import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'services/api_service.dart';
import 'services/notification_service.dart';
import 'services/supabase_service.dart';
import 'pages/login_page.dart';
import 'pages/onboarding_page.dart';
import 'pages/home_page.dart';
import 'pages/profile_page.dart';
import 'pages/splash_page.dart';

bool firebaseInitialized = false;

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    await Firebase.initializeApp();
    firebaseInitialized = true;
  } catch (e) {
    print('Firebase init error: $e');
  }
  try {
    await SupabaseService.initialize();
  } catch (e) {
    print('Supabase init error (non-fatal): $e');
  }
  SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.dark,
    statusBarBrightness: Brightness.light,
  ));
  final navigatorKey = GlobalKey<NavigatorState>();
  runApp(UfsAttendApp(navigatorKey: navigatorKey));
}

class AppColors extends ThemeExtension<AppColors> {
  final Color primaryFixed;
  final Color primaryFixedDim;
  final Color onPrimaryFixed;
  final Color onPrimaryFixedVariant;
  final Color secondaryContainer;
  final Color onSecondaryContainer;
  final Color secondaryFixed;
  final Color secondaryFixedDim;
  final Color onSecondaryFixed;
  final Color onSecondaryFixedVariant;
  final Color tertiary;
  final Color tertiaryContainer;
  final Color onTertiary;
  final Color onTertiaryContainer;
  final Color tertiaryFixed;
  final Color tertiaryFixedDim;
  final Color onTertiaryFixed;
  final Color onTertiaryFixedVariant;
  final Color surfaceContainerLowest;
  final Color surfaceContainerLow;
  final Color surfaceContainer;
  final Color surfaceContainerHigh;
  final Color surfaceContainerHighest;
  final Color surfaceDim;
  final Color surfaceBright;
  final Color surfaceVariant;
  final Color outline;
  final Color outlineVariant;
  final Color inverseSurface;
  final Color inverseOnSurface;
  final Color inversePrimary;

  const AppColors({
    required this.primaryFixed,
    required this.primaryFixedDim,
    required this.onPrimaryFixed,
    required this.onPrimaryFixedVariant,
    required this.secondaryContainer,
    required this.onSecondaryContainer,
    required this.secondaryFixed,
    required this.secondaryFixedDim,
    required this.onSecondaryFixed,
    required this.onSecondaryFixedVariant,
    required this.tertiary,
    required this.tertiaryContainer,
    required this.onTertiary,
    required this.onTertiaryContainer,
    required this.tertiaryFixed,
    required this.tertiaryFixedDim,
    required this.onTertiaryFixed,
    required this.onTertiaryFixedVariant,
    required this.surfaceContainerLowest,
    required this.surfaceContainerLow,
    required this.surfaceContainer,
    required this.surfaceContainerHigh,
    required this.surfaceContainerHighest,
    required this.surfaceDim,
    required this.surfaceBright,
    required this.surfaceVariant,
    required this.outline,
    required this.outlineVariant,
    required this.inverseSurface,
    required this.inverseOnSurface,
    required this.inversePrimary,
  });

