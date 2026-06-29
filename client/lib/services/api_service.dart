import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:http/io_client.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../config.dart';

class ApiService {
  static String get baseUrl => Config.apiBaseUrl;
  static String get _host => Uri.parse(baseUrl).host;

  static const Duration _defaultTimeout = Duration(seconds: 15);
  static const Duration _connectTimeout = Duration(seconds: 10);

  // ---- DNS-over-HTTPS helpers ----
  static String? _cachedIp;
  static DateTime? _cacheExpiry;

  static Future<String> _resolveHost() async {
    if (_cachedIp != null &&
        _cacheExpiry != null &&
        DateTime.now().isBefore(_cacheExpiry!)) {
      return _cachedIp!;
    }

    final host = _host;

    // Try DoH via Cloudflare (bypasses carrier DNS)
    try {
      final dohClient = http.Client();
      try {
        final dohUrl =
            Uri.parse('https://cloudflare-dns.com/dns-query?name=$host&type=A');
        final resp = await dohClient
            .get(dohUrl, headers: {'accept': 'application/dns-json'})
            .timeout(const Duration(seconds: 5));
        if (resp.statusCode == 200) {
          final data = jsonDecode(resp.body) as Map<String, dynamic>;
          final answers = data['Answer'] as List?;
          if (answers != null) {
            for (final a in answers) {
              final record = a as Map;
              if (record['type'] == 1) {
                final ip = record['data'] as String;
                _cachedIp = ip;
                _cacheExpiry =
                    DateTime.now().add(const Duration(hours: 1));
                return ip;
              }
            }
          }
        }
      } finally {
        dohClient.close();
      }
    } catch (_) {
      // DoH failed — fall through to system DNS
    }

    // Fallback to system DNS
    final results =
        await InternetAddress.lookup(host).timeout(const Duration(seconds: 5));
    if (results.isNotEmpty) {
      _cachedIp = results[0].address;
      _cacheExpiry = DateTime.now().add(const Duration(hours: 1));
      return results[0].address;
    }

    throw Exception('Could not resolve host: $host');
  }

  static Future<IOClient> _createDohClient() async {
    final ip = await _resolveHost();
    final origHost = _host;

    final httpClient = HttpClient();
    httpClient.connectionFactory = (uri, proxyHost, proxyPort) {
      final port = uri.port;
      Future<Socket> connect() async {
        final socket = await Socket.connect(ip, port);
        if (uri.scheme == 'https') {
          return await SecureSocket.secure(socket, host: origHost);
        }
        return socket;
      }
      return Future.value(ConnectionTask.fromSocket(connect(), () {}));
    };
    return IOClient(httpClient);
  }

  static Future<bool> checkConnectivity() async {
    try {
      await _resolveHost().timeout(const Duration(seconds: 8));
      return true;
    } catch (_) {
      return false;
    }
  }

  static Future<http.Response> _get(
    Uri uri, {
    Map<String, String>? headers,
  }) async {
    final client = await _createDohClient();
    try {
      return await client.get(uri, headers: headers).timeout(_defaultTimeout);
    } finally {
      client.close();
    }
  }

  static Future<http.Response> _post(
    Uri uri, {
    Map<String, String>? headers,
    Object? body,
  }) async {
    final client = await _createDohClient();
    try {
      return await client
          .post(uri, headers: headers, body: body)
          .timeout(_defaultTimeout);
    } finally {
      client.close();
    }
  }

  static Future<http.Response> _put(
    Uri uri, {
    Map<String, String>? headers,
    Object? body,
  }) async {
    final client = await _createDohClient();
    try {
      return await client
          .put(uri, headers: headers, body: body)
          .timeout(_defaultTimeout);
    } finally {
      client.close();
    }
  }

  static Future<http.Response> _delete(
    Uri uri, {
    Map<String, String>? headers,
  }) async {
    final client = await _createDohClient();
    try {
      return await client.delete(uri, headers: headers).timeout(_defaultTimeout);
    } finally {
      client.close();
    }
  }

