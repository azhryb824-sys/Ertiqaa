import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../core/constants.dart';
import '../../core/utils.dart';
import '../../pdf/pdf_generator.dart';
import '../../state/app_state.dart';
import '../../state/business_rules.dart';
import '../../theme.dart';
import '../../widgets/common.dart';
import 'staff_finance_screen.dart';
import 'receipts_screen.dart';
import 'claims_screen.dart';

/// لوحة الإدارة المالية المتطورة: نظرة عامة + قيود قابلة للفلترة
/// + مالية الموظفين + سندات القبض + المستخلصات (صفحة موحّدة بتبويبات).
class FinanceScreen extends StatefulWidget {
  final int initialTab;
  const FinanceScreen({super.key, this.initialTab = 0});

  @override
  State<FinanceScreen> createState() => _FinanceScreenState();
}

class _FinanceScreenState extends State<FinanceScreen> with SingleTickerProviderStateMixin {
  late final TabController _tabC = TabController(length: 5, initialIndex: widget.initialTab, vsync: this)
    ..addListener(() {
      if (_tabC.index != _tab) setState(() => _tab = _tabC.index);
    });

  final _descCtrl = TextEditingController();
  final _amountCtrl = TextEditingController();
  String _type = 'expense';
  String _direction = 'out';
  bool _showForm = false;
  int _tab = 0;

  String _filterDirection = 'all';
  String _filterType = 'all';
  String _search = '';
  String _chartPeriod = '6m';

  static const List<String> _typeOrder = [
    'sale', 'purchase', 'expense', 'salary', 'advance', 'deduction', 'allowance', 'custody',
  ];