  @override
  ThemeExtension<AppColors> copyWith({
    Color? primaryFixed,
    Color? primaryFixedDim,
    Color? onPrimaryFixed,
    Color? onPrimaryFixedVariant,
    Color? secondaryContainer,
    Color? onSecondaryContainer,
    Color? secondaryFixed,
    Color? secondaryFixedDim,
    Color? onSecondaryFixed,
    Color? onSecondaryFixedVariant,
    Color? tertiary,
    Color? tertiaryContainer,
    Color? onTertiary,
    Color? onTertiaryContainer,
    Color? tertiaryFixed,
    Color? tertiaryFixedDim,
    Color? onTertiaryFixed,
    Color? onTertiaryFixedVariant,
    Color? surfaceContainerLowest,
    Color? surfaceContainerLow,
    Color? surfaceContainer,
    Color? surfaceContainerHigh,
    Color? surfaceContainerHighest,
    Color? surfaceDim,
    Color? surfaceBright,
    Color? surfaceVariant,
    Color? outline,
    Color? outlineVariant,
    Color? inverseSurface,
    Color? inverseOnSurface,
    Color? inversePrimary,
  }) =>
      AppColors(
        primaryFixed: primaryFixed ?? this.primaryFixed,
        primaryFixedDim: primaryFixedDim ?? this.primaryFixedDim,
        onPrimaryFixed: onPrimaryFixed ?? this.onPrimaryFixed,
        onPrimaryFixedVariant: onPrimaryFixedVariant ?? this.onPrimaryFixedVariant,
        secondaryContainer: secondaryContainer ?? this.secondaryContainer,
        onSecondaryContainer: onSecondaryContainer ?? this.onSecondaryContainer,
        secondaryFixed: secondaryFixed ?? this.secondaryFixed,
        secondaryFixedDim: secondaryFixedDim ?? this.secondaryFixedDim,
        onSecondaryFixed: onSecondaryFixed ?? this.onSecondaryFixed,
        onSecondaryFixedVariant: onSecondaryFixedVariant ?? this.onSecondaryFixedVariant,
        tertiary: tertiary ?? this.tertiary,
        tertiaryContainer: tertiaryContainer ?? this.tertiaryContainer,
        onTertiary: onTertiary ?? this.onTertiary,
        onTertiaryContainer: onTertiaryContainer ?? this.onTertiaryContainer,
        tertiaryFixed: tertiaryFixed ?? this.tertiaryFixed,
        tertiaryFixedDim: tertiaryFixedDim ?? this.tertiaryFixedDim,
        onTertiaryFixed: onTertiaryFixed ?? this.onTertiaryFixed,
        onTertiaryFixedVariant: onTertiaryFixedVariant ?? this.onTertiaryFixedVariant,
        surfaceContainerLowest: surfaceContainerLowest ?? this.surfaceContainerLowest,
        surfaceContainerLow: surfaceContainerLow ?? this.surfaceContainerLow,
        surfaceContainer: surfaceContainer ?? this.surfaceContainer,
        surfaceContainerHigh: surfaceContainerHigh ?? this.surfaceContainerHigh,
        surfaceContainerHighest: surfaceContainerHighest ?? this.surfaceContainerHighest,
        surfaceDim: surfaceDim ?? this.surfaceDim,
        surfaceBright: surfaceBright ?? this.surfaceBright,
        surfaceVariant: surfaceVariant ?? this.surfaceVariant,
        outline: outline ?? this.outline,
        outlineVariant: outlineVariant ?? this.outlineVariant,
        inverseSurface: inverseSurface ?? this.inverseSurface,
        inverseOnSurface: inverseOnSurface ?? this.inverseOnSurface,
        inversePrimary: inversePrimary ?? this.inversePrimary,
      );

  @override
  ThemeExtension<AppColors> lerp(covariant ThemeExtension<AppColors>? other, double t) => this;

  static const light = AppColors(
    primaryFixed: Color(0xFFd1e4ff),
    primaryFixedDim: Color(0xFFb0c9e8),
    onPrimaryFixed: Color(0xFF011d35),
    onPrimaryFixedVariant: Color(0xFF314863),
    secondaryContainer: Color(0xFFbfdbfe),
    onSecondaryContainer: Color(0xFF1d4ed8),
    secondaryFixed: Color(0xFFbfdbfe),
    secondaryFixedDim: Color(0xFF93c5fd),
    onSecondaryFixed: Color(0xFF172554),
    onSecondaryFixedVariant: Color(0xFF1e3a8a),
    tertiary: Color(0xFF201100),
    tertiaryContainer: Color(0xFF3c2300),
    onTertiary: Color(0xFFffffff),
    onTertiaryContainer: Color(0xFFc28228),
    tertiaryFixed: Color(0xFFffddb8),
    tertiaryFixedDim: Color(0xFFffb95f),
    onTertiaryFixed: Color(0xFF2a1700),
    onTertiaryFixedVariant: Color(0xFF653e00),
    surfaceContainerLowest: Color(0xFFffffff),
    surfaceContainerLow: Color(0xFFf0f4f8),
    surfaceContainer: Color(0xFFeaeef2),
    surfaceContainerHigh: Color(0xFFe4e9ed),
    surfaceContainerHighest: Color(0xFFdfe3e7),
    surfaceDim: Color(0xFFd6dade),
    surfaceBright: Color(0xFFf6fafe),
    surfaceVariant: Color(0xFFdfe3e7),
    outline: Color(0xFF74777e),
    outlineVariant: Color(0xFFc3c6ce),
    inverseSurface: Color(0xFF2c3134),
    inverseOnSurface: Color(0xFFedf1f5),
    inversePrimary: Color(0xFFb0c9e8),
  );
}

