import 'package:flutter/material.dart';
import '../../core/constants.dart';
import '../../core/utils.dart';
import '../../state/app_state.dart';
import '../../theme.dart';
import '../../widgets/common.dart';
import '../../state/business_rules.dart';

/// الشاشة المالية: القيود + نظرة عامة (للمالك/الإدارة فقط).
class FinanceScreen extends StatefulWidget {
  const FinanceScreen({super.key});

  @override
  State<FinanceScreen> createState() => _FinanceScreenState();
}

class _FinanceScreenState extends State<FinanceScreen> {
  final _descCtrl = TextEditingController();
  final _amountCtrl = TextEditingController();
  String _type = 'expense';
  String _direction = 'out';
  bool _showForm = false;

  @override
  void dispose() {
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

    var totalIn = 0.0, totalOut = 0.0;
    for (final e in entries) {
      final amt = (e['amount'] as num?)?.toDouble() ?? 0;
      if (e['direction']?.toString() == 'in') totalIn += amt;
      else totalOut += amt;
    }

    return Scaffold(
      backgroundColor: AppTheme.bg,
      floatingActionButton: Fab(onPressed: () => setState(() => _showForm = !_showForm), label: 'قيد جديد'),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 90),
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
                StatCard(label: 'وارد', value: AppUtils.money(totalIn), icon: Icons.south_west_rounded, color: AppTheme.success),
                StatCard(label: 'صادر', value: AppUtils.money(totalOut), icon: Icons.north_east_rounded, color: AppTheme.danger),
                StatCard(label: 'الصافي', value: AppUtils.money(totalIn - totalOut), icon: Icons.balance_rounded, color: AppTheme.gold),
                StatCard(label: 'عدد القيود', value: '${entries.length}', icon: Icons.receipt_long_rounded),
              ],
            ),
          ),

          if (_showForm)
            Card(
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
                      items: ['sale', 'purchase', 'expense', 'salary', 'advance', 'deduction', 'allowance', 'custody'],
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
            ),

          const PageTitle('آخر القيود'),
          if (entries.isEmpty)
            const EmptyState('لا توجد قيود مالية')
          else
            for (final e in entries.take(50))
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
      ),
    );
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
