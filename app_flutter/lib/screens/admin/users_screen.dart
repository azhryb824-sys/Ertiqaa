import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import '../../core/utils.dart';
import '../../state/app_state.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// المستخدمون (مشرف النظام فقط): استعراض + حذف/استعادة عبر الخادم.
class UsersScreen extends StatefulWidget {
  const UsersScreen({super.key});

  @override
  State<UsersScreen> createState() => _UsersScreenState();
}

class _UsersScreenState extends State<UsersScreen> {
  Future<void> _deleteUser(Map<String, dynamic> u) async {
    final app = AppState.instance;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('تعطيل المستخدم', style: TextStyle(fontFamily: 'Cairo')),
        content: Text('سيتم تعطيل ${u['name'] ?? u['id']} ويمكن استعادته لاحقاً. هل تريد المتابعة؟', style: const TextStyle(fontFamily: 'Cairo')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('تراجع', style: TextStyle(fontFamily: 'Cairo'))),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('تعطيل', style: TextStyle(fontFamily: 'Cairo', color: AppTheme.danger))),
        ],
      ),
    );
    if (ok != true) return;
    try {
      final j = await ApiClient.instance.post('/api/admin/delete-user', body: {
        'userId': u['id'],
        'role': app.session!.role,
        'requesterId': app.session!.id,
      });
      await app.storage.reload();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(j is Map && j['ok'] == true ? 'تم تعطيل المستخدم.' : (j is Map ? j['error']?.toString() ?? 'حدث خطأ.' : 'حدث خطأ.'),
                style: const TextStyle(fontFamily: 'Cairo'))));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تعذر الاتصال بالخادم.', style: TextStyle(fontFamily: 'Cairo'))));
      }
    }
  }

  Future<void> _restoreUser(Map<String, dynamic> u) async {
    final app = AppState.instance;
    try {
      final j = await ApiClient.instance.post('/api/admin/restore-user', body: {
        'userId': u['id'],
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
    final users = app.allUsers;
    return Scaffold(
      backgroundColor: AppTheme.bg,
      appBar: AppBar(title: const Text('المستخدمون')),
      body: users.isEmpty
          ? const EmptyState('لا توجد حسابات مستخدمين مخزنة محلياً.\nتُجلب بيانات المستخدمين من الخادم.')
          : ListView.builder(
              padding: const EdgeInsets.only(bottom: 40),
              itemCount: users.length,
              itemBuilder: (ctx, i) {
                final u = users[i];
                final deleted = u['deletedAt'] != null;
                final isSelf = u['id']?.toString() == session.id;
                return ListCard(
                  leadingIcon: const Icon(Icons.person_rounded, color: AppTheme.primary),
                  title: '${u['name'] ?? ''} — ${u['identity'] ?? u['id'] ?? ''}',
                  subtitle: u['role']?.toString() ?? '',
                  trailingWidget: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      StatusBadge(deleted ? 'محذوف' : 'نشط'),
                      if (session.role == 'admin' && !isSelf) ...[
                        const SizedBox(width: 6),
                        IconButton(
                          icon: Icon(deleted ? Icons.restore_rounded : Icons.delete_outline,
                              color: deleted ? AppTheme.success : AppTheme.danger),
                          onPressed: () => deleted ? _restoreUser(u) : _deleteUser(u),
                        ),
                      ],
                    ],
                  ),
                );
              },
            ),
    );
  }
}