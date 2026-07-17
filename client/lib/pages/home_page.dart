import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/api_service.dart';
import '../services/realtime_service.dart';
import '../services/geofence_service.dart';
import '../widgets/skeleton_loader.dart';
import '../main.dart';

import 'scanner_page.dart';
import 'leave_page.dart';
import 'attendance_list_page.dart';
import 'advance_page.dart';

class HomePage extends StatefulWidget {
  final int tabChangeVersion;
  const HomePage({super.key, required this.tabChangeVersion});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> with SingleTickerProviderStateMixin {
  final ScrollController _scrollController = ScrollController();
  final GeofenceService _geofence = GeofenceService();
  Timer? _clockTimer;
  DateTime _now = DateTime.now();
  DateTime? _punchInTime;
  DateTime? _punchOutTime;
  String _workedDisplay = '00:00:00';
  bool _isPunchedIn = false;
  bool _isPunchedOut = false;
  bool _loading = true;
  bool _isPressing = false;
  int _lateUsed = 0;
  int _present = 0, _absent = 0, _late = 0, _leave = 0;
  String _workerName = '';
  String _workerId = '';
  String _officeStartTime = '10:00';
  late final AnimationController _pulseCtrl;
  late final Animation<double> _pulseAnim;
  String _officeEndTime = '19:00';
  List<Map<String, dynamic>> _notifications = [];
  int _unreadCount = 0;

  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat();
    _pulseAnim = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeOut),
    );
    _clockTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      setState(() => _now = DateTime.now());
      if (_isPunchedIn && !_isPunchedOut) {
        _updateWorked();
      }
    });
    _geofence.addListener(_onGeofenceChange);
    _fetchStatus();
  }

  @override
  void didUpdateWidget(covariant HomePage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.tabChangeVersion != oldWidget.tabChangeVersion) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scrollController.hasClients) _scrollController.jumpTo(0);
      });
    }
  }

  @override
  void dispose() {
    _geofence.removeListener(_onGeofenceChange);
    _clockTimer?.cancel();
    _scrollController.dispose();
    _pulseCtrl.dispose();
    super.dispose();
  }

  void _updateWorked() {
    if (_punchInTime == null) return;
    final end = _punchOutTime ?? DateTime.now();
    final diff = end.difference(_punchInTime!);
    final h = diff.inHours.toString().padLeft(2, '0');
    final m = (diff.inMinutes % 60).toString().padLeft(2, '0');
    final s = (diff.inSeconds % 60).toString().padLeft(2, '0');
    _workedDisplay = '$h:$m:$s';
  }

  Future<void> _fetchStatus() async {
    try {
      final worker = await ApiService.getWorkerData();
      _workerName = worker?['name'] ?? '';
      _workerId = worker?['id']?.toString() ?? '';

      if (_workerId.isNotEmpty) {
        try {
          RealtimeService.instance.init(_workerId);
        } catch (_) {}
      }
      RealtimeService.instance.removeListener(_onRealtimeChange);
      RealtimeService.instance.addListener(_onRealtimeChange);

      // Load cached data instantly
      try {
        final cachedStatus = await ApiService.getCachedTodayStatus();
        if (cachedStatus != null) _applyTodayStatus(cachedStatus);
      } catch (_) {}

      try {
        final cachedHistory = await ApiService.getCachedHistory();
        if (cachedHistory != null) {
          int p = 0, a = 0, l = 0, lv = 0;
          for (final rec in cachedHistory) {
            switch (rec['status']?.toString() ?? '') {
              case 'present': p++; break;
              case 'absent': a++; break;
              case 'late': l++; p++; break;
              case 'leave': lv++; break;
            }
          }
          setState(() { _present = p; _absent = a; _late = l; _leave = lv; });
        }
      } catch (_) {}

      try {
        if (_workerId.isNotEmpty) {
          final cachedNotifs = await ApiService.getCachedNotifications(_workerId);
          final cachedUnread = await ApiService.getCachedUnreadCount(_workerId);
          if (cachedNotifs != null) {
            setState(() {
              _notifications = cachedNotifs.cast<Map<String, dynamic>>();
              _unreadCount = cachedUnread;
            });
          }
        }
      } catch (_) {}
    } catch (_) {}

    if (mounted) setState(() => _loading = false);

    try {
      final res = await Future.wait([
        ApiService.getTodayStatus(),
        ApiService.getHistory(),
      ]);
      final today = res[0] as Map<String, dynamic>;
      final history = res[1] as List<dynamic>;

      _officeStartTime = (today['officeStartTime'] ?? '10:00') as String;
      _officeEndTime = (today['officeEndTime'] ?? '19:00') as String;

      final att = today['attendance'];
      if (mounted) {
        setState(() {
          _lateUsed = today['lateUsed'] ?? 0;
          if (att != null) {
            _isPunchedIn = att['punch_in_time'] != null;
            _isPunchedOut = att['punch_out_time'] != null;
            _punchInTime = att['punch_in_time'] != null
                ? DateTime.tryParse(att['punch_in_time'].toString())
                : null;
            _punchOutTime = att['punch_out_time'] != null
                ? DateTime.tryParse(att['punch_out_time'].toString())
                : null;
            if (_isPunchedIn && !_isPunchedOut) {
              _updateWorked();
              _geofence.start();
            }
            if (_isPunchedOut && _punchInTime != null && _punchOutTime != null) {
              final diff = _punchOutTime!.difference(_punchInTime!);
              final h = diff.inHours.toString().padLeft(2, '0');
              final m = (diff.inMinutes % 60).toString().padLeft(2, '0');
              final s = (diff.inSeconds % 60).toString().padLeft(2, '0');
              _workedDisplay = '$h:$m:$s';
            }
          }
        });
      }
      int p = 0, a = 0, l = 0, lv = 0;
      for (final rec in history) {
        final s = rec['status']?.toString() ?? '';
        if (s == 'present') {
          p++;
        } else if (s == 'absent') {
          a++;
        } else if (s == 'late') {
          l++;
          p++;
        } else if (s == 'leave') {
          lv++;
        }
      }
      if (mounted) {
        setState(() {
          _present = p;
          _absent = a;
          _late = l;
          _leave = lv;
        });
      }
    } catch (_) {}

    try {
      if (_workerId.isNotEmpty) {
        final notifs = await ApiService.getNotifications(_workerId);
        final unread = await ApiService.getUnreadNotificationCount(_workerId);
        if (mounted) {
          setState(() {
            _notifications = notifs.cast<Map<String, dynamic>>();
            _unreadCount = unread;
          });
        }
      }
    } catch (_) {}
  }

  void _applyTodayStatus(Map<String, dynamic> today) {
    final att = today['attendance'];
    setState(() {
      _officeStartTime = (today['officeStartTime'] ?? '10:00') as String;
      _officeEndTime = (today['officeEndTime'] ?? '19:00') as String;
      _lateUsed = today['lateUsed'] ?? 0;
      if (att != null) {
        _isPunchedIn = att['punch_in_time'] != null;
        _isPunchedOut = att['punch_out_time'] != null;
        _punchInTime = att['punch_in_time'] != null
            ? DateTime.tryParse(att['punch_in_time'].toString())
            : null;
        _punchOutTime = att['punch_out_time'] != null
            ? DateTime.tryParse(att['punch_out_time'].toString())
            : null;
        if (_isPunchedIn && !_isPunchedOut) _updateWorked();
        if (_isPunchedOut && _punchInTime != null && _punchOutTime != null) {
          final diff = _punchOutTime!.difference(_punchInTime!);
          final h = diff.inHours.toString().padLeft(2, '0');
          final m = (diff.inMinutes % 60).toString().padLeft(2, '0');
          final s = (diff.inSeconds % 60).toString().padLeft(2, '0');
          _workedDisplay = '$h:$m:$s';
        }
      }
    });
  }

  Future<bool> _requestLocationPermission() async {
    bool service = await Geolocator.isLocationServiceEnabled();
    if (!service) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: const Text('Please enable GPS location'), backgroundColor: Colors.red.shade700),
        );
      }
      return false;
    }
    LocationPermission perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) {
      perm = await Geolocator.requestPermission();
      if (perm == LocationPermission.denied) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: const Text('Location permission is required to punch in/out'), backgroundColor: Colors.red.shade700),
          );
        }
        return false;
      }
    }
    if (perm == LocationPermission.deniedForever) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: const Text('Location permission permanently denied. Enable it in app settings.'), backgroundColor: Colors.red.shade700),
        );
      }
      return false;
    }
    return true;
  }

  Future<void> _punchIn() async {
    if (!await _requestLocationPermission()) return;

    // Check connectivity first
    final online = await ApiService.checkConnectivity();
    if (!online && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('No internet connection. Please check your network.'),
          backgroundColor: Colors.red,
          duration: Duration(seconds: 3),
        ),
      );
      return;
    }

    final result = await Navigator.push<Map<String, dynamic>>(
      context,
      MaterialPageRoute(builder: (_) => const ScannerPage()),
    );
    if (result == null || !mounted) return;

    try {
      final data = await ApiService.punchIn(
        result['code'] ?? '',
        (result['lat'] as num).toDouble(),
        (result['lng'] as num).toDouble(),
        dailyCode: result['dailyCode'] as String?,
        punchMethod: result['punch_method'] as String?,
      );
      final lm = (data['lateMinutes'] ?? 0) as int;
      setState(() {
        _isPunchedIn = true;
        _punchInTime = DateTime.now();
        _isPunchedOut = false;
        _punchOutTime = null;
        if (lm > 0) _lateUsed += lm;
        _updateWorked();
      });
      _geofence.start();
      if (mounted) {
        HapticFeedback.vibrate();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Punched in successfully'),
            backgroundColor: const Color(0xFF10b981),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        final msg = _friendlyNetworkError(e);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(msg),
            backgroundColor: Colors.red.shade700,
          ),
        );
      }
    }
  }

  Future<void> _punchOut() async {
    if (!await _requestLocationPermission()) return;

    // Check connectivity first
    final online = await ApiService.checkConnectivity();
    if (!online && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('No internet connection. Please check your network.'),
          backgroundColor: Colors.red,
          duration: Duration(seconds: 3),
        ),
      );
      return;
    }

    final result = await Navigator.push<Map<String, dynamic>>(
      context,
      MaterialPageRoute(builder: (_) => ScannerPage(delaySeconds: 60)),
    );
    if (result == null || !mounted) return;

    try {
      await ApiService.punchOut(
        (result['lat'] as num).toDouble(),
        (result['lng'] as num).toDouble(),
        punchMethod: result['punch_method'] as String?,
      );
      setState(() {
        _isPunchedOut = true;
        _punchOutTime = DateTime.now();
        _updateWorked();
      });
      _geofence.stop();
      if (mounted) {
        HapticFeedback.vibrate();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Punched out successfully'),
            backgroundColor: const Color(0xFF10b981),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        final msg = _friendlyNetworkError(e);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(msg),
            backgroundColor: Colors.red.shade700,
          ),
        );
      }
    }
  }

  void _onGeofenceChange() {
    if (!mounted) return;
    if (_geofence.autoPunchedOut) {
      _geofence.resetAutoPunchedOut();
      _fetchStatus();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Auto punch-out: you were outside the work area for over 4 hours.'),
            backgroundColor: Color(0xFFd97706),
            duration: Duration(seconds: 5),
          ),
        );
      }
    } else {
      setState(() {});
    }
  }

  void _onRealtimeChange() {
    final event = RealtimeService.instance.lastEvent;
    if (event == null) return;
    switch (event) {
      case RealtimeEvent.attendance:
      case RealtimeEvent.notifications:
        _fetchStatus();
      default:
        break;
    }
  }

  String _friendlyNetworkError(Object e) {
    final s = e.toString();
    if (s.contains('SocketException') || s.contains('Connection refused') || s.contains('No route to host')) {
      return 'Network unreachable. Please check your internet connection.';
    }
    if (s.contains('TimeoutException') || s.contains('timed out')) {
      return 'Request timed out. Please try again.';
    }
    if (s.contains('FormatException') || s.contains('json')) {
      return 'Server error. Please try again later.';
    }
    return s.replaceFirst('Exception: ', '').trim();
  }

  String _fmtTime(dynamic ts) {
    if (ts == null) return '—';
    if (ts is DateTime) return DateFormat('hh:mm a').format(ts.toLocal());
    String s = ts.toString();
    if (!s.endsWith('Z') && !RegExp(r'[+-]\d{2}:\d{2}$').hasMatch(s)) s += 'Z';
    final t = DateTime.tryParse(s);
    if (t == null) return '—';
    return DateFormat('hh:mm a').format(t.toLocal());
  }

  void _openLeaveSheet() {
    final sc = Theme.of(context).colorScheme;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => SizedBox(
        height: MediaQuery.of(context).size.height * 0.85,
        child: Container(
          decoration: BoxDecoration(
            color: sc.surface,
            borderRadius: BorderRadius.vertical(top: Radius.circular(8)),
          ),
          child: LeavePage(),
        ),
      ),
    );
  }

  void _openNotificationSheet() {
    final scheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _NotificationSheet(
        notifications: _notifications,
        unreadCount: _unreadCount,
        workerId: _workerId,
        scheme: scheme,
        textTheme: textTheme,
        onMarkRead: (id) async {
          try {
            await ApiService.markNotificationRead(id);
            final idx = _notifications.indexWhere((n) => n['id'] == id);
            if (idx != -1) {
              setState(() {
                _notifications[idx]['read_at'] = DateTime.now().toIso8601String();
                _unreadCount = _notifications.where((n) => n['read_at'] == null).length;
              });
            }
          } catch (_) {}
        },
        onDelete: (id) async {
          try {
            await ApiService.deleteNotification(id);
          } catch (e) {
            debugPrint('deleteNotification error: $e');
          }
          setState(() {
            _notifications.removeWhere((n) => n['id'] == id);
            _unreadCount = _notifications.where((n) => n['read_at'] == null).length;
          });
        },
        onRefresh: () async {
          if (_workerId.isNotEmpty) {
            try {
              final notifs = await ApiService.getNotifications(_workerId);
              final unread = await ApiService.getUnreadNotificationCount(_workerId);
              setState(() {
                _notifications = notifs.cast<Map<String, dynamic>>();
                _unreadCount = unread;
              });
            } catch (_) {}
          }
        },
      ),
    );
  }

  double get _attendanceRate {
    final total = _present + _absent + _late + _leave;
    if (total == 0) return 0;
    return (_present + _late) / total;
  }

  int get _lateTier {
    if (_lateUsed <= 180) return 0;
    if (_lateUsed <= 240) return 1;
    if (_lateUsed <= 480) return 2;
    return 3;
  }

  Color get _lateTierColor {
    switch (_lateTier) {
      case 0: return const Color(0xFF2a6a4b);
      case 1: return const Color(0xFFe67e22);
      case 2: return const Color(0xFFd35400);
      case 3: return const Color(0xFFba1a1a);
      default: return const Color(0xFFc28228);
    }
  }

  String get _lateTierLabel {
    switch (_lateTier) {
      case 0: return 'Within grace limit';
      case 1: return 'Half-day deduction';
      case 2: return 'One-day deduction';
      case 3: return 'Proportional deduction';
      default: return '';
    }
  }

  double get _lateProgressMax {
    switch (_lateTier) {
      case 0: return 180;
      case 1: return 240;
      case 2: return 480;
      case 3: return 480;
      default: return 180;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const HomeSkeleton();

    final sc = Theme.of(context).colorScheme;
    final colors = Theme.of(context).extension<AppColors>()!;

    final clockStr = DateFormat('hh:mm a').format(_now);
    final firstName = _workerName.split(' ').first;

    return Scaffold(
      backgroundColor: sc.surface,
      body: SafeArea(
        child: CustomScrollView(
          controller: _scrollController,
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'HELLO THERE',
                            style: TextStyle(
                              fontSize: 12, fontWeight: FontWeight.w600, letterSpacing: 0.05,
                              color: const Color(0xFF00152a),
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            firstName.isNotEmpty ? firstName : 'there',
                            style: GoogleFonts.hankenGrotesk(
                              fontSize: 24,
                              fontWeight: FontWeight.w700,
                              height: 32 / 24,
                              color: sc.onSurface,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Stack(
                      children: [
                        Container(
                          width: 48,
                          height: 48,
                          decoration: BoxDecoration(
                            color: colors.surfaceContainerLow,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: colors.outline),
                          ),
                          child: IconButton(
                            icon: const Icon(Icons.notifications_outlined),
                            iconSize: 22,
                            color: sc.onSurfaceVariant,
                            onPressed: _openNotificationSheet,
                          ),
                        ),
                        if (_unreadCount > 0)
                          Positioned(
                            top: 4,
                            right: 4,
                            child: Container(
                              padding: const EdgeInsets.all(4),
                              decoration: BoxDecoration(
                                color: const Color(0xFFba1a1a),
                                shape: BoxShape.circle,
                              ),
                              constraints: const BoxConstraints(
                                minWidth: 18,
                                minHeight: 18,
                              ),
                              child: Text(
                                '$_unreadCount',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                ),
                                textAlign: TextAlign.center,
                              ),
                            ),
                    ),
                    const SizedBox(height: 16),
                  ],
                    ),
                  ],
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: sc.surface,
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: colors.outline),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'SHIFT',
                            style: TextStyle(
                              fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.05,
                              color: sc.outline,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            '$_officeStartTime – $_officeEndTime',
                            style: TextStyle(
                              fontSize: 14, fontWeight: FontWeight.w600,
                              color: sc.onSurface,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 32),
                    Text(
                      clockStr,
                      style: GoogleFonts.hankenGrotesk(
                        fontSize: 64,
                        fontWeight: FontWeight.w800,
                        height: 64 / 64,
                        letterSpacing: -1.5,
                        color: sc.onSurface,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFbfdbfe).withValues(alpha: 0.3),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.access_time, size: 18, color: const Color(0xFF1d4ed8)),
                          const SizedBox(width: 6),
                          Text(
                            '$_workedDisplay',
                            style: TextStyle(
                              fontSize: 14, fontWeight: FontWeight.w500,
                              color: const Color(0xFF1d4ed8),
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (_geofence.isOutside) ...[
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                        decoration: BoxDecoration(
                          color: const Color(0xFFf59e0b).withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFf59e0b).withValues(alpha: 0.4)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.warning_amber_rounded, size: 18, color: Color(0xFFd97706)),
                            const SizedBox(width: 8),
                            Text(
                              _geofence.remainingHours != null
                                  ? 'Outside work area · ${_geofence.remainingHours!.toStringAsFixed(1)}h until auto punch-out'
                                  : 'Outside work area',
                              style: GoogleFonts.manrope(
                                fontSize: 13, fontWeight: FontWeight.w600,
                                color: const Color(0xFF92400e),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                      const SizedBox(height: 40),
                    if (_isPunchedOut)
                      Column(
                        children: [
                          Icon(Icons.check_circle, size: 72, color: const Color(0xFF2563eb)),
                          const SizedBox(height: 12),
                          Text('Today completed', style: GoogleFonts.hankenGrotesk(
                            fontSize: 18, fontWeight: FontWeight.w600, color: sc.onSurface,
                          )),
                        ],
                      )
                    else
                      SizedBox(
                        width: 192,
                        height: 192,
                        child: Stack(
                          alignment: Alignment.center,
                          children: [
                            for (final i in [0, 1, 2])
                              AnimatedBuilder(
                                animation: _pulseAnim,
                                builder: (context, child) {
                                  final phase = i * 0.33;
                                  final t = (_pulseAnim.value + phase) % 1.0;
                                  final scale = 1.0 + t * 0.6;
                                  final opacity = (1.0 - t) * 0.2;
                                  return Transform.scale(
                                    scale: scale,
                                    child: Opacity(
                                      opacity: opacity,
                                      child: Container(
                                        width: 192,
                                        height: 192,
                                        decoration: BoxDecoration(
                                          shape: BoxShape.circle,
                                          border: Border.all(
                                            color: _isPunchedIn
                                                ? const Color(0xFF2563eb).withValues(alpha: 0.5)
                                                : const Color(0xFF00152a).withValues(alpha: 0.5),
                                            width: 2,
                                          ),
                                        ),
                                      ),
                                    ),
                                  );
                                },
                              ),
                            AnimatedScale(
                              scale: _isPressing ? 0.92 : 1.0,
                              duration: const Duration(milliseconds: 100),
                              child: GestureDetector(
                              onTap: _isPunchedIn ? _punchOut : _punchIn,
                              onTapDown: (_) => setState(() => _isPressing = true),
                              onTapUp: (_) => setState(() => _isPressing = false),
                              onTapCancel: () => setState(() => _isPressing = false),
                              child: Container(
                                width: 192,
                                height: 192,
                                decoration: BoxDecoration(
                                  gradient: LinearGradient(
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                    colors: _isPunchedIn
                                        ? [const Color(0xFF2563eb), const Color(0xFF1e40af)]
                                        : [const Color(0xFF00152a), const Color(0xFF102a43)],
                                  ),
                                  borderRadius: BorderRadius.circular(100),
                                  boxShadow: [
                                    BoxShadow(
                                      color: _isPunchedIn
                                          ? const Color(0xFF2563eb).withValues(alpha: 0.4)
                                          : const Color(0xFF00152a).withValues(alpha: 0.4),
                                      blurRadius: 40,
                                      offset: const Offset(0, 20),
                                    ),
                                  ],
                                ),
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(
                                      _isPunchedIn ? Icons.exit_to_app : Icons.qr_code_scanner,
                                      size: 48,
                                      color: Colors.white,
                                    ),
                                    const SizedBox(height: 8),
                                    Text(
                                      _isPunchedIn ? 'Punch Out' : 'Punch In',
                                      style: const TextStyle(
                                        fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: 1.5,
                                        color: Colors.white,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                          ],
                        ),
                      ),
                    const SizedBox(height: 40),
                    Row(
                      children: [
                        Expanded(
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
                            decoration: BoxDecoration(
                              color: sc.surface,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: colors.outline),
                            ),
                            child: Column(
                              children: [
                                Text(
                                  'IN',
                                  style: TextStyle(
                                    fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1.0,
                                    color: sc.outline,
                                  ),
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  _fmtTime(_punchInTime),
                                  style: GoogleFonts.hankenGrotesk(
                                    fontSize: 20,
                                    fontWeight: FontWeight.w700,
                                    color: sc.onSurface,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
                            decoration: BoxDecoration(
                              color: sc.surface,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: colors.outline),
                            ),
                            child: Column(
                              children: [
                                Text(
                                  'OUT',
                                  style: TextStyle(
                                    fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1.0,
                                    color: sc.outline,
                                  ),
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  _fmtTime(_punchOutTime),
                                  style: GoogleFonts.hankenGrotesk(
                                    fontSize: 20,
                                    fontWeight: FontWeight.w700,
                                    color: sc.onSurface,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Column(
                  children: [
                    const SizedBox(height: 24),
                    IntrinsicHeight(
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Expanded(
                            child: GestureDetector(
                              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AttendanceListPage())),
                              child: Container(
                                padding: const EdgeInsets.all(16),
                                decoration: BoxDecoration(
                                  color: sc.surface,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: colors.outline),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Container(
                                          width: 36, height: 36,
                                          decoration: BoxDecoration(
                                            color: const Color(0xFF2563eb).withValues(alpha: 0.1),
                                            borderRadius: BorderRadius.circular(8),
                                          ),
                                          child: Icon(Icons.event_available, size: 20, color: const Color(0xFF2563eb)),
                                        ),
                                        const Spacer(),
                                        Icon(Icons.chevron_right, size: 18, color: sc.onSurfaceVariant),
                                      ],
                                    ),
                                    const SizedBox(height: 16),
                                    Row(
                                      crossAxisAlignment: CrossAxisAlignment.end,
                                      children: [
                                        Text(
                                          '${(_attendanceRate * 100).toStringAsFixed(0)}%',
                                          style: GoogleFonts.hankenGrotesk(
                                            fontSize: 28, fontWeight: FontWeight.w800, color: sc.onSurface,
                                          ),
                                        ),
                                        const SizedBox(width: 6),
                                        Padding(
                                          padding: const EdgeInsets.only(bottom: 4),
                                          child: Text(
                                            'Attendance',
                                            style: TextStyle(
                                              fontSize: 11, fontWeight: FontWeight.w500,
                                              color: sc.outline,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 10),
                                    ClipRRect(
                                      borderRadius: BorderRadius.circular(2),
                                      child: LinearProgressIndicator(
                                        value: _attendanceRate,
                                        backgroundColor: const Color(0xFFe0e4ea),
                                        valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF2563eb)),
                                        minHeight: 4,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Container(
                                padding: const EdgeInsets.all(16),
                                decoration: BoxDecoration(
                                  color: sc.surface,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: colors.outline),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Container(
                                          width: 36, height: 36,
                                          decoration: BoxDecoration(
                                            color: _lateTierColor.withValues(alpha: 0.1),
                                            borderRadius: BorderRadius.circular(8),
                                          ),
                                          child: Icon(Icons.access_time, size: 20, color: _lateTierColor),
                                        ),
                                        const Spacer(),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: _lateTierColor.withValues(alpha: 0.12),
                                            borderRadius: BorderRadius.circular(3),
                                          ),
                                          child: Text(
                                            _lateTierLabel,
                                            style: TextStyle(
                                              fontSize: 9, fontWeight: FontWeight.w700,
                                              color: _lateTierColor,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 16),
                                    Row(
                                      crossAxisAlignment: CrossAxisAlignment.end,
                                      children: [
                                        Text(
                                          '${_lateUsed ~/ 60}:${(_lateUsed % 60).toString().padLeft(2, '0')}h',
                                          style: GoogleFonts.hankenGrotesk(
                                            fontSize: 28, fontWeight: FontWeight.w800, color: _lateTierColor,
                                          ),
                                        ),
                                        const SizedBox(width: 6),
                                        Padding(
                                          padding: const EdgeInsets.only(bottom: 4),
                                          child: Text(
                                            'Late batch',
                                            style: TextStyle(
                                              fontSize: 11, fontWeight: FontWeight.w500,
                                              color: sc.outline,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 10),
                                    ClipRRect(
                                      borderRadius: BorderRadius.circular(2),
                                      child: LinearProgressIndicator(
                                        value: (_lateUsed / _lateProgressMax).clamp(0.0, 1.0),
                                        backgroundColor: const Color(0xFFe0e4ea),
                                        valueColor: AlwaysStoppedAnimation<Color>(_lateTierColor),
                                        minHeight: 4,
                                      ),
                                    ),
                                  ],
                                ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 24, 16, 80),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: sc.surface,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: colors.outline),
                      ),
                      child: InkWell(
                        onTap: _openLeaveSheet,
                        child: Row(
                          children: [
                            Container(
                              width: 48, height: 48,
                              decoration: BoxDecoration(
                                color: const Color(0xFFd1e4ff),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: const Icon(Icons.auto_awesome, size: 22, color: Color(0xFF00152a)),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('New Request', style: GoogleFonts.hankenGrotesk(
                                    fontSize: 16, fontWeight: FontWeight.w600, color: sc.onSurface,
                                  )),
                                  Text('Take a break or leave', style: TextStyle(
                                    fontSize: 12, fontWeight: FontWeight.w500,
                                    color: sc.onSurfaceVariant,
                                  )),
                                ],
                              ),
                            ),
                            Icon(Icons.chevron_right, size: 20, color: sc.outline),
                            ],
                           ),
                          ),
                        ),
                      const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: sc.surface,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: colors.outline),
                      ),
                      child: InkWell(
                        onTap: () => showModalBottomSheet(
                          context: context,
                          isScrollControlled: true,
                          backgroundColor: Colors.transparent,
                          builder: (_) => SizedBox(
                            height: MediaQuery.of(context).size.height * 0.85,
                            child: Container(
                                decoration: BoxDecoration(
                                  color: sc.surface,
                                  borderRadius: BorderRadius.vertical(top: Radius.circular(8)),
                                ),
                                child: AdvancePage(),
                              ),
                          ),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 48, height: 48,
                              decoration: BoxDecoration(
                                color: const Color(0xFFbfdbfe),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: const Icon(Icons.account_balance_wallet, size: 22, color: Color(0xFF2563eb)),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('Apply for Advance / Loan', style: GoogleFonts.hankenGrotesk(
                                    fontSize: 16, fontWeight: FontWeight.w600, color: sc.onSurface,
                                  )),
                                  Text('Request salary advance or loan', style: TextStyle(
                                    fontSize: 12, fontWeight: FontWeight.w500,
                                    color: sc.onSurfaceVariant,
                                  )),
                                ],
                              ),
                            ),
                            Icon(Icons.chevron_right, size: 20, color: sc.outline),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

IconData _notifIcon(String? type) {
  switch (type) {
    case 'birthday':
      return Icons.cake;
    case 'event':
      return Icons.event;
    case 'notice':
      return Icons.campaign;
    case 'achievement':
      return Icons.emoji_events;
    default:
      return Icons.notifications;
  }
}

Color _notifColor(String? type, ColorScheme sc) {
  switch (type) {
    case 'birthday':
      return const Color(0xFFf43f5e);
    case 'event':
      return const Color(0xFF2563eb);
    case 'notice':
      return const Color(0xFF00152a);
    case 'achievement':
      return const Color(0xFFf59e0b);
    default:
      return sc.onSurfaceVariant;
  }
}

class _NotificationSheet extends StatefulWidget {
  final List<Map<String, dynamic>> notifications;
  final int unreadCount;
  final String workerId;
  final ColorScheme scheme;
  final TextTheme textTheme;
  final Function(String id) onMarkRead;
  final Function(String id) onDelete;
  final VoidCallback? onRefresh;

  const _NotificationSheet({
    required this.notifications,
    required this.unreadCount,
    required this.workerId,
    required this.scheme,
    required this.textTheme,
    required this.onMarkRead,
    required this.onDelete,
    this.onRefresh,
  });

  @override
  State<_NotificationSheet> createState() => _NotificationSheetState();
}

class _NotificationSheetState extends State<_NotificationSheet> {
  late List<Map<String, dynamic>> _items;
  @override
  void initState() {
    super.initState();
    _items = List.from(widget.notifications);
  }

  @override
  Widget build(BuildContext context) {
    final sc = Theme.of(context).colorScheme;
    final colors = Theme.of(context).extension<AppColors>()!;
    return SizedBox(
      height: MediaQuery.of(context).size.height * 0.85,
      child: Container(
        decoration: BoxDecoration(
          color: sc.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(8)),
        ),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 24),
                decoration: BoxDecoration(
                  color: const Color(0xFFdfe3e7),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: const Color(0xFFd1e4ff),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Icon(Icons.notifications_active, color: Color(0xFF00152a), size: 22),
                ),
                const SizedBox(width: 16),
                Text(
                  'Notifications',
                  style: GoogleFonts.hankenGrotesk(
                    fontSize: 20,
                    fontWeight: FontWeight.w600,
                    color: sc.onSurface,
                  ),
                ),
                const Spacer(),
                if (_items.isNotEmpty)
                  Text(
                    '${widget.unreadCount} unread',
                    style: TextStyle(
                      fontSize: 12, fontWeight: FontWeight.w600,
                      color: sc.onSurfaceVariant,
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 24),
            if (_items.isEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 40),
                child: Center(
                  child: Column(
                    children: [
                      Icon(Icons.notifications_off, size: 48, color: sc.outline.withValues(alpha: 0.3)),
                      const SizedBox(height: 12),
                      Text('No notifications yet', style: TextStyle(
                        fontSize: 14, color: sc.outline.withValues(alpha: 0.6),
                      )),
                    ],
                  ),
                ),
              )
            else
              ..._items.asMap().entries.map((entry) {
                final i = entry.key;
                final n = entry.value;
                final isLast = i == _items.length - 1;
                final isRead = n['read_at'] != null;
                return Column(
                  children: [
                    Dismissible(
                      key: ValueKey('notif_${n['id']}'),
                      direction: DismissDirection.horizontal,
                      background: Container(
                        alignment: Alignment.centerLeft,
                        padding: const EdgeInsets.only(left: 16),
                        decoration: BoxDecoration(
                          color: const Color(0xFF2563eb),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.done_all, color: Colors.white, size: 20),
                            SizedBox(width: 8),
                            Text('Read', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13)),
                          ],
                        ),
                      ),
                      secondaryBackground: Container(
                        alignment: Alignment.centerRight,
                        padding: const EdgeInsets.only(right: 16),
                        decoration: BoxDecoration(
                          color: const Color(0xFFba1a1a),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text('Delete', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13)),
                            SizedBox(width: 8),
                            Icon(Icons.delete_outline, color: Colors.white, size: 20),
                          ],
                        ),
                      ),
                      confirmDismiss: (direction) async {
                        if (direction == DismissDirection.startToEnd) {
                          await widget.onMarkRead(n['id'].toString());
                          setState(() => n['read_at'] = DateTime.now().toIso8601String());
                          return false;
                        } else {
                          await widget.onDelete(n['id'].toString());
                          setState(() => _items.removeAt(i));
                          return true;
                        }
                      },
                      child: Opacity(
                        opacity: isRead ? 0.5 : 1,
                        child: Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: !isRead
                                ? colors.surfaceContainerHigh
                                : colors.surfaceContainerLow,
                            borderRadius: BorderRadius.circular(8),
                            border: !isRead ? Border.all(color: colors.outline.withValues(alpha: 0.3)) : null,
                          ),
                          child: Row(
                            children: [
                              Icon(
                                _notifIcon(n['type']?.toString()),
                                size: 20,
                                color: _notifColor(n['type']?.toString(), sc),
                              ),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      n['title'] ?? '',
                                      style: TextStyle(
                                        fontSize: 14, fontWeight: FontWeight.w600,
                                        color: sc.onSurface,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      n['body'] ?? '',
                                      style: TextStyle(
                                        fontSize: 12,
                                        color: sc.outline,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                         ),
                        ),
                      ),
                      if (!isLast) const SizedBox(height: 12),
                    ],
                  );
              }),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: () => Navigator.of(context).pop(),
                style: ElevatedButton.styleFrom(
                  backgroundColor: colors.surfaceContainerHigh,
                  foregroundColor: sc.onSurface,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
                child: Text('Close', style: GoogleFonts.hankenGrotesk(
                  fontSize: 14, fontWeight: FontWeight.w700,
                )),
              ),
            ),
          ],
        ),
      ),
    );
  }
}