import 'package:flutter/material.dart';
import '../../core/api/api_service.dart';
import '../../core/theme/app_theme.dart';
import '../../widgets/location_picker.dart';

class RegisterScreen extends StatefulWidget {
  final VoidCallback onRegisterSuccess;

  const RegisterScreen({super.key, required this.onRegisterSuccess});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _phoneController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  final TextEditingController _cityController = TextEditingController();
  final TextEditingController _districtController = TextEditingController();

  String _role = 'customer'; // 'customer' veya 'artisan'
  String _selectedCategory = 'plumber';
  double? _latitude;
  double? _longitude;
  int _serviceRadiusKm = kDefaultRadiusKm;
  bool _isLoading = false;
  String? _errorMessage;

  Future<void> _handleRegister() async {
    if (!_formKey.currentState!.validate()) return;

    if (_latitude == null ||
        _longitude == null ||
        _cityController.text.trim().isEmpty ||
        _districtController.text.trim().isEmpty) {
      setState(() {
        _errorMessage =
            'Kayıt için konum pininizi seçip il ve ilçe bilgilerini girin.';
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    Map<String, dynamic>? artisanProfile;
    if (_role == 'artisan') {
      artisanProfile = {
        'category': _selectedCategory,
        'city': _cityController.text.trim(),
        'district': _districtController.text.trim(),
        'latitude': _latitude,
        'longitude': _longitude,
        'serviceRadiusKm': _serviceRadiusKm,
      };
    }

    final res = await ApiService().register(
      email: _emailController.text.trim(),
      password: _passwordController.text,
      fullName: _nameController.text.trim(),
      phone: _phoneController.text.trim().isEmpty
          ? null
          : _phoneController.text.trim(),
      role: _role,
      artisanProfile: artisanProfile,
      customerLocation: _role == 'customer'
          ? {
              'city': _cityController.text.trim(),
              'district': _districtController.text.trim(),
              'latitude': _latitude,
              'longitude': _longitude,
            }
          : null,
    );

    setState(() => _isLoading = false);

    if (res.success) {
      if (mounted) {
        Navigator.pop(context);
        widget.onRegisterSuccess();
      }
    } else {
      setState(() {
        _errorMessage = res.message ?? 'Kayıt işlemi başarısız oldu.';
      });
    }
  }

  @override
  void dispose() {
    _cityController.dispose();
    _districtController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Yeni Hesap Aç'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Rol Seçici (Müşteri vs Usta)
              Row(
                children: [
                  Expanded(
                    child: _buildRoleOption(
                      label: 'Müşteriyim',
                      value: 'customer',
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildRoleOption(
                      label: 'Ustayım',
                      value: 'artisan',
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),

              if (_errorMessage != null)
                Container(
                  padding: const EdgeInsets.all(12),
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: AppColors.dangerSoft,
                    border:
                        Border.all(color: AppColors.danger.withOpacity(0.25)),
                    borderRadius: BorderRadius.circular(AppTheme.fieldRadius),
                  ),
                  child: Text(
                    _errorMessage!,
                    style:
                        const TextStyle(color: AppColors.danger, fontSize: 13),
                    textAlign: TextAlign.center,
                  ),
                ),

              // Ad Soyad
              TextFormField(
                controller: _nameController,
                style: const TextStyle(color: AppColors.ink, fontSize: 15),
                decoration: _inputDecoration('Ad Soyad', Icons.person_outline),
                validator: (v) =>
                    v == null || v.trim().isEmpty ? 'Ad soyad giriniz' : null,
              ),
              const SizedBox(height: 16),

              // E-posta
              TextFormField(
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
                style: const TextStyle(color: AppColors.ink, fontSize: 15),
                decoration: _inputDecoration('E-posta', Icons.email_outlined),
                validator: (v) => v == null || !v.contains('@')
                    ? 'Geçerli e-posta giriniz'
                    : null,
              ),
              const SizedBox(height: 16),

              // Telefon
              TextFormField(
                controller: _phoneController,
                keyboardType: TextInputType.phone,
                style: const TextStyle(color: AppColors.ink, fontSize: 15),
                decoration: _inputDecoration(
                    'Telefon Numarası (Opsiyonel)', Icons.phone_outlined),
              ),
              const SizedBox(height: 16),

              // Usta ise Kategori Seçimi
              if (_role == 'artisan') ...[
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
                      style:
                          const TextStyle(color: AppColors.ink, fontSize: 15),
                      items: const [
                        DropdownMenuItem(
                            value: 'plumber', child: Text('Sıhhi Tesisat')),
                        DropdownMenuItem(
                            value: 'electrician',
                            child: Text('Elektrik & Aydınlatma')),
                        DropdownMenuItem(
                            value: 'painter', child: Text('Boya & Badana')),
                        DropdownMenuItem(
                            value: 'carpenter',
                            child: Text('Marangoz & Mobilya')),
                        DropdownMenuItem(
                            value: 'locksmith',
                            child: Text('Çilingir & Kilit')),
                        DropdownMenuItem(
                            value: 'appliance',
                            child: Text('Beyaz Eşya Servisi')),
                        DropdownMenuItem(
                            value: 'renovation', child: Text('Ev Tadilatı')),
                      ],
                      onChanged: (val) {
                        if (val != null) {
                          setState(() => _selectedCategory = val);
                        }
                      },
                    ),
                  ),
                ),
                const SizedBox(height: 16),
              ],

              AppLocationPicker(
                latitude: _latitude,
                longitude: _longitude,
                radiusKm: _serviceRadiusKm,
                showRadius: _role == 'artisan',
                onLocationChanged: (lat, lng) {
                  setState(() {
                    _latitude = lat;
                    _longitude = lng;
                  });
                },
                onRadiusChanged: (radius) {
                  setState(() => _serviceRadiusKm = radius);
                },
                label: _role == 'artisan' ? 'Hizmet merkeziniz' : 'Konumunuz',
                radiusLabel: 'Kaç km çevresine hizmet veriyorsunuz?',
                helperText: 'Kayıt için konum pininizi seçin.',
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _cityController,
                style: const TextStyle(color: AppColors.ink, fontSize: 15),
                decoration:
                    _inputDecoration('İl', Icons.location_city_outlined),
                validator: (value) =>
                    value == null || value.trim().isEmpty ? 'İl giriniz' : null,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _districtController,
                style: const TextStyle(color: AppColors.ink, fontSize: 15),
                decoration: _inputDecoration('İlçe', Icons.place_outlined),
                validator: (value) => value == null || value.trim().isEmpty
                    ? 'İlçe giriniz'
                    : null,
              ),
              const SizedBox(height: 16),

              // Şifre
              TextFormField(
                controller: _passwordController,
                obscureText: true,
                style: const TextStyle(color: AppColors.ink, fontSize: 15),
                decoration: _inputDecoration(
                    'Şifre (en az 6 karakter)', Icons.lock_outline),
                validator: (v) => v == null || v.length < 6
                    ? 'En az 6 karakter olmalı'
                    : null,
              ),
              const SizedBox(height: 28),

              // Kayıt Butonu
              SizedBox(
                height: 50,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _handleRegister,
                  child: _isLoading
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                              color: Colors.white, strokeWidth: 2.5),
                        )
                      : const Text('Hesabı Oluştur',
                          style: TextStyle(fontSize: 16)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildRoleOption({required String label, required String value}) {
    final isSelected = _role == value;
    return GestureDetector(
      onTap: () => setState(() => _role = value),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: isSelected ? AppColors.accent : AppColors.surface,
          borderRadius: BorderRadius.circular(AppTheme.fieldRadius),
          border: Border.all(
            color: isSelected ? AppColors.accent : AppColors.border,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? Colors.white : AppColors.inkSecondary,
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
            fontSize: 14,
          ),
        ),
      ),
    );
  }

  InputDecoration _inputDecoration(String hint, IconData icon) {
    return InputDecoration(
      hintText: hint,
      prefixIcon: Icon(icon, color: AppColors.inkFaint, size: 20),
    );
  }
}
