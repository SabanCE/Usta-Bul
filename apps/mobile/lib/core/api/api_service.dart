import 'dart:convert';
import 'package:http/http.dart' as http;
import '../constants/api_constants.dart';
import '../storage/token_storage.dart';
import '../models/user_model.dart';

class ApiResponse<T> {
  final bool success;
  final T? data;
  final String? message;
  final int statusCode;

  ApiResponse({
    required this.success,
    this.data,
    this.message,
    required this.statusCode,
  });
}

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  final http.Client _client = http.Client();

  // Temel Header Oluşturucu (Bearer Token dahil)
  Future<Map<String, String>> _getHeaders({bool requireAuth = true}) async {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (requireAuth) {
      final token = await TokenStorage.getAccessToken();
      if (token != null && token.isNotEmpty) {
        headers['Authorization'] = 'Bearer $token';
      }
    }

    return headers;
  }

  // ==========================================
  // AUTH İŞLEMLERİ
  // ==========================================

  // 1. Giriş Yap (Login)
  Future<ApiResponse<UserModel>> login({
    required String email,
    required String password,
  }) async {
    final url = Uri.parse('${ApiConstants.baseUrl}${ApiConstants.login}');

    try {
      final response = await _client
          .post(
            url,
            headers: await _getHeaders(requireAuth: false),
            body: jsonEncode({
              'email': email.trim(),
              'password': password,
            }),
          )
          .timeout(const Duration(seconds: 7));

      final decoded =
          jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;

      if (response.statusCode == 200 && decoded['success'] == true) {
        final data = decoded['data'] as Map<String, dynamic>;
        final user = UserModel.fromJson(data['user'] as Map<String, dynamic>);
        final tokens = data['tokens'] as Map<String, dynamic>;

        // Token ve oturum bilgilerini yerel depolamaya kaydet
        await TokenStorage.saveUserSession(
          id: user.id,
          name: user.fullName,
          role: user.role,
          accessToken: tokens['accessToken'] as String,
          refreshToken: tokens['refreshToken'] as String,
        );

        return ApiResponse(
          success: true,
          data: user,
          message: decoded['message'] as String? ?? 'Giriş başarılı',
          statusCode: response.statusCode,
        );
      } else {
        final error = decoded['error'];
        final errorMsg = error is Map ? error['message'] : decoded['message'];
        return ApiResponse(
          success: false,
          message: errorMsg?.toString() ?? 'Giriş yapılamadı',
          statusCode: response.statusCode,
        );
      }
    } catch (e) {
      return ApiResponse(
        success: false,
        message: 'Sunucuya bağlanılamadı: $e',
        statusCode: 503,
      );
    }
  }

  // 2. Kayıt Ol (Register - Müşteri veya Usta)
  Future<ApiResponse<UserModel>> register({
    required String email,
    required String password,
    required String fullName,
    String? phone,
    required String role, // 'customer' veya 'artisan'
    Map<String, dynamic>? artisanProfile,
    Map<String, dynamic>? customerLocation,
  }) async {
    final url = Uri.parse('${ApiConstants.baseUrl}${ApiConstants.register}');

    try {
      final body = <String, dynamic>{
        'email': email.trim(),
        'password': password,
        'fullName': fullName.trim(),
        'phone': phone,
        'role': role,
      };

      if (role == 'artisan' && artisanProfile != null) {
        body['artisanProfile'] = artisanProfile;
      }
      if (role == 'customer' && customerLocation != null) {
        body['customerLocation'] = customerLocation;
      }

      final response = await _client.post(
        url,
        headers: await _getHeaders(requireAuth: false),
        body: jsonEncode(body),
      );

      final decoded =
          jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;

      if (response.statusCode == 201 && decoded['success'] == true) {
        final data = decoded['data'] as Map<String, dynamic>;
        final user = UserModel.fromJson(data['user'] as Map<String, dynamic>);
        final tokens = data['tokens'] as Map<String, dynamic>;

        await TokenStorage.saveUserSession(
          id: user.id,
          name: user.fullName,
          role: user.role,
          accessToken: tokens['accessToken'] as String,
          refreshToken: tokens['refreshToken'] as String,
        );

        return ApiResponse(
          success: true,
          data: user,
          message: 'Kayıt başarılı',
          statusCode: response.statusCode,
        );
      } else {
        final error = decoded['error'];
        final errorMsg = error is Map ? error['message'] : decoded['message'];
        return ApiResponse(
          success: false,
          message: errorMsg?.toString() ?? 'Kayıt işlemi başarısız',
          statusCode: response.statusCode,
        );
      }
    } catch (e) {
      return ApiResponse(
        success: false,
        message: 'Sunucu bağlantı hatası: $e',
        statusCode: 503,
      );
    }
  }

  // 3. Token Yenileme (Refresh Token Rotation)
  Future<bool> refreshToken() async {
    final currentRefreshToken = await TokenStorage.getRefreshToken();
    if (currentRefreshToken == null) return false;

    final url =
        Uri.parse('${ApiConstants.baseUrl}${ApiConstants.refreshToken}');

    try {
      final response = await _client.post(
        url,
        headers: await _getHeaders(requireAuth: false),
        body: jsonEncode({'refreshToken': currentRefreshToken}),
      );

      if (response.statusCode == 200) {
        final decoded =
            jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
        final tokens = decoded['data']['tokens'] as Map<String, dynamic>;

        await TokenStorage.saveTokens(
          accessToken: tokens['accessToken'] as String,
          refreshToken: tokens['refreshToken'] as String,
        );
        return true;
      }
    } catch (_) {}

    return false;
  }

  // 4. Çıkış Yap (Logout)
  Future<void> logout() async {
    final currentRefreshToken = await TokenStorage.getRefreshToken();
    if (currentRefreshToken != null) {
      try {
        final url = Uri.parse('${ApiConstants.baseUrl}${ApiConstants.logout}');
        await _client.post(
          url,
          headers: await _getHeaders(requireAuth: false),
          body: jsonEncode({'refreshToken': currentRefreshToken}),
        );
      } catch (_) {}
    }
    await TokenStorage.clear();
  }

  // ==========================================
  // GENEL GET / POST / PATCH / DELETE İSTEKLERİ
  // (Otomatik Bearer Token ve 401 Durumunda Token Yenileme Destekli)
  // ==========================================

  Future<http.Response> get(String endpoint,
      {Map<String, dynamic>? queryParams, bool requireAuth = true}) async {
    Uri url = Uri.parse('${ApiConstants.baseUrl}$endpoint');
    if (queryParams != null && queryParams.isNotEmpty) {
      url = url.replace(
          queryParameters:
              queryParams.map((k, v) => MapEntry(k, v.toString())));
    }

    var headers = await _getHeaders(requireAuth: requireAuth);
    var response = await _client.get(url, headers: headers);

    // 401 Unauthorized ise bir kez refresh token dene
    if (response.statusCode == 401 && requireAuth) {
      final refreshed = await refreshToken();
      if (refreshed) {
        headers = await _getHeaders(requireAuth: true);
        response = await _client.get(url, headers: headers);
      }
    }

    return response;
  }

  Future<http.Response> post(String endpoint,
      {Map<String, dynamic>? body, bool requireAuth = true}) async {
    final url = Uri.parse('${ApiConstants.baseUrl}$endpoint');
    var headers = await _getHeaders(requireAuth: requireAuth);

    var response = await _client.post(
      url,
      headers: headers,
      body: body != null ? jsonEncode(body) : null,
    );

    if (response.statusCode == 401 && requireAuth) {
      final refreshed = await refreshToken();
      if (refreshed) {
        headers = await _getHeaders(requireAuth: true);
        response = await _client.post(
          url,
          headers: headers,
          body: body != null ? jsonEncode(body) : null,
        );
      }
    }

    return response;
  }

  Future<http.Response> patch(String endpoint,
      {Map<String, dynamic>? body, bool requireAuth = true}) async {
    final url = Uri.parse('${ApiConstants.baseUrl}$endpoint');
    var headers = await _getHeaders(requireAuth: requireAuth);

    var response = await _client.patch(
      url,
      headers: headers,
      body: body != null ? jsonEncode(body) : null,
    );

    if (response.statusCode == 401 && requireAuth) {
      final refreshed = await refreshToken();
      if (refreshed) {
        headers = await _getHeaders(requireAuth: true);
        response = await _client.patch(
          url,
          headers: headers,
          body: body != null ? jsonEncode(body) : null,
        );
      }
    }

    return response;
  }
}
