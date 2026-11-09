class ArtisanModel {
  final String id;
  final String fullName;
  final String category;
  final String bio;
  final int experienceYears;
  final double rating;
  final int totalReviews;
  final double? hourlyRate;
  final String city;
  final String district;
  final double? distanceKm;
  final int? serviceRadiusKm;
  final String? avatarUrl;
  final bool isAvailable;

  ArtisanModel({
    required this.id,
    required this.fullName,
    required this.category,
    required this.bio,
    required this.experienceYears,
    required this.rating,
    required this.totalReviews,
    this.hourlyRate,
    required this.city,
    required this.district,
    this.distanceKm,
    this.serviceRadiusKm,
    this.avatarUrl,
    this.isAvailable = true,
  });

  String get locationLabel {
    final parts = [district, city].where((part) => part.trim().isNotEmpty).toList();
    return parts.join(', ');
  }

  factory ArtisanModel.fromJson(Map<String, dynamic> json) {
    return ArtisanModel(
      id: json['id']?.toString() ?? '',
      fullName: json['full_name'] ?? json['fullName'] ?? 'İsimsiz Usta',
      category: json['category'] ?? 'Genel',
      bio: json['bio'] ?? '',
      experienceYears: json['experience_years'] is int
          ? json['experience_years']
          : int.tryParse(json['experience_years']?.toString() ?? '0') ?? 0,
      rating: json['rating'] is num
          ? (json['rating'] as num).toDouble()
          : double.tryParse(json['rating']?.toString() ?? '5.0') ?? 5.0,
      totalReviews: json['total_reviews'] is int
          ? json['total_reviews']
          : int.tryParse(json['total_reviews']?.toString() ?? '0') ?? 0,
      hourlyRate: json['hourly_rate'] != null
          ? (json['hourly_rate'] is num ? (json['hourly_rate'] as num).toDouble() : double.tryParse(json['hourly_rate'].toString()))
          : null,
      city: json['city'] ?? '',
      district: json['district'] ?? '',
      distanceKm: json['distance_km'] != null
          ? (json['distance_km'] is num ? (json['distance_km'] as num).toDouble() : double.tryParse(json['distance_km'].toString()))
          : null,
      serviceRadiusKm: json['service_radius_km'] is int
          ? json['service_radius_km']
          : int.tryParse(json['service_radius_km']?.toString() ?? ''),
      avatarUrl: json['avatar_url'] ?? json['avatarUrl'],
      isAvailable: json['is_available'] ?? true,
    );
  }
}
