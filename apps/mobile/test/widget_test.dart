import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:usta_bul_mobile/core/theme/app_theme.dart';

void main() {
  test('AppTheme.light exposes the calm light design tokens', () {
    final theme = AppTheme.light;

    expect(theme.useMaterial3, isTrue);
    expect(theme.brightness, Brightness.light);
    expect(theme.scaffoldBackgroundColor, AppColors.background);
    expect(theme.colorScheme.primary, AppColors.accent);
    expect(theme.colorScheme.surface, AppColors.surface);
  });
}
