import 'package:flutter/material.dart';
import '../core/utils.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/common.dart';

/// الإشعارات.
class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = AppState.instance;
    final session = app.session!;
    // الإشعارات المحلية (misadNotifications + misadAdminInvites للمشرف) —
    // القائمة هنا من الإشعارات المخزنة محلياً أو قائمة فارغة مع تنبيه.
    final notifications = <Map<String, dynamic>>[];

    return Scaffold(
      backgroundColor: AppTheme.bg,
      body: notifications.isEmpty
          ? const EmptyState('لا توجد إشعارات حالياً.\nتُجلب الإشعارات من الخادم عند توفره.',
              icon: Icons.notifications_none_rounded)
          : ListView.builder(
              itemCount: notifications.length,
              itemBuilder: (ctx, i) {
                final n = notifications[i];
                return ListCard(
                  leadingIcon: const Icon(Icons.notifications_rounded, color: AppTheme.primary),
                  title: n['title']?.toString() ?? '',
                  subtitle: n['body']?.toString() ?? '',
                  trailing: n['createdAt']?.toString() ?? '',
                );
              },
            ),
    );
  }
}
