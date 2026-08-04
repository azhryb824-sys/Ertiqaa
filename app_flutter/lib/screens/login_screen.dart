import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../core/auth_service.dart';
import '../core/session.dart';
import '../core/utils.dart';
import '../state/app_state.dart';
import '../theme.dart';

/// شاشة الدخول (هوية + كلمة مرور) مع تبويب التسجيل عبر رابط الدعوة.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _identityCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  final _inviteCtrl = TextEditingController();
  bool _loading = false;
  bool _obscure = true;
  String? _error;
  int _tab = 0;

  @override
  void dispose() {
    _identityCtrl.dispose();
    _passCtrl.dispose();
    _inviteCtrl.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    FocusScope.of(context).unfocus();
    final id = AppUtils.cleanId(_identityCtrl.text);
    if (id.isEmpty || _passCtrl.text.isEmpty) {
      setState(() => _error = 'أدخل رقم الهوية وكلمة المرور.');
      return;
    }
    setState(() { _loading = true; _error = null; });
    final result = await AppState.instance.login(id, _passCtrl.text);
    if (!mounted) return;
    setState(() {
      _loading = false;
      if (!result.success) _error = result.error ?? 'خطأ في الدخول.';
    });
  }

  Future<void> _registerViaInvite() async {
    final code = _inviteCtrl.text.trim();
    if (code.isEmpty) {
      setState(() => _error = 'أدخل رمز الدعوة.');
      return;
    }
    // التسجيل عبر رابط الدعوة: يُفتح رابط /#invite=... في المتصفح
    final url = Uri.parse(
        '${AppState.instance.storage.api.baseUrl}/#invite=$code');
    setState(() => _loading = true);
    try {
      // تفويض الجهاز مباشرة
      final user = UserSession(id: code, role: 'client', name: '');
      final ok = await AuthService.instance.authorizeDevice(user);
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = ok
            ? 'تم تفويض الجهاز. أدخل رقم الهوية وكلمة المرور أدناه.'
            : 'تعذر تفويض الجهاز. افتح الرابط: $url';
      });
    } catch (_) {
      setState(() {
        _loading = false;
        _error = 'تعذر الوصول للخادم. افتح الرابط يدوياً:\n$url';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.primaryDark,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              children: [
                Container(
                  width: 88,
                  height: 88,
                  decoration: BoxDecoration(
                    color: AppTheme.gold,
                    borderRadius: BorderRadius.circular(26),
                  ),
                  child: const Icon(Icons.elevator_rounded, color: AppTheme.primaryDark, size: 52),
                ),
                const SizedBox(height: 18),
                const Text('شموس للمصاعد',
                    style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800)),
                const SizedBox(height: 6),
                const Text('نظام إدارة الصيانة والتركيب',
                    style: TextStyle(color: AppTheme.goldLight, fontSize: 13)),
                const SizedBox(height: 30),
                Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.2), blurRadius: 20)],
                  ),
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      SegmentedButton<int>(
                        segments: const [
                          ButtonSegment(value: 0, label: Text('دخول')),
                          ButtonSegment(value: 1, label: Text('تسجيل عبر الدعوة')),
                        ],
                        selected: {_tab},
                        onSelectionChanged: (s) => setState(() { _tab = s.first; _error = null; }),
                        style: SegmentedButton.styleFrom(
                          selectedBackgroundColor: AppTheme.primary,
                          selectedForegroundColor: Colors.white,
                          foregroundColor: AppTheme.primary,
                          textStyle: const TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w600),
                        ),
                      ),
                      const SizedBox(height: 18),
                      if (_tab == 0) ...[
                        TextField(
                          controller: _identityCtrl,
                          keyboardType: TextInputType.number,
                          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                          decoration: const InputDecoration(
                            labelText: 'رقم الهوية',
                            prefixIcon: Icon(Icons.badge_outlined, color: AppTheme.primary),
                          ),
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: _passCtrl,
                          obscureText: _obscure,
                          onSubmitted: (_) => _login(),
                          decoration: InputDecoration(
                            labelText: 'كلمة المرور',
                            prefixIcon: const Icon(Icons.lock_outline, color: AppTheme.primary),
                            suffixIcon: IconButton(
                              icon: Icon(_obscure ? Icons.visibility_off : Icons.visibility, color: AppTheme.textMuted),
                              onPressed: () => setState(() => _obscure = !_obscure),
                            ),
                          ),
                        ),
                        const SizedBox(height: 18),
                        ElevatedButton(
                          onPressed: _loading ? null : _login,
                          child: _loading
                              ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                              : const Text('دخول'),
                        ),
                      ] else ...[
                        TextField(
                          controller: _inviteCtrl,
                          decoration: const InputDecoration(
                            labelText: 'رمز الدعوة',
                            prefixIcon: Icon(Icons.link, color: AppTheme.primary),
                          ),
                        ),
                        const SizedBox(height: 12),
                        ElevatedButton(
                          onPressed: _loading ? null : _registerViaInvite,
                          child: _loading
                              ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                              : const Text('تفويض الجهاز'),
                        ),
                      ],
                      if (_error != null) ...[
                        const SizedBox(height: 12),
                        Text(_error!,
                            textAlign: TextAlign.center,
                            style: const TextStyle(color: AppTheme.danger, fontSize: 13)),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                const Text('© شموس للمصاعد — كل الحقوق محفوظة',
                    style: TextStyle(color: Colors.white38, fontSize: 11)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
