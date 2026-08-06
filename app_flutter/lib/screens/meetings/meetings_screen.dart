import 'package:flutter/material.dart';
import '../../core/utils.dart';
import '../../state/app_state.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// الاجتماعات.
class MeetingsScreen extends StatelessWidget {
  const MeetingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = AppState.instance;
    final meetings = app.allMeetings.where(app.sameCompany).toList()
      ..sort((a, b) => (b['createdAtMs'] ?? 0).toString().compareTo((a['createdAtMs'] ?? 0).toString()));

    return Scaffold(
      backgroundColor: AppTheme.bg,
      floatingActionButton: app.session!.canManage
          ? Fab(onPressed: () => app.go('meeting-form'), label: 'اجتماع جديد')
          : null,
      body: meetings.isEmpty
          ? const EmptyState('لا توجد اجتماعات')
          : ListView.builder(
              padding: const EdgeInsets.only(bottom: 90),
              itemCount: meetings.length,
              itemBuilder: (ctx, i) {
                final m = meetings[i];
                return ListCard(
                  leadingIcon: const Icon(Icons.groups_rounded, color: AppTheme.primary),
                  title: m['title']?.toString() ?? '',
                  subtitle: '${m['date'] ?? ''} • ${m['time'] ?? ''}',
                  trailing: m['location']?.toString() ?? '',
                );
              },
            ),
    );
  }
}
