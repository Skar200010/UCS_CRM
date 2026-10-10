import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../services/api_service.dart';
import '../services/notification_service.dart';
import '../services/reminders_controller.dart';
import '../theme.dart';
import 'all_payments_page.dart';

class SettingsPage extends StatefulWidget {
  final RemindersController controller;
  final VoidCallback onLogout;
  const SettingsPage({super.key, required this.controller, required this.onLogout});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  bool? _fcmRegistered;
  bool _checkingFcm = true;
  bool _refreshing = false;
  String? _myToken;

  @override
  void initState() {
    super.initState();
    _checkFcm();
  }

  Future<void> _checkFcm() async {
    setState(() => _checkingFcm = true);
    try {
      final token = await ApiService.resolveFcmToken();
      if (mounted) {
        setState(() {
          _myToken = token;
          _fcmRegistered = token != null && token.isNotEmpty;
          _checkingFcm = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _fcmRegistered = false;
          _checkingFcm = false;
        });
      }
    }
  }

  String? get _pushStatus {
    if (_checkingFcm) return null;
    if (_fcmRegistered == true) return 'Registered on this device';
    if (NotificationService.initError != null) {
      return 'Unavailable — ${NotificationService.initError}';
    }
    return 'Not registered yet — check phone notification permission';
  }

