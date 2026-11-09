import 'package:flutter/material.dart';
import '../../core/api/api_service.dart';
import '../../core/theme/app_theme.dart';
import 'register_screen.dart';

class LoginScreen extends StatefulWidget {
  final VoidCallback onLoginSuccess;

  const LoginScreen({super.key, required this.onLoginSuccess});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passController = TextEditingController();
  bool _isLoading = false;
  String? _errorMessage;

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final res = await ApiService().login(
      email: _emailController.text.trim(),
      password: _passController.text,
    );

    if (!mounted) return;

    if (res.success) {
      setState(() => _isLoading = false);
      widget.onLoginSuccess();
    } else {
      setState(() {
        _isLoading = false;
        _errorMessage = res.message ?? 'Giriş yapılamadı.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Form(
                key: _formKey,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Center(
                      child: Container(
                        padding: const EdgeInsets.all(16),
                        decoration: const BoxDecoration(
                          color: AppColors.accentSoft,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.handyman_rounded,
                          color: AppColors.accent,
                          size: 40,
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
                    const Text(
                      'Usta Bul',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: AppColors.ink,
                        fontSize: 28,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.5,
                      ),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'Hesabınıza giriş yapın',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: AppColors.inkSecondary, fontSize: 14),
                    ),
                    const SizedBox(height: 32),

                    if (_errorMessage != null)
                      Container(
                        padding: const EdgeInsets.all(12),
                        margin: const EdgeInsets.only(bottom: 16),
                        decoration: BoxDecoration(
                          color: AppColors.dangerSoft,
                          border: Border.all(color: AppColors.danger.withOpacity(0.25)),
                          borderRadius: BorderRadius.circular(AppTheme.fieldRadius),
                        ),
                        child: Text(
                          _errorMessage!,
                          style: const TextStyle(color: AppColors.danger, fontSize: 13),
                          textAlign: TextAlign.center,
                        ),
                      ),

                    // E-posta
                    TextFormField(
                      controller: _emailController,
                      keyboardType: TextInputType.emailAddress,
                      style: const TextStyle(color: AppColors.ink, fontSize: 15),
                      decoration: const InputDecoration(
                        hintText: 'E-posta adresi',
                        prefixIcon: Icon(Icons.email_outlined, color: AppColors.inkFaint, size: 20),
                      ),
                      validator: (v) => v == null || !v.contains('@') ? 'Geçerli bir e-posta girin' : null,
                    ),
                    const SizedBox(height: 16),

                    // Şifre
                    TextFormField(
                      controller: _passController,
                      obscureText: true,
                      style: const TextStyle(color: AppColors.ink, fontSize: 15),
                      decoration: const InputDecoration(
                        hintText: 'Şifre',
                        prefixIcon: Icon(Icons.lock_outline, color: AppColors.inkFaint, size: 20),
                      ),
                      validator: (v) => v == null || v.length < 6 ? 'En az 6 karakter girin' : null,
                    ),
                    const SizedBox(height: 24),

                    // Giriş Yap Butonu
                    SizedBox(
                      height: 50,
                      child: ElevatedButton(
                        onPressed: _isLoading ? null : _handleLogin,
                        child: _isLoading
                            ? const SizedBox(
                                width: 22,
                                height: 22,
                                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                              )
                            : const Text('Giriş Yap', style: TextStyle(fontSize: 16)),
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Kayıt Ol Yönlendirme
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Text(
                          'Hesabınız yok mu?',
                          style: TextStyle(color: AppColors.inkSecondary, fontSize: 14),
                        ),
                        TextButton(
                          onPressed: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => RegisterScreen(onRegisterSuccess: widget.onLoginSuccess),
                              ),
                            );
                          },
                          child: const Text('Kayıt Olun'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