  static const List<String> _monthNames = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
  ];

  @override
  void dispose() {
    _tabC.dispose();
    _descCtrl.dispose();
    _amountCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final app = AppState.instance;
    final session = app.session!;
    if (!session.isOwner) {
      return const Scaffold(
        backgroundColor: AppTheme.bg,
        body: EmptyState('الإدارة المالية متاحة للمالك فقط.', icon: Icons.lock_outline),
      );
    }

    final entries = app.allFinancialEntries.where(app.sameCompany).toList()
      ..sort((a, b) => ((b['createdAtMs'] as num?)?.toInt() ?? 0).compareTo((a['createdAtMs'] as num?)?.toInt() ?? 0));

    return Scaffold(
      backgroundColor: AppTheme.bg,
      floatingActionButton: _tab == 1
          ? Fab(onPressed: () => setState(() => _showForm = !_showForm), label: 'قيد جديد')
          : null,
      body: Column(
        children: [
          Material(
            color: Colors.white,
            child: TabBar(
              controller: _tabC,
              labelColor: AppTheme.primary,
              unselectedLabelColor: AppTheme.textMuted,
              indicatorColor: AppTheme.gold,
              labelStyle: const TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w800),
              tabs: const [
                Tab(text: 'نظرة عامة'),
                Tab(text: 'القيود المالية'),
                Tab(text: 'مالية الموظفين'),
                Tab(text: 'سندات القبض'),
                Tab(text: 'المستخلصات'),
              ],
            ),
          ),
          Expanded(
            child: TabBarView(
              controller: _tabC,
              children: [
                _buildOverview(app, entries),
                _buildEntries(app, entries),
                const StaffFinanceScreen(),
                const ReceiptsScreen(),
                const ClaimsScreen(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ===== تبويب نظرة عامة =====
  Widget _buildOverview(AppState app, List<Map<String, dynamic>> entries) {
    var totalIn = 0.0, totalOut = 0.0;
    for (final e in entries) {
      final amt = (e['amount'] as num?)?.toDouble() ?? 0;
      if (e['direction']?.toString() == 'in') totalIn += amt;
      else totalOut += amt;
    }
    final receiptsCount = app.allReceipts.where(app.sameCompany).length;
    final claimsCount = app.allClaims.where(app.sameCompany).length;
    final custodies = app.allCustodies.where(app.sameCompany).toList();
    final payrolls = app.allPayrolls.where(app.sameCompany).toList();
    final activeCustody = custodies.where((c) => c['status']?.toString() != 'مسددة').length;

    return ListView(
      padding: const EdgeInsets.only(bottom: 24),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          child: FilledButton.icon(
            onPressed: () => _showReportDialog(app, entries),
            icon: const Icon(Icons.picture_as_pdf_rounded),
            label: const Text('تصدير تقرير مالي PDF', style: TextStyle(fontFamily: 'Cairo')),
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(16),
          child: GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            children: [
              StatCard(label: 'إجمالي الوارد', value: AppUtils.money(totalIn), icon: Icons.south_west_rounded, color: AppTheme.success),
              StatCard(label: 'إجمالي الصادر', value: AppUtils.money(totalOut), icon: Icons.north_east_rounded, color: AppTheme.danger),
              StatCard(label: 'الصافي', value: AppUtils.money(totalIn - totalOut), icon: Icons.balance_rounded, color: AppTheme.gold),
              StatCard(label: 'عدد القيود', value: '${entries.length}', icon: Icons.receipt_long_rounded),
            ],
          ),
        ),

        // وصول سريع
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(
            children: [
              Expanded(
                child: _QuickTile(icon: Icons.receipt_rounded, label: 'سندات القبض', count: '$receiptsCount', onTap: () => app.go('receipts')),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _QuickTile(icon: Icons.receipt_long_rounded, label: 'المستخلصات', count: '$claimsCount', onTap: () => app.go('claims')),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(
            children: [
              Expanded(
                child: _QuickTile(icon: Icons.handshake_rounded, label: 'العهد', count: '$activeCustody نشطة', onTap: () => app.go('staff-finance')),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _QuickTile(icon: Icons.payments_rounded, label: 'مسيرات الرواتب', count: '${payrolls.length}', onTap: () => app.go('staff-finance')),
              ),
            ],
          ),
        ),

        _buildAlerts(app),

        const Padding(
          padding: EdgeInsets.fromLTRB(16, 20, 16, 6),
          child: Text('التدفق النقدي الشهري',
              style: TextStyle(fontFamily: 'Cairo', fontSize: 15, fontWeight: FontWeight.w800)),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Row(
            children: [
              for (final (key, lbl) in const [('6m', '6 أشهر'), ('year', 'السنة'), ('all', 'الكل')])
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: ChoiceChip(
                    label: Text(lbl, style: const TextStyle(fontFamily: 'Cairo', fontSize: 12)),
                    selected: _chartPeriod == key,
                    showCheckmark: false,
                    onSelected: (_) => setState(() => _chartPeriod = key),
                  ),
                ),
            ],
          ),
        ),
        _CashChart(entries: entries, period: _chartPeriod),

        const Padding(
          padding: EdgeInsets.fromLTRB(16, 20, 16, 6),
          child: Text('التوزيع حسب الفئة',
              style: TextStyle(fontFamily: 'Cairo', fontSize: 15, fontWeight: FontWeight.w800)),
        ),
        _buildTypeBreakdown(entries),

        const Padding(
          padding: EdgeInsets.fromLTRB(16, 20, 16, 6),
          child: Text('متابعة تحصيلات العقود',
              style: TextStyle(fontFamily: 'Cairo', fontSize: 15, fontWeight: FontWeight.w800)),
        ),
        _buildCollections(app),

        const Padding(
          padding: EdgeInsets.fromLTRB(16, 20, 16, 6),
          child: Text('آخر القيود',
              style: TextStyle(fontFamily: 'Cairo', fontSize: 15, fontWeight: FontWeight.w800)),
        ),
        if (entries.isEmpty)
          const EmptyState('لا توجد قيود مالية')
        else
          for (final e in entries.take(6))
            ListCard(
              leadingIcon: Icon(
                e['direction']?.toString() == 'in' ? Icons.call_received_rounded : Icons.call_made_rounded,
                color: e['direction']?.toString() == 'in' ? AppTheme.success : AppTheme.danger,
              ),
              title: '${e['id']} — ${BusinessRules.entryTypeLabel(e['type']?.toString() ?? '')}',
              subtitle: '${e['description']} • ${AppUtils.fmtDateTime(e['createdAtMs'])}',
              trailing: AppUtils.money(e['amount']),
            ),
      ],
    );
  }

  Widget _buildTypeBreakdown(List<Map<String, dynamic>> entries) {
    final totals = <String, ({double inn, double out})>{};
    for (final t in _typeOrder) {
      totals[t] = (inn: 0, out: 0);
    }
    for (final e in entries) {
      final t = e['type']?.toString() ?? '';
      final amt = (e['amount'] as num?)?.toDouble() ?? 0;
      final cur = totals[t] ?? (inn: 0, out: 0);
      if (e['direction']?.toString() == 'in') {
        totals[t] = (inn: cur.inn + amt, out: cur.out);
      } else {
        totals[t] = (inn: cur.inn, out: cur.out + amt);
      }
    }
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        child: Column(
          children: [
            for (final t in _typeOrder)
              if (totals[t]!.inn > 0 || totals[t]!.out > 0)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 5),
                  child: Row(
                    children: [
                      SizedBox(
                        width: 76,
                        child: Text(BusinessRules.entryTypeLabel(t),
                            style: const TextStyle(fontFamily: 'Cairo', fontSize: 12.5, fontWeight: FontWeight.w700)),
                      ),
                      Expanded(
                        child: Text('وارد ${AppUtils.money(totals[t]!.inn)}',
                            textAlign: TextAlign.end,
                            style: const TextStyle(fontFamily: 'Cairo', fontSize: 12, color: AppTheme.success)),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text('صادر ${AppUtils.money(totals[t]!.out)}',
                            textAlign: TextAlign.end,
                            style: const TextStyle(fontFamily: 'Cairo', fontSize: 12, color: AppTheme.danger)),
                      ),
                    ],
                  ),
                ),
          ],
        ),
      ),
    );
  }

  // ===== التنبيهات ومتابعة التحصيلات =====
  Widget _buildAlerts(AppState app) {
    final claims = app.allClaims.where(app.sameCompany).toList();
    final pending = claims.where((c) => c['status']?.toString() == 'قيد المراجعة').toList();
    final pendingTotal = pending.fold<double>(0, (s, c) => s + ((c['value'] as num?)?.toDouble() ?? 0));

    final custodies = app.allCustodies.where(app.sameCompany).toList();
    final activeCust = custodies.where((c) => c['status']?.toString() != 'مسددة').toList();
    final custTotal = activeCust.fold<double>(0, (s, c) => s + ((c['remaining'] as num?)?.toDouble() ?? 0));

    final contracts = app.allContracts
        .where((c) => app.sameCompany(c.toJson()) && c.status == AppConstants.statusActive)
        .toList();
    final receipts = app.allReceipts.where(app.sameCompany).toList();
    var unpaidContracts = 0;
    var unpaidTotal = 0.0;
    for (final c in contracts) {
      final collected = receipts
          .where((r) => r['contractId']?.toString() == c.id)
          .fold<double>(0, (s, r) => s + ((r['amount'] as num?)?.toDouble() ?? 0));
      final remaining = c.value - collected;
      if (remaining > 0) {
        unpaidContracts++;
        unpaidTotal += remaining;
      }
    }

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      color: const Color(0xFFFDF6EC),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.notifications_active_rounded, color: AppTheme.gold, size: 20),
                SizedBox(width: 8),
                Text('تنبيهات ومتابعات',
                    style: TextStyle(fontFamily: 'Cairo', fontSize: 14, fontWeight: FontWeight.w800)),
              ],
            ),
            const SizedBox(height: 6),
            _alertRow(Icons.pending_actions_rounded, AppTheme.gold, 'مستخلصات بانتظار المراجعة',
                '${pending.length} بقيمة ${AppUtils.money(pendingTotal)}'),
            _alertRow(Icons.handshake_rounded, AppTheme.gold, 'عهد نشطة غير مسددة',
                '${activeCust.length} بمتبقي ${AppUtils.money(custTotal)}'),
            _alertRow(Icons.account_balance_wallet_rounded, AppTheme.primary, 'عقود برصيد غير محصّل',
                '$unpaidContracts بمبلغ ${AppUtils.money(unpaidTotal)}'),
          ],
        ),
      ),
    );
  }

  Widget _alertRow(IconData icon, Color color, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(icon, color: color, size: 18),
          const SizedBox(width: 8),
          Expanded(child: Text(label, style: const TextStyle(fontFamily: 'Cairo', fontSize: 12.5))),
          Text(value,
              style: const TextStyle(fontFamily: 'Cairo', fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.textDark)),
        ],
      ),
    );
  }

  Widget _buildCollections(AppState app) {
    final contracts = app.allContracts
        .where((c) => app.sameCompany(c.toJson()) && c.status == AppConstants.statusActive)
        .toList();
    final receipts = app.allReceipts.where(app.sameCompany).toList();
    final rows = <Map<String, dynamic>>[];
    for (final c in contracts) {
      final collected = receipts
          .where((r) => r['contractId']?.toString() == c.id)
          .fold<double>(0, (s, r) => s + ((r['amount'] as num?)?.toDouble() ?? 0));
      rows.add({'id': c.id, 'client': c.clientLabel, 'value': c.value, 'collected': collected, 'remaining': c.value - collected});
    }
    rows.sort((a, b) => ((b['remaining'] as num).toDouble()).compareTo((a['remaining'] as num).toDouble()));

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('متابعة تحصيلات العقود',
                style: TextStyle(fontFamily: 'Cairo', fontSize: 14, fontWeight: FontWeight.w800)),
            const SizedBox(height: 4),
            if (rows.isEmpty)
              const Padding(
                padding: EdgeInsets.all(8),
                child: Text('لا توجد عقود سارية',
                    style: TextStyle(fontFamily: 'Cairo', color: AppTheme.textMuted, fontSize: 12)),
              )
            else
              for (final r in rows.take(6))
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text('${r['id']} — ${r['client']}',
                                style: const TextStyle(fontFamily: 'Cairo', fontSize: 12.5, fontWeight: FontWeight.w700)),
                          ),
                          Text('${AppUtils.money(r['collected'])} / ${AppUtils.money(r['value'])}',
                              style: const TextStyle(fontFamily: 'Cairo', fontSize: 11, color: AppTheme.textMuted)),
                        ],
                      ),
                      const SizedBox(height: 4),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: LinearProgressIndicator(
                          value: ((r['value'] as num).toDouble() > 0
                                  ? (r['collected'] as num).toDouble() / (r['value'] as num).toDouble()
                                  : 0.0)
                              .clamp(0.0, 1.0),
                          minHeight: 6,
                          backgroundColor: const Color(0xFFe8eeec),
                          valueColor: AlwaysStoppedAnimation<Color>(
                              (r['remaining'] as num).toDouble() > 0 ? AppTheme.gold : AppTheme.success),
                        ),
                      ),
                    ],
                  ),
                ),
          ],
        ),
      ),
    );
  }

  // ===== تبويب القيود =====
  Widget _buildEntries(AppState app, List<Map<String, dynamic>> entries) {
    final filtered = entries.where((e) {
      if (_filterDirection != 'all' && e['direction']?.toString() != _filterDirection) return false;
      if (_filterType != 'all' && e['type']?.toString() != _filterType) return false;
      if (_search.isNotEmpty) {
        final q = _search.toLowerCase();
        final hay = '${e['id']} ${e['description']} ${e['type']}'.toLowerCase();
        if (!hay.contains(q)) return false;
      }
      return true;
    }).toList();

    var fIn = 0.0, fOut = 0.0;
    for (final e in filtered) {
      final amt = (e['amount'] as num?)?.toDouble() ?? 0;
      if (e['direction']?.toString() == 'in') fIn += amt;
      else fOut += amt;
    }

    return ListView(
      padding: const EdgeInsets.only(bottom: 90),
      children: [
        if (_showForm) _entryForm(),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
          child: TextField(
            onChanged: (v) => setState(() => _search = v),
            decoration: const InputDecoration(
              hintText: 'بحث برقم القيد أو الوصف...',
              prefixIcon: Icon(Icons.search_rounded),
              isDense: true,
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              _chip('الكل', _filterDirection == 'all' && _filterType == 'all', () => setState(() {
                _filterDirection = 'all';
                _filterType = 'all';
              })),
              _chip('وارد', _filterDirection == 'in', () => setState(() {
                _filterDirection = 'in';
                _filterType = 'all';
              })),
              _chip('صادر', _filterDirection == 'out', () => setState(() {
                _filterDirection = 'out';
                _filterType = 'all';
              })),
              for (final t in _typeOrder)
                _chip(BusinessRules.entryTypeLabel(t), _filterType == t, () => setState(() {
                  _filterType = t;
                  _filterDirection = 'all';
                })),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 4),
          child: Text('${filtered.length} قيد • وارد ${AppUtils.money(fIn)} • صادر ${AppUtils.money(fOut)}',
              style: const TextStyle(fontFamily: 'Cairo', fontSize: 12.5, color: AppTheme.textMuted)),
        ),
        if (filtered.isEmpty)
          const EmptyState('لا توجد قيود مطابقة')
        else
          for (final e in filtered)
            ListCard(
              leadingIcon: Icon(
                e['direction']?.toString() == 'in' ? Icons.call_received_rounded : Icons.call_made_rounded,
                color: e['direction']?.toString() == 'in' ? AppTheme.success : AppTheme.danger,
              ),
              title: '${e['id']} — ${BusinessRules.entryTypeLabel(e['type']?.toString() ?? '')}',
              subtitle: '${e['description']} • ${AppUtils.fmtDateTime(e['createdAtMs'])}',
              trailing: AppUtils.money(e['amount']),
              trailingWidget: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(AppUtils.money(e['amount']),
                      style: const TextStyle(fontFamily: 'Cairo', fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.primary)),
                  IconButton(
                    padding: const EdgeInsets.all(2),
                    constraints: const BoxConstraints(),
                    icon: const Icon(Icons.delete_outline_rounded, size: 18, color: AppTheme.textMuted),
                    onPressed: () => _deleteEntry(app, e['id']?.toString() ?? ''),
                  ),
                ],
              ),
            ),
      ],
    );
  }

  Widget _entryForm() {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SectionHeader(1, 'قيد مالي جديد'),
            AppDropdown<String>(
              label: 'النوع',
              value: _type,
              items: _typeOrder,
              labelOf: (v) => BusinessRules.entryTypeLabel(v),
              onChanged: (v) {
                setState(() {
                  _type = v!;
                  _direction = v == 'sale' ? 'in' : 'out';
                });
              },
            ),
            AppDropdown<String>(
              label: 'الاتجاه',
              value: _direction,
              items: const ['in', 'out'],
              labelOf: (v) => v == 'in' ? 'وارد (داخل)' : 'صادر (خارج)',
              onChanged: (v) => setState(() => _direction = v!),
            ),
            AppField(label: 'المبلغ (ر.س)', keyboard: TextInputType.number, controller: _amountCtrl),
            AppField(label: 'الوصف', controller: _descCtrl),
            const SizedBox(height: 10),
            ElevatedButton(onPressed: _addEntry, child: const Text('إضافة القيد')),
          ],
        ),
      ),
    );
  }

  Widget _chip(String label, bool selected, VoidCallback onTap) {
    return FilterChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) => onTap(),
      labelStyle: const TextStyle(fontFamily: 'Cairo', fontSize: 12),
      showCheckmark: false,
    );
  }

  Future<void> _deleteEntry(AppState app, String id) async {
    if (id.isEmpty) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('حذف القيد', style: TextStyle(fontFamily: 'Cairo')),
        content: const Text('هل تريد حذف هذا القيد المالي؟', style: TextStyle(fontFamily: 'Cairo')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('تراجع', style: TextStyle(fontFamily: 'Cairo'))),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('حذف', style: TextStyle(fontFamily: 'Cairo', color: AppTheme.danger))),
        ],
      ),
    );
    if (confirmed != true) return;
    await app.remove('misadFinancialEntries', id);
    await app.logActivity('حذف قيد مالي', entityType: 'financial', entityId: id);
    if (mounted) setState(() {});
  }

  Future<void> _addEntry() async {
    final app = AppState.instance;
    final now = DateTime.now();
    final amount = double.tryParse(_amountCtrl.text) ?? 0;
    if (amount <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('أدخل مبلغاً صحيحاً.', style: TextStyle(fontFamily: 'Cairo'))));
      return;
    }
    final entry = {
      'id': 'FIN-${now.millisecondsSinceEpoch}',
      'companyOwnerId': app.ownerId,
      'type': _type,
      'direction': _direction,
      'amount': amount,
      'date': AppUtils.dateVal(now),
      'description': _descCtrl.text,
      'status': 'معتمد',
      'createdBy': app.session!.id,
      'createdAt': now.toIso8601String(),
      'createdAtMs': now.millisecondsSinceEpoch,
    };
    await app.append('misadFinancialEntries', entry);

    // إنشاء مستخلص تلقائي لقيد البيع (مطابق ensureReceiptClaims)
    if (_type == 'sale') {
      final claims = List<Map<String, dynamic>>.from(app.allClaims);
      final claim = BusinessRules.ensureClaimForEntry(entry, claims);
      if (claim != null) {
        claims.add(claim);
        await app.storage.write(AppConstants.kClaims, claims);
      }
    }
    await app.logActivity('قيد مالي جديد', entityType: 'financial', entityId: entry['id'] as String);
    if (!mounted) return;
    setState(() { _showForm = false; _amountCtrl.clear(); _descCtrl.clear(); });
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم إضافة القيد.', style: TextStyle(fontFamily: 'Cairo'))));
  }

  // ===== التقرير المالي PDF =====
  Future<void> _showReportDialog(AppState app, List<Map<String, dynamic>> entries) async {
    final now = DateTime.now();
    final months = <String>[];
    for (var i = 5; i >= 0; i--) {
      final d = DateTime(now.year, now.month - i);
      months.add('${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}');
    }
    final options = <(String, String)>[
      ('all', 'كل الفترة'),
      ('year', 'السنة الحالية (${now.year})'),
      for (final m in months) (m, _monthLabel(m)),
    ];
    String? selected = options.first.$1;

    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('تقرير مالي PDF', style: TextStyle(fontFamily: 'Cairo')),
        content: SizedBox(
          width: MediaQuery.of(ctx).size.width * 0.9,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              AppDropdown<String>(
                label: 'الفترة',
                value: selected,
                items: [for (final o in options) o.$1],
                labelOf: (k) => options.firstWhere((o) => o.$1 == k).$2,
                onChanged: (v) => selected = v,
              ),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('إلغاء', style: TextStyle(fontFamily: 'Cairo'))),
          FilledButton(
            onPressed: () async {
              Navigator.pop(ctx);
              await _exportReport(app, entries, selected!);
            },
            child: const Text('تصدير', style: TextStyle(fontFamily: 'Cairo')),
          ),
        ],
      ),
    );
  }

  Future<void> _exportReport(AppState app, List<Map<String, dynamic>> allEntries, String periodKey) async {
    final now = DateTime.now();
    List<Map<String, dynamic>> entries;
    String label;
    if (periodKey == 'all') {
      entries = allEntries;
      label = 'كل الفترة';
    } else if (periodKey == 'year') {
      final y = '${now.year}';
      entries = allEntries.where((e) => (e['date']?.toString() ?? '').startsWith(y)).toList();
      label = 'السنة الحالية (${now.year})';
    } else {
      entries = allEntries.where((e) => (e['date']?.toString() ?? '').startsWith(periodKey)).toList();
      label = _monthLabel(periodKey);
    }
    entries = List.of(entries)
      ..sort((a, b) => ((a['createdAtMs'] as num?)?.toInt() ?? 0).compareTo((b['createdAtMs'] as num?)?.toInt() ?? 0));

    var totalIn = 0.0, totalOut = 0.0;
    final byType = <String, ({double inn, double out})>{};
    for (final t in _typeOrder) {
      byType[t] = (inn: 0, out: 0);
    }
    for (final e in entries) {
      final amt = (e['amount'] as num?)?.toDouble() ?? 0;
      final t = e['type']?.toString() ?? '';
      final cur = byType[t] ?? (inn: 0, out: 0);
      if (e['direction']?.toString() == 'in') {
        byType[t] = (inn: cur.inn + amt, out: cur.out);
        totalIn += amt;
      } else {
        byType[t] = (inn: cur.inn, out: cur.out + amt);
        totalOut += amt;
      }
    }

    final report = {
      'periodLabel': label,
      'generatedAt': now.millisecondsSinceEpoch,
      'totalIn': totalIn,
      'totalOut': totalOut,
      'net': totalIn - totalOut,
      'breakdown': [
        for (final t in _typeOrder)
          if (byType[t]!.inn > 0 || byType[t]!.out > 0)
            {'label': BusinessRules.entryTypeLabel(t), 'inn': byType[t]!.inn, 'out': byType[t]!.out},
      ],
      'entries': entries,
    };

    try {
      await PdfGenerator.sharePdf('تقرير مالي',
          PdfGenerator.financialReportContent(report, app.myOwnerCompany),
          ownerCompany: app.myOwnerCompany);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تعذر إنشاء PDF.', style: TextStyle(fontFamily: 'Cairo'))));
      }
    }
  }

  static String _monthLabel(String ym) {
    final parts = ym.split('-');
    if (parts.length != 2) return ym;
    final y = parts[0];
    final m = int.tryParse(parts[1]);
    if (m == null || m < 1 || m > 12) return ym;
    return '${_monthNames[m - 1]} $y';
  }
}

