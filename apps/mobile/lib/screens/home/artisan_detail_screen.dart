import 'package:flutter/material.dart';
import '../../core/models/artisan_model.dart';
import '../../core/theme/app_theme.dart';
import '../requests/new_request_screen.dart';

class ArtisanDetailScreen extends StatelessWidget {
  final ArtisanModel artisan;

  const ArtisanDetailScreen({super.key, required this.artisan});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(artisan.fullName),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Usta Kartı Başlık
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 40,
                    backgroundColor: AppColors.accentSoft,
                    child: Text(
                      artisan.fullName.isNotEmpty ? artisan.fullName[0] : 'U',
                      style: const TextStyle(
                        color: AppColors.accent,
                        fontWeight: FontWeight.w700,
                        fontSize: 32,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    artisan.fullName,
                    style: const TextStyle(
                        color: AppColors.ink,
                        fontSize: 20,
                        fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    [
                      artisan.category.toUpperCase(),
                      if (artisan.locationLabel.isNotEmpty)
                        artisan.locationLabel,
                    ].join(' • '),
                    style: const TextStyle(
                        color: AppColors.inkSecondary, fontSize: 14),
                  ),
                  const SizedBox(height: 20),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      _buildStat('Puan', '${artisan.rating} / 5',
                          Icons.star_rounded, AppColors.warning),
                      _buildStat('Deneyim', '${artisan.experienceYears} Yıl',
                          Icons.verified_rounded, AppColors.accent),
                      _buildStat('Yorumlar', '${artisan.totalReviews}',
                          Icons.chat_bubble_outline_rounded, AppColors.success),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Hakkında
            const Text(
              'Usta Hakkında',
              style: TextStyle(
                  color: AppColors.ink,
                  fontSize: 18,
                  fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(AppTheme.cardRadius),
                border: Border.all(color: AppColors.border),
              ),
              child: Text(
                artisan.bio.isNotEmpty
                    ? artisan.bio
                    : 'Henüz biyografi eklenmemiş.',
                style: const TextStyle(
                    color: AppColors.inkSecondary, fontSize: 14, height: 1.5),
              ),
            ),
            const SizedBox(height: 20),

            // Saatlik Ücret / Bilgi
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(AppTheme.cardRadius),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                children: [
                  const Icon(Icons.payments_outlined,
                      color: AppColors.accent, size: 28),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Tahmini Saatlik Ücret',
                            style: TextStyle(
                                color: AppColors.inkSecondary, fontSize: 12)),
                        Text(
                          artisan.hourlyRate != null
                              ? '${artisan.hourlyRate!.toInt()} ₺ / saat'
                              : 'İşe göre teklif verir',
                          style: const TextStyle(
                              color: AppColors.ink,
                              fontSize: 16,
                              fontWeight: FontWeight.w700),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 32),

            // Talep Oluştur Butonu
            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton.icon(
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => NewRequestScreen(
                        initialCategory: artisan.category,
                        targetArtisanId: artisan.id,
                      ),
                    ),
                  );
                },
                icon: const Icon(Icons.flash_on_rounded,
                    color: Colors.white, size: 20),
                label: const Text('Bu Ustaya / Alana İş Talebi Aç',
                    style: TextStyle(fontSize: 16)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStat(String label, String value, IconData icon, Color color) {
    return Column(
      children: [
        Icon(icon, color: color, size: 22),
        const SizedBox(height: 4),
        Text(value,
            style: const TextStyle(
                color: AppColors.ink,
                fontWeight: FontWeight.w700,
                fontSize: 14)),
        Text(label,
            style:
                const TextStyle(color: AppColors.inkSecondary, fontSize: 12)),
      ],
    );
  }
}
