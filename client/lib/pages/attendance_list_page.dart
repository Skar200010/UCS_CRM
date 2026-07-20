import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/api_service.dart';
import '../services/realtime_service.dart';
import '../main.dart';
import '../widgets/skeleton_loader.dart';

class AttendanceListPage extends StatefulWidget {
  const AttendanceListPage({super.key});

  @override
  State<AttendanceListPage> createState() => _AttendanceListPageState();
}

class _AttendanceListPageState extends State<AttendanceListPage> with WidgetsBindingObserver {
  List<dynamic> _allRecords = [];
  bool _loading = true;
  int _selectedMonth = DateTime.now().month;
  int _selectedYear = DateTime.now().year;
  int _listKey = 0;
  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _load();
    RealtimeService.instance.addListener(_onRealtimeChange);
    _refreshTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      _load();
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _load();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    RealtimeService.instance.removeListener(_onRealtimeChange);
    _refreshTimer?.cancel();
    super.dispose();
  }

  void _onRealtimeChange() {
    if (RealtimeService.instance.lastEvent == RealtimeEvent.attendance) {
      _load();
    }
  }

  List<dynamic> get _filteredRecords {
    return _allRecords.where((r) {
      final dt = DateTime.tryParse(r['date']?.toString() ?? '');
      if (dt == null) return false;
      return dt.month == _selectedMonth && dt.year == _selectedYear;
    }).toList();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final history = await ApiService.getHistory();
      setState(() {
        _allRecords = history;
        _loading = false;
        _listKey++;
      });
    } catch (_) {
      final cached = await ApiService.getCachedHistory();
      setState(() {
        _allRecords = cached ?? [];
        _loading = false;
        _listKey++;
      });
    }
  }

  void _prevMonth() {
    setState(() {
      if (_selectedMonth == 1) {
        _selectedMonth = 12;
        _selectedYear--;
      } else {
        _selectedMonth--;
      }
      _listKey++;
    });
  }

  void _nextMonth() {
    setState(() {
      if (_selectedMonth == 12) {
        _selectedMonth = 1;
        _selectedYear++;
      } else {
        _selectedMonth++;
      }
      _listKey++;
    });
  }

  Future<void> _pickMonthYear() async {
    final now = DateTime.now();
    final years = List.generate(5, (i) => now.year - 2 + i);
    int tempMonth = _selectedMonth;
    int tempYear = _selectedYear;

    final picked = await showModalBottomSheet<(int, int)?>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            return Padding(
              padding: const EdgeInsets.fromLTRB(24, 20, 24, 32),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(width: 40, height: 4,
                    decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2))),
                  const SizedBox(height: 20),
                  Text('Select Month & Year', style: GoogleFonts.hankenGrotesk(
                    fontSize: 17, fontWeight: FontWeight.w700, color: const Color(0xFF1f1f1f),
                  )),
                  const SizedBox(height: 20),
                  Row(
                    children: [
                      Expanded(
                        child: DropdownButtonFormField<int>(
                          value: tempMonth,
                          decoration: InputDecoration(
                            labelText: 'Month',
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          ),
                          items: List.generate(12, (i) => i + 1).map((m) =>
                            DropdownMenuItem(value: m, child: Text(DateFormat('MMMM').format(DateTime(2000, m))))
                          ).toList(),
                          onChanged: (v) => setSheetState(() => tempMonth = v!),
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: DropdownButtonFormField<int>(
                          value: tempYear,
                          decoration: InputDecoration(
                            labelText: 'Year',
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          ),
                          items: years.map((y) =>
                            DropdownMenuItem(value: y, child: Text(y.toString()))
                          ).toList(),
                          onChanged: (v) => setSheetState(() => tempYear = v!),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    height: 44,
                    child: ElevatedButton(
                      onPressed: () => Navigator.pop(ctx, (tempMonth, tempYear)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF2563eb),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      child: const Text('Apply', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );

    if (picked != null) {
      setState(() {
        _selectedMonth = picked.$1;
        _selectedYear = picked.$2;
        _listKey++;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<AppColors>()!;
    final scheme = Theme.of(context).colorScheme;
    final filtered = _filteredRecords;
    final monthLabel = DateFormat('MMMM').format(DateTime(_selectedYear, _selectedMonth));

    return Scaffold(
      backgroundColor: scheme.surface,
      body: SafeArea(child: Column(
        children: [
          _buildFilterBar(monthLabel, colors),
          Expanded(child: _loading
              ? ListView(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 80),
                  children: List.generate(8, (_) => const Padding(
                    padding: EdgeInsets.only(bottom: 8),
                    child: _AttendanceSkeletonItem(),
                  )),
                )
              : filtered.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.history, size: 48, color: const Color(0xFF74777e).withValues(alpha: 0.3)),
                          const SizedBox(height: 12),
                          Text('No records for this month', style: TextStyle(
                            fontSize: 14, color: const Color(0xFF74777e).withValues(alpha: 0.6),
                          )),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.builder(
                        key: ValueKey('list_$_listKey'),
                        padding: const EdgeInsets.fromLTRB(16, 16, 16, 80),
                        itemCount: filtered.length,
                        itemBuilder: (_, i) {
                          final r = filtered[i];
                          final date = r['date']?.toString() ?? '';
                          final inTime = r['punch_in_time']?.toString() ?? '';
                          final outTime = r['punch_out_time']?.toString() ?? '';
                          final hoursWorked = r['hours_worked']?.toString() ?? '';

                          final dt = DateTime.tryParse(date);
                          final day = dt?.day.toString().padLeft(2, '0') ?? '';
                          final month = dt != null ? DateFormat('MMM').format(dt) : '';

                          return _AnimatedListItem(
                            index: i,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: const Color(0xFFE8EAED)),
                                boxShadow: const [
                                  BoxShadow(
                                    color: Color(0x08000000),
                                    blurRadius: 8,
                                    offset: Offset(0, 2),
                                  ),
                                ],
                              ),
                              child: Row(
                                children: [
                                  Column(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(day, style: GoogleFonts.hankenGrotesk(
                                        fontSize: 22, fontWeight: FontWeight.w800, color: scheme.onSurface,
                                      )),
                                      Text(month, style: TextStyle(
                                        fontSize: 10, fontWeight: FontWeight.w600, color: scheme.outline,
                                      )),
                                    ],
                                  ),
                                  const SizedBox(width: 16),
                                  Container(width: 1, height: 40, color: const Color(0xFFE8EAED)),
                                  const SizedBox(width: 16),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            Text('In ', style: TextStyle(
                                              fontSize: 12, fontWeight: FontWeight.w500, color: scheme.outline,
                                            )),
                                            Text(
                                              inTime.isNotEmpty ? _fmtTime(inTime) : '—',
                                              style: GoogleFonts.hankenGrotesk(
                                                fontSize: 15, fontWeight: FontWeight.w600, color: scheme.onSurface,
                                              ),
                                            ),
                                            const Spacer(),
                                            if (outTime.isNotEmpty || hoursWorked.isNotEmpty) ...[
                                              Text('Out ', style: TextStyle(
                                                fontSize: 12, fontWeight: FontWeight.w500, color: scheme.outline,
                                              )),
                                              Text(
                                                outTime.isNotEmpty ? _fmtTime(outTime) : '—',
                                                style: GoogleFonts.hankenGrotesk(
                                                  fontSize: 15, fontWeight: FontWeight.w600, color: scheme.onSurface,
                                                ),
                                              ),
                                            ],
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    ),
          ),
        ],
      )),
    );
  }

  Widget _buildFilterBar(String monthLabel, AppColors colors) {
    return Container(
      padding: const EdgeInsets.fromLTRB(4, 6, 4, 6),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: colors.outline.withValues(alpha: 0.3))),
      ),
      child: Row(
        children: [
          IconButton(
            onPressed: _prevMonth,
            icon: const Icon(Icons.chevron_left, size: 24, color: Color(0xFF1f1f1f)),
            splashRadius: 20,
            constraints: const BoxConstraints(minWidth: 40, minHeight: 40),
          ),
          Expanded(
            child: GestureDetector(
              onTap: _pickMonthYear,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    monthLabel,
                    style: GoogleFonts.hankenGrotesk(
                      fontSize: 20, fontWeight: FontWeight.w700, color: const Color(0xFF1f1f1f),
                    ),
                  ),
                  Text(
                    _selectedYear.toString(),
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: const Color(0xFF74777e)),
                  ),
                ],
              ),
            ),
          ),
          IconButton(
            onPressed: _nextMonth,
            icon: const Icon(Icons.chevron_right, size: 24, color: Color(0xFF1f1f1f)),
            splashRadius: 20,
            constraints: const BoxConstraints(minWidth: 40, minHeight: 40),
          ),
        ],
      ),
    );
  }

  String _fmtTime(String t) {
    final dt = DateTime.tryParse(t);
    if (dt != null) return DateFormat('hh:mm a').format(dt.toLocal());
    return t;
  }
}

