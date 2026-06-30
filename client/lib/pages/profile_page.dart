import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/api_service.dart';
import '../services/supabase_service.dart';
import '../main.dart';
import '../widgets/mini_calendar.dart';
import '../widgets/progress_circle.dart';
import '../widgets/consistency_bar.dart';
import '../widgets/menu_item.dart';
import '../widgets/skeleton_loader.dart';
import 'edit_profile_page.dart';
import 'correction_ticket_page.dart';

class ProfilePage extends StatefulWidget {
  final VoidCallback? onLogout;
  final int tabChangeVersion;
  const ProfilePage({super.key, this.onLogout, required this.tabChangeVersion});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  final ScrollController _scrollController = ScrollController();
  Map<String, dynamic>? _worker;
  List<dynamic> _history = [];
  bool _loading = true;
  List<dynamic> _loans = [];
  bool _loadingLoans = false;

  int _present = 0, _absent = 0, _late = 0, _leave = 0, _lateUsed = 0;
  Map<String, String> _statusByDate = {};
  Map<String, String> _hoursByDate = {};
  Map<String, Map<String, dynamic>> _historyByDate = {};
  String? _selectedDateKey;
  final Map<int, Map<String, int>> _monthlyStats = {};
  int _calYear = 0, _calMonth = 0;
  String? _workerId;
  Map<String, List<String>> _calendarDates = {};

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  @override
  void didUpdateWidget(covariant ProfilePage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.tabChangeVersion != oldWidget.tabChangeVersion) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scrollController.hasClients) _scrollController.jumpTo(0);
      });
    }
  }

  @override
  void dispose() {
    _scrollController.dispose();
    if (_workerId != null) {
      SupabaseService.unsubscribeFromHistory();
    }
    super.dispose();
  }

  Future<void> _loadData() async {
    _worker = await ApiService.getWorkerData();
    _workerId = _worker?['id']?.toString();
    final n = DateTime.now();
    if (_calYear == 0) { _calYear = n.year; _calMonth = n.month; }

    // Load cached data instantly
    final cachedProfile = await ApiService.getCachedProfile();
    if (cachedProfile != null) {
      _worker = cachedProfile;
      await ApiService.saveWorkerData(cachedProfile);
    }
    _applyCachedHistory(ApiService.getCachedHistory());

    setState(() => _loading = false);

    try {
      final profile = await ApiService.getMyProfile();
      _worker = profile;
      await ApiService.saveWorkerData(profile);
      _workerId = profile['id']?.toString();
    } catch (_) {}

    await _refreshHistoryFromNetwork();
    _fetchCalendar();
    _fetchLoans();

    // Subscribe to realtime updates
    if (_workerId != null && _workerId!.isNotEmpty) {
      SupabaseService.subscribeToHistory(
        workerId: _workerId!,
        onHistoryChange: _onRealtimeChange,
      );
    }
  }

  void _onRealtimeChange() {
    _refreshHistoryFromNetwork();
  }

  Future<void> _fetchLoans() async {
    setState(() => _loadingLoans = true);
    try {
      final loans = await ApiService.getMyLoans();
      if (mounted) setState(() => _loans = loans);
    } catch (_) {}
    if (mounted) setState(() => _loadingLoans = false);
  }

  Future<void> _applyCachedHistory(Future<List<dynamic>?> future) async {
    final cachedHistory = await future;
    if (cachedHistory == null) return;
    int p = 0, a = 0, l = 0, lv = 0;
    final statusMap = <String, String>{};
    final monthlyStats = <int, Map<String, int>>{};
    final hoursMap = <String, String>{};
    final detailMap = <String, Map<String, dynamic>>{};

    for (final rec in cachedHistory) {
      final date = rec['date'] ?? '';
      final status = rec['status'] ?? 'present';
      statusMap[date.toString()] = status.toString();
      final hw = rec['hours_worked'];
      if (hw != null) hoursMap[date.toString()] = hw.toString();
      detailMap[date.toString()] = {
        'date': date,
        'status': status,
        'punch_in_time': rec['punch_in_time'],
        'punch_out_time': rec['punch_out_time'],
        'hours_worked': hw,
        'late_minutes': rec['late_minutes'],
      };
      final dt = DateTime.tryParse(date.toString());
      if (dt != null) {
        final ym = dt.year * 100 + dt.month;
        monthlyStats.putIfAbsent(ym, () => {'present': 0, 'absent': 0, 'late': 0, 'leave': 0, 'holiday': 0});
        final st = status.toString();
        if (monthlyStats[ym]!.containsKey(st)) {
          monthlyStats[ym]![st] = monthlyStats[ym]![st]! + 1;
        }
      }
        switch (status) { case 'present': p++; break; case 'absent': a++; break; case 'late': l++; p++; break; case 'leave': lv++; break; }
    }

    setState(() {
      _history = cachedHistory;
      _present = p; _absent = a; _late = l; _leave = lv;
      _statusByDate = statusMap;
      _hoursByDate = hoursMap;
      _historyByDate = detailMap;
      _monthlyStats.clear();
      _monthlyStats.addAll(monthlyStats);
    });
  }

  Future<void> _refreshHistoryFromNetwork() async {
    int p = 0, a = 0, l = 0, lv = 0;
    final statusMap = <String, String>{};
    final monthlyStats = <int, Map<String, int>>{};
    final hoursMap = <String, String>{};
    final detailMap = <String, Map<String, dynamic>>{};

    try {
      final res = await Future.wait([
        ApiService.getHistory(),
        ApiService.getTodayStatus(),
      ]);
      final history = res[0] as List<dynamic>;
      final today = res[1] as Map<String, dynamic>;

      for (final rec in history) {
        final date = rec['date'] ?? '';
        final status = rec['status'] ?? 'present';
        statusMap[date.toString()] = status.toString();
        final hw = rec['hours_worked'];
        if (hw != null) hoursMap[date.toString()] = hw.toString();
        detailMap[date.toString()] = {
          'date': date,
          'status': status,
          'punch_in_time': rec['punch_in_time'],
          'punch_out_time': rec['punch_out_time'],
          'hours_worked': hw,
          'late_minutes': rec['late_minutes'],
        };
        final dt = DateTime.tryParse(date.toString());
        if (dt != null) {
          final ym = dt.year * 100 + dt.month;
        monthlyStats.putIfAbsent(ym, () => {'present': 0, 'absent': 0, 'late': 0, 'leave': 0, 'holiday': 0});
          final st = status.toString();
          if (monthlyStats[ym]!.containsKey(st)) {
            monthlyStats[ym]![st] = monthlyStats[ym]![st]! + 1;
          }
        }
      switch (status) { case 'present': p++; break; case 'absent': a++; break; case 'late': l++; p++; break; case 'leave': lv++; break; }
      }

      setState(() {
        _history = history;
        _present = p; _absent = a; _late = l; _leave = lv;
        _lateUsed = today['lateUsed'] ?? 0;
        _statusByDate = statusMap;
        _hoursByDate = hoursMap;
        _historyByDate = detailMap;
        _monthlyStats.clear();
        _monthlyStats.addAll(monthlyStats);
      });
    } catch (_) {}
  }

  Future<void> _fetchCalendar() async {
    try {
      final data = await ApiService.getCalendar(year: _calYear, month: _calMonth);
      final Map<String, List<String>> calMap = {};
      for (final e in (data['events'] as List? ?? [])) {
        final d = e['date']?.toString();
        if (d != null) calMap.putIfAbsent(d, () => []).add('event');
      }
      for (final h in (data['holidays'] as List? ?? [])) {
        final d = h['date']?.toString();
        if (d != null) calMap.putIfAbsent(d, () => []).add('holiday');
      }
      for (final b in (data['birthdays'] as List? ?? [])) {
        final d = b['date']?.toString();
        if (d != null) calMap.putIfAbsent(d, () => []).add('birthday');
      }
      if (mounted) setState(() => _calendarDates = calMap);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<AppColors>()!;
    final scheme = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    if (_loading) return const ProfileSkeleton();

    final name = _worker?['name'] ?? 'Worker';
    final loginId = _worker?['login_id'] ?? '';
    final role = _worker?['role'] ?? _worker?['designation'] ?? '';
    final total = _present + _absent + _late + _leave;
    final rate = total > 0 ? (_present + _late) / total : 0.0;
    final monthYear = DateFormat('MMMM yyyy').format(DateTime.now());
    final initials = name.split(' ').map((n) => n.isNotEmpty ? n[0] : '').join().toUpperCase();

    final presentFraction = total > 0 ? _present / total : 0.0;
    final absentFraction = total > 0 ? _absent / total : 0.0;
    final leaveFraction = total > 0 ? _leave / total : 0.0;
    final lateFraction = total > 0 ? _late / total : 0.0;

    return Scaffold(
      backgroundColor: scheme.surface,
      body: SafeArea(
        child: ListView(
          controller: _scrollController,
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 80),
          children: [
            _profileCard(name, loginId, role, initials),
            const SizedBox(height: 24),
            _monthlyOverview(monthYear),
            const SizedBox(height: 24),
            _lateDeductionCard(colors, scheme, tt),
            const SizedBox(height: 24),
            _attendanceCalendar(
              presentFraction, absentFraction, leaveFraction, lateFraction,
              rate, colors, scheme, tt,
            ),
            const SizedBox(height: 24),
            if (_selectedDateKey != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 24),
                child: _dayDetailCard(colors, scheme, tt),
              ),
        _loansCard(colors, scheme, tt),
        const SizedBox(height: 24),
        _raiseTicketCard(scheme, colors),
        const SizedBox(height: 24),
        _accountManagement(colors, scheme, tt),
          ],
        ),
      ),
    );
  }

  Widget _profileCard(String name, String loginId, String role, String initials) {
    final sc = Theme.of(context).colorScheme;
    final colors = Theme.of(context).extension<AppColors>()!;
    return GestureDetector(
      onTap: () async {
        final result = await Navigator.push<bool>(
          context,
          MaterialPageRoute(builder: (_) => EditProfilePage(worker: _worker!)),
        );
        if (result == true && mounted) _loadData();
      },
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: sc.surface,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: colors.outline),
        ),
        child: Row(
          children: [
            Stack(
              children: [
                Container(
                  width: 80, height: 80,
                  decoration: BoxDecoration(
                    color: colors.primaryFixed,
                    shape: BoxShape.circle,
                    border: Border.all(color: sc.primary, width: 2),
                  ),
                  child: Center(child: Text(initials,
                    style: GoogleFonts.hankenGrotesk(
                      fontSize: 28, fontWeight: FontWeight.w800, color: sc.primary,
                    ),
                  )),
                ),
                Positioned(
                  right: 0, bottom: 0,
                  child: Container(
                    width: 20, height: 20,
                    decoration: BoxDecoration(
                      color: sc.secondary,
                      shape: BoxShape.circle,
                      border: Border.all(color: sc.surface, width: 2),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name,
                    style: GoogleFonts.hankenGrotesk(
                      fontSize: 20, fontWeight: FontWeight.w600, color: sc.onSurface,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(role.isNotEmpty ? role : 'Worker',
                  style: TextStyle(
                    fontSize: 14, fontWeight: FontWeight.w400, color: sc.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 2),
                Text('Employee ID: #$loginId',
                  style: TextStyle(
                    fontSize: 12, fontWeight: FontWeight.w400, color: sc.outline,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      ),
    );
  }

  Widget _monthlyOverview(String monthLabel) {
    final sc = Theme.of(context).colorScheme;
    final colors = Theme.of(context).extension<AppColors>()!;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('Monthly Overview',
              style: GoogleFonts.hankenGrotesk(
                fontSize: 18, fontWeight: FontWeight.w600, color: sc.onSurface,
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: colors.surfaceContainerHigh,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(monthLabel,
                style: TextStyle(
                  fontSize: 12, fontWeight: FontWeight.w600, letterSpacing: 0.05,
                  color: sc.onSurfaceVariant,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Column(
          children: [
            Row(
              children: [
                Expanded(child: _statProgressCard('$_present', 'Present', _presentStatsValue,
                    sc.secondary, Icons.check_circle)),
                const SizedBox(width: 12),
                Expanded(child: _statProgressCard('$_absent', 'Absent', _absentStatsValue,
                    sc.error, Icons.cancel)),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(child: _statProgressCard('$_late', 'Late', _lateStatsValue,
                    const Color(0xFFc28228), Icons.schedule)),
                const SizedBox(width: 12),
                Expanded(child: _statProgressCard('$_leave', 'Leave', _leaveStatsValue,
                    const Color(0xFF7a92b0), Icons.event_note)),
              ],
            ),
          ],
        ),
      ],
    );
  }

  double get _presentStatsValue => _totalDays > 0 ? _present / _totalDays : 0;
  double get _absentStatsValue => _totalDays > 0 ? _absent / _totalDays : 0;
  double get _lateStatsValue => _totalDays > 0 ? _late / _totalDays : 0;
  double get _leaveStatsValue => _totalDays > 0 ? _leave / _totalDays : 0;
  int get _totalDays => _present + _absent + _late + _leave;

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

  Color get _lateTierBg {
    switch (_lateTier) {
      case 0: return const Color(0xFFf0f9f4);
      case 1: return const Color(0xFFfff8f0);
      case 2: return const Color(0xFFfff3eb);
      case 3: return const Color(0xFFfff5f5);
      default: return const Color(0xFFf0f4f8);
    }
  }

  Color get _lateTierBorder {
    switch (_lateTier) {
      case 0: return const Color(0xFF2a6a4b);
      case 1: return const Color(0xFFe67e22);
      case 2: return const Color(0xFFd35400);
      case 3: return const Color(0xFFba1a1a);
      default: return const Color(0xFFc3c6ce);
    }
  }

  String get _lateTierLabel {
    switch (_lateTier) {
      case 0: return 'No deduction';
      case 1: return 'Half-day deduction';
      case 2: return 'One-day deduction';
      case 3: return 'Proportional deduction';
      default: return '';
    }
  }

  String get _lateTierDesc {
    switch (_lateTier) {
      case 0: return '$_lateUsed min used — within the 180 min grace period. No expense deduction for lateness.';
      case 1: return '$_lateUsed min used — exceeds grace limit. Half-day (0.5 day) will be deducted from expenses.';
      case 2: return '$_lateUsed min used — exceeds half-day threshold. One full day will be deducted from expenses.';
      case 3: return '$_lateUsed min used — exceeds 480 min. Proportional deduction (total min / 480) applied to salary.';
      default: return '';
    }
  }

  bool get _joinedThisMonth {
    final created = _worker?['created_at'];
    if (created == null) return false;
    final dt = DateTime.tryParse(created.toString());
    if (dt == null) return false;
    final now = DateTime.now();
    return dt.year == now.year && dt.month == now.month;
  }

  Widget _lateDeductionCard(AppColors colors, ColorScheme scheme, TextTheme tt) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _lateTierBg,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: _lateTierBorder.withValues(alpha: 0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.access_time, size: 16, color: _lateTierColor),
              const SizedBox(width: 8),
              Text('Late Deduction Status',
                style: GoogleFonts.hankenGrotesk(
                  fontSize: 16, fontWeight: FontWeight.w600, color: const Color(0xFF171c1f),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: _lateTierColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  '${_lateUsed} min',
                  style: GoogleFonts.hankenGrotesk(
                    fontSize: 24, fontWeight: FontWeight.w800, color: _lateTierColor,
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: _lateTierColor.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(3),
                      ),
                      child: Text(_lateTierLabel,
                        style: TextStyle(
                          fontSize: 11, fontWeight: FontWeight.w700,
                          color: _lateTierColor,
                        ),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _lateTierDesc,
                      style: TextStyle(
                        fontSize: 11, color: scheme.onSurfaceVariant, height: 1.4,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: scheme.surface.withValues(alpha: 0.6),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Deduction rules',
                  style: TextStyle(
                    fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.05,
                    color: const Color(0xFF74777e),
                  ),
                ),
                const SizedBox(height: 6),
                _ruleRow('0 – 180 min', 'No deduction', _lateTier == 0),
                _ruleRow('181 – 240 min', 'Half-day deduction', _lateTier == 1),
                _ruleRow('241 – 480 min', 'One-day deduction', _lateTier == 2),
                _ruleRow('> 480 min', 'Proportional deduction', _lateTier == 3),
              ],
            ),
          ),
          if (_joinedThisMonth) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFFf3e8ff).withValues(alpha: 0.6),
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: const Color(0xFF8B5CF6).withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  Icon(Icons.info_outline, size: 14, color: const Color(0xFF8B5CF6)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'First month joining: 1.5 days deducted from expenses (new joiner policy).',
                      style: TextStyle(fontSize: 11, color: scheme.onSurfaceVariant, height: 1.3),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _ruleRow(String range, String desc, bool active) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          Container(
            width: 8, height: 8,
            decoration: BoxDecoration(
              color: active ? const Color(0xFF2a6a4b) : const Color(0xFFdfe3e7),
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 8),
          Text(range,
            style: TextStyle(
              fontSize: 11, fontWeight: FontWeight.w600,
              color: active ? const Color(0xFF171c1f) : const Color(0xFF74777e),
            ),
          ),
          const SizedBox(width: 8),
          Text('→',
            style: TextStyle(
              fontSize: 11, color: const Color(0xFFc3c6ce),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(desc,
              style: TextStyle(
                fontSize: 11, fontWeight: active ? FontWeight.w600 : FontWeight.w400,
                color: active ? const Color(0xFF171c1f) : const Color(0xFF74777e),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _statProgressCard(String count, String label, double value, Color color, IconData icon) {
    final sc = Theme.of(context).colorScheme;
    final colors = Theme.of(context).extension<AppColors>()!;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: sc.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: colors.outline),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(label,
                  style: TextStyle(
                    fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 0.05,
                    color: const Color(0xFF43474d),
                  ),
                ),
                const SizedBox(height: 2),
                Text(count,
                  style: GoogleFonts.hankenGrotesk(
                    fontSize: 20, fontWeight: FontWeight.w700, color: color,
                  ),
                ),
              ],
            ),
          ),
          ProgressCircle(
            size: 36,
            thickness: 3,
            value: value,
            color: color,
            icon: icon,
            iconColor: color,
            iconSize: 12,
          ),
        ],
      ),
    );
  }

  Widget _attendanceCalendar(
    double presentFrac, double absentFrac, double leaveFrac, double lateFrac,
    double rate, AppColors colors, ColorScheme scheme, TextTheme tt,
  ) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: scheme.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: colors.outline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Attendance Calendar',
                style: GoogleFonts.hankenGrotesk(
                  fontSize: 18, fontWeight: FontWeight.w600, color: scheme.onSurface,
                ),
              ),
              Row(
                children: [
                  GestureDetector(
                    onTap: () {
                      setState(() {
                        if (_calMonth == 1) { _calYear--; _calMonth = 12; }
                        else { _calMonth--; }
                        _selectedDateKey = null;
                      });
                      _fetchCalendar();
                    },
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      child: Icon(Icons.chevron_left, size: 20, color: const Color(0xFF43474d)),
                    ),
                  ),
                  const SizedBox(width: 4),
                  GestureDetector(
                    onTap: () {
                      setState(() {
                        if (_calMonth == 12) { _calYear++; _calMonth = 1; }
                        else { _calMonth++; }
                        _selectedDateKey = null;
                      });
                      _fetchCalendar();
                    },
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      child: Icon(Icons.chevron_right, size: 20, color: const Color(0xFF43474d)),
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Monthly Consistency',
                style: TextStyle(
                  fontSize: 12, fontWeight: FontWeight.w600, letterSpacing: 0.05,
                  color: const Color(0xFF43474d),
                ),
              ),
              Text('${(rate * 100).round()}%',
                style: TextStyle(
                  fontSize: 12, fontWeight: FontWeight.w600, letterSpacing: 0.05,
                  color: const Color(0xFF2a6a4b),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ConsistencyBar(
            presentFraction: presentFrac,
            absentFraction: absentFrac,
            leaveFraction: leaveFrac,
            lateFraction: lateFrac,
            height: 8,
          ),
          const SizedBox(height: 20),
          MiniCalendar(
            year: _calYear,
            month: _calMonth,
            statusByDate: _statusByDate,
            selectedDate: _selectedDateKey,
            calendarDates: _calendarDates,
            onDateSelected: (key) => setState(() {
              _selectedDateKey = _selectedDateKey == key ? null : key;
            }),
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 16, runSpacing: 8,
            children: [
              _legendDot('Present', const Color(0xFFaff1ca)),
              _legendDot('Absent', const Color(0xFFffdad6)),
              _legendDot('Leave', const Color(0xFFd1e4ff)),
              _legendDot('Late', const Color(0xFFffddb8)),
              _legendDot('Holiday', const Color(0xFFe8d5f5)),
              _smLegendDot(Icons.circle, 'Event', const Color(0xFF2563eb)),
              _smLegendDot(Icons.cake, 'Birthday', const Color(0xFFf43f5e)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _loansCard(AppColors colors, ColorScheme scheme, TextTheme tt) {
    final active = _loans.where((l) => l['status'] == 'approved' || l['status'] == 'pending').toList();
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: scheme.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: colors.outline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.account_balance_wallet, size: 18, color: scheme.primary),
              const SizedBox(width: 8),
              Text('Loans & Advances',
                style: GoogleFonts.hankenGrotesk(
                  fontSize: 18, fontWeight: FontWeight.w600, color: scheme.onSurface,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (_loadingLoans)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: Center(child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))),
            )
          else if (active.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 16),
              child: Center(
                child: Text('No active loans or advances', style: TextStyle(fontSize: 13, color: scheme.onSurfaceVariant)),
              ),
            )
          else
            ...active.map((loan) => _loanItem(loan, colors, scheme, tt)),
        ],
      ),
    );
  }

  Widget _loanItem(dynamic loan, AppColors colors, ColorScheme scheme, TextTheme tt) {
    final type = loan['type']?.toString() ?? 'advance';
    final amount = loan['total_amount'] ?? 0;
    final monthlyDeduction = loan['monthly_deduction'] ?? 0;
    final remainingAmount = loan['remaining_amount'] ?? amount;
    final status = loan['status']?.toString() ?? 'pending';
    final label = type == 'loan' ? 'Loan' : 'Advance';
    final statusColor = status == 'approved' ? const Color(0xFF1D7A4F) : const Color(0xFFc28228);

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: colors.surfaceContainerLowest,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: colors.outline.withValues(alpha: 0.5)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: scheme.onSurface)),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(status.toUpperCase(), style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: statusColor)),
                ),
              ],
            ),
            const SizedBox(height: 8),
            _loanRow('Amount', '₹ $amount', scheme),
            if (monthlyDeduction > 0) ...[
              const SizedBox(height: 4),
              _loanRow('Monthly deduction', '₹ $monthlyDeduction', scheme),
            ],
            if (remainingAmount > 0) ...[
              const SizedBox(height: 4),
              _loanRow('Remaining', '₹ $remainingAmount', scheme),
            ],
          ],
        ),
      ),
    );
  }

  Widget _loanRow(String label, String value, ColorScheme scheme) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: TextStyle(fontSize: 11, color: scheme.onSurfaceVariant)),
        Text(value, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: scheme.onSurface)),
      ],
    );
  }

  Widget _accountManagement(AppColors colors, ColorScheme scheme, TextTheme tt) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Account Management',
          style: GoogleFonts.hankenGrotesk(
            fontSize: 18, fontWeight: FontWeight.w600, color: scheme.onSurface,
          ),
        ),
        const SizedBox(height: 16),
        Container(
          decoration: BoxDecoration(
            color: scheme.surface,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: colors.outline),
          ),
          child: Column(
            children: [
              MenuItem(
                icon: Icons.help_center,
                label: 'Help Center',
                iconColor: scheme.onSurfaceVariant,
                onTap: () {},
              ),
              Divider(height: 1, color: colors.outline),
              MenuItem(
                icon: Icons.logout,
                label: 'Logout',
                isDestructive: true,
                onTap: _confirmLogout,
              ),
            ],
          ),
        ),
      ],
    );
  }

  void _confirmLogout() {
    final sc = Theme.of(context).colorScheme;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        backgroundColor: sc.surface,
        title: Text('Logout',
          style: GoogleFonts.hankenGrotesk(
            fontSize: 20, fontWeight: FontWeight.w600, color: sc.onSurface,
          ),
        ),
        content: Text('Are you sure you want to logout?',
          style: TextStyle(fontSize: 14, color: sc.onSurfaceVariant),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Cancel',
              style: TextStyle(fontWeight: FontWeight.w600, color: sc.onSurfaceVariant),
            ),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              widget.onLogout?.call();
            },
            child: Text('Logout',
              style: TextStyle(fontWeight: FontWeight.w600, color: sc.error),
            ),
          ),
        ],
      ),
    );
  }

  Widget _raiseTicketCard(ColorScheme scheme, AppColors colors) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: scheme.surface,
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
                color: scheme.surface,
                borderRadius: BorderRadius.vertical(top: Radius.circular(8)),
              ),
              child: const CorrectionTicketPage(),
            ),
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 48, height: 48,
              decoration: BoxDecoration(
                color: const Color(0xFFfef3c7),
                borderRadius: BorderRadius.circular(4),
              ),
              child: const Icon(Icons.report_problem_outlined, size: 22, color: Color(0xFF92400e)),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Raise a Ticket', style: GoogleFonts.hankenGrotesk(
                    fontSize: 16, fontWeight: FontWeight.w600, color: scheme.onSurface,
                  )),
                  Text('Report punch in/out issues', style: TextStyle(
                    fontSize: 12, fontWeight: FontWeight.w500,
                    color: scheme.onSurfaceVariant,
                  )),
                ],
              ),
            ),
            Icon(Icons.chevron_right, size: 20, color: scheme.outline),
          ],
        ),
      ),
    );
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

  Widget _dayDetailCard(AppColors colors, ColorScheme scheme, TextTheme tt) {
    final detail = _historyByDate[_selectedDateKey];
    if (detail == null) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
        color: Theme.of(context).extension<AppColors>()!.surfaceContainerLow,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          children: [
            Icon(Icons.info_outline, size: 18, color: const Color(0xFF74777e)),
            const SizedBox(width: 10),
            Text('No record for this date', style: TextStyle(fontSize: 14, color: const Color(0xFF74777e))),
        ],
      ),
    );
    }

    final status = detail['status']?.toString() ?? '';
    final punchIn = detail['punch_in_time'];
    final punchOut = detail['punch_out_time'];
    final hoursWorked = detail['hours_worked'];
    final lateMinutes = detail['late_minutes'];

    Color statusColor;
    IconData statusIcon;
    switch (status) {
      case 'present': statusColor = const Color(0xFF2a6a4b); statusIcon = Icons.check_circle; break;
      case 'absent': statusColor = const Color(0xFFba1a1a); statusIcon = Icons.cancel; break;
      case 'late': statusColor = const Color(0xFFc28228); statusIcon = Icons.schedule; break;
      case 'leave': statusColor = const Color(0xFF7a92b0); statusIcon = Icons.event_note; break;
      default: statusColor = const Color(0xFF74777e); statusIcon = Icons.help_outline;
    }

    final dateStr = _selectedDateKey ?? '';
    final dt = DateTime.tryParse(dateStr);
    final formattedDate = dt != null ? DateFormat('EEEE, d MMMM yyyy').format(dt) : dateStr;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: scheme.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: colors.outline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(statusIcon, size: 18, color: statusColor),
              const SizedBox(width: 8),
              Expanded(
                child: Text(formattedDate, style: GoogleFonts.hankenGrotesk(
                  fontSize: 16, fontWeight: FontWeight.w600, color: scheme.onSurface,
                )),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(status.toUpperCase(), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: statusColor)),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(child: _detailBox(Icons.login, 'Punch In', _fmtTime(punchIn))),
              const SizedBox(width: 8),
              Expanded(child: _detailBox(Icons.logout, 'Punch Out', _fmtTime(punchOut))),
              const SizedBox(width: 8),
              Expanded(child: _detailBox(Icons.timer, 'Worked', hoursWorked?.toString() ?? '—')),
            ],
          ),
          if (lateMinutes != null && (lateMinutes as num) > 0) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                Icon(Icons.access_time, size: 14, color: const Color(0xFFc28228)),
                const SizedBox(width: 4),
                Text('Late by ${lateMinutes} min', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: const Color(0xFFc28228))),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _detailBox(IconData icon, String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
      decoration: BoxDecoration(
        color: Theme.of(context).extension<AppColors>()!.surfaceContainerLow,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Column(
        children: [
          Icon(icon, size: 16, color: const Color(0xFF43474d)),
          const SizedBox(height: 4),
          Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600,
            color: const Color(0xFF74777e))),
          const SizedBox(height: 2),
          Text(value, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: const Color(0xFF171c1f))),
        ],
      ),
    );
  }

  Widget _legendDot(String label, Color color) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(width: 12, height: 12, decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(3),
        )),
        const SizedBox(width: 6),
        Text(label, style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant)),
      ],
    );
  }

  Widget _smLegendDot(IconData icon, String label, Color color) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 10, color: color),
        const SizedBox(width: 4),
        Text(label, style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant)),
      ],
    );
  }
}
