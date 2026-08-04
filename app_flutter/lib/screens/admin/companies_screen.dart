import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import '../../core/utils.dart';
import '../../state/app_state.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// الشركات والمؤسسات (مشرف النظام فقط): استعراض + تعطيل/استعادة عبر الخادم.
class CompaniesScreen extends StatefulWidget {
  const CompaniesScreen({super.key});

  @override
  State<CompaniesScreen> createState() => _CompaniesScreenState();
}

class _CompaniesScreenState extends State<CompaniesScreen> {
  Future<void> _deleteCompany(Map<String, dynamic> c) async {
    final app = AppState.instance;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('تعطيل الشركة', style: TextStyle(fontFamily: 'Cairo')),
        content: Text('سيتم تعطيل ${c['name'] ?? c['id']} ويمكن استعادتها لاحقاً. هل تريد المتابعة؟', style: const TextStyle(fontFamily: 'Cairo')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('تراجع', style: TextStyle(fontFamily: 'Cairo'))),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('تعطيل', style: TextStyle(fontFamily: 'Cairo', color: AppTheme.danger))),
        ],
      ),
    );
    if (ok != true) return;
    try {
      final j = await ApiClient.instance.post('/api/admin/delete-company', body: {
        'companyId': c['id']?.toString() ?? c['ownerId']?.toString() ?? '',
        'role': app.session!.role,
        'requesterId': app.session!.id,
      });
      await app.storage.reload();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(j is Map && j['ok'] == true ? 'تم تعطيل الشركة.' : (j is Map ? j['error']?.toString() ?? 'حدث خطأ.' : 'حدث خطأ.'),
                style: const TextStyle(fontFamily: 'Cairo'))));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تعذر الاتصال بالخادم.', style: TextStyle(fontFamily: 'Cairo'))));
      }
    }
  }

  Future<void> _restoreCompany(Map<String, dynamic> c) async {
    final app = AppState.instance;
    try {
      final j = await ApiClient.instance.post('/api/admin/restore-company', body: {
        'companyId': c['id']?.toString() ?? c['ownerId']?.toString() ?? '',
        'role': app.session!.role,
        'requesterId': app.session!.id,
      });
      await app.storage.reload();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(j is Map && j['ok'] == true ? 'تمت الاستعادة.' : (j is Map ? j['error']?.toString() ?? 'حدث خطأ.' : 'حدث خطأ.'),
                style: const TextStyle(fontFamily: 'Cairo'))));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تعذر الاتصال بالخادم.', style: TextStyle(fontFamily: 'Cairo'))));
      }
    }
  }

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
    final companies = app.ownerCompanies;
    return Scaffold(
      backgroundColor: AppTheme.bg,
      appBar: AppBar(title: const Text('الشركات والمؤسسات')),
      body: companies.isEmpty
          ? const EmptyState('لا توجد شركات مسجلة.')
          : ListView.builder(
              itemCount: companies.length,
              itemBuilder: (ctx, i) {
                final c = companies[i];
                final deleted = c['deletedAt'] != null;
                return ListCard(
                  leadingIcon: const Icon(Icons.apartment_rounded, color: AppTheme.primary),
                  title: c['name']?.toString() ?? '',
                  subtitle: 'الرقم الموحد: ${c['unifiedNumber'] ?? ''}',
                  trailingWidget: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      StatusBadge(deleted ? 'ملغية' : 'نشطة'),
                      const SizedBox(width: 6),
                      IconButton(
                        icon: Icon(deleted ? Icons.restore_rounded : Icons.delete_outline,
                            color: deleted ? AppTheme.success : AppTheme.danger),
                        onPressed: () => deleted ? _restoreCompany(c) : _deleteCompany(c),
                      ),
                    ],
                  ),
                );
              },
            ),
    );
  }
}