class UfsAttendApp extends StatelessWidget {
  final GlobalKey<NavigatorState> navigatorKey;
  const UfsAttendApp({super.key, required this.navigatorKey});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorKey: navigatorKey,
      title: 'UFS Attend',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.light,
        colorScheme: const ColorScheme.light(
          primary: Color(0xFF00152a),
          onPrimary: Color(0xFFffffff),
          primaryContainer: Color(0xFF102a43),
          onPrimaryContainer: Color(0xFF7a92b0),
          secondary: Color(0xFF2563eb),
          onSecondary: Color(0xFFffffff),
          secondaryContainer: Color(0xFFbfdbfe),
          onSecondaryContainer: Color(0xFF1d4ed8),
          surface: Color(0xFFf6fafe),
          onSurface: Color(0xFF171c1f),
          surfaceContainerHighest: Color(0xFFdfe3e7),
          outline: Color(0xFF74777e),
          error: Color(0xFFba1a1a),
          onError: Color(0xFFffffff),
          errorContainer: Color(0xFFffdad6),
          onErrorContainer: Color(0xFF93000a),
          inverseSurface: Color(0xFF2c3134),
          onInverseSurface: Color(0xFFedf1f5),
          inversePrimary: Color(0xFFb0c9e8),
        ),
        extensions: const [AppColors.light],
        scaffoldBackgroundColor: const Color(0xFFf6fafe),
        textTheme: GoogleFonts.manropeTextTheme().copyWith(
          headlineLarge: GoogleFonts.hankenGrotesk(
            fontSize: 24, fontWeight: FontWeight.w700, height: 32 / 24,
          ),
          headlineMedium: GoogleFonts.hankenGrotesk(
            fontSize: 20, fontWeight: FontWeight.w600, height: 28 / 20,
          ),
          headlineSmall: GoogleFonts.hankenGrotesk(
            fontSize: 18, fontWeight: FontWeight.w600, height: 24 / 18,
          ),
          titleLarge: GoogleFonts.hankenGrotesk(
            fontSize: 24, fontWeight: FontWeight.w700, height: 32 / 24,
          ),
          bodyLarge: GoogleFonts.manrope(
            fontSize: 16, fontWeight: FontWeight.w400, height: 24 / 16,
          ),
          bodyMedium: GoogleFonts.manrope(
            fontSize: 14, fontWeight: FontWeight.w400, height: 20 / 14,
          ),
          labelLarge: GoogleFonts.manrope(
            fontSize: 14, fontWeight: FontWeight.w600, height: 20 / 20, letterSpacing: 0.02,
          ),
          labelMedium: GoogleFonts.manrope(
            fontSize: 12, fontWeight: FontWeight.w600, height: 16 / 12, letterSpacing: 0.05,
          ),
          labelSmall: GoogleFonts.manrope(
            fontSize: 11, fontWeight: FontWeight.w700, height: 12 / 11,
          ),
        ),
      ),
      home: const AuthGate(),
    );
  }
}

