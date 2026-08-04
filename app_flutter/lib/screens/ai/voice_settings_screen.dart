import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import '../../state/app_state.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// إعدادات الصوت — /api/voice/settings + /api/voice/samples.
class VoiceSettingsScreen extends StatefulWidget {
  const VoiceSettingsScreen({super.key});

  @override
  State<VoiceSettingsScreen> createState() => _VoiceSettingsScreenState();
}

class _VoiceSettingsScreenState extends State<VoiceSettingsScreen> {
  dynamic _settings;
  bool _loading = false;
  bool _voiceEnabled = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final j = await ApiClient.instance.get('/api/voice/settings');
      if (!mounted) return;
      setState(() { _settings = j; _loading = false; });
    } catch (_) {
      if (!mounted) return;
      setState(() { _settings = null; _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bg,
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            margin: EdgeInsets.zero,
            child: SwitchListTile(
              title: const Text('تفعيل الأوامر الصوتية', style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w700)),
              subtitle: const Text('يتطلب اتصالاً بالخادم وخدمة الصوت.', style: TextStyle(fontFamily: 'Cairo')),
              value: _voiceEnabled,
              activeThumbColor: AppTheme.primary,
              onChanged: (v) => setState(() => _voiceEnabled = v),
            ),
          ),
          const SizedBox(height: 12),
          Card(
            margin: EdgeInsets.zero,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text('حالة الخادم الصوتي', style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w800)),
                  const SizedBox(height: 8),
                  if (_loading)
                    const Center(child: CircularProgressIndicator(color: AppTheme.primary))
                  else if (_settings == null)
                    const Text('تعذر الاتصال بخدمة الصوت.', style: TextStyle(fontFamily: 'Cairo', color: AppTheme.textMuted))
                  else
                    Text(_settings.toString(), style: const TextStyle(fontFamily: 'Cairo')),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
