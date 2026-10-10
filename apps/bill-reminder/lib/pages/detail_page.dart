import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../models/reminder.dart';
import '../models/reminder_payment.dart';
import '../services/api_service.dart';
import '../services/reminders_controller.dart';
import '../theme.dart';
import '../widgets/slide_to_confirm.dart';
import '../widgets/status_pill.dart';

class DetailPage extends StatefulWidget {
  final Reminder reminder;
  final RemindersController? controller;
  const DetailPage({super.key, required this.reminder, this.controller});

  @override
  State<DetailPage> createState() => _DetailPageState();
}

class _DetailPageState extends State<DetailPage> {
  late Reminder reminder = widget.reminder;
  bool _marking = false;
  late Future<List<ReminderPayment>> _paymentsFuture;

  @override
  void initState() {
    super.initState();
    _paymentsFuture = _loadPayments();
  }

  Future<List<ReminderPayment>> _loadPayments() async {
    final id = reminder.id;
    if (id == null) return const [];
    try {
      final data = await ApiService.fetchReminderPayments('$id');
      return data
          .whereType<Map>()
          .map((e) => ReminderPayment.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } catch (_) {
      return const [];
    }
  }

  Future<void> _markPaid() async {
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);

    final request = await showDialog<_PaymentRequest>(
      context: context,
      builder: (d) => _ConfirmPaidDialog(
        reminderTitle: reminder.title,
        initialAmount: reminder.amount ?? parseAmountFromNotes(reminder.notes, reminder.amount),
      ),
    );
    if (request == null || !mounted) {
      setState(() {});
      return;
    }

    setState(() => _marking = true);
    try {
      await ApiService.completeReminder(
        '${reminder.id}',
        body: {
          'transaction_id': request.txnId,
          'amount': request.amount,
        },
      );
      final ctrl = widget.controller ?? RemindersController.instance;
      await ctrl?.refresh();
      if (mounted) navigator.pop();
      messenger.showSnackBar(const SnackBar(content: Text('Marked as paid ✓')));
    } catch (e) {
      if (mounted) {
        setState(() => _marking = false);
        messenger.showSnackBar(SnackBar(
          content: Text('Could not mark as paid — ${e.toString().replaceFirst('Exception: ', '')}'),
        ));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = AppPalette.of(context);
    final meta = statusMeta(reminder.statusLabel);
    final cat = categoryMeta(reminder.category);
    final ownerColor = kOwnerColors[reminder.owner] ?? const Color(0xFF64748b);
    final isPaid = reminder.paid;
    final daysLeft = reminder.daysLeft;
    final showRef = reminder.dueDate ?? reminder.renewalDate;

    String? countdown;
    if (!isPaid && daysLeft != null) {
      if (daysLeft < 0) {
        countdown = 'Overdue by ${-daysLeft} day${-daysLeft == 1 ? '' : 's'}';
      } else if (daysLeft == 0) {
        countdown = 'Due today';
      } else {
        countdown = '$daysLeft day${daysLeft == 1 ? '' : 's'} left';
      }
    } else if (isPaid) {
      countdown = 'Paid ✓';
    }

    return Scaffold(
      backgroundColor: p.bg,
      body: SafeArea(
        top: false,
        child: CustomScrollView(
        slivers: [
          SliverAppBar(
            pinned: true,
            stretch: true,
            backgroundColor: p.navy,
            foregroundColor: Colors.white,
            expandedHeight: 210,
            flexibleSpace: FlexibleSpaceBar(
              stretchModes: const [StretchMode.zoomBackground],
              background: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [ownerColor.withValues(alpha: 0.55), p.navy],
                  ),
                ),
                child: SafeArea(
                  bottom: false,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 56, 20, 18),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                              decoration: BoxDecoration(
                                color: ownerColor,
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(LucideIcons.user, size: 12, color: Colors.white),
                                  const SizedBox(width: 5),
                                  Text(reminder.owner ?? 'Unassigned',
                                    style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: Colors.white)),
                                ],
                              ),
                            ),
                            const Spacer(),
                            StatusPill(status: reminder.statusLabel),
                          ],
                        ),
                        const Spacer(),
                        Text(reminder.title,
                          maxLines: 2, overflow: TextOverflow.ellipsis,
                          style: GoogleFonts.hankenGrotesk(
                            fontSize: 26, fontWeight: FontWeight.w800, color: Colors.white, height: 1.15)),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Icon(cat.icon, size: 14, color: Colors.white.withValues(alpha: 0.7)),
                            const SizedBox(width: 6),
                            Text(cat.label,
                              style: TextStyle(fontSize: 12.5, color: Colors.white.withValues(alpha: 0.75))),
                            const SizedBox(width: 10),
                            const Icon(LucideIcons.calendarDays, size: 13, color: Colors.white54),
                            const SizedBox(width: 5),
                            Text(showRef != null ? dateFull(showRef) : 'No due date',
                              style: TextStyle(fontSize: 12.5, color: Colors.white.withValues(alpha: 0.75))),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Container(
              transform: Matrix4.translationValues(0, -14, 0),
              margin: const EdgeInsets.symmetric(horizontal: 16),
              padding: const EdgeInsets.fromLTRB(18, 18, 18, 4),
              decoration: BoxDecoration(
                color: p.card,
                borderRadius: BorderRadius.circular(18),
                boxShadow: [BoxShadow(color: p.ink.withValues(alpha: 0.06), blurRadius: 18, offset: const Offset(0, 6))],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Amount',
                              style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: p.inkMute, letterSpacing: 0.4)),
                            const SizedBox(height: 4),
                            Text(formatINRZero(reminder.amount),
                              style: GoogleFonts.hankenGrotesk(fontSize: 32, fontWeight: FontWeight.w800, color: p.ink)),
                          ],
                        ),
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                            decoration: BoxDecoration(
                              color: meta.color.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(meta.label,
                              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: meta.color)),
                          ),
                          if (countdown != null) ...[
                            const SizedBox(height: 5),
                            Text(countdown,
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: daysLeft != null && daysLeft < 0 ? p.danger : p.inkSoft)),
                          ],
                        ],
                      ),
                    ],
                  ),
                  if (reminder.priority != null) ...[
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Icon(LucideIcons.flag, size: 13, color: p.inkMute),
                        const SizedBox(width: 6),
                        Text('Priority: ${reminder.priority}',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: kPriorityColors[reminder.priority] ?? p.inkSoft)),
                      ],
                    ),
                  ],
                  const SizedBox(height: 14),
                  _infoGrid(context),
                ],
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Container(
              margin: const EdgeInsets.fromLTRB(16, 10, 16, 8),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: p.card,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: p.line),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Schedule',
                    style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: p.ink)),
                  const SizedBox(height: 12),
                  _row(LucideIcons.calendarCheck2, 'Last Due', dateMedium(reminder.dueDate)),
                  _row(LucideIcons.bellRing, 'Renewal', dateMedium(reminder.renewalDate)),
                  _row(LucideIcons.repeat, 'Frequency', reminder.displayFrequency ?? reminder.frequencyType ?? '—'),
                  _row(LucideIcons.hourglass, 'Remind before',
                      reminder.remindDaysBefore != null ? '${reminder.remindDaysBefore} day${reminder.remindDaysBefore == 1 ? '' : 's'}' : '—'),
                  _row(LucideIcons.checkCircle2, 'Last paid', dateMedium(reminder.paidAt)),
                  if (reminder.transactionId != null)
                    _row(LucideIcons.creditCard, 'Transaction', reminder.transactionId!),
                  if (reminder.paidBy != null)
                    _row(LucideIcons.user, 'Paid by', reminder.paidBy!),
                ],
              ),
            ),
          ),
          if ((reminder.notes?.isNotEmpty ?? false) || (reminder.description?.isNotEmpty ?? false))
            SliverToBoxAdapter(
              child: Container(
                margin: const EdgeInsets.fromLTRB(16, 10, 16, 8),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: p.card,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: p.line),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (reminder.description?.isNotEmpty ?? false) ...[
                      Text('Description',
                        style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: p.ink)),
                      const SizedBox(height: 6),
                      Text(reminder.description!,
                        style: TextStyle(fontSize: 13.5, height: 1.5, color: p.inkSoft)),
                      const SizedBox(height: 14),
                    ],
                    if (reminder.notes?.isNotEmpty ?? false) ...[
                      Text('Notes',
                        style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: p.ink)),
                      const SizedBox(height: 6),
                      Text(reminder.notes!,
                        style: TextStyle(fontSize: 13.5, height: 1.5, color: p.inkSoft)),
                    ],
                  ],
                ),
              ),
            ),
          SliverToBoxAdapter(
            child: Container(
              margin: const EdgeInsets.fromLTRB(16, 10, 16, 8),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: p.card,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: p.line),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(LucideIcons.history, size: 16, color: p.inkMute),
                      const SizedBox(width: 8),
                      Text('Payment History',
                        style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: p.ink)),
                    ],
                  ),
                  const SizedBox(height: 6),
                  FutureBuilder<List<ReminderPayment>>(
                    future: _paymentsFuture,
                    builder: (context, snap) {
                      if (snap.connectionState != ConnectionState.done) {
                        return const Padding(
                          padding: EdgeInsets.symmetric(vertical: 14),
                          child: Center(
                            child: SizedBox(
                              width: 16, height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            ),
                          ),
                        );
                      }
                      final payments = snap.data ?? const <ReminderPayment>[];
                      if (snap.hasError || payments.isEmpty) {
                        return Padding(
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          child: Text('No payments recorded yet',
                            style: TextStyle(fontSize: 12.5, color: p.inkMute)),
                        );
                      }
                      return Column(
                        children: [
                          for (int i = 0; i < payments.length; i++) ...[
                            if (i > 0) Divider(height: 1, color: p.line),
                            Padding(
                              padding: const EdgeInsets.symmetric(vertical: 10),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Text(formatINRZero(payments[i].amount),
                                      style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800, color: p.ink)),
                                  ),
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    children: [
                                      Text(dateMedium(payments[i].paidAt),
                                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: p.inkSoft)),
                                      if (payments[i].transactionId != null)
                                        Padding(
                                          padding: const EdgeInsets.only(top: 2),
                                          child: Text(payments[i].transactionId!,
                                            style: TextStyle(fontSize: 10.5, color: p.inkMute)),
                                        ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ],
                      );
                    },
                  ),
                ],
              ),
            ),
          ),
          if (!reminder.paid)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
                child: _marking
                    ? Container(
                        height: 52,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: p.green.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(99),
                        ),
                        child: SizedBox(
                          width: 18, height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2.2, color: p.green),
                        ),
                      )
                    : SlideToConfirm(
                        onConfirm: _markPaid,
                        label: 'Slide to confirm payment',
                      ),
              ),
            ),
          const SliverToBoxAdapter(child: SizedBox(height: 20)),
        ],
        ),
      ),
    );
  }

  Widget _infoGrid(BuildContext context) {
    return Column(
      children: [
        _row(LucideIcons.circleDollarSign, 'Owner', reminder.owner ?? '—'),
        _row(LucideIcons.folderKanban, 'Category', categoryLabel(reminder.category)),
        _row(LucideIcons.users, 'Family group', groupOf(reminder.category).label),
      ],
    );
  }

  Widget _row(IconData icon, String label, String? value) {
    final p = AppPalette.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: p.inkMute),
          const SizedBox(width: 10),
          SizedBox(
            width: 118,
            child: Text(label, style: TextStyle(fontSize: 13, color: p.inkMute)),
          ),
          Expanded(
            child: Text(value ?? '—',
              style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600, color: p.ink)),
          ),
        ],
      ),
    );
  }
}

