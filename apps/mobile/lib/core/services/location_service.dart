import 'package:geolocator/geolocator.dart';

class LocationResult {
  final double? latitude;
  final double? longitude;
  final String? error;

  const LocationResult._({this.latitude, this.longitude, this.error});

  factory LocationResult.success(double latitude, double longitude) {
    return LocationResult._(latitude: latitude, longitude: longitude);
  }

  factory LocationResult.failure(String error) {
    return LocationResult._(error: error);
  }

  bool get hasLocation => latitude != null && longitude != null;
}

class LocationService {
  const LocationService._();

  /// Cihazın mevcut konumunu izin kontrolleriyle birlikte döner.
  static Future<LocationResult> getCurrentPosition() async {
    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        return LocationResult.failure(
          'Konum servisleri kapalı. Lütfen cihaz ayarlarından açıp tekrar deneyin.',
        );
      }

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      if (permission == LocationPermission.denied) {
        return LocationResult.failure('Konum izni verilmedi.');
      }

      if (permission == LocationPermission.deniedForever) {
        return LocationResult.failure(
          'Konum izni kalıcı olarak reddedildi. Lütfen uygulama ayarlarından izin verin.',
        );
      }

      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 10),
      );

      return LocationResult.success(position.latitude, position.longitude);
    } catch (_) {
      return LocationResult.failure('Konumunuz alınamadı. Lütfen tekrar deneyin.');
    }
  }
}