/// بطاقة وصول سريع.
class _QuickTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String count;
  final VoidCallback onTap;
  const _QuickTile({required this.icon, required this.label, required this.count, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Icon(icon, color: AppTheme.primary, size: 26),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label, style: const TextStyle(fontFamily: 'Cairo', fontSize: 13, fontWeight: FontWeight.w700)),
                    Text(count, style: const TextStyle(fontFamily: 'Cairo', fontSize: 11, color: AppTheme.textMuted)),
                  ],
                ),
              ),
              const Icon(Icons.chevron_left_rounded, color: AppTheme.textMuted),
            ],
          ),
        ),
      ),
    );
  }
}

/// رسم بياني للتدفق النقدي الشهري (بدون مكتبات خارجية).
class _CashChart extends StatelessWidget {
  final List<Map<String, dynamic>> entries;
  final String period; // '6m' | 'year' | 'all'
  const _CashChart({required this.entries, this.period = '6m'});

  List<String> _months() {
    final now = DateTime.now();
    if (period == 'year') {
      return [
        for (var m = 1; m <= 12; m++) '${now.year}-${m.toString().padLeft(2, '0')}',
      ];
    }
    if (period == 'all') {
      final set = <String>{};
      for (final e in entries) {
        final d = e['date']?.toString() ?? '';
        if (d.length >= 7) set.add(d.substring(0, 7));
      }
      final list = set.toList()..sort();
      if (list.length > 24) list.removeRange(0, list.length - 24);
      return list;
    }
    final list = <String>[];
    for (var i = 5; i >= 0; i--) {
      final d = DateTime(now.year, now.month - i);
      list.add('${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}');
    }
    return list;
  }

