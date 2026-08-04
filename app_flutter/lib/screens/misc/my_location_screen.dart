import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import '../../core/utils.dart';
import '../../state/app_state.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// موقعي (للفني): إرسال الموقع الحالي لتتبعه.
class MyLocationScreen extends StatefulWidget {
  const MyLocationScreen({super.key});

  @override
  State<MyLocationScreen> createState() => _MyLocationScreenState();
}

class _MyLocationScreenState extends State<MyLocationScreen> {
  bool _sending = false;
  String? _lastSent;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bg,
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            margin: EdgeInsets.zero,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Icon(Icons.my_location_rounded, color: AppTheme.primary, size: 48),
                  const SizedBox(height: 8),
                  const Text('إرسال موقعك الحالي', textAlign: TextAlign.center, style: TextStyle(fontFamily: 'Cairo', fontSize: 16, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 8),
                  const Text('يُرسل الموقع إلى لوحة تتبع الفنيين في الشركة.',
                      textAlign: TextAlign.center, style: TextStyle(fontFamily: 'Cairo', color: AppTheme.textMuted)),
                  const SizedBox(height: 16),
                  ElevatedButton.icon(
                    onPressed: _sending ? null : _send,
                    icon: _sending
                        ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Icon(Icons.near_me_rounded),
                    label: const Text('إرسال الموقع', style: TextStyle(fontFamily: 'Cairo')),
                  ),
                  if (_lastSent != null) ...[
                    const SizedBox(height: 12),
                    Text('آخر إرسال: $_lastSent', textAlign: TextAlign.center, style: const TextStyle(fontFamily: 'Cairo', fontSize: 12, color: AppTheme.success)),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          const Text('ملاحظة: للحصول على الموقع بدقة يحتاج التطبيق صلاحية الوصول للموقع من إعدادات النظام.',
              style: TextStyle(fontFamily: 'Cairo', fontSize: 12, color: AppTheme.textMuted)),
        ],
      ),
    );
  }

  Future<void> _send() async {
    final app = AppState.instance;
    setState(() => _sending = true);
    final now = DateTime.now();
    final entry = {
      'userId': app.session!.id,
      'name': app.session!.name,
      'lat': null,
      'lng': null,
      'updatedAt': now.toIso8601String(),
      'timestamp': now.millisecondsSinceEpoch,
    };
    // محاولة الحصول على الموقع الفعلي عبر geolocator
    try {
      final pos = await _geo();
      if (pos != null) {
        entry['lat'] = pos['lat'];
        entry['lng'] = pos['lng'];
      }
    } catch (_) {}
    await app.append('misadStaffLocations', entry);
    if (!mounted) return;
    setState(() {
      _sending = false;
      _lastSent = '${AppUtils.fmtDateTime(now)} — ${entry['lat'] != null ? 'تم تحديد الموقع' : 'بدون إحداثيات (السماح مطلوب)'}';
    });
  }

  Future<Map<String, dynamic>?> _geo() async {
    try {
      final pos = await Geolocator.getCurrentPosition();
      return {'lat': pos.latitude, 'lng': pos.longitude};
    } catch (_) {
      return null;
    }
  }
}
