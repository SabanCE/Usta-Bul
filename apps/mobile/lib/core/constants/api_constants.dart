class ApiConstants {
  static const String baseUrl = 'https://usta-bul-1.onrender.com/api/v1';
  static const String healthUrl = 'https://usta-bul-1.onrender.com/health';

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