  static Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('worker_token');
  }

  static Future<void> saveToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('worker_token', token);
  }

  static Future<void> saveWorkerData(Map<String, dynamic> data) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('worker_data', jsonEncode(data));
  }

  static Future<Map<String, dynamic>?> getWorkerData() async {
    final prefs = await SharedPreferences.getInstance();
    final data = prefs.getString('worker_data');
    if (data != null) return jsonDecode(data);
    return null;
  }

  static Future<void> clearAuth() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('worker_token');
    await prefs.remove('worker_data');
    final keys = prefs.getKeys().where((k) => k.startsWith('cache_')).toList();
    for (final k in keys) await prefs.remove(k);
  }

  static Future<Map<String, String>> _headers() async {
    final token = await getToken();
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  static Future<Map<String, dynamic>> login(String identifier, String password) async {
    final res = await _post(
      Uri.parse('$baseUrl/auth/worker/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'identifier': identifier, 'password': password}),
    );
    try {
      final body = jsonDecode(res.body);
      if (res.statusCode != 200) throw Exception(body['message'] ?? 'Login failed');
      return body;
    } on FormatException {
      throw Exception('Server error (${res.statusCode}). Please contact admin.');
    }
  }

  static Future<Map<String, dynamic>> punchIn(String code, double lat, double lng) async {
    final res = await _post(
      Uri.parse('$baseUrl/attendance/punch-in'),
      headers: await _headers(),
      body: jsonEncode({'code': code, 'latitude': lat, 'longitude': lng}),
    );
    final body = jsonDecode(res.body);
    if (res.statusCode != 200 && res.statusCode != 201) {
      throw Exception(body['message'] ?? 'Punch in failed');
    }
    return body;
  }

  static Future<Map<String, dynamic>> punchOut(double lat, double lng) async {
    final res = await _post(
      Uri.parse('$baseUrl/attendance/punch-out'),
      headers: await _headers(),
      body: jsonEncode({'latitude': lat, 'longitude': lng}),
    );
    final body = jsonDecode(res.body);
    if (res.statusCode != 200) throw Exception(body['message'] ?? 'Punch out failed');
    return body;
  }

  static String _todayCacheKey() {
    final now = DateTime.now();
    final dateStr = '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
    return 'cache_today_status_$dateStr';
  }

  static Future<Map<String, dynamic>?> getCachedTodayStatus() async {
    final prefs = await SharedPreferences.getInstance();
    final data = prefs.getString(_todayCacheKey());
    if (data != null) return jsonDecode(data);
    return null;
  }

  static Future<void> _cacheTodayStatus(Map<String, dynamic> data) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_todayCacheKey(), jsonEncode(data));
  }

  static Future<Map<String, dynamic>> getTodayStatus() async {
    final res = await _get(
      Uri.parse('$baseUrl/attendance/today'),
      headers: await _headers(),
    );
    final body = jsonDecode(res.body);
    if (res.statusCode != 200) throw Exception('Failed to get status');
    await _cacheTodayStatus(body);
    return body;
  }

  static Future<List<dynamic>?> getCachedHistory() async {
    final prefs = await SharedPreferences.getInstance();
    final data = prefs.getString('cache_history');
    if (data != null) return jsonDecode(data);
    return null;
  }

  static Future<void> _cacheHistory(List<dynamic> data) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('cache_history', jsonEncode(data));
  }

  static Future<List<dynamic>> getHistory() async {
    final res = await _get(
      Uri.parse('$baseUrl/attendance/history'),
      headers: await _headers(),
    );
    final body = jsonDecode(res.body);
    if (res.statusCode != 200) throw Exception('Failed to get history');
    final list = body is List ? body : [];
    await _cacheHistory(list);
    return list;
  }

  static Future<Map<String, dynamic>> applyLeave(Map<String, dynamic> data) async {
    final res = await _post(
      Uri.parse('$baseUrl/leaves/apply'),
      headers: await _headers(),
      body: jsonEncode(data),
    );
    final body = jsonDecode(res.body);
    if (res.statusCode != 201) throw Exception(body['message'] ?? 'Failed to apply leave');
    return body;
  }

  static Future<Map<String, dynamic>> applyAdvance(String amount, String reason) async {
    final res = await _post(
      Uri.parse('$baseUrl/advances/apply'),
      headers: await _headers(),
      body: jsonEncode({'amount': amount, 'reason': reason}),
    );
    final body = jsonDecode(res.body);
    if (res.statusCode != 201) throw Exception(body['message'] ?? 'Failed to apply advance');
    return body;
  }

  static Future<Map<String, dynamic>?> getCachedProfile() async {
    final prefs = await SharedPreferences.getInstance();
    final data = prefs.getString('cache_profile');
    if (data != null) return jsonDecode(data);
    return null;
  }

  static Future<void> _cacheProfile(Map<String, dynamic> data) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('cache_profile', jsonEncode(data));
  }

  static Future<Map<String, dynamic>> getMyProfile() async {
    final res = await _get(
      Uri.parse('$baseUrl/workers/me'),
      headers: await _headers(),
    );
    final body = jsonDecode(res.body);
    if (res.statusCode != 200) throw Exception(body['message'] ?? 'Failed to get profile');
    await _cacheProfile(body);
    return body;
  }

  static Future<Map<String, dynamic>> updateMyProfile(Map<String, dynamic> updates) async {
    final res = await _put(
      Uri.parse('$baseUrl/workers/me'),
      headers: await _headers(),
      body: jsonEncode(updates),
    );
    final body = jsonDecode(res.body);
    if (res.statusCode != 200) throw Exception(body['message'] ?? 'Failed to update profile');
    return body;
  }

  static Future<Map<String, dynamic>> updateMyEducation(List<Map<String, dynamic>> education) async {
    final res = await _put(
      Uri.parse('$baseUrl/workers/me/education'),
      headers: await _headers(),
      body: jsonEncode({'education': education}),
    );
    final body = jsonDecode(res.body);
    if (res.statusCode != 200) throw Exception(body['message'] ?? 'Failed to update education');
    return body;
  }

  static Future<List<dynamic>> getMyLeaves() async {
    final res = await _get(
      Uri.parse('$baseUrl/leaves/my'),
      headers: await _headers(),
    );
    final body = jsonDecode(res.body);
    if (res.statusCode != 200) throw Exception('Failed to get leaves');
    return body is List ? body : [];
  }

  static Future<void> registerFcmToken(String workerId, String token) async {
    final res = await _post(
      Uri.parse('$baseUrl/notifications/register-token'),
      headers: await _headers(),
      body: jsonEncode({
        'worker_id': workerId,
        'token': token,
        'device_type': 'flutter',
      }),
    );
    if (res.statusCode != 200) {
      final body = jsonDecode(res.body);
      throw Exception(body['message'] ?? 'Failed to register FCM token');
    }
  }

  static Future<List<dynamic>?> getCachedNotifications(String workerId) async {
    final prefs = await SharedPreferences.getInstance();
    final data = prefs.getString('cache_notifications_$workerId');
    if (data != null) return jsonDecode(data);
    return null;
  }

  static Future<List<dynamic>> getNotifications(String workerId) async {
    final res = await _get(
      Uri.parse('$baseUrl/notifications/$workerId'),
      headers: await _headers(),
    );
    final body = jsonDecode(res.body);
    if (res.statusCode != 200) throw Exception('Failed to get notifications');
    final list = body is List ? body : [];
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('cache_notifications_$workerId', jsonEncode(list));
    return list;
  }

  static Future<void> deleteNotification(String id) async {
    final res = await _delete(
      Uri.parse('$baseUrl/notifications/$id'),
      headers: await _headers(),
    );
    if (res.statusCode != 200) {
      final body = jsonDecode(res.body);
      throw Exception(body['message'] ?? 'Failed to delete notification');
    }
  }

  static Future<void> markNotificationRead(String id) async {
    final res = await _put(
      Uri.parse('$baseUrl/notifications/$id/read'),
      headers: await _headers(),
    );
    if (res.statusCode != 200) {
      final body = jsonDecode(res.body);
      throw Exception(body['message'] ?? 'Failed to mark as read');
    }
  }

  static Future<int> getCachedUnreadCount(String workerId) async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getInt('cache_unread_$workerId') ?? 0;
  }

  static Future<int> getUnreadNotificationCount(String workerId) async {
    final res = await _get(
      Uri.parse('$baseUrl/notifications/$workerId/unread-count'),
      headers: await _headers(),
    );
    final body = jsonDecode(res.body);
    if (res.statusCode != 200) throw Exception('Failed to get unread count');
    final count = (body['count'] ?? 0) as int;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt('cache_unread_$workerId', count);
    return count;
  }

  static Future<void> sendTestNotification(String workerId) async {
    final res = await _post(
      Uri.parse('$baseUrl/notifications/test-send'),
      headers: await _headers(),
      body: jsonEncode({'worker_id': workerId}),
    );
    final body = jsonDecode(res.body);
    if (res.statusCode != 200) throw Exception(body['message'] ?? 'Failed to send test notification');
  }

  // ---- Onboarding API ----

  static Future<Map<String, dynamic>> checkOnboardingStatus() async {
    final res = await _get(
      Uri.parse('$baseUrl/onboarding/status'),
      headers: await _headers(),
    );
    final body = jsonDecode(res.body);
    if (res.statusCode != 200) throw Exception('Failed to check onboarding status');
    return body;
  }

  static Future<List<dynamic>> getOnboardingPolicies() async {
    final res = await _get(
      Uri.parse('$baseUrl/onboarding/policies'),
      headers: await _headers(),
    );
    final body = jsonDecode(res.body);
    if (res.statusCode != 200) throw Exception('Failed to get policies');
    return body is List ? body : [];
  }

  static Future<Map<String, dynamic>> uploadPhoto(String base64Photo, String mimeType) async {
    final res = await _post(
      Uri.parse('$baseUrl/onboarding/upload-photo'),
      headers: await _headers(),
      body: jsonEncode({'photo_base64': base64Photo, 'mime_type': mimeType}),
    );
    final body = jsonDecode(res.body);
    if (res.statusCode != 200) throw Exception(body['message'] ?? 'Failed to upload photo');
    return body;
  }

  static Future<Map<String, dynamic>> uploadDocument(String documentType, String fileBase64, String mimeType) async {
    final res = await _post(
      Uri.parse('$baseUrl/onboarding/upload-document'),
      headers: await _headers(),
      body: jsonEncode({'document_type': documentType, 'file_base64': fileBase64, 'mime_type': mimeType}),
    );
    final body = jsonDecode(res.body);
    if (res.statusCode != 200) throw Exception(body['message'] ?? 'Failed to upload document');
    return body;
  }

  static Future<Map<String, dynamic>> submitOnboarding({
    required Map<String, dynamic> personalDetails,
    required List<Map<String, dynamic>> education,
    required List<Map<String, dynamic>> family,
    required List<Map<String, dynamic>> references,
    List<Map<String, dynamic>> previousOrganizations = const [],
  }) async {
    final res = await _post(
      Uri.parse('$baseUrl/onboarding/submit'),
      headers: await _headers(),
      body: jsonEncode({
        'personal_details': personalDetails,
        'education': education,
        'family': family,
        'references': references,
        'previous_organizations': previousOrganizations,
      }),
    );
    final body = jsonDecode(res.body);
    if (res.statusCode != 200) throw Exception(body['message'] ?? 'Failed to submit onboarding');
    return body;
  }

  static Future<Map<String, dynamic>> getPrintProfile() async {
    final res = await _get(
      Uri.parse('$baseUrl/onboarding/print-profile'),
      headers: await _headers(),
    );
    final body = jsonDecode(res.body);
    if (res.statusCode != 200) throw Exception('Failed to get print profile');
    return body;
  }

  // ---- Salary / Expense Breakdown API ----

  static Future<Map<String, dynamic>?> getMySalaryBreakdown() async {
    try {
      final res = await _get(
        Uri.parse('$baseUrl/salary/my-breakdown'),
        headers: await _headers(),
      );
      if (res.statusCode != 200) return null;
      final body = jsonDecode(res.body);
      return body;
    } catch (_) {
      return null;
    }
  }

  // ---- Calendar API ----

  static Future<Map<String, dynamic>> getCalendar({int? year, int? month}) async {
    final now = DateTime.now();
    final y = year ?? now.year;
    final m = month ?? now.month;
    final res = await _get(
      Uri.parse('$baseUrl/calendar?year=$y&month=$m'),
      headers: await _headers(),
    );
    final body = jsonDecode(res.body);
    if (res.statusCode != 200) throw Exception('Failed to get calendar data');
    return body;
  }
}
