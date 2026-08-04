import 'package:flutter/material.dart';
import '../../core/utils.dart';
import '../../state/app_state.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// المستخدمون (مشرف النظام فقط).
class UsersScreen extends StatelessWidget {
  const UsersScreen({super.key});

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
      body: users.isEmpty
          ? const EmptyState('لا توجد حسابات مستخدمين مخزنة محلياً.\nتُجلب بيانات المستخدمين من الخادم.')
          : ListView.builder(
              padding: const EdgeInsets.only(bottom: 40),
              itemCount: users.length,
              itemBuilder: (ctx, i) {
                final u = users[i];
                return ListCard(
                  leadingIcon: const Icon(Icons.person_rounded, color: AppTheme.primary),
                  title: '${u['name'] ?? ''} — ${u['identity'] ?? u['id'] ?? ''}',
                  subtitle: u['role']?.toString() ?? '',
                  trailingWidget: StatusBadge(u['active'] == false ? 'معطل' : 'نشط'),
                );
              },
            ),
    );
  }
}