  @override
  Widget build(BuildContext context) {
    final months = _months();
    final data = <({String m, double inn, double out})>[];
    var maxV = 0.0;
    for (final m in months) {
      var inn = 0.0, out = 0.0;
      for (final e in entries) {
        final d = e['date']?.toString() ?? '';
        if (!d.startsWith(m)) continue;
        final amt = (e['amount'] as num?)?.toDouble() ?? 0;
        if (e['direction']?.toString() == 'in') inn += amt;
        else out += amt;
      }
      maxV = math.max(maxV, math.max(inn, out));
      data.add((m: m, inn: inn, out: out));
    }

    final step = data.isEmpty ? 1 : (data.length / 6).ceil().clamp(1, data.length).toInt();

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const _Legend(color: AppTheme.success, label: 'وارد'),
                const SizedBox(width: 14),
                const _Legend(color: AppTheme.danger, label: 'صادر'),
              ],
            ),
            const SizedBox(height: 10),
            if (data.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 30),
                child: Center(
                  child: Text('لا توجد قيود في هذه الفترة',
                      style: TextStyle(fontFamily: 'Cairo', color: AppTheme.textMuted, fontSize: 12)),
                ),
              )
            else
              SizedBox(
                height: 150,
                width: double.infinity,
                child: CustomPaint(
                  size: Size.infinite,
                  painter: _BarChartPainter(data, maxV),
                ),
              ),
            const SizedBox(height: 6),
            Row(
              children: [
                for (var i = 0; i < data.length; i++)
                  if (i % step == 0 || i == data.length - 1)
                    Expanded(
                      child: Text(
                        _monthNameOf(data[i].m),
                        textAlign: TextAlign.center,
                        style: const TextStyle(fontFamily: 'Cairo', fontSize: 9, color: AppTheme.textMuted),
                      ),
                    ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  static String _monthNameOf(String ym) {
    final parts = ym.split('-');
    if (parts.length != 2) return ym;
    final m = int.tryParse(parts[1]);
    if (m == null || m < 1 || m > 12) return ym;
    return _FinanceScreenState._monthNames[m - 1];
  }
}

class _Legend extends StatelessWidget {
  final Color color;
  final String label;
  const _Legend({required this.color, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(width: 12, height: 12, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(3))),
        const SizedBox(width: 6),
        Text(label, style: const TextStyle(fontFamily: 'Cairo', fontSize: 11, fontWeight: FontWeight.w700)),
      ],
    );
  }
}

