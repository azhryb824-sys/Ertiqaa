import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../core/constants.dart';
import '../../core/utils.dart';
import '../../state/app_state.dart';
import '../../state/business_rules.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// لوحة الإدارة المالية المتطورة: نظرة عامة + قيود قابلة للفلترة.
class FinanceScreen extends StatefulWidget {
  const FinanceScreen({super.key});

  @override
  State<FinanceScreen> createState() => _FinanceScreenState();
}

class _FinanceScreenState extends State<FinanceScreen> with SingleTickerProviderStateMixin {
  late final TabController _tabC = TabController(length: 2, vsync: this)
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
              ],
            ),
          ),
          Expanded(
            child: TabBarView(
              controller: _tabC,
              children: [
                _buildOverview(app, entries),
                _buildEntries(app, entries),
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

        const Padding(
          padding: EdgeInsets.fromLTRB(16, 20, 16, 6),
          child: Text('التدفق النقدي الشهري',
              style: TextStyle(fontFamily: 'Cairo', fontSize: 15, fontWeight: FontWeight.w800)),
        ),
        _CashChart(entries: entries),

        const Padding(
          padding: EdgeInsets.fromLTRB(16, 20, 16, 6),
          child: Text('التوزيع حسب الفئة',
              style: TextStyle(fontFamily: 'Cairo', fontSize: 15, fontWeight: FontWeight.w800)),
        ),
        _buildTypeBreakdown(entries),

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

/// رسم بياني للتدفق النقدي الشهري (آخر 6 أشهر) بدون مكتبات خارجية.
class _CashChart extends StatelessWidget {
  final List<Map<String, dynamic>> entries;
  const _CashChart({required this.entries});

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final months = <String>[];
    for (var i = 5; i >= 0; i--) {
      final d = DateTime(now.year, now.month - i);
      months.add('${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}');
    }

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
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                for (final d in data) Text(_monthNameOf(d.m), style: const TextStyle(fontFamily: 'Cairo', fontSize: 10, color: AppTheme.textMuted)),
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