class _PaymentRequest {
  final double amount;
  final String txnId;
  const _PaymentRequest({required this.amount, required this.txnId});
}

class _ConfirmPaidDialog extends StatefulWidget {
  final String reminderTitle;
  final double initialAmount;
  const _ConfirmPaidDialog({required this.reminderTitle, required this.initialAmount});

  @override
  State<_ConfirmPaidDialog> createState() => _ConfirmPaidDialogState();
}

class _ConfirmPaidDialogState extends State<_ConfirmPaidDialog> {
  final _txnCtrl = TextEditingController();
  late final TextEditingController _amountCtrl =
      TextEditingController(text: widget.initialAmount > 0 ? _stripZeros(widget.initialAmount) : '');

  double? get _parsedAmount => double.tryParse(_amountCtrl.text.trim().replaceAll(',', ''));

  bool get _valid =>
      (_parsedAmount != null && _parsedAmount! > 0) &&
      _txnCtrl.text.trim().isNotEmpty;

  static String _stripZeros(double v) {
    final s = v == v.roundToDouble() ? v.round().toString() : v.toStringAsFixed(2);
    return s;
  }

  @override
  void dispose() {
    _txnCtrl.dispose();
    _amountCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final p = AppPalette.of(context);
    return Dialog(
      backgroundColor: p.card,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(22, 20, 22, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: p.green.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(LucideIcons.checkCircle2, color: p.green, size: 26),
              ),
              const SizedBox(height: 14),
              Text('Yes, paid?',
                style: TextStyle(fontSize: 19, fontWeight: FontWeight.w800, color: p.ink)),
              const SizedBox(height: 6),
              Text('Mark "${widget.reminderTitle}" as paid?',
                style: TextStyle(fontSize: 13.5, color: p.inkSoft)),
              const SizedBox(height: 14),
              TextField(
                controller: _amountCtrl,
                autofocus: true,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                style: TextStyle(color: p.ink),
                decoration: const InputDecoration(
                  labelText: 'Amount paid (₹)',
                  hintText: 'e.g. 5000',
                  prefixText: '₹ ',
                  border: OutlineInputBorder(),
                ),
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _txnCtrl,
                textCapitalization: TextCapitalization.characters,
                style: TextStyle(color: p.ink),
                decoration: const InputDecoration(
                  labelText: 'Transaction ID',
                  hintText: 'e.g. UPI ref / bank txn id',
                  border: OutlineInputBorder(),
                ),
                onChanged: (_) => setState(() {}),
              ),
              if (_amountCtrl.text.trim().isNotEmpty && _parsedAmount == null)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text('Enter a valid amount',
                    style: TextStyle(fontSize: 11.5, color: p.danger)),
                ),
              const SizedBox(height: 18),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: FilledButton(
                  onPressed: !_valid
                      ? null
                      : () => Navigator.pop(context, _PaymentRequest(
                          amount: _parsedAmount!,
                          txnId: _txnCtrl.text.trim(),
                        )),
                  style: FilledButton.styleFrom(
                    backgroundColor: p.green,
                    foregroundColor: p.onBlue,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  child: const Text('Yes, paid', style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800)),
                ),
              ),
              SizedBox(
                width: double.infinity,
                child: TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: Text('Back', style: TextStyle(color: p.inkSoft)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}