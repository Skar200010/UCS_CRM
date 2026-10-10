class ReminderPayment {
  final int id;
  final double? amount;
  final String? paidAt;
  final String? transactionId;
  final String? paidBy;
  final String? reminderTitle;

  const ReminderPayment({
    required this.id,
    this.amount,
    this.paidAt,
    this.transactionId,
    this.paidBy,
    this.reminderTitle,
  });

  factory ReminderPayment.fromJson(Map<String, dynamic> json) {
    final reminder = json['reminders'];
    final reminderTitle = reminder is Map ? reminder['title']?.toString() : null;
    return ReminderPayment(
      id: int.tryParse('${json['id']}') ?? 0,
      amount: json['amount'] != null ? double.tryParse('${json['amount']}') : null,
      paidAt: json['paid_at']?.toString(),
      transactionId: json['transaction_id']?.toString(),
      paidBy: json['paid_by']?.toString(),
      reminderTitle: reminderTitle,
    );
  }
}