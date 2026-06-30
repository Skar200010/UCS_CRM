import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/api_service.dart';

class CorrectionTicketPage extends StatefulWidget {
  final ScrollController? scrollController;
  const CorrectionTicketPage({super.key, this.scrollController});

  @override
  State<CorrectionTicketPage> createState() => _CorrectionTicketPageState();
}

class _CorrectionTicketPageState extends State<CorrectionTicketPage> {
  final _formKey = GlobalKey<FormState>();
  List<dynamic> _history = [];
  bool _loadingHistory = true;
  bool _submitting = false;
  String? _error;

  dynamic _selectedRecord;
  String _field = 'punch_in';
  TimeOfDay _correctedTime = TimeOfDay.now();
  final _reasonController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  Future<void> _loadHistory() async {
    try {
      final history = await ApiService.getHistory();
      if (mounted) setState(() { _history = history; _loadingHistory = false; });
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _loadingHistory = false; });
    }
  }

  Future<void> _submit() async {
    if (_selectedRecord == null) return;
    if (_reasonController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please provide a reason')),
      );
      return;
    }
    setState(() => _submitting = true);
    try {
      final now = DateTime.now();
      final dateStr = _selectedRecord!['date'] as String;
      final correctedDateTime = DateTime(
        int.parse(dateStr.split('-')[0]),
        int.parse(dateStr.split('-')[1]),
        int.parse(dateStr.split('-')[2]),
        _correctedTime.hour,
        _correctedTime.minute,
      );
      await ApiService.raiseCorrectionTicket({
        'attendance_id': _selectedRecord!['id'],
        'date': dateStr,
        'field': _field,
        'requested_time': correctedDateTime.toUtc().toIso8601String(),
        'reason': _reasonController.text.trim(),
      });
      if (mounted) {
        Navigator.of(context).pop(true);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Ticket raised successfully')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final sc = Theme.of(context).colorScheme;
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Raise a Ticket', style: GoogleFonts.hankenGrotesk(
                    fontSize: 18, fontWeight: FontWeight.w700, color: sc.onSurface,
                  )),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
            ),
            const Divider(),
            Expanded(
              child: _loadingHistory
                  ? const Center(child: CircularProgressIndicator())
                  : _error != null
                      ? Center(child: Text(_error!, style: const TextStyle(color: Colors.red)))
                      : _history.isEmpty
                          ? const Center(child: Text('No attendance records found'))
                          : ListView(
                              padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
                              children: [
                                Text('Select Date', style: GoogleFonts.hankenGrotesk(
                                  fontSize: 13, fontWeight: FontWeight.w600, color: sc.onSurfaceVariant,
                                )),
                                const SizedBox(height: 8),
                                DropdownButtonFormField<dynamic>(
                                  value: _selectedRecord,
                                  decoration: InputDecoration(
                                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
                                  ),
                                  hint: const Text('Choose a date'),
                                  items: _history.map((r) {
                                    final date = r['date'] ?? '';
                                    final status = r['status'] ?? '';
                                    return DropdownMenuItem(
                                      value: r,
                                      child: Text('$date  •  ${status.toUpperCase()}'),
                                    );
                                  }).toList(),
                                  onChanged: (v) {
                                    setState(() {
                                      _selectedRecord = v;
                                      if (v != null) {
                                        final pi = v['punch_in_time'] as String?;
                                        if (pi != null) {
                                          final dt = DateTime.parse(pi).toLocal();
                                          _correctedTime = TimeOfDay.fromDateTime(dt);
                                        }
                                      }
                                    });
                                  },
                                ),
                                if (_selectedRecord != null) ...[
                                  const SizedBox(height: 16),
                                  Text('Field to Correct', style: GoogleFonts.hankenGrotesk(
                                    fontSize: 13, fontWeight: FontWeight.w600, color: sc.onSurfaceVariant,
                                  )),
                                  const SizedBox(height: 8),
                                  DropdownButtonFormField<String>(
                                    value: _field,
                                    decoration: InputDecoration(
                                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
                                    ),
                                    items: const [
                                      DropdownMenuItem(value: 'punch_in', child: Text('Punch In')),
                                      DropdownMenuItem(value: 'punch_out', child: Text('Punch Out')),
                                    ],
                                    onChanged: (v) {
                                      setState(() => _field = v!);
                                      if (_selectedRecord != null) {
                                        final key = v == 'punch_in' ? 'punch_in_time' : 'punch_out_time';
                                        final time = _selectedRecord![key] as String?;
                                        if (time != null) {
                                          final dt = DateTime.parse(time).toLocal();
                                          _correctedTime = TimeOfDay.fromDateTime(dt);
                                        }
                                      }
                                    },
                                  ),
                                  const SizedBox(height: 16),
                                  Text('Corrected Time', style: GoogleFonts.hankenGrotesk(
                                    fontSize: 13, fontWeight: FontWeight.w600, color: sc.onSurfaceVariant,
                                  )),
                                  const SizedBox(height: 8),
                                  InkWell(
                                    onTap: () async {
                                      final picked = await showTimePicker(
                                        context: context,
                                        initialTime: _correctedTime,
                                      );
                                      if (picked != null) setState(() => _correctedTime = picked);
                                    },
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
                                      decoration: BoxDecoration(
                                        border: Border.all(color: sc.outline),
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
                                          Text(_correctedTime.format(context)),
                                          const Icon(Icons.access_time, size: 18),
                                        ],
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 16),
                                  Text('Reason', style: GoogleFonts.hankenGrotesk(
                                    fontSize: 13, fontWeight: FontWeight.w600, color: sc.onSurfaceVariant,
                                  )),
                                  const SizedBox(height: 8),
                                  TextFormField(
                                    controller: _reasonController,
                                    maxLines: 3,
                                    decoration: InputDecoration(
                                      hintText: 'Explain why the time needs correction...',
                                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                                      contentPadding: const EdgeInsets.all(12),
                                    ),
                                    validator: (v) => v == null || v.trim().isEmpty ? 'Reason is required' : null,
                                  ),
                                ],
                              ],
                            ),
            ),
            if (_selectedRecord != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
                child: SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    onPressed: _submitting ? null : _submit,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF5B6B4E),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    child: _submitting
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : Text('Submit Ticket', style: GoogleFonts.hankenGrotesk(fontSize: 15, fontWeight: FontWeight.w600)),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
