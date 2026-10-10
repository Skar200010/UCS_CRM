import 'dart:convert';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../config.dart';

class ApiService {
  static const String _tokenKey = 'bill_reminder_token';
  static const String _refreshTokenKey = 'bill_reminder_refresh_token';
  static const String _lastLoginKey = 'bill_reminder_last_login';
  static const String _fcmTokenKey = 'bill_reminder_fcm_token';

  static String get baseUrl => Config.apiBaseUrl;

  /// Invoked when the stored auth token is rejected (expired/invalid) so the
  /// app can clear the session and return to the login screen instead of
  /// silently failing to load data.
  static void Function()? onUnauthorized;

  static SharedPreferences? _prefs;

  static Future<SharedPreferences> get _prefsInstance async =>
      _prefs ??= await SharedPreferences.getInstance();

  static String? _cachedToken;
  static String? _cachedRefreshToken;
  static DateTime? _accessTokenExpiry;

  /// Decodes the `exp` claim out of a JWT so we can renew the access token
  /// before the server starts rejecting it.
  static DateTime? _jwtExpiry(String token) {
    try {
      final parts = token.split('.');
      if (parts.length < 2) return null;
      final payload =
          jsonDecode(utf8.decode(base64Url.decode(base64Url.normalize(parts[1]))));
      final exp = payload is Map ? payload['exp'] : null;
      if (exp is num) {
        return DateTime.fromMillisecondsSinceEpoch(exp.toInt() * 1000);
      }
    } catch (_) {}
    return null;
  }

  static Future<void> saveToken(String token) async {
    _cachedToken = token;
    _accessTokenExpiry = _jwtExpiry(token);
    final prefs = await _prefsInstance;
    await prefs.setString(_tokenKey, token);
  }

  static Future<String?> getToken() async {
    if (_cachedToken != null) return _cachedToken;
    final prefs = await _prefsInstance;
    _cachedToken = prefs.getString(_tokenKey);
    _accessTokenExpiry =
        _cachedToken != null ? _jwtExpiry(_cachedToken!) : null;
    return _cachedToken;
  }

  static Future<void> saveRefreshToken(String token) async {
    _cachedRefreshToken = token;
    final prefs = await _prefsInstance;
    await prefs.setString(_refreshTokenKey, token);
  }

  static Future<String?> getRefreshToken() async {
    if (_cachedRefreshToken != null) return _cachedRefreshToken;
    final prefs = await _prefsInstance;
    _cachedRefreshToken = prefs.getString(_refreshTokenKey);
    return _cachedRefreshToken;
  }

  static Future<void> saveLastLogin(String login) async {
    final prefs = await _prefsInstance;
    await prefs.setString(_lastLoginKey, login);
  }

  static Future<String?> getLastLogin() async {
    final prefs = await _prefsInstance;
    return prefs.getString(_lastLoginKey);
  }

  static Future<void> saveFcmToken(String token) async {
    final prefs = await _prefsInstance;
    await prefs.setString(_fcmTokenKey, token);
  }

  static Future<String?> getFcmToken() async {
    final prefs = await _prefsInstance;
    return prefs.getString(_fcmTokenKey);
  }

  static Future<void> clearAuth() async {
    _cachedToken = null;
    _cachedRefreshToken = null;
    _accessTokenExpiry = null;
    final prefs = await _prefsInstance;
    await prefs.remove(_tokenKey);
    await prefs.remove(_refreshTokenKey);
  }

  /// Swaps the stored refresh token for a fresh short-lived access token.
  /// Returns true when a new access token was obtained and persisted.
  ///
  /// Concurrent callers share a single in-flight refresh instead of each
  /// re-hitting the endpoint, and a caller that joins mid-refresh awaits the
  /// same future rather than being told "no" (which would otherwise flash a
  /// spurious logout when several requests expire simultaneously).
  static Future<bool>? _refreshFuture;

  static Future<bool> _refreshAccessToken() {
    final inFlight = _refreshFuture;
    if (inFlight != null) return inFlight;
    _refreshFuture = _doRefresh().whenComplete(() => _refreshFuture = null);
    return _refreshFuture!;
  }

