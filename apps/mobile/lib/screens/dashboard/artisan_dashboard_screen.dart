import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../../core/api/api_service.dart';
import '../../core/theme/app_theme.dart';

class ArtisanDashboardScreen extends StatefulWidget {
  const ArtisanDashboardScreen({super.key});

  @override
  State<ArtisanDashboardScreen> createState() => _ArtisanDashboardScreenState();
}

class _ArtisanDashboardScreenState extends State<ArtisanDashboardScreen> {
  bool _isLoading = true;
  bool _isAvailable = true;
  double? _rating;
  double? _latitude;
  double? _longitude;
  List<dynamic> _opportunities = [];
  final Set<String> _submittedBids = {};
  String? _errorMessage;
  bool _updatingAvailability = false;

  // Teklif modalı alanları
  final TextEditingController _priceController = TextEditingController();
  final TextEditingController _durationController = TextEditingController();
  final TextEditingController _noteController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _fetchOpportunities();
  }

  @override
  void dispose() {
    _priceController.dispose();
    _durationController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  Future<void> _fetchOpportunities() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final response = await ApiService().get(
        '/requests/artisan/dashboard',
        requireAuth: true,
      );
      if (response.statusCode != 200) {
        throw Exception('İş fırsatları yüklenemedi.');
      }
      final decoded = jsonDecode(utf8.decode(response.bodyBytes));
      final data = decoded is Map ? decoded['data'] : null;
      if (data is! Map || data['opportunities'] is! List) {
        throw Exception('İş fırsatları yanıtı geçersiz.');
      }
      var available = _isAvailable;
      double? rating = _rating;
      final submitted = <String>{};

      final profileData = data['profile'];
      if (profileData is Map) {
        if (profileData['is_available'] is bool) {
          available = profileData['is_available'] as bool;
        }
        if (profileData['rating'] is num) {
          rating = (profileData['rating'] as num).toDouble();
        }
        if (profileData['latitude'] is num && profileData['longitude'] is num) {
          _latitude = (profileData['latitude'] as num).toDouble();
          _longitude = (profileData['longitude'] as num).toDouble();
        }
      }

      final bidsData = data['bids'];
      if (bidsData is List) {
        for (final bid in bidsData) {
          if (bid is Map && bid['request_id'] != null) {
            submitted.add(bid['request_id'].toString());
          }
        }
      }

      if (!mounted) return;
      setState(() {
        _opportunities = data['opportunities'] as List;
        _isAvailable = available;
        _rating = rating;
        _isLoading = false;
        _submittedBids
          ..clear()
          ..addAll(submitted);
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _opportunities = [];
        _isLoading = false;
        _errorMessage = error.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  void _showBidBottomSheet(Map<String, dynamic> opp) {
    _priceController.clear();
    _durationController.clear();
    _noteController.clear();

    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (sheetContext) {
        bool submitting = false;
        String? error;

        return StatefulBuilder(
          builder: (context, setSheetState) {
            return Padding(
              padding: EdgeInsets.only(
                bottom: MediaQuery.of(context).viewInsets.bottom,
                left: 20,
                right: 20,
                top: 12,
              ),
              child: ConstrainedBox(
                constraints: BoxConstraints(
                  maxHeight: (MediaQuery.sizeOf(context).height -
                          MediaQuery.viewInsetsOf(context).bottom) *
                      0.88,
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.max,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Teklif Ver',
                            style: TextStyle(
                                color: AppColors.ink,
                                fontSize: 18,
                                fontWeight: FontWeight.w700)),
                        IconButton(
                          icon: const Icon(Icons.close,
                              color: AppColors.inkFaint),
                          onPressed: () => Navigator.pop(sheetContext),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      opp['title'] ?? '',
                      style: const TextStyle(
                          color: AppColors.accent,
                          fontSize: 14,
                          fontWeight: FontWeight.w600),
                    ),
                    if (error != null) ...[
                      const SizedBox(height: 12),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: AppColors.dangerSoft,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          error!,
                          style: const TextStyle(
                              color: AppColors.danger, fontSize: 12),
                        ),
                      ),
                    ],
                    Expanded(
                      child: SingleChildScrollView(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const SizedBox(height: 16),
                            const Text('Teklif Tutarı (₺)',
                                style: TextStyle(
                                    color: AppColors.inkSecondary,
                                    fontSize: 13)),
                            const SizedBox(height: 6),
                            TextField(
                              controller: _priceController,
                              keyboardType: TextInputType.number,
                              style: const TextStyle(
                                  color: AppColors.ink, fontSize: 15),
                              decoration: _inputDecoration('Örn: 650'),
                            ),
                            const SizedBox(height: 14),
                            const Text('Tahmini Varış / Süre',
                                style: TextStyle(
                                    color: AppColors.inkSecondary,
                                    fontSize: 13)),
                            const SizedBox(height: 6),
                            TextField(
                              controller: _durationController,
                              style: const TextStyle(
                                  color: AppColors.ink, fontSize: 15),
                              decoration:
                                  _inputDecoration('Örn: 30 dakika içinde'),
                            ),
                            const SizedBox(height: 14),
                            const Text('Müşteriye Notunuz',
                                style: TextStyle(
                                    color: AppColors.inkSecondary,
                                    fontSize: 13)),
                            const SizedBox(height: 6),
                            TextField(
                              controller: _noteController,
                              maxLines: 2,
                              style: const TextStyle(
                                  color: AppColors.ink, fontSize: 15),
                              decoration: _inputDecoration('Açıklama girin'),
                            ),
                            const SizedBox(height: 20),
                          ],
                        ),
                      ),
                    ),
                    SizedBox(
                      width: double.infinity,
                      height: 50,
                      child: ElevatedButton(
                        onPressed: submitting
                            ? null
                            : () async {
                                final reqId = opp['id'].toString();
                                final parsedPrice = double.tryParse(
                                    _priceController.text.trim());

                                if (parsedPrice == null || parsedPrice <= 0) {
                                  setSheetState(() => error =
                                      'Geçerli bir teklif tutarı girin.');
                                  return;
                                }

                                setSheetState(() {
                                  submitting = true;
                                  error = null;
                                });

                                try {
                                  final response = await ApiService().post(
                                    '/requests/$reqId/bids',
                                    body: {
                                      'price': parsedPrice,
                                      'estimatedDuration': _durationController
                                              .text
                                              .trim()
                                              .isEmpty
                                          ? null
                                          : _durationController.text.trim(),
                                      'note':
                                          _noteController.text.trim().isEmpty
                                              ? null
                                              : _noteController.text.trim(),
                                    },
                                    requireAuth: true,
                                  );

                                  if (!mounted) return;

                                  if (response.statusCode == 201 ||
                                      response.statusCode == 200) {
                                    setState(() => _submittedBids.add(reqId));
                                    navigator.pop();
                                    messenger.showSnackBar(
                                      const SnackBar(
                                        content: Text(
                                            'Teklifiniz başarıyla müşteriye iletildi!'),
                                      ),
                                    );
                                    return;
                                  }

                                  String message = 'Teklif gönderilemedi.';
                                  try {
                                    final decoded = jsonDecode(
                                        utf8.decode(response.bodyBytes));
                                    final err = decoded['error'];
                                    if (err is Map && err['message'] != null) {
                                      message = err['message'].toString();
                                    } else if (decoded['message'] != null) {
                                      message = decoded['message'].toString();
                                    }
                                  } catch (_) {}

                                  setSheetState(() {
                                    submitting = false;
                                    error = message;
                                  });
                                } catch (_) {
                                  if (!mounted) return;
                                  setSheetState(() {
                                    submitting = false;
                                    error =
                                        'Teklif gönderilemedi. Lütfen bağlantınızı kontrol edin.';
                                  });
                                }
                              },
                        child: submitting
                            ? const SizedBox(
                                width: 22,
                                height: 22,
                                child: CircularProgressIndicator(
                                    color: Colors.white, strokeWidth: 2.5),
                              )
                            : const Text('Teklifi Gönder',
                                style: TextStyle(fontSize: 15)),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  InputDecoration _inputDecoration(String hint) {
    return InputDecoration(hintText: hint);
  }

  double? _coordinate(dynamic value) {
    if (value is num) return value.toDouble();
    return double.tryParse(value?.toString() ?? '');
  }

  Widget _buildOpportunityMap() {
    final points = _opportunities.whereType<Map>().where((item) {
      final latitude = _coordinate(item['latitude']);
      final longitude = _coordinate(item['longitude']);
      return latitude != null &&
          longitude != null &&
          latitude >= -90 &&
          latitude <= 90 &&
          longitude >= -180 &&
          longitude <= 180;
    }).toList();
    final center = _latitude != null && _longitude != null
        ? LatLng(_latitude!, _longitude!)
        : points.isNotEmpty
            ? LatLng(
                _coordinate(points.first['latitude'])!,
                _coordinate(points.first['longitude'])!,
              )
            : const LatLng(39.2, 34.8);

    return Container(
      height: 250,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Stack(
        children: [
          FlutterMap(
            key: ValueKey('${center.latitude}:${center.longitude}'),
            options: MapOptions(
                initialCenter: center, initialZoom: points.isEmpty ? 6 : 10),
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.ustabul.mobile',
              ),
              MarkerLayer(
                markers: [
                  ...points.map((opportunity) => Marker(
                        point: LatLng(
                          _coordinate(opportunity['latitude'])!,
                          _coordinate(opportunity['longitude'])!,
                        ),
                        width: 42,
                        height: 48,
                        child: GestureDetector(
                          onTap: () => _showOpportunityPreview(
                            Map<String, dynamic>.from(opportunity),
                          ),
                          child: const Icon(
                            Icons.location_on,
                            color: AppColors.danger,
                            size: 40,
                          ),
                        ),
                      )),
                  if (_latitude != null && _longitude != null)
                    Marker(
                      point: LatLng(_latitude!, _longitude!),
                      width: 34,
                      height: 34,
                      child: const Icon(
                        Icons.home_work_rounded,
                        color: AppColors.accent,
                        size: 25,
                      ),
                    ),
                ],
              ),
              const RichAttributionWidget(
                attributions: [
                  TextSourceAttribution('© OpenStreetMap contributors'),
                ],
              ),
            ],
          ),
          if (points.isEmpty)
            const Positioned(
              left: 12,
              right: 12,
              bottom: 12,
              child: Card(
                child: Padding(
                  padding: EdgeInsets.all(8),
                  child: Text('Haritada gösterilecek konumlu iş bulunamadı.'),
                ),
              ),
            ),
        ],
      ),
    );
  }

  void _showOpportunityPreview(Map<String, dynamic> opportunity) {
    final requestId = opportunity['id']?.toString() ?? '';
    final alreadyBid = _submittedBids.contains(requestId);
    showModalBottomSheet<void>(
      context: context,
      useSafeArea: true,
      builder: (context) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              opportunity['title']?.toString() ?? 'İş fırsatı',
              style: const TextStyle(
                color: AppColors.ink,
                fontSize: 18,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _locationLabel(opportunity),
              style: const TextStyle(color: AppColors.inkSecondary),
            ),
            if ((opportunity['description']?.toString() ?? '').isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(
                opportunity['description'].toString(),
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: AppColors.inkSecondary),
              ),
            ],
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: alreadyBid
                    ? null
                    : () {
                        Navigator.pop(context);
                        _showBidBottomSheet(opportunity);
                      },
                child: Text(alreadyBid ? 'Teklif Verildi' : 'Teklif ver'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _toggleAvailability() async {
    if (_updatingAvailability) return;
    setState(() => _updatingAvailability = true);
    try {
      final response = await ApiService().post(
        '/artisans/profile/me',
        body: {'isAvailable': !_isAvailable},
      );
      if (response.statusCode < 200 || response.statusCode >= 300) {
        final body = jsonDecode(utf8.decode(response.bodyBytes));
        final error = body is Map ? body['error'] : null;
        final message = error is Map ? error['message'] : null;
        throw Exception(
            message?.toString() ?? 'Müsaitlik durumu güncellenemedi.');
      }
      if (!mounted) return;
      setState(() => _isAvailable = !_isAvailable);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text(error.toString().replaceFirst('Exception: ', ''))),
      );
    } finally {
      if (mounted) setState(() => _updatingAvailability = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Usta İş Paneli'),
      ),
      body: RefreshIndicator(
        onRefresh: _fetchOpportunities,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Usta İstatistik Kartı
              Container(
                clipBehavior: Clip.antiAlias,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [Color(0xFF073A80), Color(0xFF0756CF)],
                  ),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Stack(
                  children: [
                    Positioned(
                      top: -54,
                      right: -24,
                      child: Container(
                        width: 156,
                        height: 156,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: Colors.white.withOpacity(0.12),
                          ),
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.all(18),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text(
                                'USTA BUL  ·  İŞ PANELİ',
                                style: TextStyle(
                                  color: Color(0xFFDCEAFF),
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 1.1,
                                ),
                              ),
                              InkWell(
                                onTap: _updatingAvailability
                                    ? null
                                    : _toggleAvailability,
                                borderRadius: BorderRadius.circular(20),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 10, vertical: 6),
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(
                                        Icons.circle,
                                        size: 8,
                                        color: _isAvailable
                                            ? AppColors.success
                                            : AppColors.warning,
                                      ),
                                      const SizedBox(width: 6),
                                      Text(
                                        _updatingAvailability
                                            ? 'Güncelleniyor'
                                            : _isAvailable
                                                ? 'Müsait'
                                                : 'Meşgul',
                                        style: TextStyle(
                                          color: _isAvailable
                                              ? AppColors.success
                                              : AppColors.warning,
                                          fontSize: 11,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 13),
                          const Text(
                            'Yeni işler seni bekliyor.',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 20,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -0.3,
                            ),
                          ),
                          const SizedBox(height: 4),
                          const Text(
                            'Bölgenizdeki talepleri keşfedin, size uygun işe teklif verin.',
                            style: TextStyle(
                              color: Color(0xFFDCEAFF),
                              fontSize: 12,
                              height: 1.45,
                            ),
                          ),
                          const SizedBox(height: 16),
                          Row(
                            children: [
                              _buildStatBox(
                                'Yeni fırsat',
                                '${_opportunities.length}',
                                Icons.notifications_active_outlined,
                              ),
                              const SizedBox(width: 8),
                              _buildStatBox(
                                'Tekliflerim',
                                '${_submittedBids.length}',
                                Icons.local_offer_outlined,
                              ),
                              const SizedBox(width: 8),
                              _buildStatBox(
                                'Puanım',
                                _rating != null
                                    ? _rating!.toStringAsFixed(1)
                                    : '-',
                                Icons.star_rate_rounded,
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Yakınınızdaki işler',
                    style: TextStyle(
                      color: AppColors.ink,
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text('${_opportunities.length} iş'),
                ],
              ),
              const SizedBox(height: 12),
              _buildOpportunityMap(),
              const SizedBox(height: 24),

              // Başlık
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Bölgenizdeki Talepler',
                    style: TextStyle(
                        color: AppColors.ink,
                        fontSize: 18,
                        fontWeight: FontWeight.w700),
                  ),
                  Text(
                    '${_opportunities.length} talep',
                    style: const TextStyle(
                        color: AppColors.inkFaint, fontSize: 12),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              if (_isLoading)
                const Center(
                  child: Padding(
                    padding: EdgeInsets.all(40),
                    child: CircularProgressIndicator(),
                  ),
                )
              else if (_errorMessage != null)
                Container(
                  padding: const EdgeInsets.all(24),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Column(
                    children: [
                      const Icon(Icons.cloud_off_rounded,
                          size: 44, color: AppColors.inkFaint),
                      const SizedBox(height: 12),
                      Text(
                        _errorMessage!,
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: AppColors.inkSecondary),
                      ),
                      const SizedBox(height: 12),
                      TextButton(
                        onPressed: _fetchOpportunities,
                        child: const Text('Tekrar dene'),
                      ),
                    ],
                  ),
                )
              else if (_opportunities.isEmpty)
                Container(
                  padding: const EdgeInsets.all(32),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: const Text(
                    'Şu an açık talep bulunmuyor.',
                    style: TextStyle(color: AppColors.inkSecondary),
                  ),
                )
              else
                ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: _opportunities.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 14),
                  itemBuilder: (context, index) {
                    final opp = _opportunities[index];
                    final reqId = opp['id'].toString();
                    final isSubmitted = _submittedBids.contains(reqId);
                    final isUrgent = opp['urgency'] == 'urgent';

                    return Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius:
                            BorderRadius.circular(AppTheme.cardRadius),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(
                                child: Text(
                                  opp['customer_name'] ?? 'Müşteri',
                                  style: const TextStyle(
                                    color: AppColors.accent,
                                    fontWeight: FontWeight.w600,
                                    fontSize: 14,
                                  ),
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: isUrgent
                                      ? AppColors.dangerSoft
                                      : AppColors.accentSoft,
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  isUrgent ? 'ACİL' : 'NORMAL',
                                  style: TextStyle(
                                    color: isUrgent
                                        ? AppColors.danger
                                        : AppColors.accent,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              Container(
                                width: 42,
                                height: 42,
                                decoration: BoxDecoration(
                                  color: isUrgent
                                      ? AppColors.dangerSoft
                                      : AppColors.accentSoft,
                                  borderRadius: BorderRadius.circular(13),
                                ),
                                child: Icon(
                                  Icons.handyman_rounded,
                                  color: isUrgent
                                      ? AppColors.danger
                                      : AppColors.accent,
                                  size: 21,
                                ),
                              ),
                              const SizedBox(width: 11),
                              Expanded(
                                child: Text(
                                  opp['title'] ?? '',
                                  style: const TextStyle(
                                    color: AppColors.ink,
                                    fontSize: 16,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(
                            opp['description'] ?? '',
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                color: AppColors.inkSecondary,
                                fontSize: 13,
                                height: 1.5),
                          ),
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              const Icon(Icons.location_on_outlined,
                                  size: 16, color: AppColors.inkFaint),
                              const SizedBox(width: 4),
                              Text(
                                _locationLabel(opp),
                                style: const TextStyle(
                                    color: AppColors.inkSecondary,
                                    fontSize: 12),
                              ),
                              const Spacer(),
                              Text(
                                opp['created_at'] ?? '',
                                style: const TextStyle(
                                    color: AppColors.inkFaint, fontSize: 12),
                              ),
                            ],
                          ),
                          const SizedBox(height: 14),
                          SizedBox(
                            width: double.infinity,
                            height: 44,
                            child: ElevatedButton(
                              onPressed: isSubmitted
                                  ? null
                                  : () => _showBidBottomSheet(opp),
                              child: Text(
                                isSubmitted
                                    ? 'Teklif Verildi'
                                    : 'Fiyat Teklifi Ver',
                                style: const TextStyle(
                                    fontWeight: FontWeight.w600),
                              ),
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
            ],
          ),
        ),
      ),
    );
  }

  String _locationLabel(dynamic opp) {
    final city = (opp['city'] ?? '').toString().trim();
    final district = (opp['district'] ?? '').toString().trim();
    final address = (opp['address'] ?? '').toString().trim();
    final isApproximate = opp['location_is_approximate'] == true;

    final area = [district, city].where((part) => part.isNotEmpty).join(', ');
    if (area.isNotEmpty) {
      return isApproximate ? '$area · Yaklaşık konum' : area;
    }
    if (address.isNotEmpty) {
      return isApproximate ? '$address · Yaklaşık konum' : address;
    }
    if (isApproximate) return 'Yaklaşık konum';
    return 'Konum belirtilmedi';
  }

  Widget _buildStatBox(String title, String val, IconData icon) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 9),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.13),
          borderRadius: BorderRadius.circular(11),
          border: Border.all(color: Colors.white.withOpacity(0.14)),
        ),
        child: Row(
          children: [
            Icon(icon, color: const Color(0xFFFFD238), size: 18),
            const SizedBox(width: 7),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    val,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                      fontSize: 14,
                    ),
                  ),
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Color(0xFFDCEAFF),
                      fontSize: 9,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
