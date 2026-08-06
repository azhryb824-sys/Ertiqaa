import 'package:flutter/material.dart';
import '../../core/utils.dart';
import '../../models/contract.dart';
import '../../state/app_state.dart';
import '../../state/business_rules.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// الملف المالي للعقد: ملخص + دفعات + سندات قبض + مصروفات + مشتريات + ربحية.
class ContractFinanceScreen extends StatefulWidget {
  const ContractFinanceScreen({super.key});

  @override
  State<ContractFinanceScreen> createState() => _ContractFinanceScreenState();
}

class _ContractFinanceScreenState extends State<ContractFinanceScreen> with SingleTickerProviderStateMixin {
  late final TabController _tabC = TabController(length: 6, vsync: this);

  @override
  void dispose() {
    _tabC.dispose();
    super.dispose();
  }

  Contract? _find(AppState app) {
    final id = app.currentPageData['id']?.toString() ?? '';
    for (final c in app.visibleContracts) {
      if (c.id == id) return c;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final app = AppState.instance;
    final c = _find(app);
    if (c == null) {
      return Scaffold(
        backgroundColor: AppTheme.bg,
        appBar: AppBar(title: const Text('الملف المالي للعقد')),
        body: const EmptyState('العقد غير موجود أو غير مرئي'),
      );
    }

    final fin = BusinessRules.contractFinance(c, app.allFinancialEntries);
    final entries = app.allFinancialEntries.where((e) => e['contractId']?.toString() == c.id).toList();
    final claims = app.allClaims.where((x) => x['contractId']?.toString() == c.id).toList();
    final expenses = app.allContractExpenses.where((x) => x['contractId']?.toString() == c.id).toList();
    final purchases = app.allPurchaseInvoices.where((x) => x['contractId']?.toString() == c.id).toList();

    final pur = purchases.fold<double>(0, (s, x) => s + ((x['total'] as num?)?.toDouble() ?? 0));
    final exp = expenses.fold<double>(0, (s, x) => s + ((x['amount'] as num?)?.toDouble() ?? 0));
    final net = (fin['paid'] as double) - pur - exp;

    return Scaffold(
      backgroundColor: AppTheme.bg,
      appBar: AppBar(title: Text('الملف المالي للعقد ${c.id}')),
      body: Column(
        children: [
          Material(
            color: Colors.white,
            child: TabBar(
              controller: _tabC,
              isScrollable: true,
              labelColor: AppTheme.primary,
              unselectedLabelColor: AppTheme.textMuted,
              indicatorColor: AppTheme.gold,
              labelStyle: const TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w800),
              tabs: const [
                Tab(text: 'ملخص'),
                Tab(text: 'الدفعات'),
                Tab(text: 'سندات القبض'),
                Tab(text: 'المصروفات'),
                Tab(text: 'المشتريات'),
                Tab(text: 'الربحية'),
              ],
            ),
          ),
          Expanded(
            child: TabBarView(
              controller: _tabC,
              children: [
                _buildSummary(c, fin, pur, exp, net),
                _buildPayments(app, c, entries),
                _buildClaims(app, claims),
                _buildExpenses(app, expenses),
                _buildPurchases(app, purchases),
                _buildProfit(c, fin, pur, exp, net),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSummary(Contract c, Map<String, dynamic> fin, double pur, double exp, double net) {
    return ListView(
      padding: const EdgeInsets.only(bottom: 24),
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            children: [
              StatCard(label: 'إجمالي العقد', value: AppUtils.money(fin['total']), icon: Icons.description_rounded, color: AppTheme.primary),
              StatCard(label: 'المحصل', value: AppUtils.money(fin['paid']), icon: Icons.south_west_rounded, color: AppTheme.success),
              StatCard(label: 'المتبقي', value: AppUtils.money(fin['remaining']), icon: Icons.account_balance_wallet_rounded, color: AppTheme.danger),
              StatCard(label: 'المتأخر', value: AppUtils.money(fin['overdue']), icon: Icons.timelapse_rounded, color: AppTheme.danger),
              StatCard(label: 'المشتريات', value: AppUtils.money(pur), icon: Icons.shopping_cart_rounded, color: AppTheme.gold),
              StatCard(label: 'المصروفات', value: AppUtils.money(exp), icon: Icons.receipt_long_rounded, color: AppTheme.gold),
              StatCard(
                label: 'صافي الربح (محصل - تكاليف)',
                value: AppUtils.money(net),
                icon: Icons.trending_up_rounded,
                color: net >= 0 ? AppTheme.success : AppTheme.danger,
              ),
            ],
          ),
        ),
        const PageTitle('الوصول السريع'),
        _quickTile('إدارة الدفعات', 'تسجيل الدفعات ومراحل التركيب', Icons.payments_rounded, () => _tabC.animateTo(1)),
        _quickTile('سندات القبض', 'السندات المرتبطة بالعقد', Icons.receipt_rounded, () => _tabC.animateTo(2)),
        _quickTile('مصروفات العقد', 'تسجيل مصروفات مباشرة للعقد', Icons.savings_rounded, () => _tabC.animateTo(3)),
        _quickTile('تقرير الربحية', 'الربح وصافي الهامش', Icons.trending_up_rounded, () => _tabC.animateTo(5)),
      ],
    );
  }

  Widget _quickTile(String label, String sub, IconData icon, VoidCallback onTap) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 5),
      child: ListTile(
        leading: Icon(icon, color: AppTheme.primary, size: 26),
        title: Text(label, style: const TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w700)),
        subtitle: Text(sub, style: const TextStyle(fontFamily: 'Cairo', fontSize: 12, color: AppTheme.textMuted)),
        trailing: const Icon(Icons.chevron_left_rounded, color: AppTheme.textMuted),
        onTap: onTap,
      ),
    );
  }

