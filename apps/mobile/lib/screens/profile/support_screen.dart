import 'dart:convert';

import 'package:flutter/material.dart';

import '../../core/api/api_service.dart';
import '../../core/theme/app_theme.dart';
import '../../widgets/brand_hero_card.dart';

class SupportScreen extends StatefulWidget {
  const SupportScreen({super.key});

  @override
  State<SupportScreen> createState() => _SupportScreenState();
}

class _SupportScreenState extends State<SupportScreen> {
  List<Map<String, dynamic>> _tickets = [];
  Map<String, dynamic>? _selectedTicket;
  bool _loading = true;
  bool _busy = false;
  String? _error;
  final _subjectController = TextEditingController();
  final _messageController = TextEditingController();
  final _replyController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadTickets();
  }

  @override
  void dispose() {
    _subjectController.dispose();
    _messageController.dispose();
    _replyController.dispose();
    super.dispose();
  }

  Future<void> _loadTickets() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final response = await ApiService().get('/support');
      final body = jsonDecode(utf8.decode(response.bodyBytes));
      if (response.statusCode != 200 || body['data'] is! List) {
        throw Exception(_apiMessage(body, 'Destek kayıtları yüklenemedi.'));
      }
      if (!mounted) return;
      setState(() {
        _tickets = (body['data'] as List)
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

  String _apiMessage(dynamic body, String fallback) {
    dynamic message;
    if (body is Map) {
      final error = body['error'];
      message = error is Map ? error['message'] : body['message'];
    }
    return message?.toString() ?? fallback;
  }

  Future<void> _openTicket(Map<String, dynamic> ticket) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final response = await ApiService().get('/support/${ticket['id']}');
      final body = jsonDecode(utf8.decode(response.bodyBytes));
      if (response.statusCode != 200 || body['data'] is! Map) {
        throw Exception(_apiMessage(body, 'Destek konuşması yüklenemedi.'));
      }
      if (!mounted) return;
      setState(() {
        _selectedTicket = Map<String, dynamic>.from(body['data'] as Map);
        _busy = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = error.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  Future<void> _createTicket() async {
    final subject = _subjectController.text.trim();
    final message = _messageController.text.trim();
    if (subject.isEmpty || message.length < 5) {
      setState(() => _error = 'Konu ve en az 5 karakterlik mesaj girin.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final response = await ApiService().post(
        '/support',
        body: {'subject': subject, 'message': message},
      );
      final body = jsonDecode(utf8.decode(response.bodyBytes));
      if (response.statusCode != 201 && response.statusCode != 200) {
        throw Exception(_apiMessage(body, 'Destek talebi oluşturulamadı.'));
      }
      _subjectController.clear();
      _messageController.clear();
      await _loadTickets();
      if (!mounted) return;
      final created = body['data'];
      if (created is Map && created['id'] != null) {
        await _openTicket(Map<String, dynamic>.from(created));
      }
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = error.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  Future<void> _sendReply() async {
    final ticket = _selectedTicket;
    final message = _replyController.text.trim();
    if (ticket == null || message.length < 2) {
      setState(() => _error = 'Yanıt en az 2 karakter olmalı.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final response = await ApiService().post(
        '/support/${ticket['id']}/messages',
        body: {'message': message},
      );
      final body = jsonDecode(utf8.decode(response.bodyBytes));
      if (response.statusCode != 201 && response.statusCode != 200) {
        throw Exception(_apiMessage(body, 'Yanıt gönderilemedi.'));
      }
      _replyController.clear();
      await _openTicket(ticket);
      await _loadTickets();
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = error.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final ticket = _selectedTicket;
    return Scaffold(
      appBar: AppBar(
        leading: ticket == null
            ? null
            : IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: () => setState(() => _selectedTicket = null),
              ),
        title: Text(ticket == null
            ? 'Destek ve yardım'
            : '${ticket['subject'] ?? 'Destek'}'),
        actions: [
          if (ticket == null)
            IconButton(
              tooltip: 'Yeni destek talebi',
              icon: const Icon(Icons.add_comment_outlined),
              onPressed: _showCreateDialog,
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ticket == null
              ? _buildTicketList()
              : _buildConversation(ticket),
    );
  }

  Widget _buildTicketList() {
    return RefreshIndicator(
      onRefresh: _loadTickets,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        children: [
          const BrandHeroCard(
            eyebrow: 'USTA BUL · YANINIZDAYIZ',
            title: 'Birlikte çözüme ulaşalım.',
            subtitle:
                'Destek ekibimize ulaşın; taleplerinizi buradan takip edin.',
            icon: Icons.support_agent_rounded,
          ),
          const SizedBox(height: 12),
          if (_error != null) _errorBanner(),
          if (_tickets.isEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 100),
              child: Center(child: Text('Henüz destek kaydınız yok.')),
            ),
          ..._tickets.map((ticket) => Card(
                child: ListTile(
                  title: Text(ticket['subject']?.toString() ?? 'Destek kaydı'),
                  subtitle: Text('Durum: ${ticket['status'] ?? 'Açık'}'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: _busy ? null : () => _openTicket(ticket),
                ),
              )),
        ],
      ),
    );
  }

  Widget _buildConversation(Map<String, dynamic> ticket) {
    final messages =
        ticket['messages'] is List ? ticket['messages'] as List : const [];
    return Column(
      children: [
        if (_error != null) _errorBanner(),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              ...messages.whereType<Map>().map((message) {
                final mine = message['author_role'] != 'admin';
                return Align(
                  alignment:
                      mine ? Alignment.centerRight : Alignment.centerLeft,
                  child: Container(
                    constraints: const BoxConstraints(maxWidth: 320),
                    margin: const EdgeInsets.only(bottom: 10),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: mine ? AppColors.accentSoft : AppColors.surface,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Text(message['body']?.toString() ?? ''),
                  ),
                );
              }),
            ],
          ),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _replyController,
                    minLines: 1,
                    maxLines: 4,
                    decoration:
                        const InputDecoration(hintText: 'Yanıtınızı yazın'),
                  ),
                ),
                IconButton(
                  onPressed: _busy ? null : _sendReply,
                  icon: const Icon(Icons.send_rounded, color: AppColors.accent),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _errorBanner() => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Text(_error!, style: const TextStyle(color: AppColors.danger)),
      );

  Future<void> _showCreateDialog() async {
    setState(() => _error = null);
    await showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Yeni destek talebi'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: _subjectController,
                maxLength: 150,
                decoration: const InputDecoration(labelText: 'Konu'),
              ),
              TextField(
                controller: _messageController,
                minLines: 3,
                maxLines: 6,
                maxLength: 4000,
                decoration: const InputDecoration(labelText: 'Mesajınız'),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Vazgeç'),
          ),
          FilledButton(
            onPressed: _busy
                ? null
                : () async {
                    Navigator.pop(dialogContext);
                    await _createTicket();
                  },
            child: const Text('Gönder'),
          ),
        ],
      ),
    );
  }
}
