import 'package:flutter/foundation.dart';
import 'dart:io' show Platform;

class ApiConstants {
  // Emülatör & Cihaz Ağ Ayarları:
  // Android Emulator için: 'http://10.0.2.2:5000/api/v1'
  // Web / Windows / iOS için: 'http://localhost:5000/api/v1'
  static String get baseUrl {
    if (kIsWeb) {
      return 'http://localhost:5000/api/v1';
    }
    try {
      if (Platform.isAndroid) {
        return 'http://10.0.2.2:5000/api/v1';
      }
    } catch (_) {}
    return 'http://localhost:5000/api/v1';
  }

  // Auth Uç Noktaları
  static const String register = '/auth/register';
  static const String login = '/auth/login';
  static const String refreshToken = '/auth/refresh-token';
  static const String logout = '/auth/logout';
  static const String me = '/auth/me';

  // Keşif & Ustalar
  static const String categories = '/categories';
  static const String artisans = '/artisans';

  // İş & Teklifler
  static const String requests = '/requests';
}
