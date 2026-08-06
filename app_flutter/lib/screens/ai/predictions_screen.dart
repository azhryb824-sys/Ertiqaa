import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import '../../core/utils.dart';
import '../../state/app_state.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// التنبؤ بالأعطال — /api/ai/predict-failures.
class PredictionsScreen extends StatefulWidget {
  const PredictionsScreen({super.key});

  @override
  State<PredictionsScreen> createState() => _PredictionsScreenState();
}

class _PredictionsScreenState extends State<PredictionsScreen> {
  dynamic _data;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final j = await ApiClient.instance.get('/api/ai/predict-failures');
      if (!mounted) return;
      setState(() { _data = j; _loading = false; });
    } catch (_) {
      if (!mounted) return;
      setState(() { _data = null; _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = AppState.instance;
    // تنبؤ محلي بسيط: عقود تحتاج تجديد + بلاغات متأخرة عن SLA
    final renewals = app.visibleContracts.where((c) => c.needsRenewal()).length;
    return Scaffold(
      backgroundColor: AppTheme.bg,
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [AppTheme.primaryDark, AppTheme.primary]),
              borderRadius: BorderRadius.circular(18),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('تنبؤات الصيانة', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800, fontFamily: 'Cairo')),
                const SizedBox(height: 8),
                Text('$renewals عقداً تحتاج تجديداً قريباً.', style: const TextStyle(color: AppTheme.goldLight, fontFamily: 'Cairo')),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Card(
            margin: EdgeInsets.zero,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  const Text('نتائج الذكاء الاصطناعي', style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w800)),
                  const SizedBox(height: 8),
                  if (_loading)
                    const CircularProgressIndicator(color: AppTheme.primary)
                  else if (_data == null)
                    const Text('لا تتوفر نتائج تنبؤ من الخادم.', style: TextStyle(fontFamily: 'Cairo', color: AppTheme.textMuted))
                  else
                    Text(_data.toString(), style: const TextStyle(fontFamily: 'Cairo')),
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    onPressed: _loading ? null : _load,
                    icon: const Icon(Icons.refresh_rounded),
                    label: const Text('إعادة التحميل', style: TextStyle(fontFamily: 'Cairo')),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