class _BarChartPainter extends CustomPainter {
  final List<({String m, double inn, double out})> data;
  final double maxV;
  const _BarChartPainter(this.data, this.maxV);

  @override
  void paint(Canvas canvas, Size size) {
    if (maxV <= 0) return;
    final n = data.length;
    final slot = size.width / n;
    final barW = math.min(slot * 0.22, 26.0);
    final gap = slot * 0.06;
    final paintIn = Paint()..color = AppTheme.success;
    final paintOut = Paint()..color = AppTheme.danger;

    for (var i = 0; i < n; i++) {
      final center = slot * i + slot / 2;
      final hIn = size.height * (data[i].inn / maxV);
      final hOut = size.height * (data[i].out / maxV);
      canvas.drawRRect(
        RRect.fromRectAndRadius(Rect.fromLTWH(center + gap, size.height - hIn, barW, hIn), const Radius.circular(3)),
        paintIn,
      );
      canvas.drawRRect(
        RRect.fromRectAndRadius(Rect.fromLTWH(center - gap - barW, size.height - hOut, barW, hOut), const Radius.circular(3)),
        paintOut,
      );
    }
    canvas.drawLine(Offset(0, size.height), Offset(size.width, size.height), Paint()..color = const Color(0xFFdde5e3)..strokeWidth = 1);
  }

  @override
  bool shouldRepaint(covariant _BarChartPainter oldDelegate) => oldDelegate.maxV != maxV || oldDelegate.data != data;
}