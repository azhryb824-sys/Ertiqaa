import 'package:flutter/material.dart';
import '../../core/constants.dart';
import '../../core/utils.dart';
import '../../pdf/pdf_generator.dart';
import '../../state/app_state.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// مالية الموظفين: العهد + مسيرات الرواتب + سندات قبض الموظفين.
class StaffFinanceScreen extends StatefulWidget {
  const StaffFinanceScreen({super.key});

  @override
  State<StaffFinanceScreen> createState() => _StaffFinanceScreenState();
}

class _StaffFinanceScreenState extends State<StaffFinanceScreen> {
  @override
  Widget build(BuildContext context) {
    final app = AppState.instance;
    final session = app.session!;
    if (!session.canManage) {
      return const Scaffold(
        backgroundColor: AppTheme.bg,
        body: EmptyState('غير متاح لدورك.', icon: Icons.lock_outline),
      );
    }

    final staff = app.allStaff.where(app.sameCompany).toList();
    final custodies = app.allCustodies.where(app.sameCompany).toList()
      ..sort((a, b) => ((b['createdAtMs'] as num?)?.toInt() ?? 0).compareTo((a['createdAtMs'] as num?)?.toInt() ?? 0));
    final payrolls = app.allPayrolls.where(app.sameCompany).toList()
      ..sort((a, b) => ((b['createdAtMs'] as num?)?.toInt() ?? 0).compareTo((a['createdAtMs'] as num?)?.toInt() ?? 0));

    return DefaultTabController(
      length: 3,
      child: Scaffold(
        backgroundColor: AppTheme.bg,
        body: Column(
          children: [
            Material(
              color: Colors.white,
              child: TabBar(
                labelColor: AppTheme.primary,
                unselectedLabelColor: AppTheme.textMuted,
                indicatorColor: AppTheme.gold,
                labelStyle: const TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w800),
                tabs: const [
                  Tab(text: 'العهد'),
                  Tab(text: 'مسيرات رواتب'),
                  Tab(text: 'سندات قبض'),
                ],
              ),
            ),
            Expanded(
              child: TabBarView(
                children: [
                  _buildCustodies(app, staff, custodies),
                  _buildPayrolls(app, staff, payrolls),
                  _buildSalaryReceipts(app, payrolls),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ===== العهد =====
  Widget _buildCustodies(AppState app, List<Map<String, dynamic>> staff, List<Map<String, dynamic>> custodies) {
    return ListView(
      padding: const EdgeInsets.only(bottom: 20),
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(
            children: [
              Expanded(
                child: Text('${custodies.length} عهدة',
                    style: const TextStyle(fontFamily: 'Cairo', fontSize: 14, fontWeight: FontWeight.w700)),
              ),
              FilledButton.icon(
                onPressed: staff.isEmpty ? null : () => _showCustodyDialog(app, staff),
                icon: const Icon(Icons.add_rounded, size: 18),
                label: const Text('إضافة عهدة', style: TextStyle(fontFamily: 'Cairo')),
              ),
            ],
          ),
        ),
        if (custodies.isEmpty)
          const EmptyState('لا توجد عهد')
        else
          for (final c in custodies)
            ListCard(
              leadingIcon: const Icon(Icons.handshake_rounded, color: AppTheme.gold),
              title: c['staffName']?.toString() ?? '',
              subtitle:
                  '${AppUtils.money(c['value'])} — المخصوم ${AppUtils.money(c['deducted'])} — المتبقي ${AppUtils.money(c['remaining'])}\n${c['description'] ?? ''}',
              trailingWidget: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  StatusBadge(c['status']?.toString()),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (((c['remaining'] as num?)?.toDouble() ?? 0) > 0)
                        IconButton(
                          padding: const EdgeInsets.all(2),
                          constraints: const BoxConstraints(),
                          icon: const Icon(Icons.payments_rounded, size: 18, color: AppTheme.primary),
                          tooltip: 'خصم من الراتب',
                          onPressed: () => _showDeductDialog(app, c),
                        ),
                      IconButton(
                        padding: const EdgeInsets.all(2),
                        constraints: const BoxConstraints(),
                        icon: const Icon(Icons.print_rounded, size: 20, color: AppTheme.primary),
                        onPressed: () => _printCustody(app, c),
                      ),
                    ],
                  ),
                ],
              ),
            ),
      ],
    );
  }

  // ===== المسيرات =====
  Widget _buildPayrolls(AppState app, List<Map<String, dynamic>> staff, List<Map<String, dynamic>> payrolls) {
    return ListView(
      padding: const EdgeInsets.only(bottom: 20),
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(
            children: [
              Expanded(
                child: Text('${payrolls.length} مسير',
                    style: const TextStyle(fontFamily: 'Cairo', fontSize: 14, fontWeight: FontWeight.w700)),
              ),
              FilledButton.icon(
                onPressed: staff.isEmpty ? null : () => _showPayrollDialog(app, staff),
                icon: const Icon(Icons.calendar_month_rounded, size: 18),
                label: const Text('إنشاء مسير', style: TextStyle(fontFamily: 'Cairo')),
              ),
            ],
          ),
        ),
        if (payrolls.isEmpty)
          const EmptyState('لا توجد مسيرات رواتب')
        else
          for (final p in payrolls)
            Card(
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 5),
              child: ExpansionTile(
                leading: const Icon(Icons.payments_rounded, color: AppTheme.primary),
                title: Text(_monthLabel(p['period']?.toString() ?? ''),
                    style: const TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w700, fontSize: 14)),
                subtitle: Text('${p['status'] ?? ''} • الإجمالي ${AppUtils.money(p['totalNet'])}',
                    style: const TextStyle(fontFamily: 'Cairo', fontSize: 12)),
                trailing: IconButton(
                  icon: const Icon(Icons.print_rounded, color: AppTheme.primary),
                  onPressed: () => _printPayroll(p),
                ),
                children: [
                  for (final row in ((p['rows'] as List?) ?? []).cast<Map<String, dynamic>>())
                    ListTile(
                      dense: true,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 20),
                      leading: const Icon(Icons.person_rounded, color: AppTheme.gold, size: 20),
                      title: Text(row['staffName']?.toString() ?? '',
                          style: const TextStyle(fontFamily: 'Cairo', fontSize: 13, fontWeight: FontWeight.w700)),
                      subtitle: Text(
                          'الراتب ${AppUtils.money(row['base'])} • البدلات ${AppUtils.money(row['allowances'])} • الخصومات ${AppUtils.money(row['deductions'])} • العهدة ${AppUtils.money(row['custodyDeduction'])}',
                          style: const TextStyle(fontFamily: 'Cairo', fontSize: 11)),
                      trailing: Text('${AppUtils.money(row['net'])} ر.س',
                          style: const TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w800, color: AppTheme.primary)),
                      onTap: () => _printSalaryReceipt(p, row),
                    ),
                ],
              ),
            ),
      ],
    );
  }

  // ===== سندات قبض الموظفين =====
  Widget _buildSalaryReceipts(AppState app, List<Map<String, dynamic>> payrolls) {
    final receipts = <Map<String, dynamic>>[];
    for (final p in payrolls) {
      final period = p['period']?.toString() ?? '';
      for (final row in ((p['rows'] as List?) ?? []).cast<Map<String, dynamic>>()) {
        receipts.add({
          'id': '${p['id']}-${row['staffId']}',
          'staffName': row['staffName'],
          'staffIdentity': row['staffIdentity'],
          'period': period,
          'amount': row['net'],
          'details': [
            {'label': 'الراتب الأساسي', 'value': row['base']},
            {'label': 'البدلات', 'value': row['allowances']},
            {'label': 'الخصومات', 'value': row['deductions']},
            {'label': 'خصم العهدة', 'value': row['custodyDeduction']},
          ],
          'createdAtMs': p['createdAtMs'],
        });
      }
    }
    receipts.sort((a, b) => ((b['createdAtMs'] as num?)?.toInt() ?? 0).compareTo((a['createdAtMs'] as num?)?.toInt() ?? 0));

    return ListView(
      padding: const EdgeInsets.only(bottom: 20),
      children: [
        const Padding(
          padding: EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: Text('سندات قبض الموظفين',
              style: TextStyle(fontFamily: 'Cairo', fontSize: 15, fontWeight: FontWeight.w800)),
        ),
        if (receipts.isEmpty)
          const EmptyState('لا توجد سندات قبض')
        else
          for (final r in receipts)
            ListCard(
              leadingIcon: const Icon(Icons.receipt_rounded, color: AppTheme.gold),
              title: '${r['staffName']} — ${_monthLabel(r['period']?.toString() ?? '')}',
              subtitle: 'سند قبض راتب • ${AppUtils.money(r['amount'])}',
              trailingWidget: IconButton(
                icon: const Icon(Icons.print_rounded, color: AppTheme.primary),
                onPressed: () => _printSalaryReceiptRecord(app, r),
              ),
            ),
      ],
    );
  }

  // ===== أفعال العهدة =====
  Future<void> _showCustodyDialog(AppState app, List<Map<String, dynamic>> staff) async {
    String? staffId = staff.isNotEmpty ? staff.first['id']?.toString() : null;
    final amountCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('إضافة عهدة', style: TextStyle(fontFamily: 'Cairo')),
        content: SizedBox(
          width: MediaQuery.of(ctx).size.width * 0.9,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                AppDropdown<String>(
                  label: 'الموظف',
                  value: staffId,
                  items: [for (final s in staff) s['id'].toString()],
                  labelOf: (id) => staff.firstWhere((x) => x['id']?.toString() == id)['name']?.toString() ?? id,
                  onChanged: (v) => staffId = v,
                ),
                AppField(label: 'قيمة العهدة (ر.س)', keyboard: TextInputType.number, controller: amountCtrl),
                AppField(label: 'البيان', controller: descCtrl),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('إلغاء', style: TextStyle(fontFamily: 'Cairo'))),
          FilledButton(
            onPressed: () async {
              final amount = double.tryParse(amountCtrl.text) ?? 0;
              if (staffId == null || amount <= 0) {
                ScaffoldMessenger.of(ctx).showSnackBar(const SnackBar(content: Text('أدخل الموظف والمبلغ.', style: TextStyle(fontFamily: 'Cairo'))));
                return;
              }
              Navigator.pop(ctx);
              await _addCustody(app, staffId!, amount, descCtrl.text);
            },
            child: const Text('حفظ', style: TextStyle(fontFamily: 'Cairo')),
          ),
        ],
      ),
    );
  }

  Future<void> _addCustody(AppState app, String staffId, double amount, String desc) async {
    final now = DateTime.now();
    final s = app.allStaff.firstWhere((x) => x['id']?.toString() == staffId, orElse: () => const {});
    final custody = {
      'id': 'CST-${now.millisecondsSinceEpoch}',
      'companyOwnerId': app.ownerId,
      'staffId': staffId,
      'staffName': s['name']?.toString() ?? '',
      'staffIdentity': s['identity']?.toString() ?? '',
      'value': amount,
      'deducted': 0.0,
      'remaining': amount,
      'description': desc,
      'status': 'نشطة',
      'createdAt': now.toIso8601String(),
      'createdAtMs': now.millisecondsSinceEpoch,
    };
    await app.append(AppConstants.kCustodies, custody);

    final entry = {
      'id': 'FIN-${now.millisecondsSinceEpoch}',
      'companyOwnerId': app.ownerId,
      'type': 'custody',
      'direction': 'out',
      'amount': amount,
      'date': AppUtils.dateVal(now),
      'description': 'عهدة: ${custody['id']} — ${s['name'] ?? ''}',
      'staffId': staffId,
      'contractId': '',
      'status': 'معتمد',
      'paymentMethod': '',
      'paymentLabel': 'عهدة',
      'receiptId': '',
      'createdBy': app.session!.id,
      'createdAt': now.toIso8601String(),
      'createdAtMs': now.millisecondsSinceEpoch,
    };
    await app.append('misadFinancialEntries', entry);
    await app.logActivity('إضافة عهدة', entityType: 'custody', entityId: custody['id'] as String);
    if (mounted) {
      setState(() {});
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم إضافة العهدة.', style: TextStyle(fontFamily: 'Cairo'))));
    }
  }

  Future<void> _showDeductDialog(AppState app, Map<String, dynamic> c) async {
    final remaining = (c['remaining'] as num?)?.toDouble() ?? 0;
    final amountCtrl = TextEditingController(text: remaining.toStringAsFixed(0));
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('خصم من الراتب', style: TextStyle(fontFamily: 'Cairo')),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('العُهد المتبقي: ${AppUtils.money(remaining)}', style: const TextStyle(fontFamily: 'Cairo')),
            AppField(label: 'المبلغ المخصوم (ر.س)', keyboard: TextInputType.number, controller: amountCtrl),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('إلغاء', style: TextStyle(fontFamily: 'Cairo'))),
          FilledButton(
            onPressed: () async {
              final amount = double.tryParse(amountCtrl.text) ?? 0;
              if (amount <= 0 || amount > remaining) {
                ScaffoldMessenger.of(ctx).showSnackBar(const SnackBar(content: Text('مبلغ غير صحيح.', style: TextStyle(fontFamily: 'Cairo'))));
                return;
              }
              Navigator.pop(ctx);
              await _recordDeduction(app, c, amount);
            },
            child: const Text('خصم', style: TextStyle(fontFamily: 'Cairo')),
          ),
        ],
      ),
    );
  }

  Future<void> _recordDeduction(AppState app, Map<String, dynamic> c, double amount) async {
    final now = DateTime.now();
    final prevDeducted = (c['deducted'] as num?)?.toDouble() ?? 0;
    final prevRemaining = (c['remaining'] as num?)?.toDouble() ?? 0;
    final newDeducted = prevDeducted + amount;
    final newRemaining = prevRemaining - amount;
    await app.update(AppConstants.kCustodies, {
      ...c,
      'deducted': newDeducted,
      'remaining': newRemaining,
      'status': newRemaining <= 0 ? 'مسددة' : 'نشطة',
    });

    final entry = {
      'id': 'FIN-${now.millisecondsSinceEpoch}',
      'companyOwnerId': app.ownerId,
      'type': 'custody',
      'direction': 'in',
      'amount': amount,
      'date': AppUtils.dateVal(now),
      'description': 'خصم عهدة من راتب: ${c['id']} — ${c['staffName'] ?? ''}',
      'staffId': c['staffId'],
      'contractId': '',
      'status': 'معتمد',
      'paymentMethod': '',
      'paymentLabel': 'خصم عهدة',
      'receiptId': '',
      'createdBy': app.session!.id,
      'createdAt': now.toIso8601String(),
      'createdAtMs': now.millisecondsSinceEpoch,
    };
    await app.append('misadFinancialEntries', entry);
    await app.logActivity('خصم عهدة من الراتب', entityType: 'custody', entityId: c['id'] as String);
    if (mounted) {
      setState(() {});
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم تسجيل الخصم.', style: TextStyle(fontFamily: 'Cairo'))));
    }
  }

  // ===== أفعال المسيرات =====
  Future<void> _showPayrollDialog(AppState app, List<Map<String, dynamic>> staff) async {
    final months = _lastMonths();
    String? month = months.isNotEmpty ? months.first : null;
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('إنشاء مسير رواتب', style: TextStyle(fontFamily: 'Cairo')),
        content: SizedBox(
          width: MediaQuery.of(ctx).size.width * 0.9,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              AppDropdown<String>(
                label: 'الشهر',
                value: month,
                items: months,
                labelOf: (m) => _monthLabel(m),
                onChanged: (v) => month = v,
              ),
              const SizedBox(height: 6),
              Text('سيتم إنشاء مسير لكل الموظفين مع خصم العُهد النشطة من الرواتب.',
                  style: const TextStyle(fontFamily: 'Cairo', fontSize: 12, color: AppTheme.textMuted)),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('إلغاء', style: TextStyle(fontFamily: 'Cairo'))),
          FilledButton(
            onPressed: () async {
              if (month == null) return;
              Navigator.pop(ctx);
              await _generatePayroll(app, month!);
            },
            child: const Text('إنشاء', style: TextStyle(fontFamily: 'Cairo')),
          ),
        ],
      ),
    );
  }

  Future<void> _generatePayroll(AppState app, String month) async {
    final now = DateTime.now();
    final staff = app.allStaff.where(app.sameCompany).toList();
    final entries = app.allFinancialEntries.where(app.sameCompany).toList();
    var custodies = List<Map<String, dynamic>>.from(app.allCustodies.where(app.sameCompany));
    final rows = <Map<String, dynamic>>[];
    var totalNet = 0.0;
    var totalCustody = 0.0;

    for (final s in staff) {
      final staffId = s['id']?.toString() ?? '';
      final base = (s['baseSalary'] as num?)?.toDouble() ?? 0;
      var allowances = 0.0;
      var deductions = 0.0;
      for (final e in entries) {
        if (e['staffId']?.toString() != staffId) continue;
        final d = e['date']?.toString() ?? '';
        if (!d.startsWith(month)) continue;
        final amt = (e['amount'] as num?)?.toDouble() ?? 0;
        final type = e['type']?.toString() ?? '';
        if (type == 'allowance') {
          if (e['direction']?.toString() == 'in') allowances += amt;
        } else if (type == 'deduction') {
          if (e['direction']?.toString() == 'out') deductions += amt;
        }
      }

      // خصم العُهد النشطة
      final active = custodies.where((c) =>
          c['staffId']?.toString() == staffId &&
          c['status']?.toString() != 'مسددة' &&
          ((c['remaining'] as num?)?.toDouble() ?? 0) > 0).toList();
      var gross = base + allowances - deductions;
      var custodyDeduct = 0.0;
      var budget = gross > 0 ? gross : 0.0;
      final updated = <Map<String, dynamic>>[];
      for (final c in active) {
        final rem = (c['remaining'] as num?)?.toDouble() ?? 0;
        final take = rem <= budget ? rem : budget;
        budget -= take;
        custodyDeduct += take;
        totalCustody += take;
        updated.add({
          ...c,
          'deducted': ((c['deducted'] as num?)?.toDouble() ?? 0) + take,
          'remaining': rem - take,
          'status': (rem - take) <= 0 ? 'مسددة' : 'نشطة',
        });
      }

      final net = gross - custodyDeduct;
      totalNet += net;
      rows.add({
        'staffId': staffId,
        'staffName': s['name']?.toString() ?? '',
        'staffIdentity': s['identity']?.toString() ?? '',
        'base': base,
        'allowances': allowances,
        'deductions': deductions,
        'custodyDeduction': custodyDeduct,
        'net': net,
      });
      for (final u in updated) {
        final idx = custodies.indexWhere((c) => c['id'] == u['id']);
        if (idx >= 0) custodies[idx] = u;
      }
    }

    final payroll = {
      'id': 'PAY-${now.millisecondsSinceEpoch}',
      'companyOwnerId': app.ownerId,
      'period': month,
      'status': 'مسدد',
      'rows': rows,
      'totalNet': totalNet,
      'totalCustodyDeducted': totalCustody,
      'createdAt': now.toIso8601String(),
      'createdAtMs': now.millisecondsSinceEpoch,
    };
    await app.append(AppConstants.kPayrolls, payroll);
    await app.storage.write(AppConstants.kCustodies, custodies);

    if (totalNet > 0) {
      await app.append('misadFinancialEntries', {
        'id': 'FIN-${now.millisecondsSinceEpoch}',
        'companyOwnerId': app.ownerId,
        'type': 'salary',
        'direction': 'out',
        'amount': totalNet,
        'date': AppUtils.dateVal(now),
        'description': 'مسير رواتب: ${_monthLabel(month)}',
        'staffId': '',
        'contractId': '',
        'status': 'معتمد',
        'paymentMethod': '',
        'paymentLabel': 'مسير رواتب',
        'receiptId': '',
        'createdBy': app.session!.id,
        'createdAt': now.toIso8601String(),
        'createdAtMs': now.millisecondsSinceEpoch,
      });
    }
    await app.logActivity('إنشاء مسير رواتب', entityType: 'payroll', entityId: payroll['id'] as String);
    if (mounted) {
      setState(() {});
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('تم إنشاء مسير $_monthLabel($month) وإجمالي ${AppUtils.money(totalNet)} ر.س.', style: const TextStyle(fontFamily: 'Cairo'))));
    }
  }

  // ===== الطباعة =====
  Future<void> _printCustody(AppState app, Map<String, dynamic> c) async {
    try {
      await PdfGenerator.sharePdf('سند عهدة',
          PdfGenerator.custodyContent(c, app.myOwnerCompany),
          ownerCompany: app.myOwnerCompany);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تعذر إنشاء PDF.', style: TextStyle(fontFamily: 'Cairo'))));
      }
    }
  }

  Future<void> _printPayroll(Map<String, dynamic> p) async {
    final app = AppState.instance;
    try {
      await PdfGenerator.sharePdf('مسير رواتب',
          PdfGenerator.payrollContent(p, app.myOwnerCompany),
          ownerCompany: app.myOwnerCompany);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تعذر إنشاء PDF.', style: TextStyle(fontFamily: 'Cairo'))));
      }
    }
  }

  Future<void> _printSalaryReceipt(Map<String, dynamic> p, Map<String, dynamic> row) async {
    final app = AppState.instance;
    final r = {
      'id': '${p['id']}-${row['staffId']}',
      'staffName': row['staffName'],
      'staffIdentity': row['staffIdentity'],
      'period': p['period'],
      'amount': row['net'],
      'details': [
        {'label': 'الراتب الأساسي', 'value': row['base']},
        {'label': 'البدلات', 'value': row['allowances']},
        {'label': 'الخصومات', 'value': row['deductions']},
        {'label': 'خصم العهدة', 'value': row['custodyDeduction']},
      ],
      'createdAtMs': p['createdAtMs'],
    };
    try {
      await PdfGenerator.sharePdf('سند قبض راتب',
          PdfGenerator.salaryReceiptContent(r, app.myOwnerCompany),
          ownerCompany: app.myOwnerCompany);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تعذر إنشاء PDF.', style: TextStyle(fontFamily: 'Cairo'))));
      }
    }
  }

  Future<void> _printSalaryReceiptRecord(AppState app, Map<String, dynamic> r) async {
    try {
      await PdfGenerator.sharePdf('سند قبض راتب',
          PdfGenerator.salaryReceiptContent(r, app.myOwnerCompany),
          ownerCompany: app.myOwnerCompany);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تعذر إنشاء PDF.', style: TextStyle(fontFamily: 'Cairo'))));
      }
    }
  }

  // ===== أدوات =====
  static String _monthLabel(String ym) {
    final parts = ym.split('-');
    if (parts.length != 2) return ym;
    final year = parts[0];
    final m = int.tryParse(parts[1]);
    const names = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    if (m == null || m < 1 || m > 12) return ym;
    return '${names[m - 1]} $year';
  }

  static List<String> _lastMonths() {
    final now = DateTime.now();
    final list = <String>[];
    for (var i = 0; i < 6; i++) {
      final d = DateTime(now.year, now.month - i);
      list.add('${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}');
    }
    return list;
  }
}