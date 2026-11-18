import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:usta_bul_mobile/core/constants/api_constants.dart';
import 'package:usta_bul_mobile/core/theme/app_theme.dart';
import 'package:usta_bul_mobile/widgets/startup_splash_screen.dart';

void main() {
  test('API endpoints use the hosted HTTPS service', () {
    expect(
      ApiConstants.baseUrl,
      'https://usta-bul-1.onrender.com/api/v1',
    );
    expect(
      ApiConstants.healthUrl,
      'https://usta-bul-1.onrender.com/health',
    );
  });

  test('AppTheme.light exposes the calm light design tokens', () {
    final theme = AppTheme.light;

    expect(theme.useMaterial3, isTrue);
    expect(theme.brightness, Brightness.light);
    expect(theme.scaffoldBackgroundColor, AppColors.background);
    expect(theme.colorScheme.primary, AppColors.accent);
    expect(theme.colorScheme.surface, AppColors.surface);
  });

  testWidgets('startup splash introduces categories and the three-step guide',
      (tester) async {
    tester.view.physicalSize = const Size(320, 720);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: const StartupSplashScreen(),
      ),
    );

    expect(find.text('Sunucu hazırlanıyor…'), findsOneWidget);
    expect(find.text('Hizmet kategorileri'), findsOneWidget);
    expect(find.text('Tesisat'), findsOneWidget);
    expect(find.text('Nasıl çalışır?'), findsOneWidget);
    expect(find.text('Teklifleri karşılaştır'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
