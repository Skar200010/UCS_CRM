import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'models/reminder.dart';
import 'pages/detail_page.dart';
import 'pages/login_page.dart';
import 'pages/main_shell.dart';
import 'services/api_service.dart';
import 'services/notification_service.dart';
import 'theme.dart';
import 'widgets/app_loader.dart';

void _applySystemUi(Brightness brightness) {
  final isLight = brightness == Brightness.light;
  SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
    statusBarBrightness: Brightness.dark,
    systemNavigationBarColor: isLight ? Colors.white : const Color(0xFF131415),
    systemNavigationBarIconBrightness:
        isLight ? Brightness.dark : Brightness.light,
  ));
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  _applySystemUi(
      WidgetsBinding.instance.platformDispatcher.platformBrightness);
  try {
    await Firebase.initializeApp();
  } catch (_) {}
  runApp(const BillReminderApp());
}

class BillReminderApp extends StatefulWidget {
  const BillReminderApp({super.key});

  @override
  State<BillReminderApp> createState() => _BillReminderAppState();
}

class _BillReminderAppState extends State<BillReminderApp> {
  final GlobalKey<NavigatorState> _navigatorKey = GlobalKey<NavigatorState>();
  bool? _loggedIn;

  @override
  void initState() {
    super.initState();
    NotificationService().setNavigatorKey(_navigatorKey);
    ApiService.onUnauthorized = _handleUnauthorized;
    _init();
  }

  /// Called when the backend rejects the stored token (expired/invalid).
  /// Clears any open routes and returns to the login screen.
  void _handleUnauthorized() {
    if (!mounted) return;
    _navigatorKey.currentState?.popUntil((r) => r.isFirst);
    setState(() => _loggedIn = false);
  }

  Future<void> _init() async {
    try {
      await NotificationService().init();
    } catch (_) {}
    String? token;
    try {
      // Recover a lapsed-but-refreshable session before deciding whether to
      // show the login screen, so users are not logged out after a few days.
      await ApiService.ensureSession();
      token = await ApiService.getToken();
    } catch (_) {}
    if (mounted) setState(() => _loggedIn = token != null);
    await _handleInitialPush();
  }

  Future<void> _handleInitialPush() async {
    try {
      final loggedIn = await ApiService.getToken();
      if (loggedIn == null) return;
      final message = await FirebaseMessaging.instance.getInitialMessage();
      if (message == null) return;
      final id = message.data['reminderId'];
      if (id == null || id.toString().isEmpty) return;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _navigatorKey.currentState
            ?.pushNamed('/detail', arguments: {'id': id.toString()});
      });
    } catch (_) {}
  }

  Widget _notFound() => const Scaffold(
        body: Center(child: Text('Reminder not found')),
      );

  Future<void> _logout() async {
    try {
      await ApiService.clearAuth();
    } catch (_) {}
    _navigatorKey.currentState?.popUntil((r) => r.isFirst);
    if (mounted) setState(() => _loggedIn = false);
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Bill Reminder',
      debugShowCheckedModeBanner: false,
      navigatorKey: _navigatorKey,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: ThemeMode.system,
      builder: (context, child) =>
          _SystemUiScope(child: child ?? const SizedBox.shrink()),
      routes: {
        '/detail': (context) {
          final args = ModalRoute.of(context)?.settings.arguments;
          final id = (args is Map && args['id'] != null) ? args['id'].toString() : null;
          if (id == null || id.isEmpty) return _notFound();
          return FutureBuilder<Map<String, dynamic>?>(
            future: ApiService.fetchReminderById(id),
            builder: (context, snap) {
              if (snap.connectionState != ConnectionState.done) {
                return const Scaffold(
                  body: AppLoader(message: 'Loading reminder…'),
                );
              }
              final data = snap.data;
              if (data == null) return _notFound();
              return DetailPage(
                reminder: Reminder.fromJson(Map<String, dynamic>.from(data)),
              );
            },
          );
        },
      },
      home: _loggedIn == null
          ? const _BootScreen()
          : _loggedIn!
              ? MainShell(onLogout: _logout)
              : LoginPage(onLogin: () {
                  setState(() => _loggedIn = true);
                }),
    );
  }
}

/// Branded splash shown while the stored session is being resolved.
class _BootScreen extends StatelessWidget {
  const _BootScreen();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: kHeaderGradient),
        child: const SafeArea(
          child: AppLoader(
            onGradient: true,
            message: 'Getting things ready…',
          ),
        ),
      ),
    );
  }
}

/// Keeps system status/navigation bar styles in sync with the active theme
/// (follows the phone's light/dark setting via [ThemeMode.system]).
class _SystemUiScope extends StatefulWidget {
  final Widget child;
  const _SystemUiScope({required this.child});

  @override
  State<_SystemUiScope> createState() => _SystemUiScopeState();
}

class _SystemUiScopeState extends State<_SystemUiScope> {
  @override
  Widget build(BuildContext context) {
    final brightness = Theme.of(context).brightness;
    _applySystemUi(brightness);
    return widget.child;
  }
}
