import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../models/reminder_payment.dart';
import '../services/api_service.dart';
import '../theme.dart';

/// Combined payment history across every reminder, newest first.
/// Shows the reminder name next to each payment so it doubles as a log
/// of all amounts paid, even when a bill's amount changes every cycle.
class AllPaymentsPage extends StatefulWidget {
  const AllPaymentsPage({super.key});

  @override
  State<AllPaymentsPage> createState() => _AllPaymentsPageState();
}

class _AllPaymentsPageState extends State<AllPaymentsPage> {
  late Future<List<ReminderPayment>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<ReminderPayment>> _load() async {
    final data = await ApiService.fetchAllReminderPayments();
    return data
        .whereType<Map>()
        .map((e) => ReminderPayment.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<void> _refresh() async {
    setState(() => _future = _load());
  }

  @override
  Widget build(BuildContext context) {
    final p = AppPalette.of(context);
    return Scaffold(
      backgroundColor: p.bg,
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(child: _header()),
            SliverToBoxAdapter(
              child: FutureBuilder<List<ReminderPayment>>(
                future: _future,
                builder: (context, snap) {
                  if (snap.connectionState != ConnectionState.done) {
                    return const Padding(
                      padding: EdgeInsets.symmetric(vertical: 60),
                      child: Center(
                        child: SizedBox(
                          width: 22, height: 22,
                          child: CircularProgressIndicator(strokeWidth: 2.4),
                        ),
                      ),
                    );
                  }
                  final payments = snap.data ?? const <ReminderPayment>[];
                  if (snap.hasError || payments.isEmpty) {
                    return Padding(
                      padding: const EdgeInsets.only(top: 60),
                      child: Column(
                        children: [
                          Icon(LucideIcons.receipt, size: 40, color: p.inkMute),
                          const SizedBox(height: 12),
                          Text('No payments recorded yet',
                            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: p.ink)),
                          const SizedBox(height: 4),
                          Text('Mark a reminder as paid to start tracking',
                            style: TextStyle(fontSize: 12.5, color: p.inkMute)),
                        ],
                      ),
                    );
                  }
                  return Padding(
                    padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        for (int i = 0; i < payments.length; i++) _paymentTile(p, payments[i]),
                      ],
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _header() {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.fromLTRB(20, MediaQuery.paddingOf(context).top + 18, 20, 22),
      decoration: const BoxDecoration(
        gradient: kHeaderGradient,
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(28)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('All Payments',
            style: GoogleFonts.hankenGrotesk(fontSize: 22, fontWeight: FontWeight.w800, color: Colors.white)),
          const SizedBox(height: 4),
          Text('Payment history across every reminder',
            style: TextStyle(fontSize: 13, color: Colors.white.withValues(alpha: 0.7))),
        ],
      ),
    );
  }

  Widget _paymentTile(AppPalette p, ReminderPayment payment) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.fromLTRB(14, 13, 14, 12),
      decoration: BoxDecoration(
        color: p.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: p.line),
      ),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: p.green.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(LucideIcons.checkCircle2, size: 19, color: p.green),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(payment.reminderTitle ?? 'Reminder',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: p.ink)),
                const SizedBox(height: 3),
                Row(
                  children: [
                    Text(dateMedium(payment.paidAt),
                      style: TextStyle(fontSize: 11.5, color: p.inkMute)),
                    if (payment.transactionId != null) ...[
                      const SizedBox(width: 6),
                      Container(
                        width: 3, height: 3,
                        decoration: BoxDecoration(color: p.inkMute, shape: BoxShape.circle),
                      ),
                      const SizedBox(width: 6),
                      Flexible(
                        child: Text(payment.transactionId!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontSize: 11, color: p.inkMute)),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Text(formatINRZero(payment.amount),
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: p.ink)),
        ],
      ),
    );
  }
}