import 'dart:convert';
import 'package:flutter/material.dart';
import '../../core/api/api_service.dart';
import '../../core/theme/app_theme.dart';
import '../../widgets/location_picker.dart';

class NewRequestScreen extends StatefulWidget {
  final String? initialCategory;
  final String? targetArtisanId;

  const NewRequestScreen(
      {super.key, this.initialCategory, this.targetArtisanId});

  @override
  State<NewRequestScreen> createState() => _NewRequestScreenState();
}

class _NewRequestScreenState extends State<NewRequestScreen> {
  final _formKey = GlobalKey<FormState>();
  late String _selectedCategory;
  final TextEditingController _titleController = TextEditingController();
  final TextEditingController _descController = TextEditingController();
  final TextEditingController _addressController = TextEditingController();

  double? _latitude;
  double? _longitude;
  int _radiusKm = kDefaultRadiusKm;

  String _urgency = 'urgent';
  bool _isSubmitting = false;

  final List<Map<String, String>> _categories = [
    {'slug': 'plumber', 'name': 'Sıhhi Tesisat'},
    {'slug': 'electrician', 'name': 'Elektrik & Aydınlatma'},
    {'slug': 'painter', 'name': 'Boya & Badana'},
    {'slug': 'carpenter', 'name': 'Marangoz & Mobilya'},
    {'slug': 'locksmith', 'name': 'Çilingir & Kilit'},
    {'slug': 'appliance', 'name': 'Beyaz Eşya Servisi'},
    {'slug': 'renovation', 'name': 'Ev Tadilatı'},
  ];

  @override
  void initState() {
    super.initState();
    _selectedCategory = widget.initialCategory ?? 'plumber';
  }

