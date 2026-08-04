import 'package:flutter/material.dart';
import '../../core/constants.dart';
import '../../core/utils.dart';
import '../../state/app_state.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// الإنذارات والحظر (مشرف النظام).
class ModerationScreen extends StatelessWidget {
  const ModerationScreen({super.key});

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
    return Scaffold(
      backgroundColor: AppTheme.bg,
      body: ListView(
        children: [
          const PageTitle('حظر / تنبيه'),
          Card(
            margin: const EdgeInsets.all(16),
            child: ListTile(
              leading: const Icon(Icons.block_rounded, color: AppTheme.danger),
              title: const Text('الهويات المحظورة', style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w700)),
              subtitle: Text(AppConstants.blockedIds.join('، '), style: const TextStyle(fontFamily: 'Cairo')),
            ),
          ),
        ],
      ),
    );
  }
}
