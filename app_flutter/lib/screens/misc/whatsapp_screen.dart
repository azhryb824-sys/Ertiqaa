import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import '../../state/app_state.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// واتساب: حالة الخدمة + إرسال رسالة للعميل.
class WhatsappScreen extends StatefulWidget {
  const WhatsappScreen({super.key});

  @override
  State<WhatsappScreen> createState() => _WhatsappScreenState();
}

class _WhatsappScreenState extends State<WhatsappScreen> {
  String? _status;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final j = await ApiClient.instance.get('/api/whatsapp/status');
      if (!mounted) return;
      setState(() => _status = j.toString());
    } catch (_) {
      if (!mounted) return;
      setState(() => _status = 'غير متصل بخدمة واتساب.');
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
              leading: Icon(_status == null ? Icons.sync_rounded : Icons.check_circle_rounded, color: AppTheme.success),
              title: const Text('حالة خدمة واتساب', style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w700)),
              subtitle: Text(_status ?? 'جارٍ التحقق...', style: const TextStyle(fontFamily: 'Cairo')),
              onTap: _load,
            ),
          ),
        ],
      ),
    );
  }
}