  Future<void> _submitRequest() async {
    if (!_formKey.currentState!.validate()) return;

    if (_latitude == null || _longitude == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Devam etmek için lütfen konumunuzu bulun.'),
        ),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    final payload = {
      'category': _selectedCategory,
      'title': _titleController.text.trim(),
      'description': _descController.text.trim(),
      'address': _addressController.text.trim(),
      'latitude': _latitude,
      'longitude': _longitude,
      'radiusKm': _radiusKm,
      'urgency': _urgency,
      if (widget.targetArtisanId != null)
        'targetArtisanId': widget.targetArtisanId,
    };

    try {
      final response = await ApiService()
          .post('/requests', body: payload, requireAuth: true);

      if (!mounted) return;

      if (response.statusCode == 201 || response.statusCode == 200) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              widget.targetArtisanId == null
                  ? 'Talebiniz başarıyla oluşturuldu! Yakındaki ustalara iletildi.'
                  : 'Talebiniz seçtiğiniz ustaya gönderildi.',
            ),
          ),
        );
        Navigator.pop(context, true);
        return;
      }

      String message = 'Talep oluşturulamadı.';
      try {
        final decoded = jsonDecode(utf8.decode(response.bodyBytes));
        final error = decoded['error'];
        if (error is Map && error['message'] != null) {
          message = error['message'].toString();
        } else if (decoded['message'] != null) {
          message = decoded['message'].toString();
        }
      } catch (_) {}

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message)),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content:
                Text('Talep oluşturulamadı. Lütfen bağlantınızı kontrol edin.'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Yeni Hizmet Talebi'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Kategori Seçimi
              const _SectionLabel('Kategori'),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(AppTheme.fieldRadius),
                  border: Border.all(color: AppColors.border),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    isExpanded: true,
                    dropdownColor: AppColors.surface,
                    borderRadius: BorderRadius.circular(AppTheme.fieldRadius),
                    value: _selectedCategory,
                    style: const TextStyle(color: AppColors.ink, fontSize: 15),
                    items: _categories.map((c) {
                      return DropdownMenuItem<String>(
                        value: c['slug'],
                        child: Text(c['name']!),
                      );
                    }).toList(),
                    onChanged: (val) {
                      if (val != null) setState(() => _selectedCategory = val);
                    },
                  ),
                ),
              ),
              const SizedBox(height: 20),

              // Aciliyet Durumu
              const _SectionLabel('Aciliyet Durumu'),
              const SizedBox(height: 8),
              Row(
                children: [
                  _buildUrgencyButton('Acil (30 dk)', 'urgent',
                      AppColors.danger, AppColors.dangerSoft),
                  const SizedBox(width: 8),
                  _buildUrgencyButton('Bugün İçinde', 'normal',
                      AppColors.warning, AppColors.warningSoft),
                  const SizedBox(width: 8),
                  _buildUrgencyButton('Esnek', 'flexible', AppColors.accent,
                      AppColors.accentSoft),
                ],
              ),
              const SizedBox(height: 20),

              // Talep Başlığı
              const _SectionLabel('Başlık'),
              const SizedBox(height: 8),
              TextFormField(
                controller: _titleController,
                style: const TextStyle(color: AppColors.ink, fontSize: 15),
                decoration:
                    _inputDecoration('Örn: Banyo bataryasından su sızıyor'),
                validator: (val) => val == null || val.trim().isEmpty
                    ? 'Lütfen bir başlık girin'
                    : null,
              ),
              const SizedBox(height: 20),

              // Detaylı Açıklama
              const _SectionLabel('Detaylı Açıklama'),
              const SizedBox(height: 8),
              TextFormField(
                controller: _descController,
                maxLines: 4,
                style: const TextStyle(color: AppColors.ink, fontSize: 15),
                decoration: _inputDecoration(
                    'Sorunu detaylandırın, parça değişimi gerekebilir mi vb.'),
                validator: (val) => val == null || val.trim().isEmpty
                    ? 'Lütfen sorun açıklamasını yazın'
                    : null,
              ),
              const SizedBox(height: 20),

              // Konum & Yarıçap
              AppLocationPicker(
                latitude: _latitude,
                longitude: _longitude,
                radiusKm: _radiusKm,
                onLocationChanged: (lat, lng) {
                  setState(() {
                    _latitude = lat;
                    _longitude = lng;
                  });
                },
                onRadiusChanged: (radius) {
                  setState(() => _radiusKm = radius);
                },
                label: 'Hizmet konumu',
                radiusLabel: 'Ustaları ne kadar uzakta aramak istersiniz?',
                helperText:
                    'Konum izni vererek çevrenizdeki ustaların eşleşmesini sağlayın.',
              ),
              const SizedBox(height: 20),

              // Adres
              const _SectionLabel('Açık Adres'),
              const SizedBox(height: 8),
              TextFormField(
                controller: _addressController,
                style: const TextStyle(color: AppColors.ink, fontSize: 15),
                decoration:
                    _inputDecoration('Mahalle, cadde, sokak ve bina no'),
                validator: (val) => val == null || val.trim().isEmpty
                    ? 'Lütfen açık adres girin'
                    : null,
              ),
              const SizedBox(height: 32),

              // Gönder Butonu
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton(
                  onPressed: _isSubmitting ? null : _submitRequest,
                  child: _isSubmitting
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                              color: Colors.white, strokeWidth: 2.5),
                        )
                      : Text(
                          widget.targetArtisanId == null
                              ? 'Talebi Yayınla'
                              : 'Bu Ustaya Gönder',
                          style: const TextStyle(fontSize: 16),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildUrgencyButton(
      String label, String value, Color color, Color softColor) {
    final isSelected = _urgency == value;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _urgency = value),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: isSelected ? softColor : AppColors.surface,
            border: Border.all(
              color: isSelected ? color : AppColors.border,
              width: isSelected ? 1.5 : 1,
            ),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: isSelected ? color : AppColors.inkSecondary,
              fontSize: 12,
              fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
            ),
          ),
        ),
      ),
    );
  }

  InputDecoration _inputDecoration(String hint) {
    return InputDecoration(hintText: hint);
  }
}

class _SectionLabel extends StatelessWidget {
  final String text;

  const _SectionLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        color: AppColors.inkSecondary,
        fontSize: 13,
        fontWeight: FontWeight.w600,
      ),
    );
  }
}
