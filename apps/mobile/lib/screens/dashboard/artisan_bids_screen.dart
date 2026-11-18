import 'dart:convert';

import 'package:flutter/material.dart';

import '../../core/api/api_service.dart';
import '../../core/theme/app_theme.dart';
import '../../widgets/brand_hero_card.dart';

class ArtisanBidsScreen extends StatefulWidget {
  const ArtisanBidsScreen({super.key});

  @override
  State<ArtisanBidsScreen> createState() => _ArtisanBidsScreenState();
}

class _ArtisanBidsScreenState extends State<ArtisanBidsScreen> {
  List<Map<String, dynamic>> _bids = [];
  bool _loading = true;
  String? _error;
  bool _updating = false;

  @override
  void initState() {
    super.initState();
    _loadBids();
  }

  Future<void> _loadBids() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final response = await ApiService().get('/requests/artisan/my-bids');
      final body = jsonDecode(utf8.decode(response.bodyBytes));
      if (response.statusCode != 200 || body['data'] is! List) {
        throw Exception(_message(body, 'Teklifler yüklenemedi.'));
      }
      if (!mounted) return;
      setState(() {
        _bids = (body['data'] as List)
            .whereType<Map>()
            .map((item) => Map<String, dynamic>.from(item))
            .toList();
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = error.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  String _message(dynamic body, String fallback) {
    if (body is Map) {
      final error = body['error'];
      if (error is Map && error['message'] != null) {
        return error['message'].toString();
      }
      if (body['message'] != null) return body['message'].toString();
    }
    return fallback;
  }

  bool _isCompleted(Map<String, dynamic> bid) =>
      bid['request_status'] == 'completed' && bid['is_accepted'] == true;

  Future<void> _completeJob(Map<String, dynamic> bid) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('İşi tamamla'),
        content:
            const Text('Bu işi tamamlandı olarak işaretlemek istiyor musunuz?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Vazgeç'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Tamamla'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() {
      _updating = true;
      _error = null;
    });
    try {
      final response = await ApiService().patch(
        '/requests/${bid['request_id']}/status',
        body: {'status': 'completed'},
      );
      final body = jsonDecode(utf8.decode(response.bodyBytes));
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw Exception(_message(body, 'İş durumu güncellenemedi.'));
      }
      await _loadBids();
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _updating = false);
    }
  }

  String _statusLabel(Map<String, dynamic> bid) {
    if (_isCompleted(bid)) return 'Tamamlandı';
    if (bid['status'] == 'rejected') return 'Teklif reddedildi';
    if (bid['is_accepted'] == true) return 'Teklif kabul edildi';
    if (bid['status'] == 'pending') return 'Teklif inceleniyor';
    return 'Teklif gönderildi';
  }

  @override
  Widget build(BuildContext context) {
    final active = _bids.where((bid) => !_isCompleted(bid)).toList();
    final completed = _bids.where(_isCompleted).toList();
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Tekliflerim'),
          actions: [
            IconButton(
              tooltip: 'Yenile',
              onPressed: _loading ? null : _loadBids,
              icon: const Icon(Icons.refresh),
            ),
          ],
          bottom: TabBar(
            labelColor: AppColors.accent,
            tabs: [
              Tab(text: 'Tekliflerim (${active.length})'),
              Tab(text: 'Tamamladıklarım (${completed.length})'),
            ],
          ),
        ),
        body: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null && _bids.isEmpty
                ? _errorView()
                : Column(
                    children: [
                      const Padding(
                        padding: EdgeInsets.fromLTRB(16, 12, 16, 8),
                        child: BrandHeroCard(
                          eyebrow: 'USTA BUL · İŞ TAKİBİ',
                          title: 'Teklifiniz doğru müşteriye ulaşsın.',
                          subtitle:
                              'Gönderdiğiniz teklifleri ve tamamlanan işleri takip edin.',
                          icon: Icons.local_offer_rounded,
                        ),
                      ),
                      Expanded(
                        child: TabBarView(
                          children: [
                            _bidList(active, completed: false),
                            _bidList(completed, completed: true),
                          ],
                        ),
                      ),
                    ],
                  ),
      ),
    );
  }

  Widget _errorView() => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(_error ?? 'Teklifler yüklenemedi.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.danger)),
              const SizedBox(height: 12),
              TextButton(
                  onPressed: _loadBids, child: const Text('Tekrar dene')),
            ],
          ),
        ),
      );

  Widget _bidList(List<Map<String, dynamic>> bids, {required bool completed}) {
    if (bids.isEmpty) {
      return RefreshIndicator(
        onRefresh: _loadBids,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            const SizedBox(height: 150),
            Icon(completed ? Icons.task_alt : Icons.local_offer_outlined,
                size: 52, color: AppColors.inkFaint),
            const SizedBox(height: 12),
            Center(
              child: Text(
                completed
                    ? 'Tamamlanan işiniz bulunmuyor.'
                    : 'Devam eden teklifiniz bulunmuyor.',
                style: const TextStyle(color: AppColors.inkSecondary),
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadBids,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: bids.length,
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (context, index) {
          final bid = bids[index];
          final location = [
            bid['request_district']?.toString(),
            bid['request_city']?.toString(),
            if (bid['request_location_is_approximate'] == true)
              'Yaklaşık konum',
          ].where((part) => part != null && part.trim().isNotEmpty).join(', ');
          return Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          _statusLabel(bid),
                          style: TextStyle(
                            color: _isCompleted(bid)
                                ? AppColors.success
                                : AppColors.accent,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      Text('${bid['price'] ?? '-'} ₺',
                          style: const TextStyle(
                              color: AppColors.ink,
                              fontWeight: FontWeight.w700)),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(bid['request_title']?.toString() ?? 'İş talebi',
                      style: const TextStyle(
                          color: AppColors.ink,
                          fontSize: 16,
                          fontWeight: FontWeight.w700)),
                  if (location.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(location,
                        style: const TextStyle(color: AppColors.inkSecondary)),
                  ],
                  if ((bid['note']?.toString() ?? '').isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text('Notunuz: ${bid['note']}',
                        style: const TextStyle(color: AppColors.inkSecondary)),
                  ],
                  if (!completed &&
                      bid['is_accepted'] == true &&
                      bid['request_status'] == 'in_progress') ...[
                    const SizedBox(height: 12),
                    Align(
                      alignment: Alignment.centerRight,
                      child: OutlinedButton(
                        onPressed: _updating ? null : () => _completeJob(bid),
                        child:
                            Text(_updating ? 'Güncelleniyor…' : 'İşi tamamla'),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
