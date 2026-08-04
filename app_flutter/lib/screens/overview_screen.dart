import 'package:flutter/material.dart';
import '../core/constants.dart';
import '../core/utils.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/common.dart';

/// لوحة النظرة العامة: ملخص عددي + قائمة حديثة.
class OverviewScreen extends StatelessWidget {
  const OverviewScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = AppState.instance;
    final session = app.session!;
    final contracts = app.visibleContracts;
    final tickets = app.visibleTickets;
    final visits = app.visibleVisits;

    final active = contracts.where((c) => c.status == 'ساري').length;
    final openTickets = tickets.where((t) => t.status == 'مفتوح').length;
    final upcomingVisits = visits.where((v) =>
        (v['status']?.toString() == 'مجدولة' || v['status']?.toString() == 'بانتظار الإسناد')).length;

    // ملخص مالي للمديرين
    var revenue = 0.0;
    if (session.canManage) {
      for (final e in app.allFinancialEntries) {
        if (e['direction']?.toString() == 'in' && app.sameCompany(e)) {
          revenue += (e['amount'] as num?)?.toDouble() ?? 0;
        }
      }
    }

    return ListView(
      padding: const EdgeInsets.only(bottom: 24),
      children: [
        _Greeting(name: session.name, role: session.role),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            children: [
              StatCard(label: 'عقود سارية', value: '$active', icon: Icons.verified_rounded, color: AppTheme.success),
              StatCard(label: 'بلاغات مفتوحة', value: '$openTickets', icon: Icons.report_problem_rounded, color: AppTheme.danger),
              StatCard(label: 'زيارات قادمة', value: '$upcomingVisits', icon: Icons.event_available_rounded),
              if (session.canManage)
                StatCard(label: 'المحصل', value: AppUtils.money(revenue), icon: Icons.account_balance_wallet_rounded, color: AppTheme.gold)
              else
                StatCard(label: 'عقودي', value: '${contracts.length}', icon: Icons.description_rounded),
            ],
          ),
        ),
        const PageTitle('أحدث العقود'),
        if (contracts.isEmpty)
          const EmptyState('لا توجد عقود بعد')
        else
          for (final c in contracts.take(5))
            ListCard(
              title: '${c.id} — ${c.type}',
              subtitle: '${c.clientLabel}',
              trailing: c.value > 0 ? AppUtils.money(c.value) : null,
              trailingWidget: StatusBadge(c.status),
              onTap: () => app.goWithData('contract-detail', {'id': c.id}),
            ),
        const PageTitle('أحدث البلاغات'),
        if (tickets.isEmpty)
          const EmptyState('لا توجد بلاغات')
        else
          for (final t in tickets.take(5))
            ListCard(
              leadingIcon: const Icon(Icons.report_problem_rounded, color: AppTheme.danger),
              title: '${t.id} — ${t.title}',
              subtitle: t.clientLabel,
              trailingWidget: StatusBadge(t.status),
              onTap: () => app.goWithData('ticket-detail', {'id': t.id}),
            ),
      ],
    );
  }
}

class _Greeting extends StatelessWidget {
  final String name;
  final String role;
  const _Greeting({required this.name, required this.role});

  @override
  Widget build(BuildContext context) {
    final hour = DateTime.now().hour;
    final greeting = hour < 12 ? 'صباح الخير' : (hour < 18 ? 'مساء الخير' : 'مساء النور');
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 4),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [AppTheme.primaryDark, AppTheme.primary]),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('$greeting، $name',
              style: const TextStyle(color: Colors.white, fontSize: 19, fontWeight: FontWeight.w800, fontFamily: 'Cairo')),
          const SizedBox(height: 6),
          Text(AppConstants.roleLabels[role] ?? role,
              style: const TextStyle(color: AppTheme.goldLight, fontSize: 13, fontFamily: 'Cairo')),
        ],
      ),
    );
  }
}
