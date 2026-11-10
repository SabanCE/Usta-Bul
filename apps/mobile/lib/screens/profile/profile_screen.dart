import 'package:flutter/material.dart';
import '../../core/api/api_service.dart';
import '../../core/storage/token_storage.dart';
import '../../core/theme/app_theme.dart';
import 'notifications_screen.dart';

class ProfileScreen extends StatefulWidget {
  final VoidCallback onLogout;

  const ProfileScreen({super.key, required this.onLogout});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  String? _userName;
  String? _userRole;

  @override
  void initState() {
    super.initState();
    _loadUser();
  }

  Future<void> _loadUser() async {
    final name = await TokenStorage.getUserName();
    final role = await TokenStorage.getUserRole();
    setState(() {
      _userName = name ?? 'Kullanıcı';
      _userRole = role ?? 'customer';
    });
  }

  Future<void> _handleLogout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Çıkış Yap'),
        content:
            const Text('Hesabınızdan çıkış yapmak istediğinize emin misiniz?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Vazgeç',
                style: TextStyle(color: AppColors.inkSecondary)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.danger,
              foregroundColor: Colors.white,
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Çıkış'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await ApiService().logout();
      widget.onLogout();
    }
  }

  @override
  Widget build(BuildContext context) {
    final isArtisan = _userRole == 'artisan';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Profilim'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            // Kullanıcı Bilgi Kartı
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 36,
                    backgroundColor: AppColors.accentSoft,
                    child: Text(
                      _userName != null && _userName!.isNotEmpty
                          ? _userName![0]
                          : 'U',
                      style: const TextStyle(
                          color: AppColors.accent,
                          fontSize: 28,
                          fontWeight: FontWeight.w700),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    _userName ?? '',
                    style: const TextStyle(
                        color: AppColors.ink,
                        fontSize: 18,
                        fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 6),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: isArtisan
                          ? AppColors.warningSoft
                          : AppColors.accentSoft,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      isArtisan ? 'USTA HESABI' : 'MÜŞTERİ HESABI',
                      style: TextStyle(
                        color: isArtisan ? AppColors.warning : AppColors.accent,
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Menü Seçenekleri
            _buildMenuItem(Icons.person_outline, 'Hesap Bilgileri', () {}),
            _buildMenuItem(
              Icons.notifications_none_rounded,
              'Bildirimler',
              () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => const NotificationsScreen(),
                ),
              ),
            ),
            _buildMenuItem(Icons.security_rounded, 'Güvenlik ve Şifre', () {}),
            _buildMenuItem(
                Icons.help_outline_rounded, 'Yardım & Destek', () {}),
            const SizedBox(height: 20),

            // Çıkış Yap Butonu
            SizedBox(
              width: double.infinity,
              height: 48,
              child: OutlinedButton.icon(
                onPressed: _handleLogout,
                icon:
                    const Icon(Icons.logout, color: AppColors.danger, size: 20),
                label: const Text(
                  'Çıkış Yap',
                  style: TextStyle(
                      color: AppColors.danger, fontWeight: FontWeight.w600),
                ),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: AppColors.danger),
                  shape: RoundedRectangleBorder(
                      borderRadius:
                          BorderRadius.circular(AppTheme.fieldRadius)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMenuItem(IconData icon, String title, VoidCallback onTap) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTheme.fieldRadius),
        border: Border.all(color: AppColors.border),
      ),
      child: ListTile(
        leading: Icon(icon, color: AppColors.accent, size: 22),
        title: Text(title,
            style: const TextStyle(color: AppColors.ink, fontSize: 14)),
        trailing: const Icon(Icons.chevron_right, color: AppColors.inkFaint),
        onTap: onTap,
      ),
    );
  }
}
