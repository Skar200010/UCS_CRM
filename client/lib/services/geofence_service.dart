import 'dart:async';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'api_service.dart';

class GeofenceService extends ChangeNotifier {
  static final GeofenceService _instance = GeofenceService._();
  factory GeofenceService() => _instance;
  GeofenceService._();

  Timer? _timer;
  bool _isOutside = false;
  DateTime? _exitTime;
  double? _remainingHours;
  bool _autoPunchedOut = false;
  final FlutterLocalNotificationsPlugin _localNotifs = FlutterLocalNotificationsPlugin();
  bool _notifInitialized = false;

  bool get isOutside => _isOutside;
  DateTime? get exitTime => _exitTime;
  double? get remainingHours => _remainingHours;
  bool get autoPunchedOut => _autoPunchedOut;

  void start() {
    if (_timer != null) return;
    _check();
    _timer = Timer.periodic(const Duration(minutes: 5), (_) => _check());
  }

  void stop() {
    _timer?.cancel();
    _timer = null;
    if (_isOutside) {
      _isOutside = false;
      _exitTime = null;
      _remainingHours = null;
      notifyListeners();
    }
  }

  void resetAutoPunchedOut() {
    _autoPunchedOut = false;
    notifyListeners();
  }

  Future<void> _check() async {
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) return;

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) return;

      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 15),
        ),
      );

      final result = await ApiService.reportGeofence(position.latitude, position.longitude);

      final wasOutside = _isOutside;
      final nowOutside = result['isOutside'] == true;
      final autoPunchedOut = result['autoPunchedOut'] == true;

      if (autoPunchedOut) {
        _autoPunchedOut = true;
        _isOutside = false;
        _exitTime = null;
        _remainingHours = null;
        _timer?.cancel();
        _timer = null;
        notifyListeners();
        return;
      }

      _isOutside = nowOutside;

      if (nowOutside) {
        final exitTimeStr = result['exitTime'];
        if (exitTimeStr != null) {
          _exitTime = DateTime.tryParse(exitTimeStr.toString());
        }
        _remainingHours = result['remainingHours']?.toDouble();

        if (!wasOutside && result['isFirstExit'] == true) {
          _showExitNotification();
        }
      } else {
        _exitTime = null;
        _remainingHours = null;
      }

      notifyListeners();
    } catch (_) {}
  }

  Future<void> _showExitNotification() async {
    try {
      if (!_notifInitialized) {
        const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
        const initSettings = InitializationSettings(android: androidSettings);
        await _localNotifs.initialize(initSettings);
        _notifInitialized = true;
      }

      const androidDetails = AndroidNotificationDetails(
        'geofence_channel',
        'Geofence Alerts',
        channelDescription: 'Alerts when leaving work area',
        importance: Importance.high,
        priority: Priority.high,
      );
      const details = NotificationDetails(android: androidDetails);
      await _localNotifs.show(
        999,
        'Outside Work Area',
        'You have left the work area. Return within 4 hours to avoid auto punch-out.',
        details,
      );
    } catch (_) {}
  }
}
