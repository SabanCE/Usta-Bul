import 'package:flutter/material.dart';
import 'core/storage/token_storage.dart';
import 'core/theme/app_theme.dart';
import 'screens/auth/login_screen.dart';
import 'screens/home/home_screen.dart';
import 'screens/requests/requests_list_screen.dart';
import 'screens/dashboard/artisan_dashboard_screen.dart';
import 'screens/profile/profile_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const UstaBulMobileApp());
}

class UstaBulMobileApp extends StatelessWidget {
  const UstaBulMobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Usta Bul Mobil',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      home: const RootNavigationWrapper(),
    );
  }
}

class RootNavigationWrapper extends StatefulWidget {
  const RootNavigationWrapper({super.key});

  @override
  State<RootNavigationWrapper> createState() => _RootNavigationWrapperState();
}

class _RootNavigationWrapperState extends State<RootNavigationWrapper> {
  bool _isLoading = true;
  bool _isLoggedIn = false;
  String? _userRole;
  int _currentIndex = 0;

  @override
  void initState() {
    super.initState();
    _checkAuth();
  }

  Future<void> _checkAuth() async {
    final hasToken = await TokenStorage.hasToken();
    final role = await TokenStorage.getUserRole();
    setState(() {
      _isLoggedIn = hasToken;
      _userRole = role;
      _isLoading = false;
    });
  }

  void _onLoginSuccess() {
    _checkAuth();
  }

  void _onLogout() {
    setState(() {
      _isLoggedIn = false;
      _userRole = null;
      _currentIndex = 0;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        body: Center(
          child: CircularProgressIndicator(),
        ),
      );
    }

    if (!_isLoggedIn) {
      return LoginScreen(onLoginSuccess: _onLoginSuccess);
    }

    final isArtisan = _userRole == 'artisan';

    // Sekmeler (Müşteri vs Usta rollerine özel)
    final pages = isArtisan
        ? [
            const ArtisanDashboardScreen(),
            const HomeScreen(), // Ustalar da keşfedebilir
            ProfileScreen(onLogout: _onLogout),
          ]
        : [
            const HomeScreen(),
            const RequestsListScreen(),
            ProfileScreen(onLogout: _onLogout),
          ];

    final bottomNavItems = isArtisan
        ? const [
            BottomNavigationBarItem(
              icon: Icon(Icons.dashboard_outlined),
              activeIcon: Icon(Icons.dashboard_rounded),
              label: 'İş Paneli',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.search_outlined),
              activeIcon: Icon(Icons.search_rounded),
              label: 'Ustalar',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.person_outline),
              activeIcon: Icon(Icons.person_rounded),
              label: 'Profil',
            ),
          ]
        : const [
            BottomNavigationBarItem(
              icon: Icon(Icons.home_outlined),
              activeIcon: Icon(Icons.home_rounded),
              label: 'Ana Sayfa',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.receipt_long_outlined),
              activeIcon: Icon(Icons.receipt_long_rounded),
              label: 'Taleplerim',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.person_outline),
              activeIcon: Icon(Icons.person_rounded),
              label: 'Profil',
            ),
          ];

    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: pages,
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) => setState(() => _currentIndex = index),
        items: bottomNavItems,
      ),
    );
  }
}
