import 'dart:convert';
import 'package:flutter/material.dart';
import '../../core/api/api_service.dart';
import '../../core/theme/app_theme.dart';
import 'new_request_screen.dart';

class RequestsListScreen extends StatefulWidget {
  const RequestsListScreen({super.key});

  @override
  State<RequestsListScreen> createState() => _RequestsListScreenState();
}

class _RequestsListScreenState extends State<RequestsListScreen> {
  bool _isLoading = true;
  List<dynamic> _requests = [];
  String _filter = 'all';
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _fetchRequests();
  }

  Future<void> _fetchRequests() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    try {
      final response = await ApiService().get('/requests', requireAuth: true);
      if (response.statusCode == 200) {
        final decoded = jsonDecode(utf8.decode(response.bodyBytes));
        if (decoded['data'] is List) {
          setState(() {
            _requests = decoded['data'];
            _isLoading = false;
          });
          return;
        }
      }

      setState(() {
        _requests = [];
        _isLoading = false;
        _errorMessage = 'Talepler yüklenemedi. Lütfen tekrar deneyin.';
      });
    } catch (_) {
      setState(() {
        _requests = [];
        _isLoading = false;
        _errorMessage = 'Talepler yüklenemedi. Lütfen bağlantınızı kontrol edin.';
      });
    }
  }

  List<dynamic> get _filteredList {
    if (_filter == 'all') return _requests;
    return _requests.where((r) => r['status'] == _filter).toList();
  }

  String _requestLocationLabel(dynamic request) {
    final city = (request['city'] ?? '').toString().trim();
    final district = (request['district'] ?? '').toString().trim();
    final address = (request['address'] ?? '').toString().trim();

    final area = [district, city].where((part) => part.isNotEmpty).join(', ');
    if (area.isNotEmpty) return area;
    if (address.isNotEmpty) return address;
    return 'Konum belirtilmedi';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Taleplerim'),
      ),
      floatingActionButton: FloatingActionButton.extended(
        icon: const Icon(Icons.add),
        label: const Text('Yeni Talep Aç'),
        onPressed: () async {
          final res = await Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const NewRequestScreen()),
          );
          if (res == true) {
            _fetchRequests();
          }
        },
      ),
      body: Column(
        children: [
          // Filtreleme tabları
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: const BoxDecoration(
              color: AppColors.surface,
              border: Border(bottom: BorderSide(color: AppColors.border)),
            ),
            child: Row(
              children: [
                _buildFilterChip('Tümü', 'all'),
                const SizedBox(width: 8),
                _buildFilterChip('Beklemede', 'pending'),
                const SizedBox(width: 8),
                _buildFilterChip('İşlemde', 'in_progress'),
              ],
            ),
          ),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _errorMessage != null
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.cloud_off_rounded, size: 56, color: AppColors.inkFaint),
                              const SizedBox(height: 12),
                              Text(
                                _errorMessage!,
                                textAlign: TextAlign.center,
                                style: const TextStyle(color: AppColors.inkSecondary),
                              ),
                              const SizedBox(height: 12),
                              TextButton(
                                onPressed: _fetchRequests,
                                child: const Text('Tekrar dene'),
                              ),
                            ],
                          ),
                        ),
                      )
                    : _filteredList.isEmpty
                    ? const Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.assignment_outlined, size: 64, color: AppColors.inkFaint),
                            SizedBox(height: 12),
                            Text(
                              'Henüz bir iş talebiniz bulunmuyor',
                              style: TextStyle(color: AppColors.inkSecondary),
                            ),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _fetchRequests,
                        child: ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: _filteredList.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 14),
                          itemBuilder: (context, index) {
                            final req = _filteredList[index];
                            final status = req['status'] ?? 'pending';
                            final isUrgent = req['urgency'] == 'urgent';

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
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                        decoration: BoxDecoration(
                                          color: isUrgent ? AppColors.dangerSoft : AppColors.accentSoft,
                                          borderRadius: BorderRadius.circular(6),
                                        ),
                                        child: Text(
                                          isUrgent ? 'ACİL DURUM' : 'NORMAL',
                                          style: TextStyle(
                                            color: isUrgent ? AppColors.danger : AppColors.accent,
                                            fontWeight: FontWeight.w700,
                                            fontSize: 11,
                                          ),
                                        ),
                                      ),
                                      _buildStatusBadge(status),
                                    ],
                                  ),
                                  const SizedBox(height: 12),
                                  Text(
                                    req['title'] ?? '',
                                    style: const TextStyle(color: AppColors.ink, fontSize: 16, fontWeight: FontWeight.w700),
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    req['description'] ?? '',
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(color: AppColors.inkSecondary, fontSize: 13, height: 1.5),
                                  ),
                                  const SizedBox(height: 14),
                                  const Divider(color: AppColors.border, height: 1),
                                  const SizedBox(height: 12),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        _requestLocationLabel(req),
                                        style: const TextStyle(color: AppColors.inkFaint, fontSize: 12),
                                      ),
                                      Row(
                                        children: [
                                          const Icon(Icons.local_offer_outlined, color: AppColors.accent, size: 16),
                                          const SizedBox(width: 4),
                                          Text(
                                            '${req['bids_count'] ?? 0} Teklif Var',
                                            style: const TextStyle(
                                              color: AppColors.accent,
                                              fontWeight: FontWeight.w700,
                                              fontSize: 13,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String label, String value) {
    final isSelected = _filter == value;
    return GestureDetector(
      onTap: () => setState(() => _filter = value),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.accent : AppColors.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? AppColors.accent : AppColors.border,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? Colors.white : AppColors.inkSecondary,
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
          ),
        ),
      ),
    );
  }

  Widget _buildStatusBadge(String status) {
    Color bg;
    Color fg;
    String label;

    switch (status) {
      case 'in_progress':
        bg = AppColors.warningSoft;
        fg = AppColors.warning;
        label = 'İşlemde';
        break;
      case 'completed':
        bg = AppColors.successSoft;
        fg = AppColors.success;
        label = 'Tamamlandı';
        break;
      case 'cancelled':
        bg = AppColors.neutralSoft;
        fg = AppColors.inkSecondary;
        label = 'İptal';
        break;
      default:
        bg = AppColors.accentSoft;
        fg = AppColors.accent;
        label = 'Teklif Bekliyor';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
      child: Text(label, style: TextStyle(color: fg, fontSize: 11, fontWeight: FontWeight.w700)),
    );
  }
}
