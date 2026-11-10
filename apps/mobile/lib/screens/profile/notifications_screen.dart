import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import '../../core/api/api_service.dart';
import '../../core/theme/app_theme.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<Map<String, dynamic>> _notifications = [];
  bool _isLoading = true;
  String? _errorMessage;
  Timer? _refreshTimer;
  int _requestId = 0;
  final Set<String> _locallyReadIds = {};
  final Set<String> _pendingReadIds = {};

  @override
  void initState() {
    super.initState();
    _loadNotifications();
    _refreshTimer = Timer.periodic(
      const Duration(seconds: 15),
      (_) => _loadNotifications(),
    );
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadNotifications() async {
    final requestId = ++_requestId;
    try {
      final response = await ApiService().get('/notifications');
      final decoded =
          jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
      if (response.statusCode != 200 || decoded['success'] != true) {
        final error = decoded['error'];
        final message = error is Map ? error['message'] : decoded['message'];
        throw Exception(message?.toString() ?? 'Bildirimler alınamadı.');
      }

      final rawItems = decoded['data'];
      if (rawItems is! List) {
        throw const FormatException('Bildirim yanıtı geçersiz.');
      }

      final items = rawItems
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .map((item) {
        final id = item['id']?.toString() ?? '';
        return {
          ...item,
          'isRead': item['isRead'] == true ||
              _locallyReadIds.contains(id) ||
              _pendingReadIds.contains(id),
        };
      }).toList();

      if (!mounted || requestId != _requestId) return;
      setState(() {
        _notifications = items;
        _isLoading = false;
        _errorMessage = null;
      });

      final unseenIds = items
          .where((item) => item['isRead'] != true)
          .map((item) => item['id']?.toString() ?? '')
          .where((id) => id.isNotEmpty)
          .toList();
      await _markRead(unseenIds);
    } catch (error) {
      if (!mounted || requestId != _requestId) return;
      setState(() {
        _isLoading = false;
        _errorMessage = error.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  Future<void> _markRead(List<String> ids) async {
    if (ids.isEmpty) return;
    _pendingReadIds.addAll(ids);

    try {
      final response = await ApiService().post(
        '/notifications/read',
        body: {'ids': ids},
      );
      if (response.statusCode < 200 || response.statusCode >= 300) {
        final decoded = jsonDecode(utf8.decode(response.bodyBytes));
        final error = decoded is Map ? decoded['error'] : null;
        final message = error is Map ? error['message'] : null;
        throw Exception(
          message?.toString() ?? 'Bildirimler okundu işaretlenemedi.',
        );
      }
    } finally {
      _pendingReadIds.removeAll(ids);
    }

    _locallyReadIds.addAll(ids);
    if (!mounted) return;
    setState(() {
      _notifications = _notifications.map((item) {
        if (ids.contains(item['id']?.toString())) {
          return {...item, 'isRead': true};
        }
        return item;
      }).toList();
    });
  }

  String _formatDate(dynamic value) {
    final date = DateTime.tryParse(value?.toString() ?? '');
    if (date == null) return '';
    final local = date.toLocal();
    return '${local.day.toString().padLeft(2, '0')}.'
        '${local.month.toString().padLeft(2, '0')}.'
        '${local.year} ${local.hour.toString().padLeft(2, '0')}:'
        '${local.minute.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Bildirimler')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadNotifications,
              child: ListView.separated(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                itemCount: (_errorMessage == null ? 0 : 1) +
                    (_notifications.isEmpty
                        ? (_errorMessage == null ? 1 : 0)
                        : _notifications.length),
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (context, index) {
                  if (_errorMessage != null && index == 0) {
                    return Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.dangerSoft,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        _errorMessage!,
                        style: const TextStyle(color: AppColors.danger),
                      ),
                    );
                  }
                  if (_notifications.isEmpty) {
                    return SizedBox(
                      height: MediaQuery.of(context).size.height * 0.6,
                      child: const Center(
                        child: Text(
                          'Henüz bildiriminiz yok.',
                          style: TextStyle(color: AppColors.inkSecondary),
                        ),
                      ),
                    );
                  }

                  final itemIndex = index - (_errorMessage == null ? 0 : 1);
                  final item = _notifications[itemIndex];
                  final isRead = item['isRead'] == true;
                  return Card(
                    child: ListTile(
                      leading: Icon(
                        isRead
                            ? Icons.notifications_none_rounded
                            : Icons.notifications_active_rounded,
                        color: isRead ? AppColors.inkFaint : AppColors.danger,
                      ),
                      title: Text(
                        item['title']?.toString() ?? 'Bildirim',
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      subtitle: Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(item['message']?.toString() ?? ''),
                            const SizedBox(height: 4),
                            Text(
                              _formatDate(item['createdAt']),
                              style: const TextStyle(
                                color: AppColors.inkFaint,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ),
                      isThreeLine: true,
                    ),
                  );
                },
              ),
            ),
    );
  }
}
