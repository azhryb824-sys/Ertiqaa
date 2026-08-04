import 'package:flutter/material.dart';
import '../../state/app_state.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// مركز التشغيل: ملخص زيارات وبلاغات اليوم.
class OperationsScreen extends StatelessWidget {
  const OperationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = AppState.instance;
    final visits = app.visibleVisits;
    final tickets = app.visibleTickets;
    final todayStr = _today();
    final todayVisits = visits.where((v) {
      final sched = DateTime.fromMillisecondsSinceEpoch((v['scheduledAt'] as num?)?.toInt() ?? 0);
      return '${sched.year}-${sched.month.toString().padLeft(2, '0')}-${sched.day.toString().padLeft(2, '0')}' == todayStr;
    }).length;
    final open = tickets.where((t) => t.status == 'مفتوح').length;

    return Scaffold(
      backgroundColor: AppTheme.bg,
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [AppTheme.primaryDark, AppTheme.primary]),
              borderRadius: BorderRadius.circular(18),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('مركز التشغيل', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800, fontFamily: 'Cairo')),
                const SizedBox(height: 8),
                Text('زيارات اليوم: $todayVisits', style: const TextStyle(color: AppTheme.goldLight, fontFamily: 'Cairo')),
                Text('بلاغات مفتوحة: $open', style: const TextStyle(color: AppTheme.goldLight, fontFamily: 'Cairo')),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _today() {
    final d = DateTime.now();
    return '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  }
}
