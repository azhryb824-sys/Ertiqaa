import 'package:flutter/material.dart';
import '../core/utils.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/common.dart';

/// سجل النشاط.
class ActivityScreen extends StatelessWidget {
  const ActivityScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = AppState.instance;
    final session = app.session!;
    if (!session.canManage) {
      return const Scaffold(
        backgroundColor: AppTheme.bg,
        body: EmptyState('غير متاح لدورك.', icon: Icons.lock_outline),
      );
    }
    final logs = app.allActivity.where(app.sameCompany).toList()
      ..sort((a, b) => ((b['createdAtMs'] as num?)?.toInt() ?? 0).compareTo((a['createdAtMs'] as num?)?.toInt() ?? 0));

    return Scaffold(
      backgroundColor: AppTheme.bg,
      body: logs.isEmpty
          ? const EmptyState('لا يوجد نشاط مسجل بعد')
          : ListView.builder(
              itemCount: logs.length,
              itemBuilder: (ctx, i) {
                final l = logs[i];
                return ListCard(
                  leadingIcon: const Icon(Icons.history_rounded, color: AppTheme.primary),
                  title: '${l['userName'] ?? ''} — ${l['action'] ?? ''}',
                  subtitle: '${l['entityId'] ?? ''} • ${l['details'] ?? ''}',
                  trailing: AppUtils.fmtDateTime(l['createdAtMs']),
                );
              },
            ),
    );
  }
}
