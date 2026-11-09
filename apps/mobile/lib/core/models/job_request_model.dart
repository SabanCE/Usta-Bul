class JobRequestModel {
  final String id;
  final String customerName;
  final String category;
  final String title;
  final String description;
  final String address;
  final String city;
  final String district;
  final String urgency;
  final String status;
  final String createdAt;
  final List<String> images;
  final int bidsCount;

  JobRequestModel({
    required this.id,
    this.customerName = 'Müşteri',
    required this.category,
    required this.title,
    required this.description,
    required this.address,
    required this.city,
    required this.district,
    required this.urgency,
    required this.status,
    required this.createdAt,
    required this.images,
    this.bidsCount = 0,
  });

  String get locationLabel {
    final area = [district, city].where((part) => part.trim().isNotEmpty).join(', ');
    if (area.isNotEmpty) return area;
    if (address.trim().isNotEmpty) return address;
    return 'Konum belirtilmedi';
  }

  factory JobRequestModel.fromJson(Map<String, dynamic> json) {
    return JobRequestModel(
      id: json['id']?.toString() ?? '',
      customerName: json['customer_name'] ?? json['customerName'] ?? 'Müşteri',
      category: json['category'] ?? 'Genel',
      title: json['title'] ?? '',
      description: json['description'] ?? '',
      address: json['address'] ?? '',
      city: json['city'] ?? '',
      district: json['district'] ?? '',
      urgency: json['urgency'] ?? 'normal',
      status: json['status'] ?? 'pending',
      createdAt: json['created_at'] ?? 'Bugün',
      images: (json['images'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
      bidsCount: json['bids_count'] is int ? json['bids_count'] : 0,
    );
  }
}
