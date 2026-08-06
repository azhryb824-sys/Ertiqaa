import 'package:flutter/material.dart';
import '../../core/utils.dart';
import '../../models/contract.dart';
import '../../state/app_state.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// التحليلات: إيرادات، عقود، توزيع حسب النوع (owner/company_admin/admin).
class AnalyticsScreen extends StatelessWidget {
  const AnalyticsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = AppState.instance;
    final contracts = app.visibleContracts;
    final entries = app.allFinancialEntries.where(app.sameCompany).toList();

    var totalContracts = 0.0;
    for (final c in contracts) { totalContracts += c.value; }

    var totalIn = 0.0;
    var totalOut = 0.0;
    for (final e in entries) {
      final amt = (e['amount'] as num?)?.toDouble() ?? 0;
      if (e['direction']?.toString() == 'in') totalIn += amt; else totalOut += amt;
    }

    final byType = <String, int>{};
    for (final c in contracts) {
      byType[c.type] = (byType[c.type] ?? 0) + 1;
    }

    return Scaffold(
      backgroundColor: AppTheme.bg,
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text('التحليلات', style: TextStyle(fontFamily: 'Cairo', fontSize: 20, fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            children: [
              StatCard(label: 'قيمة العقود', value: AppUtils.money(totalContracts), icon: Icons.description_rounded),
              StatCard(label: 'وارد', value: AppUtils.money(totalIn), icon: Icons.south_west_rounded, color: AppTheme.success),
              StatCard(label: 'صادر', value: AppUtils.money(totalOut), icon: Icons.north_east_rounded, color: AppTheme.danger),
              StatCard(label: 'عدد العقود', value: '${contracts.length}', icon: Icons.numbers_rounded, color: AppTheme.gold),
            ],
          ),
          const SizedBox(height: 16),
          const Text('العقود حسب النوع', style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          for (final e in byType.entries)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                children: [
                  Expanded(child: Text(e.key, style: const TextStyle(fontFamily: 'Cairo'))),
                  Text('${e.value}', style: const TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w800)),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
