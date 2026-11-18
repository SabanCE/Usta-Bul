import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/api/api_service.dart';
import '../../core/models/artisan_model.dart';
import '../../core/services/location_service.dart';
import '../../core/storage/token_storage.dart';
import '../../core/theme/app_theme.dart';
import '../../widgets/brand_hero_card.dart';
import '../../widgets/location_picker.dart';
import 'artisan_detail_screen.dart';

class CategoryItem {
  final String slug;
  final String name;
  final IconData icon;

  const CategoryItem(
      {required this.slug, required this.name, required this.icon});
}

const List<CategoryItem> categories = [
  CategoryItem(slug: '', name: 'Tümü', icon: Icons.grid_view_rounded),
  CategoryItem(slug: 'plumber', name: 'Tesisat', icon: Icons.plumbing_rounded),
  CategoryItem(slug: 'electrician', name: 'Elektrik', icon: Icons.bolt_rounded),
  CategoryItem(
      slug: 'painter', name: 'Boya & Badana', icon: Icons.format_paint_rounded),
  CategoryItem(
      slug: 'carpenter', name: 'Marangoz', icon: Icons.carpenter_rounded),
  CategoryItem(slug: 'locksmith', name: 'Çilingir', icon: Icons.key_rounded),
  CategoryItem(
      slug: 'appliance', name: 'Beyaz Eşya', icon: Icons.kitchen_rounded),
  CategoryItem(
      slug: 'renovation',
      name: 'Tadilat',
      icon: Icons.home_repair_service_rounded),
];

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  String _selectedCategory = '';
  final TextEditingController _searchController = TextEditingController();
  List<ArtisanModel> _artisans = [];
  bool _isLoading = true;
  String? _errorMessage;

  double? _latitude;
  double? _longitude;
  int _radiusKm = kDefaultRadiusKm;
  bool _locating = false;
  bool _customerLocationRequired = false;
  String? _locationError;
  LatLng? _deviceRouteOrigin;
  String? _selectedArtisanId;
  List<LatLng> _routePoints = [];
  bool _routeLoading = false;
  int _routeRequestGeneration = 0;

  @override
  void initState() {
    super.initState();
    _initializeLocation();
  }

  Future<void> _initializeLocation() async {
    try {
      if (await TokenStorage.getUserRole() == 'customer') {
        _customerLocationRequired = true;
        final response = await ApiService().get('/customers/profile/me');
        if (response.statusCode == 200) {
          final decoded = jsonDecode(utf8.decode(response.bodyBytes));
          final profile = decoded['data'];
          final latitude = profile['latitude'];
          final longitude = profile['longitude'];
          if (latitude is num && longitude is num && mounted) {
            setState(() {
              _latitude = latitude.toDouble();
              _longitude = longitude.toDouble();
            });
          }
        } else if (mounted) {
          setState(() {
            _locationError =
                'Kayıtlı konumunuz alınamadı. Konumunuzu yeniden seçin.';
          });
        }
      }
    } catch (_) {
      if (mounted && _customerLocationRequired) {
        setState(() {
          _locationError =
              'Kayıtlı konumunuz alınamadı. Konumunuzu yeniden seçin.';
        });
      }
    }

    if (mounted) await _fetchArtisans();
  }

  Future<void> _fetchArtisans() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    if (_customerLocationRequired &&
        (_latitude == null || _longitude == null)) {
      setState(() {
        _artisans = [];
        _isLoading = false;
      });
      return;
    }
    try {
      final queryParams = <String, dynamic>{};
      if (_selectedCategory.isNotEmpty) {
        queryParams['category'] = _selectedCategory;
      }
      if (_searchController.text.trim().isNotEmpty) {
        queryParams['query'] = _searchController.text.trim();
      }
      if (_latitude != null && _longitude != null) {
        queryParams['lat'] = _latitude;
        queryParams['lng'] = _longitude;
        queryParams['radius'] = _radiusKm;
        queryParams['sortBy'] = 'distance';
      }

      final response = await ApiService()
          .get('/artisans', queryParams: queryParams, requireAuth: false);

      if (response.statusCode == 200) {
        final decoded = jsonDecode(utf8.decode(response.bodyBytes));
        if (decoded['data'] is List) {
          final list = (decoded['data'] as List)
              .map((item) => ArtisanModel.fromJson(item))
              .toList();
          setState(() {
            _artisans = list;
            _isLoading = false;
          });
          return;
        }
      }

      setState(() {
        _artisans = [];
        _isLoading = false;
        _errorMessage = 'Ustalar yüklenemedi. Lütfen tekrar deneyin.';
      });
    } catch (_) {
      setState(() {
        _artisans = [];
        _isLoading = false;
        _errorMessage =
            'Ustalar yüklenemedi. Lütfen bağlantınızı kontrol edin.';
      });
    }
  }

  Future<void> _detectLocation() async {
    setState(() {
      _locating = true;
      _locationError = null;
    });

    final result = await LocationService.getCurrentPosition();

    if (!mounted) return;

    if (result.hasLocation) {
      setState(() {
        _latitude = result.latitude;
        _longitude = result.longitude;
        _deviceRouteOrigin = LatLng(result.latitude!, result.longitude!);
        _locating = false;
      });
      await _fetchArtisans();
    } else {
      setState(() {
        _locationError = result.error;
        _locating = false;
      });
    }
  }

  Future<void> _selectArtisan(ArtisanModel artisan) async {
    final requestGeneration = ++_routeRequestGeneration;
    final destination = artisan.coordinates;
    setState(() {
      _selectedArtisanId = artisan.id;
      _routePoints = [];
      _routeLoading = destination != null;
    });
    if (destination == null) return;

    var origin = _deviceRouteOrigin;
    if (origin == null) {
      final result = await LocationService.getCurrentPosition();
      if (!mounted) return;
      if (!result.hasLocation) {
        setState(() => _routeLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(result.error ?? 'GPS konumu alınamadı.')),
        );
        return;
      }
      origin = LatLng(result.latitude!, result.longitude!);
      setState(() => _deviceRouteOrigin = origin);
    }

    try {
      final uri = Uri.https(
        'router.project-osrm.org',
        '/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}',
        {'overview': 'full', 'geometries': 'geojson'},
      );
      final response = await http.get(uri).timeout(const Duration(seconds: 15));
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw Exception('Rota servisi yanıt vermedi.');
      }
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      final routes = body['routes'];
      dynamic coordinates;
      if (routes is List && routes.isNotEmpty && routes.first is Map) {
        final geometry = (routes.first as Map)['geometry'];
        if (geometry is Map) coordinates = geometry['coordinates'];
      }
      if (coordinates is! List) throw Exception('Rota bulunamadı.');

      final points = coordinates
          .whereType<List>()
          .where((point) =>
              point.length >= 2 && point[0] is num && point[1] is num)
          .map((point) => LatLng(
                (point[1] as num).toDouble(),
                (point[0] as num).toDouble(),
              ))
          .toList();
      if (points.length < 2) throw Exception('Rota geometrisi geçersiz.');
      if (!mounted || requestGeneration != _routeRequestGeneration) return;
      setState(() {
        _routePoints = points;
        _routeLoading = false;
      });
    } catch (error) {
      if (!mounted || requestGeneration != _routeRequestGeneration) return;
      setState(() => _routeLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Rota yüklenemedi: $error')),
      );
    }
  }

  Future<void> _openArtisanDirections() async {
    final origin = _deviceRouteOrigin;
    ArtisanModel? artisan;
    for (final item in _artisans) {
      if (item.id == _selectedArtisanId) {
        artisan = item;
        break;
      }
    }
    final destination = artisan?.coordinates;
    if (origin == null || destination == null) return;
    final uri = Uri.https('www.google.com', '/maps/dir/', {
      'api': '1',
      'origin': '${origin.latitude},${origin.longitude}',
      'destination': '${destination.latitude},${destination.longitude}',
      'travelmode': 'driving',
    });
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication) &&
        mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Harita uygulaması açılamadı.')),
      );
    }
  }

  Widget _buildArtisanMap() {
    final mappedArtisans =
        _artisans.where((artisan) => artisan.coordinates != null).toList();
    final mapCenter = _routePoints.isNotEmpty
        ? _routePoints[_routePoints.length ~/ 2]
        : _latitude != null && _longitude != null
            ? LatLng(_latitude!, _longitude!)
            : mappedArtisans.isNotEmpty
                ? mappedArtisans.first.coordinates!
                : const LatLng(39.2, 34.8);

    return Container(
      height: 280,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Stack(
        children: [
          FlutterMap(
            key: ValueKey('${mapCenter.latitude}:${mapCenter.longitude}'),
            options: MapOptions(
              initialCenter: mapCenter,
              initialZoom:
                  _latitude != null || mappedArtisans.length == 1 ? 11 : 6,
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.ustabul.mobile',
              ),
              if (_routePoints.length >= 2)
                PolylineLayer(
                  polylines: [
                    Polyline(
                      points: _routePoints,
                      strokeWidth: 5,
                      color: AppColors.accent,
                    ),
                  ],
                ),
              MarkerLayer(
                markers: [
                  ...mappedArtisans.map(
                    (artisan) => Marker(
                      point: artisan.coordinates!,
                      width: 42,
                      height: 48,
                      child: GestureDetector(
                        onTap: () => _selectArtisan(artisan),
                        child: Icon(
                          Icons.location_on,
                          size: 40,
                          color: _selectedArtisanId == artisan.id
                              ? AppColors.warning
                              : AppColors.accent,
                        ),
                      ),
                    ),
                  ),
                  if (_deviceRouteOrigin != null)
                    Marker(
                      point: _deviceRouteOrigin!,
                      width: 34,
                      height: 34,
                      child: const Icon(
                        Icons.my_location,
                        size: 26,
                        color: Colors.blue,
                      ),
                    ),
                ],
              ),
              const RichAttributionWidget(
                attributions: [
                  TextSourceAttribution('© OpenStreetMap contributors'),
                ],
              ),
            ],
          ),
          if (_routeLoading)
            const Positioned(
              top: 10,
              right: 10,
              child: Card(
                child: Padding(
                  padding: EdgeInsets.all(8),
                  child: SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                ),
              ),
            ),
          if (_selectedArtisanId != null && _deviceRouteOrigin != null)
            Positioned(
              left: 10,
              bottom: 10,
              child: FilledButton.icon(
                onPressed: _openArtisanDirections,
                icon: const Icon(Icons.directions),
                label: const Text('Yol tarifi'),
              ),
            ),
          if (mappedArtisans.isEmpty)
            const Positioned(
              left: 12,
              right: 12,
              bottom: 12,
              child: Card(
                child: Padding(
                  padding: EdgeInsets.all(8),
                  child: Text('Haritada gösterilecek konumlu usta bulunamadı.'),
                ),
              ),
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppColors.accentSoft,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.handyman_rounded,
                  color: AppColors.accent, size: 20),
            ),
            const SizedBox(width: 10),
            const Text(
              'Usta Bul',
              style: TextStyle(
                  fontWeight: FontWeight.w800,
                  color: AppColors.ink,
                  fontSize: 20),
            ),
          ],
        ),
      ),
      body: RefreshIndicator(
        onRefresh: _fetchArtisans,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const BrandHeroCard(
                eyebrow: 'USTA BUL · USTALAR YAKININIZDA',
                title: 'Güvenilir ustayı bulun.',
                subtitle: 'İşinizi kolayca halledin; doğru uzman size yakın.',
                icon: Icons.handyman_rounded,
              ),
              const SizedBox(height: 20),

              // Arama Çubuğu
              TextField(
                controller: _searchController,
                style: const TextStyle(color: AppColors.ink, fontSize: 15),
                onSubmitted: (_) => _fetchArtisans(),
                decoration: InputDecoration(
                  hintText: 'Usta, uzmanlık veya hizmet ara...',
                  prefixIcon: const Icon(Icons.search,
                      color: AppColors.inkFaint, size: 20),
                  suffixIcon: _searchController.text.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.clear,
                              color: AppColors.inkFaint, size: 20),
                          onPressed: () {
                            _searchController.clear();
                            _fetchArtisans();
                          },
                        )
                      : null,
                  contentPadding:
                      const EdgeInsets.symmetric(vertical: 0, horizontal: 16),
                ),
              ),
              const SizedBox(height: 14),

              // Konum & Yarıçap
              OutlinedButton.icon(
                onPressed: _locating ? null : _detectLocation,
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
                      : _latitude != null
                          ? 'Konumu güncelle'
                          : 'Konumumu bul',
                ),
              ),
              if (_locationError != null) ...[
                const SizedBox(height: 8),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.warningSoft,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFFFDE68A)),
                  ),
                  child: Text(
                    _locationError!,
                    style:
                        const TextStyle(color: AppColors.warning, fontSize: 12),
                  ),
                ),
              ],
              if (_latitude != null) ...[
                const SizedBox(height: 8),
                Row(
                  children: [
                    const Icon(Icons.check_circle_rounded,
                        color: AppColors.success, size: 16),
                    const SizedBox(width: 6),
                    Text(
                      'Konum aktif · $_radiusKm km',
                      style: const TextStyle(
                        color: AppColors.success,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ],
              const SizedBox(height: 10),
              const Text(
                'Arama yarıçapı',
                style: TextStyle(
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
                  final isSelected = _radiusKm == option;
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
                    onSelected: (_) {
                      setState(() => _radiusKm = option);
                      _fetchArtisans();
                    },
                  );
                }).toList(),
              ),
              const SizedBox(height: 20),

              // Kategoriler Yatay Liste
              const Text(
                'Kategoriler',
                style: TextStyle(
                    color: AppColors.ink,
                    fontSize: 17,
                    fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 12),
              SizedBox(
                height: 44,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: categories.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemBuilder: (context, index) {
                    final cat = categories[index];
                    final isSelected = _selectedCategory == cat.slug;
                    return ChoiceChip(
                      label: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            cat.icon,
                            size: 16,
                            color: isSelected
                                ? AppColors.accent
                                : AppColors.inkSecondary,
                          ),
                          const SizedBox(width: 6),
                          Text(cat.name),
                        ],
                      ),
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
                      onSelected: (val) {
                        setState(() {
                          _selectedCategory = isSelected ? '' : cat.slug;
                        });
                        _fetchArtisans();
                      },
                    );
                  },
                ),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Yakınınızdaki ustalar',
                    style: TextStyle(
                      color: AppColors.ink,
                      fontSize: 17,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  if (_routePoints.isNotEmpty)
                    TextButton(
                      onPressed: () => setState(() => _routePoints = []),
                      child: const Text('Rotayı temizle'),
                    ),
                ],
              ),
              const SizedBox(height: 10),
              const Text(
                'Harita işaretleri ve usta konumları yaklaşık gösterilir.',
                style: TextStyle(color: AppColors.inkFaint, fontSize: 12),
              ),
              const SizedBox(height: 8),
              _buildArtisanMap(),
              const SizedBox(height: 24),

              // Usta Listesi
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    _latitude != null
                        ? '$_radiusKm km Çevrenizdeki Ustalar'
                        : 'Öne Çıkan Ustalar',
                    style: const TextStyle(
                        color: AppColors.ink,
                        fontSize: 17,
                        fontWeight: FontWeight.w700),
                  ),
                  Text(
                    '${_artisans.length} usta bulundu',
                    style: const TextStyle(
                        color: AppColors.inkFaint, fontSize: 12),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              if (_isLoading)
                const Center(
                  child: Padding(
                    padding: EdgeInsets.all(40),
                    child: CircularProgressIndicator(),
                  ),
                )
              else if (_errorMessage != null)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Column(
                    children: [
                      const Icon(Icons.cloud_off_rounded,
                          size: 44, color: AppColors.inkFaint),
                      const SizedBox(height: 12),
                      Text(
                        _errorMessage!,
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: AppColors.inkSecondary),
                      ),
                      const SizedBox(height: 12),
                      TextButton(
                        onPressed: _fetchArtisans,
                        child: const Text('Tekrar dene'),
                      ),
                    ],
                  ),
                )
              else if (_customerLocationRequired && _latitude == null)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: const Text(
                    'Yakınınızdaki ustaları gösterebilmemiz için konumunuzu seçin.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppColors.inkSecondary),
                  ),
                )
              else if (_artisans.isEmpty)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(32),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: const Column(
                    children: [
                      Icon(Icons.search_off_rounded,
                          size: 48, color: AppColors.inkFaint),
                      SizedBox(height: 12),
                      Text(
                        'Aradığınız kriterde usta bulunamadı.',
                        style: TextStyle(color: AppColors.inkSecondary),
                      ),
                    ],
                  ),
                )
              else
                ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: _artisans.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 14),
                  itemBuilder: (context, index) {
                    final artisan = _artisans[index];
                    return InkWell(
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) =>
                                ArtisanDetailScreen(artisan: artisan),
                          ),
                        );
                      },
                      borderRadius: BorderRadius.circular(AppTheme.cardRadius),
                      child: Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius:
                              BorderRadius.circular(AppTheme.cardRadius),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                CircleAvatar(
                                  radius: 26,
                                  backgroundColor: AppColors.accentSoft,
                                  child: Text(
                                    artisan.fullName.isNotEmpty
                                        ? artisan.fullName[0]
                                        : 'U',
                                    style: const TextStyle(
                                      color: AppColors.accent,
                                      fontWeight: FontWeight.w700,
                                      fontSize: 20,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Expanded(
                                            child: Text(
                                              artisan.fullName,
                                              style: const TextStyle(
                                                color: AppColors.ink,
                                                fontWeight: FontWeight.w700,
                                                fontSize: 16,
                                              ),
                                            ),
                                          ),
                                          Container(
                                            padding: const EdgeInsets.symmetric(
                                                horizontal: 8, vertical: 3),
                                            decoration: BoxDecoration(
                                              color: AppColors.warningSoft,
                                              borderRadius:
                                                  BorderRadius.circular(8),
                                            ),
                                            child: Row(
                                              mainAxisSize: MainAxisSize.min,
                                              children: [
                                                const Icon(Icons.star_rounded,
                                                    color: AppColors.warning,
                                                    size: 16),
                                                const SizedBox(width: 4),
                                                Text(
                                                  artisan.rating
                                                      .toStringAsFixed(1),
                                                  style: const TextStyle(
                                                    color: AppColors.warning,
                                                    fontWeight: FontWeight.w700,
                                                    fontSize: 12,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        [
                                          if (artisan.locationLabel.isNotEmpty)
                                            artisan.locationLabel,
                                          if (artisan.locationIsApproximate)
                                            'Yaklaşık konum',
                                          if (artisan.distanceKm != null)
                                            '~${artisan.distanceKm!.round()} km',
                                          '${artisan.experienceYears} yıl deneyim',
                                        ].join(' • '),
                                        style: const TextStyle(
                                            color: AppColors.inkSecondary,
                                            fontSize: 13),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            Text(
                              artisan.bio,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                  color: AppColors.inkSecondary,
                                  fontSize: 13,
                                  height: 1.5),
                            ),
                            const SizedBox(height: 12),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                if (artisan.hourlyRate != null)
                                  Text(
                                    '${artisan.hourlyRate!.toInt()} ₺ / saat',
                                    style: const TextStyle(
                                      color: AppColors.accent,
                                      fontWeight: FontWeight.w700,
                                      fontSize: 14,
                                    ),
                                  )
                                else
                                  const Text(
                                    'Fiyat teklifi al',
                                    style: TextStyle(
                                        color: AppColors.inkFaint,
                                        fontSize: 13),
                                  ),
                                const Row(
                                  children: [
                                    Text(
                                      'Profili İncele',
                                      style: TextStyle(
                                        color: AppColors.accent,
                                        fontSize: 13,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                    Icon(Icons.chevron_right_rounded,
                                        color: AppColors.accent, size: 18),
                                  ],
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
            ],
          ),
        ),
      ),
    );
  }
}
