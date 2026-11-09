import 'package:flutter/material.dart';

import '../core/services/location_service.dart';
import '../core/theme/app_theme.dart';

const List<int> kRadiusOptions = [5, 10, 25, 50, 100, 200];
const int kDefaultRadiusKm = 25;

/// Konum izni + yarıçap seçimi için ortak mobil bileşen.
class AppLocationPicker extends StatefulWidget {
  final double? latitude;
  final double? longitude;
  final int radiusKm;
  final void Function(double latitude, double longitude) onLocationChanged;
  final ValueChanged<int> onRadiusChanged;
  final String label;
  final String radiusLabel;
  final String helperText;
  final bool showRadius;

  const AppLocationPicker({
    super.key,
    required this.latitude,
    required this.longitude,
    required this.radiusKm,
    required this.onLocationChanged,
    required this.onRadiusChanged,
    this.label = 'Hizmet konumunuz',
    this.radiusLabel = 'Arama yarıçapı',
    this.helperText = 'Konumunuzu paylaşarak yakınınızdaki ustaları bulun.',
    this.showRadius = true,
  });

  @override
  State<AppLocationPicker> createState() => _AppLocationPickerState();
}

class _AppLocationPickerState extends State<AppLocationPicker> {
  bool _locating = false;
  String? _error;

  bool get _hasLocation => widget.latitude != null && widget.longitude != null;

  Future<void> _locate() async {
    setState(() {
      _locating = true;
      _error = null;
    });

    final result = await LocationService.getCurrentPosition();

    if (!mounted) return;

    if (result.hasLocation) {
      widget.onLocationChanged(result.latitude!, result.longitude!);
    } else {
      setState(() => _error = result.error);
    }

    setState(() => _locating = false);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          widget.label,
          style: const TextStyle(
            color: AppColors.inkSecondary,
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 8),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.neutralSoft,
            borderRadius: BorderRadius.circular(AppTheme.fieldRadius),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _locating ? null : _locate,
                      icon: _locating
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.my_location_rounded, size: 18),
                      label: Text(
                        _locating
                            ? 'Konum alınıyor...'
                            : _hasLocation
                                ? 'Konumu güncelle'
                                : 'Konumumu bul',
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              if (_hasLocation) ...[
                const Row(
                  children: [
                    Icon(Icons.check_circle_rounded,
                        color: AppColors.success, size: 16),
                    SizedBox(width: 6),
                    Text(
                      'Konum kaydedildi',
                      style: TextStyle(
                        color: AppColors.success,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  '${widget.latitude!.toStringAsFixed(5)}, ${widget.longitude!.toStringAsFixed(5)}',
                  style: const TextStyle(
                    color: AppColors.inkSecondary,
                    fontSize: 12,
                  ),
                ),
              ] else
                Text(
                  widget.helperText,
                  style: const TextStyle(
                    color: AppColors.inkSecondary,
                    fontSize: 12,
                    height: 1.4,
                  ),
                ),
              if (_error != null) ...[
                const SizedBox(height: 8),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.warningSoft,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFFDE68A)),
                  ),
                  child: Text(
                    _error!,
                    style:
                        const TextStyle(color: AppColors.warning, fontSize: 12),
                  ),
                ),
              ],
              if (widget.showRadius) ...[
                const SizedBox(height: 14),
                Text(
                  widget.radiusLabel,
                  style: const TextStyle(
                    color: AppColors.inkSecondary,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: kRadiusOptions.map((option) {
                    final isSelected = widget.radiusKm == option;
                    return ChoiceChip(
                      label: Text('$option km'),
                      selected: isSelected,
                      showCheckmark: false,
                      selectedColor: AppColors.accentSoft,
                      backgroundColor: AppColors.surface,
                      labelStyle: TextStyle(
                        color: isSelected
                            ? AppColors.accent
                            : AppColors.inkSecondary,
                        fontWeight:
                            isSelected ? FontWeight.w600 : FontWeight.w500,
                        fontSize: 13,
                      ),
                      side: BorderSide(
                        color: isSelected ? AppColors.accent : AppColors.border,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                      onSelected: (_) => widget.onRadiusChanged(option),
                    );
                  }).toList(),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}
