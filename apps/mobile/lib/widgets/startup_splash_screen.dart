import 'dart:async';

import 'package:flutter/material.dart';

import '../core/theme/app_theme.dart';

class StartupSplashScreen extends StatefulWidget {
  const StartupSplashScreen({super.key});

  @override
  State<StartupSplashScreen> createState() => _StartupSplashScreenState();
}

class _StartupSplashScreenState extends State<StartupSplashScreen> {
  static const _categories = [
    ('Tesisat', Icons.water_drop_rounded),
    ('Elektrik', Icons.bolt_rounded),
    ('Boya', Icons.format_paint_rounded),
    ('Marangoz', Icons.handyman_rounded),
    ('Çilingir', Icons.lock_rounded),
    ('Tadilat', Icons.home_repair_service_rounded),
  ];

  static const _guideSteps = [
    ('Kategorini seç', Icons.search_rounded),
    ('İşini anlat', Icons.edit_note_rounded),
    ('Teklifleri karşılaştır', Icons.compare_arrows_rounded),
  ];

  late final Timer _categoryTimer;
  int _activeCategory = 0;

  @override
  void initState() {
    super.initState();
    _categoryTimer = Timer.periodic(const Duration(milliseconds: 1100), (_) {
      if (mounted &&
          !(MediaQuery.maybeOf(context)?.disableAnimations ?? false)) {
        setState(() {
          _activeCategory = (_activeCategory + 1) % _categories.length;
        });
      }
    });
  }

  @override
  void dispose() {
    _categoryTimer.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFFF4F8FF), Color(0xFFEDF4FF)],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 520),
              child: SingleChildScrollView(
                padding:
                    const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildHeader(),
                    const SizedBox(height: 28),
                    _buildIntro(),
                    const SizedBox(height: 24),
                    _buildCategories(),
                    const SizedBox(height: 24),
                    _buildGuide(),
                    const SizedBox(height: 22),
                    _buildConnectionStatus(),
                    const SizedBox(height: 20),
                    const Center(
                      child: Text(
                        'USTALAR YAKININIZDA',
                        style: TextStyle(
                          color: AppColors.inkFaint,
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.8,
                        ),
                      ),
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

  Widget _buildHeader() {
    return Wrap(
      alignment: WrapAlignment.spaceBetween,
      crossAxisAlignment: WrapCrossAlignment.center,
      runSpacing: 10,
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: AppColors.accent,
                borderRadius: BorderRadius.circular(14),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.accent.withOpacity(0.2),
                    blurRadius: 16,
                    offset: const Offset(0, 7),
                  ),
                ],
              ),
              alignment: Alignment.center,
              child: const Text(
                'U',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
            const SizedBox(width: 11),
            const Text(
              'Usta Bul',
              style: TextStyle(
                color: AppColors.ink,
                fontSize: 20,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.6,
              ),
            ),
          ],
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 8),
          decoration: const BoxDecoration(
            color: Color(0xCCFFFFFF),
            border: Border.fromBorderSide(
              BorderSide(color: AppColors.accentBorder),
            ),
            borderRadius: BorderRadius.all(Radius.circular(30)),
          ),
          child: const Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                width: 12,
                height: 12,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
              SizedBox(width: 8),
              Text(
                'Sunucu hazırlanıyor…',
                style: TextStyle(
                  color: AppColors.accentPressed,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildIntro() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF073A80), Color(0xFF0756CF), Color(0xFF237DE5)],
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.accent.withOpacity(0.19),
            blurRadius: 24,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'GÜVENİLİR USTA, KOLAY HİZMET',
            style: TextStyle(
              color: Color(0xFFD8E9FF),
              fontSize: 10,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.1,
            ),
          ),
          SizedBox(height: 10),
          Text(
            'Ev işleriniz için doğru usta bir adım yakınınızda.',
            style: TextStyle(
              color: Colors.white,
              fontSize: 24,
              height: 1.12,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.7,
            ),
          ),
          SizedBox(height: 9),
          Text(
            'İhtiyacınızı seçin, talebinizi oluşturun ve size uygun teklifleri karşılaştırın.',
            style: TextStyle(
              color: Color(0xFFE2EDFF),
              fontSize: 13,
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCategories() {
    final animationDuration = MediaQuery.of(context).disableAnimations
        ? Duration.zero
        : const Duration(milliseconds: 380);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Hizmet kategorileri',
          style: TextStyle(
            color: AppColors.ink,
            fontSize: 16,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 12),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: _categories.length,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 3,
            mainAxisSpacing: 9,
            crossAxisSpacing: 9,
            childAspectRatio: 1.36,
          ),
          itemBuilder: (context, index) {
            final category = _categories[index];
            final isActive = index == _activeCategory;
            return AnimatedContainer(
              duration: animationDuration,
              curve: Curves.easeOutCubic,
              transform: Matrix4.translationValues(0, isActive ? -3 : 0, 0),
              decoration: BoxDecoration(
                color: isActive ? AppColors.accentSoft : Colors.white,
                border: Border.all(
                  color: isActive ? AppColors.accentBorder : AppColors.border,
                ),
                borderRadius: BorderRadius.circular(15),
                boxShadow: isActive
                    ? [
                        BoxShadow(
                          color: AppColors.accent.withOpacity(0.09),
                          blurRadius: 14,
                          offset: const Offset(0, 5),
                        ),
                      ]
                    : null,
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  AnimatedScale(
                    scale: isActive ? 1.1 : 1,
                    duration: animationDuration,
                    child: Icon(
                      category.$2,
                      color: AppColors.accent,
                      size: 23,
                    ),
                  ),
                  const SizedBox(height: 5),
                  Text(
                    category.$1,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: AppColors.ink,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ],
    );
  }

  Widget _buildGuide() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Nasıl çalışır?',
          style: TextStyle(
            color: AppColors.ink,
            fontSize: 16,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 12),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: List.generate(_guideSteps.length, (index) {
            final step = _guideSteps[index];
            return Expanded(
              child: Padding(
                padding: EdgeInsets.only(
                  right: index == _guideSteps.length - 1 ? 0 : 8,
                ),
                child: Container(
                  constraints: const BoxConstraints(minHeight: 92),
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.88),
                    border: Border.all(color: AppColors.border),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 26,
                        height: 26,
                        decoration: const BoxDecoration(
                          color: AppColors.accentSoft,
                          shape: BoxShape.circle,
                        ),
                        alignment: Alignment.center,
                        child: Icon(
                          step.$2,
                          color: AppColors.accent,
                          size: 15,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        step.$1,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppColors.ink,
                          fontSize: 10,
                          height: 1.25,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          }),
        ),
      ],
    );
  }

  Widget _buildConnectionStatus() {
    return Column(
      children: [
        Row(
          children: [
            const Expanded(
              child: Text(
                'Usta Bul sizin için hazırlanıyor',
                style: TextStyle(
                  color: AppColors.inkSecondary,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            Text(
              'Başlangıç',
              style: TextStyle(
                color: AppColors.accent.withOpacity(0.8),
                fontSize: 11,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
        const SizedBox(height: 9),
        ClipRRect(
          borderRadius: BorderRadius.circular(10),
          child: const LinearProgressIndicator(minHeight: 4),
        ),
      ],
    );
  }
}
