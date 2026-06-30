import 'package:flutter/material.dart';

class MiniCalendar extends StatelessWidget {
  final int year;
  final int month;
  final Map<String, String> statusByDate;
  final String? selectedDate;
  final ValueChanged<String>? onDateSelected;
  final Map<String, List<String>> calendarDates;

  const MiniCalendar({
    super.key,
    required this.year,
    required this.month,
    this.statusByDate = const {},
    this.selectedDate,
    this.onDateSelected,
    this.calendarDates = const {},
  });

  @override
  Widget build(BuildContext context) {
    final days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    final firstDay = DateTime(year, month, 1).weekday % 7;
    final monthDays = DateTime(year, month + 1, 0).day;
    final now = DateTime.now();
    final isCurrentMonth = now.year == year && now.month == month;

    return Column(
      children: [
        Row(
          children: days.map((d) => Expanded(
            child: Center(
              child: Text(d, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: const Color(0xFF74777e))),
            ),
          )).toList(),
        ),
        const SizedBox(height: 4),
        ...List.generate((firstDay + monthDays + 6) ~/ 7, (row) {
          return Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Row(
              children: List.generate(7, (col) {
                final dayNum = row * 7 + col - firstDay + 1;
                if (dayNum < 1 || dayNum > monthDays) return const Expanded(child: SizedBox());
                final key = '${year}-${month.toString().padLeft(2, '0')}-${dayNum.toString().padLeft(2, '0')}';
                final status = statusByDate[key];
                final calTypes = calendarDates[key] ?? <String>[];
                final wd = DateTime(year, month, dayNum).weekday;
                final isWeekend = wd == DateTime.saturday || wd == DateTime.sunday;
                final isToday = isCurrentMonth && dayNum == now.day;
                final isFuture = isCurrentMonth && dayNum > now.day ||
                    (year == now.year && month > now.month) || year > now.year;

                Color? bg;
                Color? fg;
                bool hasBorder = false;
                bool filled = false;

                if (status != null) {
                  switch (status) {
                    case 'present':
                      bg = const Color(0xFFaff1ca);
                      fg = const Color(0xFF0a5135);
                      filled = true;
                      break;
                    case 'absent':
                      bg = const Color(0xFFffdad6);
                      fg = const Color(0xFFba1a1a);
                      filled = true;
                      break;
                    case 'late':
                      bg = const Color(0xFFffddb8);
                      fg = const Color(0xFF653e00);
                      filled = true;
                      break;
                    case 'leave':
                      bg = const Color(0xFFd1e4ff);
                      fg = const Color(0xFF011d35);
                      filled = true;
                      break;
                    case 'holiday':
                      bg = const Color(0xFFe8d5f5);
                      fg = const Color(0xFF5a2a8a);
                      filled = true;
                      break;
                  }
                }

                if (isToday && !filled) {
                  bg = const Color(0xFFd1e4ff);
                  fg = const Color(0xFF00152a);
                  hasBorder = true;
                }

                if (!filled && (wd == DateTime.sunday || isFuture)) {
                  fg = const Color(0xFF74777e).withValues(alpha: 0.3);
                } else if (!filled && !isToday && !isFuture && wd != DateTime.sunday) {
                  bg = const Color(0xFFffdad6);
                  fg = const Color(0xFFba1a1a);
                }

                final isSelected = selectedDate == key;

                return Expanded(
                  child: GestureDetector(
                    onTap: onDateSelected != null ? () => onDateSelected!(key) : null,
                    child: Container(
                      padding: EdgeInsets.symmetric(vertical: calTypes.isNotEmpty ? 4 : 6),
                      decoration: BoxDecoration(
                        color: isSelected ? const Color(0xFF00152a) : bg,
                        borderRadius: BorderRadius.circular(4),
                        border: hasBorder ? Border.all(color: const Color(0xFF00152a), width: 2) : null,
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text('$dayNum',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: filled || isToday ? FontWeight.w700 : FontWeight.w400,
                              color: isSelected ? Colors.white : (fg ?? const Color(0xFF171c1f)),
                            ),
                          ),
                          if (calTypes.isNotEmpty)
                            Padding(
                              padding: const EdgeInsets.only(top: 2),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: calTypes.map((t) {
                                  Color dotColor;
                                  switch (t) {
                                    case 'holiday':
                                      dotColor = const Color(0xFF7c3aed);
                                      break;
                                    case 'event':
                                      dotColor = const Color(0xFF2563eb);
                                      break;
                                    case 'birthday':
                                      dotColor = const Color(0xFFf43f5e);
                                      break;
                                    default:
                                      dotColor = const Color(0xFF74777e);
                                  }
                                  return Container(
                                    width: 5, height: 5,
                                    margin: const EdgeInsets.symmetric(horizontal: 1),
                                    decoration: BoxDecoration(
                                      color: isSelected ? Colors.white : dotColor,
                                      shape: BoxShape.circle,
                                    ),
                                  );
                                }).toList(),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                );
              }),
            ),
          );
        }),
      ],
    );
  }
}
