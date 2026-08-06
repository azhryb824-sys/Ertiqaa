import 'package:flutter/material.dart';
import '../../core/constants.dart';
import '../../core/utils.dart';
import '../../state/app_state.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// المسودات المحفوظة (misadFormDrafts).
class DraftsScreen extends StatelessWidget {
  const DraftsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = AppState.instance;
    final drafts = app.storage.list(AppConstants.kFormDrafts);
    return Scaffold(
      backgroundColor: AppTheme.bg,
      body: drafts.isEmpty
          ? const EmptyState('لا توجد مسودات محفوظة.')
          : ListView.builder(
              padding: const EdgeInsets.only(bottom: 40),
              itemCount: drafts.length,
              itemBuilder: (ctx, i) {
                final d = drafts[i];
                final id = d is Map ? (d['id']?.toString() ?? '') : d.toString();
                return ListCard(
                  leadingIcon: const Icon(Icons.drafts_rounded, color: AppTheme.gold),
                  title: id,
                  subtitle: d is Map ? d['formType']?.toString() ?? '' : '',
                );
              },
            ),
    );
  }
}