  static Future<bool> _doRefresh() async {
    final refresh = await getRefreshToken();
    if (refresh == null || refresh.isEmpty) return false;
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/auth/refresh'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'refresh_token': refresh}),
      );
      if (res.statusCode != 200) return false;
      final body = jsonDecode(res.body);
      if (body is! Map) return false;
      final token = body['token'];
      if (token is! String || token.isEmpty) return false;
      await saveToken(token);
      final newRefresh = body['refresh_token'];
      if (newRefresh is String && newRefresh.isNotEmpty) {
        await saveRefreshToken(newRefresh);
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Renews the access token shortly before it lapses so normal requests never
  /// hit a 401 in the first place. Also called at startup to recover an
  /// expired-but-refreshable session without forcing a re-login.
  static Future<void> _ensureFreshToken() async {
    final expiry = _accessTokenExpiry;
    // No `exp` claim (legacy non-expiring token) — nothing to rotate. Any
    // server-side 401 is still handled by [_send]'s refresh-and-retry.
    if (expiry == null) return;
    if (expiry.isAfter(DateTime.now().add(const Duration(minutes: 5)))) return;
    await _refreshAccessToken();
  }

  /// Called at startup so a lapsed access token never forces a logout while a
  /// refresh token is still held.
  static Future<void> ensureSession() async {
    await getToken();
    await _ensureFreshToken();
  }

  static Future<Map<String, String>> _headers() async {
    await _ensureFreshToken();
    final token = await getToken();
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  /// Runs [send] with auth headers, transparently refreshing the access token
  /// and retrying once when the server rejects it with a 401.
  static Future<http.Response> _send(
    Future<http.Response> Function(Map<String, String> headers) send, {
    bool skipRefresh = false,
  }) async {
    final res = await send(await _headers());
    if (!skipRefresh && res.statusCode == 401) {
      final refreshed = await _refreshAccessToken();
      if (refreshed) {
        return send(await _headers());
      }
    }
    return res;
  }

  static Future<void> _check(http.Response res) async {
    if (res.statusCode >= 200 && res.statusCode < 300) return;

    String message;
    try {
      final body = jsonDecode(res.body);
      message = (body is Map && body['message'] != null)
          ? body['message'].toString()
          : 'Request failed (${res.statusCode})';
    } catch (_) {
      message = 'Server error (${res.statusCode}). Please try again.';
    }

    if (res.statusCode == 401) {
      // Only treat it as an expired session when we actually had a token —
      // a 401 from the login endpoint should surface as a normal error. By the
      // time we get here the refresh attempt has already failed.
      final hadToken = (await getToken()) != null;
      if (hadToken) {
        await clearAuth();
        onUnauthorized?.call();
        throw Exception('Session expired. Please sign in again.');
      }
    }

    throw Exception(message);
  }

  static Future<Map<String, dynamic>> login(String identifier, String password) async {
    final res = await http.post(
      Uri.parse('$baseUrl/auth/worker/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'identifier': identifier,
        'password': password,
        'client': 'bill_reminder',
      }),
    );
    await _check(res);
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    final token = body['token'];
    if (token != null) await saveToken(token.toString());
    final refreshToken = body['refresh_token'];
    if (refreshToken != null) await saveRefreshToken(refreshToken.toString());
    await saveLastLogin(identifier);
    return body;
  }

  static Future<List<dynamic>> fetchReminders() async {
    final res = await _send(
      (h) => http.get(Uri.parse('$baseUrl/reminders'), headers: h),
    );
    await _check(res);
    final body = jsonDecode(res.body);
    return (body is List) ? body : (body['reminders'] ?? []);
  }

  static Future<Map<String, dynamic>?> fetchReminderById(String id) async {
    final res = await _send(
      (h) => http.get(Uri.parse('$baseUrl/reminders/$id'), headers: h),
    );
    if (res.statusCode == 404) return null;
    await _check(res);
    final body = jsonDecode(res.body);
    return body is Map<String, dynamic> ? body : null;
  }

  static Future<List<dynamic>> fetchNotifications() async {
    final res = await _send(
      (h) => http.get(Uri.parse('$baseUrl/reminders/notifications'), headers: h),
    );
    await _check(res);
    final body = jsonDecode(res.body);
    return body is List ? body : (body['notifications'] ?? []);
  }

  static Future<void> markNotificationRead(int id) async {
    final res = await _send(
      (h) =>
          http.post(Uri.parse('$baseUrl/reminders/notifications/$id'), headers: h),
    );
    await _check(res);
  }

  static Future<void> markAllNotificationsRead() async {
    final res = await _send(
      (h) => http.post(
        Uri.parse('$baseUrl/reminders/notifications/mark-all-read'),
        headers: h,
      ),
    );
    await _check(res);
  }

  static Future<void> deleteNotification(int id) async {
    final res = await _send(
      (h) =>
          http.delete(Uri.parse('$baseUrl/reminders/notifications/$id'), headers: h),
    );
    await _check(res);
  }

  static Future<Map<String, dynamic>> fetchSettings() async {
    final res = await _send(
      (h) => http.get(Uri.parse('$baseUrl/reminders/settings'), headers: h),
    );
    await _check(res);
    final body = jsonDecode(res.body);
    return body is Map<String, dynamic> ? body : <String, dynamic>{};
  }

  static Future<void> registerDeviceToken(String token) async {
    final res = await _send(
      (h) => http.post(
        Uri.parse('$baseUrl/reminders/device-token'),
        headers: h,
        body: jsonEncode({'token': token, 'device_type': 'flutter'}),
      ),
    );
    await _check(res);
    await saveFcmToken(token);
  }

  /// Resolve the current FCM token from Firebase and cache it locally.
  static Future<String?> resolveFcmToken() async {
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null && token.isNotEmpty) {
        await saveFcmToken(token);
      }
      return token;
    } catch (_) {
      return null;
    }
  }

  /// Ask the backend to send an immediate FCM test push to registered devices.
  static Future<Map<String, dynamic>> sendTestPush() async {
    final res = await _send(
      (h) => http.post(Uri.parse('$baseUrl/reminders/test-push'), headers: h),
    );
    await _check(res);
    final body = jsonDecode(res.body);
    return body is Map<String, dynamic> ? body : <String, dynamic>{};
  }

  /// Create a test reminder entry (due today) and make the backend notify
  /// devices immediately, so the full mark-as-paid flow can be exercised.
  static Future<Map<String, dynamic>> createTestEntry() async {
    final res = await _send(
      (h) => http.post(Uri.parse('$baseUrl/reminders/test-entry'), headers: h),
    );
    await _check(res);
    final body = jsonDecode(res.body);
    return body is Map<String, dynamic> ? body : <String, dynamic>{};
  }

  /// Snooze a reminder by [minutes]; the backend resumes alerts afterwards.
  static Future<void> snoozeReminder(String reminderId, int minutes) async {
    final res = await _send(
      (h) => http.post(
        Uri.parse('$baseUrl/reminders/$reminderId/snooze'),
        headers: h,
        body: jsonEncode({'minutes': minutes}),
      ),
    );
    await _check(res);
  }

  /// Mark a reminder as paid/completed on the server.
  static Future<void> completeReminder(String reminderId, {Map<String, dynamic>? body}) async {
    final res = await _send(
      (h) => http.post(
        Uri.parse('$baseUrl/reminders/$reminderId/complete'),
        headers: h,
        body: jsonEncode(body ?? const <String, dynamic>{}),
      ),
    );
    await _check(res);
  }

  /// Per-payment amount history for a reminder (each cycle can differ).
  static Future<List<dynamic>> fetchReminderPayments(String reminderId) async {
    final res = await _send(
      (h) => http.get(
        Uri.parse('$baseUrl/reminders/$reminderId/payments'),
        headers: h,
      ),
    );
    await _check(res);
    final body = jsonDecode(res.body);
    return body is List ? body : [];
  }

  /// Combined payment history across all reminders, newest first.
  static Future<List<dynamic>> fetchAllReminderPayments() async {
    final res = await _send(
      (h) => http.get(Uri.parse('$baseUrl/reminders/payments'), headers: h),
    );
    await _check(res);
    final body = jsonDecode(res.body);
    return body is List ? body : [];
  }
}
