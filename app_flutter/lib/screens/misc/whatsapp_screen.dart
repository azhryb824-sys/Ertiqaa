import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/api_client.dart';
import '../../state/app_state.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// واتساب: حالة الخدمة + حفظ رقم الجوال + سجل الرسائل المُرسلة.
class WhatsappScreen extends StatefulWidget {
  const WhatsappScreen({super.key});

  @override
  State<WhatsappScreen> createState() => _WhatsappScreenState();
}

class _WhatsappScreenState extends State<WhatsappScreen> {
  bool _configured = false;
  bool _loadingStatus = true;
  final _phoneCtrl = TextEditingController();
  bool _whatsappEnabled = false;
  List<Map<String, dynamic>> _log = [];
  bool _loadingLog = true;

  @override
  void initState() {
    super.initState();
    _loadStatus();
    _loadLog();
  }

  @override
  void dispose() {
    _phoneCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadStatus() async {
    try {
      final j = await ApiClient.instance.get('/api/whatsapp/status');
      if (!mounted) return;
      setState(() {
        _configured = j is Map && j['configured'] == true;
        _loadingStatus = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() { _configured = false; _loadingStatus = false; });
    }
  }

  Future<void> _loadLog() async {
    final app = AppState.instance;
    final session = app.session!;
    try {
      final j = await ApiClient.instance.get('/api/notifications', query: {
        'userId': session.id,
        'role': session.role,
      });
      final list = (j is Map && j['notifications'] is List)
          ? (j['notifications'] as List).whereType<Map>().toList()
          : <Map>[];
      final wa = list.where((n) => n['whatsapp'] is Map && (n['whatsapp'] as Map)['sent'] == true).toList();
      if (!mounted) return;
      setState(() {
        _log = wa.map((e) => Map<String, dynamic>.from(e)).toList();
        _loadingLog = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() { _loadingLog = false; });
    }
  }

  Future<void> _savePhone() async {
    final app = AppState.instance;
    final session = app.session!;
    final phone = _phoneCtrl.text.replaceAll(RegExp(r'[^0-9]'), '');
    if (phone.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('أدخل رقم الجوال.', style: TextStyle(fontFamily: 'Cairo'))));
      }
      return;
    }
    try {
      final j = await ApiClient.instance.post('/api/user/phone', body: {
        'userId': session.id,
        'phone': phone,
        'whatsappEnabled': _whatsappEnabled,
      });
      if (mounted) {
        final ok = j is Map && j['ok'] == true;
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(ok ? 'تم حفظ رقم الجوال.' : (j is Map ? j['error']?.toString() ?? 'تعذر الحفظ.' : 'تعذر الحفظ.'),
                style: const TextStyle(fontFamily: 'Cairo'))));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تعذر الاتصال بالخادم.', style: TextStyle(fontFamily: 'Cairo'))));
      }
    }
  }

  Future<void> _openWhatsApp(String phone) async {
    final digits = phone.replaceAll(RegExp(r'[^0-9]'), '');
    if (digits.isEmpty) return;
    final uri = Uri.parse('https://wa.me/$digits');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
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
            child: ListTile(
              leading: Icon(_loadingStatus ? Icons.sync_rounded : (_configured ? Icons.check_circle_rounded : Icons.warning_amber_rounded),
                  color: _configured ? AppTheme.success : AppTheme.danger),
              title: const Text('حالة خدمة واتساب', style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w700)),
              subtitle: Text(_loadingStatus ? 'جارٍ التحقق...' : (_configured ? 'الخدمة مفعّلة.' : 'الخدمة غير مفعّلة.'),
                  style: const TextStyle(fontFamily: 'Cairo')),
              onTap: _loadStatus,
            ),
          ),
          const SizedBox(height: 14),
          Card(
            margin: EdgeInsets.zero,
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SectionHeader(1, 'رقم الجوال للواتساب'),
                  AppField(label: 'رقم الجوال (05xxxxxxxx)', controller: _phoneCtrl, keyboard: TextInputType.phone),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('تفعيل استقبال رسائل واتساب', style: TextStyle(fontFamily: 'Cairo')),
                    value: _whatsappEnabled,
                    onChanged: (v) => setState(() => _whatsappEnabled = v),
                  ),
                  ElevatedButton(onPressed: _savePhone, child: const Text('حفظ')),
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),
          Card(
            margin: EdgeInsets.zero,
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SectionHeader(2, 'سجل رسائل واتساب'),
                  if (_loadingLog)
                    const Padding(padding: EdgeInsets.all(12), child: Center(child: CircularProgressIndicator()))
                  else if (_log.isEmpty)
                    const Padding(
                      padding: EdgeInsets.all(12),
                      child: Text('لا توجد رسائل واتساب مرسلة بعد.', style: TextStyle(fontFamily: 'Cairo', color: AppTheme.textMuted)),
                    )
                  else
                    for (final n in _log)
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: const Icon(Icons.chat_rounded, color: AppTheme.success),
                        title: Text(n['title']?.toString() ?? '', style: const TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w700, fontSize: 13)),
                        subtitle: Text(n['body']?.toString() ?? '', style: const TextStyle(fontFamily: 'Cairo', fontSize: 11)),
                        trailing: TextButton(
                          onPressed: () => _openWhatsApp((n['whatsapp'] as Map?)?['to']?.toString() ?? ''),
                          child: const Text('فتح', style: TextStyle(fontFamily: 'Cairo')),
                        ),
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