class _AnimatedListItem extends StatefulWidget {
  final int index;
  final Widget child;

  const _AnimatedListItem({required this.index, required this.child});

  @override
  State<_AnimatedListItem> createState() => _AnimatedListItemState();
}

class _AnimatedListItemState extends State<_AnimatedListItem>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeAnim;
  late Animation<Offset> _slideAnim;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 350),
    );
    _fadeAnim = CurvedAnimation(parent: _controller, curve: Curves.easeOut);
    _slideAnim = Tween<Offset>(
      begin: const Offset(0, 0.08),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic));
    Future.delayed(Duration(milliseconds: widget.index * 40), _controller.forward);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _fadeAnim,
      child: SlideTransition(
        position: _slideAnim,
        child: Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: widget.child,
        ),
      ),
    );
  }
}

class _AttendanceSkeletonItem extends StatelessWidget {
  const _AttendanceSkeletonItem();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: SkeletonLoader(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFE8EAED)),
          ),
          child: Row(
            children: [
              const Column(
                children: [
                  SkeletonBlock(width: 28, height: 22),
                  SizedBox(height: 4),
                  SkeletonBlock(width: 28, height: 10),
                ],
              ),
              const SizedBox(width: 16),
              Container(width: 1, height: 40, color: const Color(0xFFE8EAED)),
              const SizedBox(width: 16),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      SkeletonBlock(width: 13, height: 13, borderRadius: 6),
                      SizedBox(width: 4),
                      SkeletonBlock(width: 16, height: 10),
                      Spacer(),
                      SkeletonBlock(width: 60, height: 16),
                    ]),
                    SizedBox(height: 6),
                    Row(children: [
                      SkeletonBlock(width: 13, height: 13, borderRadius: 6),
                      SizedBox(width: 4),
                      SkeletonBlock(width: 20, height: 10),
                      Spacer(),
                      SkeletonBlock(width: 60, height: 16),
                    ]),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
