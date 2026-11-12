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
  int _currentStep = 0;
  bool _locationRequired = false;
  bool _urgencyChanged = false;

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

  @override
  void dispose() {
    _titleController.dispose();
    _descController.dispose();
    _addressController.dispose();
    super.dispose();
  }

  String get _selectedUrgency {
    final isPhone = MediaQuery.sizeOf(context).width < 600;
    return isPhone && !_urgencyChanged ? 'normal' : _urgency;
  }

  void _continue() {
    if (_currentStep == 0) {
      if (_formKey.currentState!.validate()) {
        setState(() => _currentStep = 1);
      }
    } else if (_currentStep == 1) {
      setState(() => _currentStep = 2);
    } else {
      _submitRequest();
    }
  }

  Widget _buildStepIndicator() {
    const labels = ['İş bilgisi', 'Sorun detayı', 'Konum'];
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Adım ${_currentStep + 1}/3 · ${labels[_currentStep]}',
              style: const TextStyle(
                  color: AppColors.inkSecondary,
                  fontSize: 13,
                  fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          LinearProgressIndicator(
            value: (_currentStep + 1) / 3,
            minHeight: 4,
            borderRadius: BorderRadius.circular(4),
          ),
        ],
      ),
    );
  }

  Future<void> _submitRequest() async {
    if (_titleController.text.trim().isEmpty) {
      setState(() => _currentStep = 0);
      return;
    }

    if (_latitude == null || _longitude == null) {
      setState(() => _locationRequired = true);
      return;
    }

    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSubmitting = true);

    final payload = {
      'category': _selectedCategory,
      'title': _titleController.text.trim(),
      'description': _descController.text.trim().isEmpty
          ? 'Detay belirtilmedi.'
          : _descController.text.trim(),
      'address': _addressController.text.trim(),
      'latitude': _latitude,
      'longitude': _longitude,
      'radiusKm': _radiusKm,
      'urgency': _selectedUrgency,
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
    final isPhone = MediaQuery.sizeOf(context).width < 600;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Yeni Hizmet Talebi'),
      ),
      body: Form(
        key: _formKey,
        child: Column(
          children: [
            if (isPhone) _buildStepIndicator(),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
              // Kategori Seçimi
              if (!isPhone || _currentStep == 0) ...[
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
              ],

              // Aciliyet Durumu
              if (!isPhone || _currentStep == 2) ...[
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
              ],

              // Talep Başlığı
              if (!isPhone || _currentStep == 0) ...[
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
              ],

              // Detaylı Açıklama
              if (!isPhone || _currentStep == 1) ...[
              const _SectionLabel('Detaylı Açıklama'),
              const SizedBox(height: 8),
              TextFormField(
                controller: _descController,
                maxLines: 4,
                style: const TextStyle(color: AppColors.ink, fontSize: 15),
                decoration: _inputDecoration(
                    'Sorunu detaylandırın, parça değişimi gerekebilir mi vb.'),
              ),
              const SizedBox(height: 20),
              ],

              // Konum & Yarıçap
              if (!isPhone || _currentStep == 2) ...[
              AppLocationPicker(
                latitude: _latitude,
                longitude: _longitude,
                radiusKm: _radiusKm,
                onLocationChanged: (lat, lng) {
                  setState(() {
                    _latitude = lat;
                    _longitude = lng;
                    _locationRequired = false;
                  });
                },
                onRadiusChanged: (radius) => setState(() => _radiusKm = radius),
                showRadius: !isPhone,
                label: 'Hizmet konumu',
                radiusLabel: 'Ustaları ne kadar uzakta aramak istersiniz?',
                helperText:
                    'Konum izni vererek çevrenizdeki ustaların eşleşmesini sağlayın.',
              ),
              if (_locationRequired) ...[
                const SizedBox(height: 8),
                const Text('Devam etmek için konumunuzu bulun.',
                    style: TextStyle(color: AppColors.danger, fontSize: 13)),
              ],
              if (isPhone)
                ExpansionTile(
                  tilePadding: EdgeInsets.zero,
                  title: const Text('Diğer seçenekler'),
                  children: [
                    Align(
                      alignment: Alignment.centerLeft,
                      child: Wrap(
                        spacing: 8,
                        children: kRadiusOptions.map((radius) {
                          return ChoiceChip(
                            label: Text('$radius km'),
                            selected: _radiusKm == radius,
                            onSelected: (_) =>
                                setState(() => _radiusKm = radius),
                          );
                        }).toList(),
                      ),
                    ),
                  ],
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
              const SizedBox(height: 20),
              ],

              // Gönder Butonu
              if (!isPhone) SizedBox(
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
          ],
        ),
      ),
      bottomNavigationBar: isPhone
          ? SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
                child: Row(
                  children: [
                    if (_currentStep > 0) ...[
                      OutlinedButton(
                        onPressed: () => setState(() => _currentStep--),
                        child: const Text('Geri'),
                      ),
                      const SizedBox(width: 10),
                    ],
                    Expanded(
                      child: SizedBox(
                        height: 50,
                        child: ElevatedButton(
                          onPressed: _isSubmitting ? null : _continue,
                          child: _isSubmitting
                              ? const SizedBox(
                                  width: 22,
                                  height: 22,
                                  child: CircularProgressIndicator(
                                      color: Colors.white, strokeWidth: 2.5),
                                )
                              : Text(
                                  _currentStep < 2
                                      ? 'Devam'
                                      : widget.targetArtisanId == null
                                          ? 'Talebi Yayınla'
                                          : 'Bu Ustaya Gönder',
                                  style: const TextStyle(fontSize: 16),
                                ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            )
          : null,
    );
  }

  Widget _buildUrgencyButton(
      String label, String value, Color color, Color softColor) {
    final isSelected = _selectedUrgency == value;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() {
          _urgency = value;
          _urgencyChanged = true;
        }),
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
