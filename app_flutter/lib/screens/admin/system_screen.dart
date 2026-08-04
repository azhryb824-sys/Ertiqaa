import 'package:flutter/material.dart';
import '../../core/constants.dart';
import '../../state/app_state.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// صفحة النظام (مشرف النظام): إحصائيات عامة + روابط سريعة.
class AdminSystemScreen extends StatefulWidget {
  const AdminSystemScreen({super.key});

  @override
  State<AdminSystemScreen> createState() => _AdminSystemScreenState();
}

class _AdminSystemScreenState extends State<AdminSystemScreen> {
  @override
  Widget build(BuildContext context) {
    final app = AppState.instance;
    final session = app.session!;
    if (session.role != 'admin') {
      return const Scaffold(
        backgroundColor: AppTheme.bg,
        body: EmptyState('متاح لمشرف النظام فقط.', icon: Icons.lock_outline),
      );
    }
    final users = app.allUsers;
    final activeUsers = users.where((u) => u['deletedAt'] == null).length;
    final companies = app.ownerCompanies;
    final activeCo = companies.where((c) => c['deletedAt'] == null).length;
    final contracts = app.allContracts.length;
    final staff = app.allStaff.length;
    final tickets = app.allTickets.length;
    final banners = app.allBanners.where((b) => b['status']?.toString() == 'active').length;

    return Scaffold(
      backgroundColor: AppTheme.bg,
      appBar: AppBar(title: const Text('النظام')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _statRow([
            _stat('${activeUsers}', 'مستخدم نشط', Icons.person_rounded),
            _stat('${activeCo}', 'منشأة نشطة', Icons.apartment_rounded),
          ]),
          const SizedBox(height: 12),
          _statRow([
            _stat('${contracts}', 'عقد', Icons.description_rounded),
            _stat('${staff}', 'عضو فريق', Icons.groups_rounded),
          ]),
          const SizedBox(height: 12),
          _statRow([
            _stat('${tickets}', 'بلاغ', Icons.confirmation_number_rounded),
            _stat('${banners}', 'بنر نشط', Icons.campaign_rounded),
          ]),
          const SizedBox(height: 20),
          Card(
            margin: EdgeInsets.zero,
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.manage_accounts_rounded, color: AppTheme.primary),
                  title: const Text('المستخدمون', style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w700)),
                  subtitle: const Text('إدارة حسابات المستخدمين وحذفها واستعادتها.', style: TextStyle(fontFamily: 'Cairo', fontSize: 12)),
                  trailing: const Icon(Icons.chevron_left_rounded, color: AppTheme.textMuted),
                  onTap: () => app.go('users'),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.apartment_rounded, color: AppTheme.primary),
                  title: const Text('الشركات والمؤسسات', style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w700)),
                  subtitle: const Text('إدارة الشركات وتعطيلها واستعادتها.', style: TextStyle(fontFamily: 'Cairo', fontSize: 12)),
                  trailing: const Icon(Icons.chevron_left_rounded, color: AppTheme.textMuted),
                  onTap: () => app.go('companies'),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.campaign_rounded, color: AppTheme.gold),
                  title: const Text('البنرات', style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w700)),
                  subtitle: const Text('إضافة وتفعيل وإيقاف بنرات النظام.', style: TextStyle(fontFamily: 'Cairo', fontSize: 12)),
                  trailing: const Icon(Icons.chevron_left_rounded, color: AppTheme.textMuted),
                  onTap: () => app.go('banners'),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.gavel_rounded, color: AppTheme.danger),
                  title: const Text('الإنذارات والحظر', style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w700)),
                  subtitle: const Text('الهويات المحظورة من التسجيل.', style: TextStyle(fontFamily: 'Cairo', fontSize: 12)),
                  trailing: const Icon(Icons.chevron_left_rounded, color: AppTheme.textMuted),
                  onTap: () => app.go('moderation'),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.storage_rounded, color: AppTheme.success),
                  title: const Text('بيانات التخزين', style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w700)),
                  subtitle: const Text('استعراض مفاتيح التخزين ومعاينة البيانات.', style: TextStyle(fontFamily: 'Cairo', fontSize: 12)),
                  trailing: const Icon(Icons.chevron_left_rounded, color: AppTheme.textMuted),
                  onTap: () => app.go('storage-data'),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.settings_rounded, color: AppTheme.textDark),
                  title: const Text('أدوات البيانات', style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w700)),
                  subtitle: const Text('تصدير واستيراد ونسخ احتياطي واستيراد عقود Excel.', style: TextStyle(fontFamily: 'Cairo', fontSize: 12)),
                  trailing: const Icon(Icons.chevron_left_rounded, color: AppTheme.textMuted),
                  onTap: () => app.go('data-tools'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _statRow(List<Widget> items) => Row(
        children: [
          for (final w in items) ...[Expanded(child: w), if (w != items.last) const SizedBox(width: 12)],
        ],
      );

  Widget _stat(String value, String label, IconData icon) => Card(
        margin: EdgeInsets.zero,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, color: AppTheme.primary, size: 20),
              const SizedBox(height: 8),
              Text(value, style: const TextStyle(fontFamily: 'Cairo', fontSize: 22, fontWeight: FontWeight.w800)),
              Text(label, style: const TextStyle(fontFamily: 'Cairo', fontSize: 12, color: AppTheme.textMuted)),
            ],
          ),
        ),
      );
}