  Widget _buildPayments(AppState app, Contract c, List<Map<String, dynamic>> entries) {
    final plan = c.paymentPlan.isNotEmpty
        ? c.paymentPlan
        : BusinessRules.defaultPaymentPlan().map((m) => PaymentPlanItem(
              label: m['label']?.toString() ?? '',
              description: m['description']?.toString() ?? '',
              percent: (m['percent'] as num?)?.toDouble() ?? 0,
            )).toList();
    final history = entries.where((e) => e['direction']?.toString() == 'in').toList()
      ..sort((a, b) => ((b['createdAtMs'] as num?)?.toInt() ?? 0).compareTo((a['createdAtMs'] as num?)?.toInt() ?? 0));
    final total = c.value;

    return ListView(
      padding: const EdgeInsets.only(bottom: 24),
      children: [
        const PageTitle('خطة الدفعات ومراحلها'),
        if (plan.isEmpty)
          const EmptyState('لا توجد خطة دفعات')
        else
          for (final p in plan)
            Builder(builder: (context) {
              final expected = total * (p.percent / 100);
              var received = 0.0;
              for (final e in entries) {
                if (e['direction']?.toString() == 'in' && e['paymentLabel']?.toString() == p.label) {
                  received += (e['amount'] as num?)?.toDouble() ?? 0;
                }
              }
              final remaining = (expected - received) < 0 ? 0.0 : (expected - received);
              return ListCard(
                title: p.label,
                subtitle: p.description,
                trailing: 'متبقي ${AppUtils.money(remaining)}',
                trailingWidget: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('${p.percent}%',
                        style: const TextStyle(fontFamily: 'Cairo', fontSize: 12, fontWeight: FontWeight.w800, color: AppTheme.primary)),
                    Text('${AppUtils.money(received)} / ${AppUtils.money(expected)}',
                        style: const TextStyle(fontFamily: 'Cairo', fontSize: 11, color: AppTheme.textMuted)),
                  ],
                ),
              );
            }),
        const PageTitle('سجل الدفعات'),
        if (history.isEmpty)
          const EmptyState('لا توجد دفعات مسجلة')
        else
          for (final e in history)
            ListCard(
              leadingIcon: const Icon(Icons.call_received_rounded, color: AppTheme.success),
              title: e['description']?.toString() ?? e['paymentLabel']?.toString() ?? '—',
              subtitle: '${e['date'] ?? '—'} • ${e['paymentMethod'] ?? '—'}',
              trailing: AppUtils.money(e['amount']),
            ),
      ],
    );
  }

  Widget _buildClaims(AppState app, List<Map<String, dynamic>> claims) {
    final list = List.of(claims)
      ..sort((a, b) => ((b['createdAtMs'] as num?)?.toInt() ?? 0).compareTo((a['createdAtMs'] as num?)?.toInt() ?? 0));
    return ListView(
      padding: const EdgeInsets.only(bottom: 24),
      children: [
        const PageTitle('سندات القبض والمستخلصات'),
        if (list.isEmpty)
          const EmptyState('لا توجد سندات قبض', 'ستنشأ سندات القبض تلقائياً عند تسجيل الدفعات.')
        else
          for (final cl in list)
            ListCard(
              title: cl['id']?.toString() ?? '—',
              subtitle: cl['period']?.toString() ?? 'سند قبض',
              trailing: AppUtils.money(cl['value']),
              trailingWidget: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(AppUtils.money(cl['value']),
                      style: const TextStyle(fontFamily: 'Cairo', fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.primary)),
                  Text(cl['status']?.toString() ?? 'معتمد',
                      style: const TextStyle(fontFamily: 'Cairo', fontSize: 11, color: AppTheme.textMuted)),
                ],
              ),
            ),
      ],
    );
  }

  Widget _buildExpenses(AppState app, List<Map<String, dynamic>> expenses) {
    final list = List.of(expenses)
      ..sort((a, b) => ((b['createdAtMs'] as num?)?.toInt() ?? 0).compareTo((a['createdAtMs'] as num?)?.toInt() ?? 0));
    final staff = app.allStaff;
    return ListView(
      padding: const EdgeInsets.only(bottom: 24),
      children: [
        const PageTitle('مصروفات العقد'),
        if (list.isEmpty)
          const EmptyState('لا توجد مصروفات', 'سجل مصروفات العقد مثل قطع الغيار والعمالة.')
        else
          for (final x in list)
            ListCard(
              title: x['description']?.toString() ?? '—',
              subtitle: '${x['category'] ?? '—'} • ${x['date'] ?? '—'} • ${_staffName(staff, x['staffId']?.toString() ?? '')}',
              trailing: AppUtils.money(x['amount']),
            ),
      ],
    );
  }

  Widget _buildPurchases(AppState app, List<Map<String, dynamic>> purchases) {
    final list = List.of(purchases)
      ..sort((a, b) => ((b['createdAtMs'] as num?)?.toInt() ?? 0).compareTo((a['createdAtMs'] as num?)?.toInt() ?? 0));
    return ListView(
      padding: const EdgeInsets.only(bottom: 24),
      children: [
        const PageTitle('فواتير المشتريات المرتبطة بالعقد'),
        if (list.isEmpty)
          const EmptyState('لا توجد فواتير شراء', 'سجل فواتير مشتريات العقد لمتابعة التكاليف.')
        else
          for (final pi in list)
            Builder(builder: (context) {
              final total = (pi['total'] as num?)?.toDouble() ?? 0;
              final paid = (pi['paid'] as num?)?.toDouble() ?? 0;
              final rem = (total - paid) < 0 ? 0.0 : total - paid;
              return ListCard(
                title: pi['invoiceNo']?.toString() ?? pi['id']?.toString() ?? '—',
                subtitle: '${_supplierName(app, pi['supplierId']?.toString() ?? '')} • ${pi['date'] ?? '—'} • ${pi['status'] ?? 'مستحقة'}',
                trailing: AppUtils.money(total),
                trailingWidget: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('مدفوع ${AppUtils.money(paid)}',
                        style: const TextStyle(fontFamily: 'Cairo', fontSize: 11, color: AppTheme.success)),
                    Text('متبقي ${AppUtils.money(rem)}',
                        style: TextStyle(
                            fontFamily: 'Cairo',
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: rem > 0 ? AppTheme.danger : AppTheme.success)),
                  ],
                ),
              );
            }),
      ],
    );
  }

  Widget _buildProfit(Contract c, Map<String, dynamic> fin, double pur, double exp, double net) {
    final margin = (fin['total'] as double) > 0 ? (net / (fin['total'] as double) * 100) : 0.0;
    final rows = <(String, String)>[
      ('إجمالي قيمة العقد', AppUtils.money(fin['total'])),
      ('إجمالي المحصل', AppUtils.money(fin['paid'])),
      ('المتبقي على العميل', AppUtils.money(fin['remaining'])),
      ('تكلفة المشتريات (فواتير)', AppUtils.money(pur)),
      ('مصروفات العقد', AppUtils.money(exp)),
      ('إجمالي التكاليف', AppUtils.money(pur + exp)),
      ('صافي الربح (المحصل - التكاليف)', AppUtils.money(net)),
      ('هامش الربح', '${margin.toStringAsFixed(1)}%'),
    ];
    return ListView(
      padding: const EdgeInsets.only(bottom: 24),
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            children: [
              StatCard(label: 'صافي الربح', value: AppUtils.money(net), icon: Icons.trending_up_rounded, color: net >= 0 ? AppTheme.success : AppTheme.danger),
              StatCard(label: 'هامش الربح', value: '${margin.toStringAsFixed(1)}%', icon: Icons.percent_rounded, color: AppTheme.gold),
            ],
          ),
        ),
        const PageTitle('تقرير ربحية العقد'),
        for (final (k, v) in rows)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(flex: 2, child: Text(k, style: const TextStyle(fontFamily: 'Cairo', color: AppTheme.textMuted))),
                Expanded(
                  flex: 3,
                  child: Text(v, textAlign: TextAlign.end, style: const TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w700)),
                ),
              ],
            ),
          ),
      ],
    );
  }

  String _staffName(List<Map<String, dynamic>> staff, String id) {
    if (id.isEmpty) return '—';
    for (final s in staff) {
      final sid = s['identity']?.toString() ?? s['id']?.toString() ?? '';
      if (sid == id) return s['name']?.toString() ?? id;
    }
    return id;
  }

  String _supplierName(AppState app, String id) {
    if (id.isEmpty) return '—';
    for (final s in app.allSuppliers) {
      if ((s['id']?.toString() ?? '') == id) return s['name']?.toString() ?? id;
    }
    return id;
  }
}
