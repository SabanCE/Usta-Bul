import 'dart:convert';
import 'package:flutter/material.dart';
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
  List<dynamic> _opportunities = [];
  final Set<String> _submittedBids = {};
  String? _errorMessage;

  // Teklif modalı alanları
  final TextEditingController _priceController = TextEditingController();
  final TextEditingController _durationController = TextEditingController();
  final TextEditingController _noteController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _fetchOpportunities();
  }

  Future<void> _fetchOpportunities() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final responses = await Future.wait([
        ApiService().get('/requests', requireAuth: true),
        ApiService().get('/artisans/profile/me', requireAuth: true),
        ApiService().get('/requests/artisan/my-bids', requireAuth: true),
      ]);

      final response = responses[0];
      final profileResponse = responses[1];
      final bidsResponse = responses[2];
      var available = _isAvailable;
      double? rating = _rating;
      final submitted = <String>{};

      if (profileResponse.statusCode == 200) {
        final profileDecoded = jsonDecode(utf8.decode(profileResponse.bodyBytes));
        final profileData = profileDecoded['data'];
        if (profileData is Map) {
          if (profileData['is_available'] is bool) {
            available = profileData['is_available'] as bool;
          }
          if (profileData['rating'] is num) {
            rating = (profileData['rating'] as num).toDouble();
          }
        }
      }

      if (bidsResponse.statusCode == 200) {
        final bidsDecoded = jsonDecode(utf8.decode(bidsResponse.bodyBytes));
        final bidsData = bidsDecoded['data'];
        if (bidsData is List) {
          for (final bid in bidsData) {
            if (bid is Map && bid['request_id'] != null) {
              submitted.add(bid['request_id'].toString());
            }
          }
        }
      }

      if (response.statusCode == 200) {
        final decoded = jsonDecode(utf8.decode(response.bodyBytes));
        if (decoded['data'] is List) {
          setState(() {
            _opportunities = decoded['data'];
            _isAvailable = available;
            _rating = rating;
            _submittedBids
              ..clear()
              ..addAll(submitted);
            _isLoading = false;
          });
          return;
        }
      }

      setState(() {
        _opportunities = [];
        _isAvailable = available;
        _rating = rating;
        _isLoading = false;
        _errorMessage = 'İş fırsatları yüklenemedi. Lütfen tekrar deneyin.';
      });
    } catch (_) {
      setState(() {
        _opportunities = [];
        _isLoading = false;
        _errorMessage = 'İş fırsatları yüklenemedi. Lütfen bağlantınızı kontrol edin.';
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
      builder: (sheetContext) {
        bool submitting = false;
        String? error;

        return StatefulBuilder(
          builder: (context, setSheetState) {
            return Padding(
              padding: EdgeInsets.only(
                bottom: MediaQuery.of(context).viewInsets.bottom + 20,
                left: 20,
                right: 20,
                top: 20,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Teklif Ver',
                          style: TextStyle(
                              color: AppColors.ink, fontSize: 18, fontWeight: FontWeight.w700)),
                      IconButton(
                        icon: const Icon(Icons.close, color: AppColors.inkFaint),
                        onPressed: () => Navigator.pop(sheetContext),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    opp['title'] ?? '',
                    style: const TextStyle(
                        color: AppColors.accent, fontSize: 14, fontWeight: FontWeight.w600),
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
                        style: const TextStyle(color: AppColors.danger, fontSize: 12),
                      ),
                    ),
                  ],
                  const SizedBox(height: 16),
                  const Text('Teklif Tutarı (₺)',
                      style: TextStyle(color: AppColors.inkSecondary, fontSize: 13)),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _priceController,
                    keyboardType: TextInputType.number,
                    style: const TextStyle(color: AppColors.ink, fontSize: 15),
                    decoration: _inputDecoration('Örn: 650'),
                  ),
                  const SizedBox(height: 14),
                  const Text('Tahmini Varış / Süre',
                      style: TextStyle(color: AppColors.inkSecondary, fontSize: 13)),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _durationController,
                    style: const TextStyle(color: AppColors.ink, fontSize: 15),
                    decoration: _inputDecoration('Örn: 30 dakika içinde'),
                  ),
                  const SizedBox(height: 14),
                  const Text('Müşteriye Notunuz',
                      style: TextStyle(color: AppColors.inkSecondary, fontSize: 13)),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _noteController,
                    maxLines: 2,
                    style: const TextStyle(color: AppColors.ink, fontSize: 15),
                    decoration: _inputDecoration('Açıklama girin'),
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: ElevatedButton(
                      onPressed: submitting
                          ? null
                          : () async {
                              final reqId = opp['id'].toString();
                              final parsedPrice = double.tryParse(_priceController.text.trim());

                              if (parsedPrice == null || parsedPrice <= 0) {
                                setSheetState(() => error = 'Geçerli bir teklif tutarı girin.');
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
                                    'estimatedDuration':
                                        _durationController.text.trim().isEmpty
                                            ? null
                                            : _durationController.text.trim(),
                                    'note': _noteController.text.trim().isEmpty
                                        ? null
                                        : _noteController.text.trim(),
                                  },
                                  requireAuth: true,
                                );

                                if (!mounted) return;

                                if (response.statusCode == 201 || response.statusCode == 200) {
                                  setState(() => _submittedBids.add(reqId));
                                  navigator.pop();
                                  messenger.showSnackBar(
                                    const SnackBar(
                                      content: Text('Teklifiniz başarıyla müşteriye iletildi!'),
                                    ),
                                  );
                                  return;
                                }

                                String message = 'Teklif gönderilemedi.';
                                try {
                                  final decoded = jsonDecode(utf8.decode(response.bodyBytes));
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
                                  error = 'Teklif gönderilemedi. Lütfen bağlantınızı kontrol edin.';
                                });
                              }
                            },
                      child: submitting
                          ? const SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                            )
                          : const Text('Teklifi Gönder', style: TextStyle(fontSize: 15)),
                    ),
                  ),
                ],
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
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Expanded(
                          child: Text(
                            'Hoş Geldiniz, Usta',
                            style: TextStyle(color: AppColors.ink, fontSize: 18, fontWeight: FontWeight.w700),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: _isAvailable ? AppColors.successSoft : AppColors.warningSoft,
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            _isAvailable ? 'Müsait' : 'Meşgul',
                            style: TextStyle(
                              color: _isAvailable ? AppColors.success : AppColors.warning,
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceAround,
                      children: [
                        _buildStatBox('Yeni Fırsatlar', '${_opportunities.length}', Icons.notifications_active_outlined),
                        _buildStatBox('Verilen Teklif', '${_submittedBids.length}', Icons.local_offer_outlined),
                        _buildStatBox('Puanınız', _rating != null ? _rating!.toStringAsFixed(1) : '-', Icons.star_rate_rounded),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Başlık
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Bölgenizdeki Talepler',
                    style: TextStyle(color: AppColors.ink, fontSize: 18, fontWeight: FontWeight.w700),
                  ),
                  Text(
                    '${_opportunities.length} talep',
                    style: const TextStyle(color: AppColors.inkFaint, fontSize: 12),
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
                      const Icon(Icons.cloud_off_rounded, size: 44, color: AppColors.inkFaint),
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
                        borderRadius: BorderRadius.circular(AppTheme.cardRadius),
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
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: isUrgent ? AppColors.dangerSoft : AppColors.accentSoft,
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  isUrgent ? 'ACİL' : 'NORMAL',
                                  style: TextStyle(
                                    color: isUrgent ? AppColors.danger : AppColors.accent,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(
                            opp['title'] ?? '',
                            style: const TextStyle(color: AppColors.ink, fontSize: 16, fontWeight: FontWeight.w700),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            opp['description'] ?? '',
                            style: const TextStyle(color: AppColors.inkSecondary, fontSize: 13, height: 1.5),
                          ),
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              const Icon(Icons.location_on_outlined, size: 16, color: AppColors.inkFaint),
                              const SizedBox(width: 4),
                              Text(
                                _locationLabel(opp),
                                style: const TextStyle(color: AppColors.inkSecondary, fontSize: 12),
                              ),
                              const Spacer(),
                              Text(
                                opp['created_at'] ?? '',
                                style: const TextStyle(color: AppColors.inkFaint, fontSize: 12),
                              ),
                            ],
                          ),
                          const SizedBox(height: 14),
                          SizedBox(
                            width: double.infinity,
                            height: 44,
                            child: ElevatedButton(
                              onPressed: isSubmitted ? null : () => _showBidBottomSheet(opp),
                              child: Text(
                                isSubmitted ? 'Teklif Verildi' : 'Fiyat Teklifi Ver',
                                style: const TextStyle(fontWeight: FontWeight.w600),
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

    final area = [district, city].where((part) => part.isNotEmpty).join(', ');
    if (area.isNotEmpty) return area;
    if (address.isNotEmpty) return address;
    return 'Konum belirtilmedi';
  }

  Widget _buildStatBox(String title, String val, IconData icon) {
    return Column(
      children: [
        Icon(icon, color: AppColors.accent, size: 24),
        const SizedBox(height: 6),
        Text(val, style: const TextStyle(color: AppColors.ink, fontWeight: FontWeight.w700, fontSize: 16)),
        Text(title, style: const TextStyle(color: AppColors.inkSecondary, fontSize: 11)),
      ],
    );
  }
}
