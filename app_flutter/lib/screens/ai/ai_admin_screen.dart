import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import '../../state/app_state.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// الإدارة الذكية / المساعد الذكي — يمرر عبر /api/ai/execute و /api/ai/admin.
class AiAdminScreen extends StatefulWidget {
  const AiAdminScreen({super.key});

  @override
  State<AiAdminScreen> createState() => _AiAdminScreenState();
}

class _AiAdminScreenState extends State<AiAdminScreen> {
  final _inputCtrl = TextEditingController();
  String? _answer;
  bool _loading = false;

  @override
  void dispose() {
    _inputCtrl.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final app = AppState.instance;
    final s = app.session!;
    final q = _inputCtrl.text.trim();
    if (q.isEmpty) return;
    setState(() { _loading = true; _answer = null; });
    try {
      final j = await ApiClient.instance.post('/api/ai/execute', body: {
        'question': q,
        'userId': s.id,
        'role': s.role,
        'name': s.name,
        'permissions': s.permissions,
        'companyOwnerId': s.companyOwnerId,
      });
      if (!mounted) return;
      setState(() {
        _loading = false;
        _answer = (j?['answer'] ?? j?['message'] ?? 'لا يوجد رد.').toString();
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _answer = 'تعذر الوصول إلى المساعد الذكي (غير متصل بالخادم).';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bg,
      body: Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (_answer != null)
                  Card(
                    margin: EdgeInsets.zero,
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Text(_answer!, style: const TextStyle(fontFamily: 'Cairo', height: 1.6)),
                    ),
                  )
                else
                  const EmptyState('اكتب أمراً نصياً أو صوتياً، وسيقوم المساعد الذكي بالتنفيذ.', icon: Icons.auto_awesome_rounded),
              ],
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _inputCtrl,
                      onSubmitted: (_) => _send(),
                      decoration: const InputDecoration(
                        hintText: 'اكتب أمراً...',
                        prefixIcon: Icon(Icons.auto_awesome_rounded, color: AppTheme.primary),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filled(
                    onPressed: _loading ? null : _send,
                    icon: _loading
                        ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Icon(Icons.send_rounded),
                    style: IconButton.styleFrom(backgroundColor: AppTheme.primary, foregroundColor: Colors.white),
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
