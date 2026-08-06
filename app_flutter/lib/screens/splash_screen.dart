import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../core/storage_service.dart';
import '../state/app_state.dart';
import '../theme.dart';

/// شاشة البداية: تهيئة التطبيق ثم الانتقال.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _boot();
  }

  Future<void> _boot() async {
    final app = AppState.instance;
    SharedPreferences.getInstance().then((prefs) {
      StorageService.instance.attachPrefs(prefs);
    });
    await app.init();
    if (!mounted) return;
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final logged = AppState.instance.isLoggedIn;
    return Scaffold(
      backgroundColor: AppTheme.primaryDark,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 96,
              height: 96,
              decoration: BoxDecoration(
                color: AppTheme.gold,
                borderRadius: BorderRadius.circular(28),
              ),
              child: const Icon(Icons.elevator_rounded, color: AppTheme.primaryDark, size: 56),
            ),
            const SizedBox(height: 20),
            const Text('شموس للمصاعد',
                style: TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            const Text('نظام إدارة الصيانة والتركيب',
                style: TextStyle(color: AppTheme.goldLight, fontSize: 14)),
            const SizedBox(height: 32),
            const CircularProgressIndicator(color: AppTheme.gold),
            const SizedBox(height: 16),
            Text(logged ? 'جارٍ التحميل...' : 'تسجيل الدخول',
                style: const TextStyle(color: Colors.white70, fontSize: 13)),
          ],
        ),
      ),
    );
  }
}