class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  bool? _loggedIn;
  bool _showOnboarding = false;

  @override
  void initState() {
    super.initState();
    _checkAuth();
  }

  Future<void> _checkAuth() async {
    try {
      final token = await ApiService.getToken().timeout(const Duration(seconds: 2));
      if (token != null && firebaseInitialized) {
        await NotificationService().init();
      }
      if (token != null) {
        // Always query server; use local cache only as fallback
        final prefs = await SharedPreferences.getInstance();
        try {
          final status = await ApiService.checkOnboardingStatus().timeout(const Duration(seconds: 2));
          final serverCompleted = status['onboarding_completed'] == true;
          if (serverCompleted) {
            await prefs.setBool('has_seen_onboarding', true);
          }
          setState(() {
            _loggedIn = true;
            _showOnboarding = !serverCompleted;
          });
        } catch (_) {
          // Server unreachable — fall back to local cache
          final locallySeen = prefs.getBool('has_seen_onboarding') ?? false;
          setState(() {
            _loggedIn = true;
            _showOnboarding = !locallySeen;
          });
        }
      } else {
        setState(() => _loggedIn = false);
      }
    } catch (_) {
      setState(() => _loggedIn = false);
    }
  }

  void _onLogin() async {
    if (firebaseInitialized) {
      NotificationService().init();
    }
    // Always query server; use local cache only as fallback
    final prefs = await SharedPreferences.getInstance();
    try {
      final status = await ApiService.checkOnboardingStatus();
      final serverCompleted = status['onboarding_completed'] == true;
      if (serverCompleted) {
        await prefs.setBool('has_seen_onboarding', true);
      }
      if (!mounted) return;
      setState(() {
        _loggedIn = true;
        _showOnboarding = !serverCompleted;
      });
    } catch (_) {
      // Server unreachable — fall back to local cache
      final locallySeen = prefs.getBool('has_seen_onboarding') ?? false;
      if (!mounted) return;
      setState(() {
        _loggedIn = true;
        _showOnboarding = !locallySeen;
      });
    }
  }

  Future<void> _onOnboardingComplete() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('has_seen_onboarding', true);
    setState(() => _showOnboarding = false);
  }

  void _onLogout() async {
    await ApiService.clearAuth();
    setState(() {
      _loggedIn = false;
      _showOnboarding = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_loggedIn == null) {
      return const SplashPage();
    }
    if (_loggedIn == true) {
      if (_showOnboarding) {
        return OnboardingPage(onComplete: _onOnboardingComplete);
      }
      return MainShell(onLogout: _onLogout);
    }
    return LoginPage(onLogin: _onLogin);
  }
}

class MainShell extends StatefulWidget {
  final VoidCallback onLogout;
  const MainShell({super.key, required this.onLogout});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _currentIndex = 0;
  int _tabChangeVersion = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: [
          HomePage(tabChangeVersion: _tabChangeVersion),
          ProfilePage(onLogout: widget.onLogout, tabChangeVersion: _tabChangeVersion),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Container(
          height: 72,
          decoration: BoxDecoration(
            color: const Color(0xFFf6fafe),
            border: Border(top: BorderSide(color: const Color(0xFFc3c6ce).withValues(alpha: 0.5))),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 8,
                offset: const Offset(0, -2),
              ),
            ],
          ),
          child: Row(
            children: [
              _NavItem(
                icon: Icons.home_outlined,
                activeIcon: Icons.home,
                label: 'Home',
                isActive: _currentIndex == 0,
                onTap: () { if (_currentIndex != 0) { _tabChangeVersion++; setState(() => _currentIndex = 0); } },
              ),
              _NavItem(
                icon: Icons.person_outline,
                activeIcon: Icons.person,
                label: 'Profile',
                isActive: _currentIndex == 1,
                onTap: () { if (_currentIndex != 1) { _tabChangeVersion++; setState(() => _currentIndex = 1); } },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  final IconData icon;
  final IconData activeIcon;
  final String label;
  final bool isActive;
  final VoidCallback onTap;

  const _NavItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.isActive,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              isActive ? activeIcon : icon,
              size: 24,
              color: isActive ? const Color(0xFF2563eb) : const Color(0xFF74777e),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 11, fontWeight: FontWeight.w600,
                color: isActive ? const Color(0xFF2563eb) : const Color(0xFF74777e),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