  void _snack(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  Future<void> _copyToken() async {
    final t = _myToken;
    if (t == null) {
      _snack('No token loaded yet — tap Re-register below');
      return;
    }
    await Clipboard.setData(ClipboardData(text: t));
    if (mounted) _snack('Device token copied');
  }

  Future<void> _sendTestPush() async {
    if (_myToken == null) {
      _snack('Register a token first — tap Re-register below');
      return;
    }
    setState(() => _refreshing = true);
    try {
      final r = await ApiService.sendTestPush();
      if (mounted) _snack('${r['message'] ?? 'Test push sent'}');
    } catch (e) {
      if (mounted) _snack('Failed: ${e.toString().replaceFirst('Exception: ', '')}');
    } finally {
      if (mounted) setState(() => _refreshing = false);
    }
  }

  Future<void> _createTestEntry() async {
    setState(() => _refreshing = true);
    try {
      final r = await ApiService.createTestEntry();
      await widget.controller.refresh();
      if (mounted) _snack('${r['message'] ?? 'Test entry created'} — check Alerts');
    } catch (e) {
      if (mounted) _snack('Failed: ${e.toString().replaceFirst('Exception: ', '')}');
    } finally {
      if (mounted) setState(() => _refreshing = false);
    }
  }

  Future<void> _reRegister() async {
    setState(() => _refreshing = true);
    RemindersController.registerFcmToken();
    await Future<void>.delayed(const Duration(milliseconds: 800));
    await _checkFcm();
    if (mounted) setState(() => _refreshing = false);
  }

  Future<void> _sync() async {
    setState(() => _refreshing = true);
    await widget.controller.refresh();
    if (mounted) setState(() => _refreshing = false);
  }

  @override
  Widget build(BuildContext context) {
    final p = AppPalette.of(context);
    return Scaffold(
      backgroundColor: p.bg,
      body: ListenableBuilder(
        listenable: widget.controller,
        builder: (context, _) {
          final c = widget.controller;
          return RefreshIndicator(
            onRefresh: _sync,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: EdgeInsets.zero,
              children: [
                Container(
                  padding: EdgeInsets.fromLTRB(20, MediaQuery.paddingOf(context).top + 18, 20, 26),
                  decoration: const BoxDecoration(
                    gradient: kHeaderGradient,
                    borderRadius: BorderRadius.vertical(bottom: Radius.circular(28)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Settings',
                        style: GoogleFonts.hankenGrotesk(fontSize: 22, fontWeight: FontWeight.w800, color: Colors.white)),
                      const SizedBox(height: 4),
                      Text('Account, sync & preferences',
                        style: TextStyle(fontSize: 13, color: Colors.white.withValues(alpha: 0.7))),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _section('Account'),
                      _card([
                        _tile(
                          icon: LucideIcons.userCog,
                          iconBg: p.blue,
                          title: 'Signed in as',
                          subtitle: 'Super Admin (UFS House)',
                        ),
                        Divider(height: 1, color: p.line),
                        _tile(
                          icon: LucideIcons.clock3,
                          iconBg: const Color(0xFF64748b),
                          title: 'Last login',
                          subtitle: c.lastLogin ?? '—',
                        ),
                      ]),
                      const SizedBox(height: 20),
                      _section('Notifications'),
                      _card([
                        _tile(
                          icon: LucideIcons.bellRing,
                          iconBg: const Color(0xFF7c3aed),
                          title: 'Push alerts',
                          subtitle: _pushStatus ?? 'Checking…',
                          trailing: _checkingFcm
                              ? const SizedBox(
                                  width: 16, height: 16,
                                  child: CircularProgressIndicator(strokeWidth: 2))
                              : _statusDot(_fcmRegistered == true),
                        ),
                        if (_fcmRegistered != true) ...[
                          Divider(height: 1, color: p.line),
                          InkWell(
                            onTap: _reRegister,
                            child: Padding(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              child: Row(
                                children: [
                                  const SizedBox(width: 34),
                                  if (_refreshing)
                                    const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
                                  else
                                    Icon(LucideIcons.refreshCw, size: 14, color: p.blue),
                                  const SizedBox(width: 8),
                                  Text('Re-register push token',
                                    style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: p.blue)),
                                ],
                              ),
                            ),
                          ),
                        ],
                        Divider(height: 1, color: p.line),
                        _tile(
                          icon: LucideIcons.keyRound,
                          iconBg: const Color(0xFF475569),
                          title: 'Device token',
                          subtitle: _checkingFcm
                              ? 'Loading…'
                              : (_myToken != null && _myToken!.isNotEmpty ? _myToken! : 'Missing'),
                          isToken: true,
                          trailing: IconButton(
                            onPressed: _copyToken,
                            icon: Icon(LucideIcons.copy, size: 15, color: p.inkMute),
                            tooltip: 'Copy token',
                          ),
                        ),
                      ]),
                      const SizedBox(height: 20),
                      _section('Push Test'),
                      _card([
                        _tile(
                          icon: LucideIcons.send,
                          iconBg: p.blue,
                          title: 'Send test push',
                          subtitle: 'Instantly notifies this phone via FCM',
                          onTap: _sendTestPush,
                          trailing: _refreshing
                              ? const SizedBox(
                                  width: 16, height: 16,
                                  child: CircularProgressIndicator(strokeWidth: 2))
                              : Icon(LucideIcons.chevronRight, size: 16, color: p.inkMute),
                        ),
                        Divider(height: 1, color: p.line),
                        _tile(
                          icon: LucideIcons.plusCircle,
                          iconBg: p.green,
                          title: 'Create test entry',
                          subtitle: 'Adds a due-today reminder & notifies — test the slide-to-pay flow',
                          onTap: _createTestEntry,
                          trailing: _refreshing
                              ? const SizedBox(
                                  width: 16, height: 16,
                                  child: CircularProgressIndicator(strokeWidth: 2))
                              : Icon(LucideIcons.chevronRight, size: 16, color: p.inkMute),
                        ),
                      ]),
                      const SizedBox(height: 20),
                      _section('Data & Sync'),
                      _card([
                        _tile(
                          icon: LucideIcons.history,
                          iconBg: const Color(0xFFb45309),
                          title: 'All Payments',
                          subtitle: 'Combined payment history across every reminder',
                          onTap: () => Navigator.of(context).push(
                            MaterialPageRoute(builder: (_) => const AllPaymentsPage()),
                          ),
                          trailing: Icon(LucideIcons.chevronRight, size: 16, color: p.inkMute),
                        ),
                        Divider(height: 1, color: p.line),
                        _tile(
                          icon: LucideIcons.layers,
                          iconBg: const Color(0xFF0891b2),
                          title: 'Reminders',
                          subtitle: '${c.reminders.length} active · ${c.notifications.length} alerts',
                        ),
                        Divider(height: 1, color: p.line),
                        _tile(
                          icon: LucideIcons.refreshCw,
                          iconBg: p.green,
                          title: 'Last synced',
                          subtitle: c.syncedAt != null ? DateFormat('d MMM yyyy, h:mm a').format(c.syncedAt!) : 'Not yet',
                          onTap: _sync,
                        ),
                      ]),
                      const SizedBox(height: 20),
                      _section('About'),
                      _card([
                        _tile(
                          icon: LucideIcons.walletCards,
                          iconBg: const Color(0xFFd97706),
                          title: 'Bill Reminder',
                          subtitle: 'Version 1.0.0 · Android',
                        ),
                        Divider(height: 1, color: p.line),
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          child: Row(
                            children: [
                              Icon(LucideIcons.globe, size: 15, color: p.inkMute),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Text(ApiService.baseUrl,
                                  maxLines: 1, overflow: TextOverflow.ellipsis,
                                  style: TextStyle(fontSize: 12, color: p.inkMute)),
                              ),
                            ],
                          ),
                        ),
                      ]),
                      const SizedBox(height: 26),
                      SizedBox(
                        width: double.infinity,
                        height: 50,
                        child: FilledButton.icon(
                          onPressed: widget.onLogout,
                          style: FilledButton.styleFrom(
                            backgroundColor: p.danger.withValues(alpha: 0.1),
                            foregroundColor: p.danger,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          ),
                          icon: const Icon(LucideIcons.logOut, size: 18),
                          label: const Text('Sign out',
                            style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800)),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Center(
                        child: Text('Managed from the Bill Reminder web admin',
                          style: TextStyle(fontSize: 11, color: p.inkMute)),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _section(String title) {
    final p = AppPalette.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(title,
        style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, letterSpacing: 1, color: p.inkMute)),
    );
  }

  Widget _card(List<Widget> children) {
    final p = AppPalette.of(context);
    return Container(
      decoration: BoxDecoration(
        color: p.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: p.line),
      ),
      child: Column(children: children),
    );
  }

  Widget _tile({
    required IconData icon,
    required Color iconBg,
    required String title,
    required String subtitle,
    Widget? trailing,
    VoidCallback? onTap,
    bool isToken = false,
  }) {
    final p = AppPalette.of(context);
    return InkWell(
      onTap: onTap ?? () {},
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(color: iconBg.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(9)),
              child: Icon(icon, size: 15, color: iconBg),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: p.ink)),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    overflow: TextOverflow.ellipsis,
                    maxLines: isToken ? 2 : 1,
                    style: TextStyle(fontSize: isToken ? 10.5 : 12, color: p.inkMute),
                  ),
                ],
              ),
            ),
            trailing ?? const SizedBox.shrink(),
          ],
        ),
      ),
    );
  }

  Widget _statusDot(bool ok) {
    final p = AppPalette.of(context);
    final color = ok ? p.green : p.danger;
    return Container(
      width: 9,
      height: 9,
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
        boxShadow: [BoxShadow(color: color.withValues(alpha: 0.4), blurRadius: 6, spreadRadius: 1)],
      ),
    );
  }
}