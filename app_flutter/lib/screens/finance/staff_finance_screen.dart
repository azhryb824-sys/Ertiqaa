import 'package:flutter/material.dart';
import '../../core/constants.dart';
import '../../core/utils.dart';
import '../../finance/finance_journal.dart';
import '../../finance/staff_finance_utils.dart';
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
  bool _initialProfileOpened = false;

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
    final activeStaff = staff.where(StaffFinanceUtils.isActive).toList();
    final custodies = app.allCustodies.where(app.sameCompany).toList()
      ..sort((a, b) => ((b['createdAtMs'] as num?)?.toInt() ?? 0).compareTo((a['createdAtMs'] as num?)?.toInt() ?? 0));
    final payrolls = app.allPayrolls.where(app.sameCompany).toList()
      ..sort((a, b) => ((b['createdAtMs'] as num?)?.toInt() ?? 0).compareTo((a['createdAtMs'] as num?)?.toInt() ?? 0));

    final requestedId = app.currentPageData['staffFinancialId']?.toString() ?? '';
    if (!_initialProfileOpened && requestedId.isNotEmpty) {
      _initialProfileOpened = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        for (final member in staff) {
          if (StaffFinanceUtils.staffRefs(member).contains(StaffFinanceUtils.normalizeRef(requestedId))) {
            _showProfile(app, member);
            break;
          }
        }
      });
    }

    return DefaultTabController(
      length: 4,
      child: Scaffold(
        backgroundColor: AppTheme.bg,
        body: Column(
          children: [
            Material(
              color: Colors.white,
              child: TabBar(
                isScrollable: true,
                labelColor: AppTheme.primary,
                unselectedLabelColor: AppTheme.textMuted,
                indicatorColor: AppTheme.gold,
                labelStyle: const TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w800),
                tabs: const [
                  Tab(text: 'ملفات الموظفين'),
                  Tab(text: 'العهد'),
                  Tab(text: 'مسيرات رواتب'),
                  Tab(text: 'سندات قبض'),
                ],
              ),
            ),
            Expanded(
              child: TabBarView(
                children: [
                  _buildProfiles(app, staff, custodies, payrolls),
                  _buildCustodies(app, activeStaff, custodies),
                  _buildPayrolls(app, activeStaff, payrolls),
                  _buildSalaryReceipts(app, payrolls),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ===== الملفات المالية للموظفين =====
  Widget _buildProfiles(
    AppState app,
    List<Map<String, dynamic>> staff,
    List<Map<String, dynamic>> custodies,
    List<Map<String, dynamic>> payrolls,
  ) {
    final entries = app.allFinancialEntries.where(app.sameCompany).toList();
    final purchases = app.storage
        .list('misadStaffPurchaseInvoices')
        .whereType<Map>()
        .map((x) => Map<String, dynamic>.from(x))
        .where(app.sameCompany)
        .toList();
    final vouchers = app.storage
        .list('misadStaffVouchers')
        .whereType<Map>()
        .map((x) => Map<String, dynamic>.from(x))
        .where(app.sameCompany)
        .toList();
    return ListView(
      padding: const EdgeInsets.only(bottom: 24),
      children: [
        const PageTitle('الملفات المالية للموظفين'),
        const Padding(
          padding: EdgeInsets.fromLTRB(16, 0, 16, 8),
          child: Text('اضغط على الموظف لعرض الراتب والمسيرات والسلف والبدلات والخصومات والعهد والمشتريات والسندات.',
              style: TextStyle(fontFamily: 'Cairo', fontSize: 11.5, color: AppTheme.textMuted)),
        ),
        if (staff.isEmpty)
          const EmptyState('لا يوجد موظفون')
        else
          for (final member in staff)
            Builder(builder: (context) {
              final profile = StaffFinanceUtils.calculateProfile(
                staff: member,
                entries: entries,
                custodies: custodies,
                payrolls: payrolls,
                purchases: purchases,
                vouchers: vouchers,
              );
              return ListCard(
                leadingIcon: const Icon(Icons.account_balance_wallet_rounded, color: AppTheme.gold),
                title: member['name']?.toString() ?? StaffFinanceUtils.financialId(member),
                subtitle:
                    '${AppConstants.roleLabels[member['role']] ?? member['role']} • الأساسي ${AppUtils.money(profile['baseSalary'])}\nمسدد ${AppUtils.money(profile['payrollPaid'])} • مستحق ${AppUtils.money(profile['payrollPayable'])}',
                trailingWidget: StatusBadge(StaffFinanceUtils.isActive(member) ? 'على رأس العمل' : 'منتهي الخدمة'),
                onTap: () => _showProfile(app, member),
              );
            }),
      ],
    );
  }

  void _showProfile(AppState app, Map<String, dynamic> member) {
    final profile = StaffFinanceUtils.calculateProfile(
      staff: member,
      entries: app.allFinancialEntries.where(app.sameCompany),
      custodies: app.allCustodies.where(app.sameCompany),
      payrolls: app.allPayrolls.where(app.sameCompany),
      purchases: app.storage
          .list('misadStaffPurchaseInvoices')
          .whereType<Map>()
          .map((x) => Map<String, dynamic>.from(x))
          .where(app.sameCompany),
      vouchers: app.storage
          .list('misadStaffVouchers')
          .whereType<Map>()
          .map((x) => Map<String, dynamic>.from(x))
          .where(app.sameCompany),
    );
    final entries = (profile['entries'] as List).cast<Map<String, dynamic>>();
    final payrolls = (profile['payrolls'] as List).cast<Map<String, dynamic>>();
    final custodies = (profile['custodies'] as List).cast<Map<String, dynamic>>();
    final purchases = (profile['purchases'] as List).cast<Map<String, dynamic>>();
    final vouchers = (profile['vouchers'] as List).cast<Map<String, dynamic>>();
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.bg,
      builder: (ctx) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.94,
        maxChildSize: 0.98,
        builder: (ctx, scroll) => ListView(
          controller: scroll,
          padding: const EdgeInsets.all(16),
          children: [
            Row(
              children: [
                Expanded(
                  child: Text('الملف المالي: ${member['name'] ?? ''}',
                      style: const TextStyle(fontFamily: 'Cairo', fontSize: 17, fontWeight: FontWeight.w800)),
                ),
                IconButton(onPressed: () => Navigator.pop(ctx), icon: const Icon(Icons.close_rounded)),
              ],
            ),
            Text(
              'رقم الملف ${StaffFinanceUtils.financialId(member)} • ${AppConstants.roleLabels[member['role']] ?? member['role']} • ${member['employmentStatus'] ?? member['status'] ?? ''}',
              style: const TextStyle(fontFamily: 'Cairo', fontSize: 11.5, color: AppTheme.textMuted),
            ),
            const SizedBox(height: 8),
            FilledButton.icon(
              onPressed: () {
                Navigator.pop(ctx);
                _showStaffEntryDialog(app, member);
              },
              icon: const Icon(Icons.add_card_rounded, size: 18),
              label: const Text('إضافة سلفة / بدل / خصم', style: TextStyle(fontFamily: 'Cairo')),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _profileMetric('الراتب الأساسي', profile['baseSalary']),
                _profileMetric('رواتب مسددة', profile['payrollPaid'], color: AppTheme.success),
                _profileMetric('رواتب مستحقة', profile['payrollPayable'], color: AppTheme.danger),
                _profileMetric('رصيد السلف', profile['advancesOutstanding']),
                _profileMetric('البدلات', profile['allowances']),
                _profileMetric('الخصومات', profile['deductions']),
                _profileMetric('متبقي العهد', profile['custodyRemaining']),
                _profileMetric('مشتريات معلّقة', profile['purchasesPending']),
                _profileMetric('سندات صرف', profile['vouchersPaid']),
              ],
            ),
            _profileSection('مسيرات الرواتب', payrolls.isEmpty
                ? const [Text('لا توجد مسيرات.', style: TextStyle(fontFamily: 'Cairo', color: AppTheme.textMuted))]
                : payrolls.map<Widget>((payroll) {
                    final row = StaffFinanceUtils.payrollRow(payroll, member) ?? const <String, dynamic>{};
                    return ListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      title: Text('${_monthLabel(payroll['period']?.toString() ?? '')} — ${payroll['status'] ?? ''}',
                          style: const TextStyle(fontFamily: 'Cairo', fontSize: 12.5, fontWeight: FontWeight.w700)),
                      subtitle: Text('الأساسي ${AppUtils.money(row['base'])} • البدلات ${AppUtils.money(row['allowances'])} • الخصومات ${AppUtils.money(row['deductions'])} • العهد ${AppUtils.money(row['custodyDeduction'])}',
                          style: const TextStyle(fontFamily: 'Cairo', fontSize: 10.5)),
                      trailing: Text(AppUtils.money(row['net']), style: const TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w800)),
                    );
                  }).toList()),
            _profileSection('السلف والبدلات والخصومات', entries.isEmpty
                ? const [Text('لا توجد حركات.', style: TextStyle(fontFamily: 'Cairo', color: AppTheme.textMuted))]
                : entries.map<Widget>((entry) => ListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      title: Text(entry['description']?.toString() ?? entry['type']?.toString() ?? '—',
                          style: const TextStyle(fontFamily: 'Cairo', fontSize: 12)),
                      subtitle: Text('${entry['date'] ?? ''} • ${entry['status'] ?? ''}', style: const TextStyle(fontFamily: 'Cairo', fontSize: 10.5)),
                      trailing: Text(AppUtils.money(entry['amount']), style: const TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w700)),
                    )).toList()),
            _profileSection('العهد', custodies.isEmpty
                ? const [Text('لا توجد عهد.', style: TextStyle(fontFamily: 'Cairo', color: AppTheme.textMuted))]
                : custodies.map<Widget>((custody) => ListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      title: Text('${custody['id'] ?? ''} — ${custody['description'] ?? ''}', style: const TextStyle(fontFamily: 'Cairo', fontSize: 12)),
                      subtitle: Text('القيمة ${AppUtils.money(custody['value'])} • المسوّى ${AppUtils.money(custody['deducted'])}', style: const TextStyle(fontFamily: 'Cairo', fontSize: 10.5)),
                      trailing: Text('متبقي ${AppUtils.money(custody['remaining'])}', style: const TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w700)),
                    )).toList()),
            _profileSection('المشتريات وسندات الصرف', [
              if (purchases.isEmpty && vouchers.isEmpty)
                const Text('لا توجد مشتريات أو سندات.', style: TextStyle(fontFamily: 'Cairo', color: AppTheme.textMuted)),
              for (final purchase in purchases)
                ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  title: Text('فاتورة ${purchase['invoiceNo'] ?? purchase['id'] ?? ''}', style: const TextStyle(fontFamily: 'Cairo', fontSize: 12)),
                  subtitle: Text('${purchase['date'] ?? ''} • ${purchase['status'] ?? ''}', style: const TextStyle(fontFamily: 'Cairo', fontSize: 10.5)),
                  trailing: Text(AppUtils.money(purchase['amount']), style: const TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w700)),
                ),
              for (final voucher in vouchers)
                ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  title: Text('سند صرف ${voucher['id'] ?? ''}', style: const TextStyle(fontFamily: 'Cairo', fontSize: 12)),
                  subtitle: Text('${voucher['date'] ?? ''} • ${voucher['description'] ?? ''}', style: const TextStyle(fontFamily: 'Cairo', fontSize: 10.5)),
                  trailing: Text(AppUtils.money(voucher['amount']), style: const TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w700)),
                ),
            ]),
          ],
        ),
      ),
    );
  }

  Widget _profileMetric(String label, Object? amount, {Color color = AppTheme.primary}) => Container(
        width: 150,
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(fontFamily: 'Cairo', fontSize: 10.5, color: AppTheme.textMuted)),
            Text(AppUtils.money(amount), style: TextStyle(fontFamily: 'Cairo', fontSize: 13, fontWeight: FontWeight.w800, color: color)),
          ],
        ),
      );

  Widget _profileSection(String title, List<Widget> children) => Padding(
        padding: const EdgeInsets.only(top: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(title, style: const TextStyle(fontFamily: 'Cairo', fontSize: 14, fontWeight: FontWeight.w800)),
            const Divider(),
            ...children,
          ],
        ),
      );

  Future<void> _showStaffEntryDialog(AppState app, Map<String, dynamic> member) async {
    final amountCtrl = TextEditingController();
    final dateCtrl = TextEditingController(text: AppUtils.dateVal());
    final descCtrl = TextEditingController();
    var kind = 'advance-out';
    await showDialog<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: Text('حركة مالية: ${member['name'] ?? ''}', style: const TextStyle(fontFamily: 'Cairo')),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                AppDropdown<String>(
                  label: 'نوع الحركة',
                  value: kind,
                  items: const ['advance-out', 'advance-in', 'allowance', 'deduction'],
                  labelOf: (value) => const {
                    'advance-out': 'صرف سلفة للموظف',
                    'advance-in': 'استرداد سلفة من الموظف',
                    'allowance': 'بدل يضاف لمسير الشهر',
                    'deduction': 'خصم يطبق على مسير الشهر',
                  }[value] ?? value,
                  onChanged: (value) => setDialogState(() => kind = value ?? kind),
                ),
                AppField(label: 'المبلغ (ر.س)', keyboard: TextInputType.number, controller: amountCtrl),
                AppField(label: 'التاريخ', controller: dateCtrl, hint: 'YYYY-MM-DD'),
                AppField(label: 'البيان', controller: descCtrl, maxLines: 2),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('إلغاء', style: TextStyle(fontFamily: 'Cairo'))),
            FilledButton(
              onPressed: () async {
                final amount = double.tryParse(amountCtrl.text) ?? 0;
                if (!amount.isFinite || amount <= 0 || dateCtrl.text.trim().isEmpty || descCtrl.text.trim().isEmpty) {
                  ScaffoldMessenger.of(ctx).showSnackBar(
                    const SnackBar(content: Text('أدخل المبلغ والتاريخ والبيان بشكل صحيح.', style: TextStyle(fontFamily: 'Cairo'))),
                  );
                  return;
                }
                final now = DateTime.now();
                final financialId = StaffFinanceUtils.financialId(member);
                final type = kind.startsWith('advance') ? 'advance' : kind;
                final entry = <String, dynamic>{
                  'id': 'FIN-${now.millisecondsSinceEpoch}',
                  'companyOwnerId': app.ownerId,
                  'type': type,
                  'direction': kind == 'advance-in' ? 'in' : 'out',
                  'amount': amount,
                  'date': dateCtrl.text.trim(),
                  'description': descCtrl.text.trim(),
                  'staffFinancialId': financialId,
                  'staffId': financialId,
                  'employeeId': member['id'] ?? '',
                  'staffIdentity': member['identity'] ?? financialId,
                  'status': 'معتمد',
                  'paymentMethod': type == 'advance' ? 'نقداً' : '',
                  'createdBy': app.session!.id,
                  'createdAt': now.toIso8601String(),
                  'createdAtMs': now.millisecondsSinceEpoch,
                };
                if (type == 'advance') {
                  final posted = await FinanceJournal.postStaffAdvance(app, entry);
                  if (!posted) {
                    if (ctx.mounted) {
                      ScaffoldMessenger.of(ctx).showSnackBar(
                        const SnackBar(content: Text('تعذر ترحيل السلفة محاسبياً.', style: TextStyle(fontFamily: 'Cairo'))),
                      );
                    }
                    return;
                  }
                }
                await app.append('misadFinancialEntries', entry);
                await app.logActivity('مالية موظف', entityType: 'staff-finance', entityId: entry['id'] as String);
                if (ctx.mounted) Navigator.pop(ctx);
                if (mounted) {
                  setState(() {});
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('تم حفظ الحركة في ملف الموظف.', style: TextStyle(fontFamily: 'Cairo'))),
                  );
                }
              },
              child: const Text('حفظ الحركة', style: TextStyle(fontFamily: 'Cairo')),
            ),
          ],
        ),
      ),
    );
    amountCtrl.dispose();
    dateCtrl.dispose();
    descCtrl.dispose();
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
                          tooltip: 'استرداد نقدي',
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
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (!StaffFinanceUtils.isPaidPayroll(p))
                      IconButton(
                        icon: const Icon(Icons.payments_rounded, color: AppTheme.success),
                        tooltip: 'تسجيل الصرف',
                        onPressed: () => _showPayrollPaymentDialog(app, p),
                      ),
                    IconButton(
                      icon: const Icon(Icons.print_rounded, color: AppTheme.primary),
                      onPressed: () => _printPayroll(p),
                    ),
                  ],
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
                      onTap: StaffFinanceUtils.isPaidPayroll(p) ? () => _printSalaryReceipt(p, row) : null,
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
      if (!StaffFinanceUtils.isPaidPayroll(p)) continue;
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
    String? staffId = staff.isNotEmpty ? StaffFinanceUtils.financialId(staff.first) : null;
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
                  items: [for (final s in staff) StaffFinanceUtils.financialId(s)],
                  labelOf: (id) => staff.firstWhere((x) => StaffFinanceUtils.financialId(x) == id)['name']?.toString() ?? id,
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
    final s = app.allStaff.firstWhere(
      (x) => StaffFinanceUtils.staffRefs(x).contains(StaffFinanceUtils.normalizeRef(staffId)),
      orElse: () => const {},
    );
    final financialId = StaffFinanceUtils.financialId(s);
    final custody = {
      'id': 'CST-${now.millisecondsSinceEpoch}',
      'companyOwnerId': app.ownerId,
      'staffFinancialId': financialId,
      'staffId': financialId,
      'employeeId': s['id']?.toString() ?? '',
      'staffName': s['name']?.toString() ?? '',
      'staffIdentity': s['identity']?.toString() ?? financialId,
      'value': amount,
      'deducted': 0.0,
      'remaining': amount,
      'description': desc,
      'status': 'نشطة',
      'createdAt': now.toIso8601String(),
      'createdAtMs': now.millisecondsSinceEpoch,
    };
    final custodyPosted = await FinanceJournal.postCustody(app, custody);
    if (!custodyPosted) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('تعذر ترحيل قيد العهدة؛ راجع البيانات.', style: TextStyle(fontFamily: 'Cairo'))),
        );
      }
      return;
    }
    await app.append(AppConstants.kCustodies, custody);

    final entry = {
      'id': 'FIN-${now.millisecondsSinceEpoch}',
      'companyOwnerId': app.ownerId,
      'type': 'custody',
      'direction': 'out',
      'amount': amount,
      'date': AppUtils.dateVal(now),
      'description': 'عهدة: ${custody['id']} — ${s['name'] ?? ''}',
      'staffFinancialId': financialId,
      'staffId': financialId,
      'employeeId': s['id']?.toString() ?? '',
      'staffIdentity': s['identity']?.toString() ?? financialId,
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
        title: const Text('استرداد عهدة نقدياً', style: TextStyle(fontFamily: 'Cairo')),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('العُهد المتبقي: ${AppUtils.money(remaining)}. خصم الراتب يتم تلقائياً ضمن المسير.', style: const TextStyle(fontFamily: 'Cairo')),
            AppField(label: 'المبلغ المسترد نقدياً (ر.س)', keyboard: TextInputType.number, controller: amountCtrl),
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
            child: const Text('تسجيل الاسترداد', style: TextStyle(fontFamily: 'Cairo')),
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
    final entry = {
      'id': 'FIN-${now.millisecondsSinceEpoch}',
      'companyOwnerId': app.ownerId,
      'type': 'custody',
      'direction': 'in',
      'amount': amount,
      'date': AppUtils.dateVal(now),
      'description': 'استرداد نقدي من عهدة: ${c['id']} — ${c['staffName'] ?? ''}',
      'staffFinancialId': c['staffFinancialId'] ?? c['staffId'] ?? c['staffIdentity'] ?? '',
      'staffId': c['staffFinancialId'] ?? c['staffId'] ?? c['staffIdentity'] ?? '',
      'employeeId': c['employeeId'] ?? '',
      'staffIdentity': c['staffIdentity'] ?? '',
      'contractId': '',
      'status': 'معتمد',
      'paymentMethod': 'نقداً',
      'paymentLabel': 'استرداد عهدة',
      'receiptId': '',
      'createdBy': app.session!.id,
      'createdAt': now.toIso8601String(),
      'createdAtMs': now.millisecondsSinceEpoch,
    };
    final recoveryPosted = await FinanceJournal.postCustodyRecovery(app, c, entry);
    if (!recoveryPosted) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('تعذر ترحيل استرداد العهدة.', style: TextStyle(fontFamily: 'Cairo'))),
        );
      }
      return;
    }
    await app.update(AppConstants.kCustodies, {
      ...c,
      'deducted': newDeducted,
      'remaining': newRemaining,
      'status': newRemaining <= 0 ? 'مسددة' : 'نشطة',
    });
    await app.append('misadFinancialEntries', entry);
    await app.logActivity('استرداد عهدة نقدياً', entityType: 'custody', entityId: c['id'] as String);
    if (mounted) {
      setState(() {});
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم تسجيل الاسترداد النقدي.', style: TextStyle(fontFamily: 'Cairo'))));
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
    if (StaffFinanceUtils.payrollExistsForPeriod(app.allPayrolls, app.ownerId, month)) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('يوجد مسير رواتب لهذا الشهر بالفعل.', style: TextStyle(fontFamily: 'Cairo'))),
        );
      }
      return;
    }
    final now = DateTime.now();
    final staff = app.allStaff.where(app.sameCompany).where(StaffFinanceUtils.isActive).toList();
    if (staff.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('لا يوجد موظفون على رأس العمل.', style: TextStyle(fontFamily: 'Cairo'))),
        );
      }
      return;
    }
    final entries = app.allFinancialEntries.where(app.sameCompany).toList();
    final allCustodies = app.allCustodies.map((x) => Map<String, dynamic>.from(x)).toList();
    final rows = <Map<String, dynamic>>[];
    var totalGross = 0.0;
    var totalNet = 0.0;
    var totalCustody = 0.0;

    for (final s in staff) {
      final financialId = StaffFinanceUtils.financialId(s);
      final base = StaffFinanceUtils.amount(s['baseSalary']).clamp(0.0, double.infinity).toDouble();
      var allowances = 0.0;
      var deductions = 0.0;
      for (final e in entries) {
        if (!StaffFinanceUtils.matchesRecord(e, s)) continue;
        final d = e['date']?.toString() ?? '';
        if (!d.startsWith(month)) continue;
        final status = (e['status'] ?? '').toString().toLowerCase();
        if (const {'مسودة', 'ملغي', 'ملغى', 'ملغاة', 'ملغية', 'محذوف', 'cancelled', 'canceled', 'deleted'}.contains(status)) continue;
        final amt = StaffFinanceUtils.amount(e['amount']).clamp(0.0, double.infinity).toDouble();
        final type = e['type']?.toString() ?? '';
        if (type == 'allowance') {
          allowances += amt;
        } else if (type == 'deduction') {
          deductions += amt;
        }
      }

      // خصم العُهد النشطة
      final active = allCustodies.where((c) =>
          app.sameCompany(c) &&
          StaffFinanceUtils.matchesRecord(c, s) &&
          c['status']?.toString() != 'مسددة' &&
          ((c['remaining'] as num?)?.toDouble() ?? 0) > 0).toList();
      final gross = (base + allowances - deductions).clamp(0.0, double.infinity).toDouble();
      var custodyDeduct = 0.0;
      var budget = gross;
      for (final c in active) {
        final rem = (c['remaining'] as num?)?.toDouble() ?? 0;
        final take = rem <= budget ? rem : budget;
        if (take <= 0) continue;
        budget -= take;
        custodyDeduct += take;
        totalCustody += take;
        final idx = allCustodies.indexWhere((item) => item['id']?.toString() == c['id']?.toString());
        if (idx >= 0) {
          allCustodies[idx] = {
            ...c,
          'deducted': ((c['deducted'] as num?)?.toDouble() ?? 0) + take,
          'remaining': rem - take,
          'status': (rem - take) <= 0 ? 'مسددة' : 'نشطة',
          };
        }
      }

      final net = (gross - custodyDeduct).clamp(0.0, double.infinity).toDouble();
      totalGross += gross;
      totalNet += net;
      rows.add({
        'staffFinancialId': financialId,
        'staffId': financialId,
        'employeeId': s['id']?.toString() ?? '',
        'staffName': s['name']?.toString() ?? '',
        'staffIdentity': s['identity']?.toString() ?? financialId,
        'base': base,
        'allowances': allowances,
        'deductions': deductions,
        'gross': gross,
        'custodyDeduction': custodyDeduct,
        'net': net,
      });
    }
    if (totalGross <= 0) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('إجمالي المسير يجب أن يكون أكبر من صفر.', style: TextStyle(fontFamily: 'Cairo'))),
        );
      }
      return;
    }

    final parts = month.split('-').map(int.parse).toList();
    final accrualDate = DateTime.utc(parts[0], parts[1] + 1, 0).toIso8601String().substring(0, 10);
    final payroll = {
      'id': 'PAY-${now.millisecondsSinceEpoch}',
      'companyOwnerId': app.ownerId,
      'period': month,
      'accrualDate': accrualDate,
      'status': 'مستحق',
      'rows': rows,
      'totalGross': totalGross,
      'totalNet': totalNet,
      'totalCustodyDeducted': totalCustody,
      'createdBy': app.session!.id,
      'createdAt': now.toIso8601String(),
      'createdAtMs': now.millisecondsSinceEpoch,
    };
    final payrollPosted = await FinanceJournal.postPayrollAccrual(app, payroll);
    if (!payrollPosted) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('تعذر ترحيل قيد استحقاق الرواتب؛ راجع المسير.', style: TextStyle(fontFamily: 'Cairo'))),
        );
      }
      return;
    }
    await app.append(AppConstants.kPayrolls, payroll);
    await app.storage.write(AppConstants.kCustodies, allCustodies);
    await app.logActivity('إنشاء مسير رواتب', entityType: 'payroll', entityId: payroll['id'] as String);
    if (mounted) {
      setState(() {});
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('تم اعتماد مسير ${_monthLabel(month)} كمستحق بصافي ${AppUtils.money(totalNet)}.', style: const TextStyle(fontFamily: 'Cairo'))));
    }
  }

  Future<void> _showPayrollPaymentDialog(AppState app, Map<String, dynamic> payroll) async {
    if (StaffFinanceUtils.isPaidPayroll(payroll)) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('المسير مسدد بالفعل.', style: TextStyle(fontFamily: 'Cairo'))),
        );
      }
      return;
    }
    final dateCtrl = TextEditingController(text: AppUtils.dateVal());
    final noteCtrl = TextEditingController();
    var method = 'تحويل بنكي';
    await showDialog<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: Text('صرف رواتب ${_monthLabel(payroll['period']?.toString() ?? '')}', style: const TextStyle(fontFamily: 'Cairo')),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('صافي المبلغ المطلوب صرفه: ${AppUtils.money(payroll['totalNet'])}',
                  style: const TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w700)),
              AppField(label: 'تاريخ الصرف', controller: dateCtrl, hint: 'YYYY-MM-DD'),
              AppDropdown<String>(
                label: 'طريقة الصرف',
                value: method,
                items: const ['تحويل بنكي', 'نقداً', 'شبكة', 'شيك'],
                labelOf: (value) => value,
                onChanged: (value) => setDialogState(() => method = value ?? method),
              ),
              AppField(label: 'مرجع / بيان الصرف', controller: noteCtrl, maxLines: 2),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('إلغاء', style: TextStyle(fontFamily: 'Cairo'))),
            FilledButton(
              onPressed: () async {
                if (dateCtrl.text.trim().isEmpty) return;
                Navigator.pop(ctx);
                await _payPayroll(app, payroll, dateCtrl.text.trim(), method, noteCtrl.text.trim());
              },
              child: const Text('تأكيد الصرف', style: TextStyle(fontFamily: 'Cairo')),
            ),
          ],
        ),
      ),
    );
    dateCtrl.dispose();
    noteCtrl.dispose();
  }

  Future<void> _payPayroll(
    AppState app,
    Map<String, dynamic> payroll,
    String date,
    String method,
    String note,
  ) async {
    final current = app.allPayrolls.firstWhere(
      (item) => app.sameCompany(item) && item['id']?.toString() == payroll['id']?.toString(),
      orElse: () => const {},
    );
    if (current.isEmpty || StaffFinanceUtils.isPaidPayroll(current)) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('المسير غير موجود أو مسدد بالفعل.', style: TextStyle(fontFamily: 'Cairo'))),
        );
      }
      return;
    }
    final now = DateTime.now();
    final entries = app.allFinancialEntries.map((x) => Map<String, dynamic>.from(x)).toList();
    final rows = ((current['rows'] as List?) ?? const []).whereType<Map>().map((x) => Map<String, dynamic>.from(x)).toList();
    for (var index = 0; index < rows.length; index++) {
      final row = rows[index];
      final financialId = StaffFinanceUtils.normalizeRef(
          row['staffFinancialId'] ?? row['staffId'] ?? row['staffIdentity'] ?? row['employeeId']);
      final alreadyRecorded = entries.any((entry) =>
          entry['payrollId']?.toString() == current['id']?.toString() &&
          StaffFinanceUtils.recordRefs(entry).contains(financialId));
      final amount = StaffFinanceUtils.amount(row['net']).clamp(0.0, double.infinity).toDouble();
      if (alreadyRecorded || amount <= 0) continue;
      entries.insert(0, {
        'id': 'FIN-${now.millisecondsSinceEpoch}-SAL-$index',
        'companyOwnerId': app.ownerId,
        'type': 'salary',
        'direction': 'out',
        'amount': amount,
        'date': date,
        'description': 'صرف راتب ${row['staffName'] ?? financialId} عن ${_monthLabel(current['period']?.toString() ?? '')}',
        'staffFinancialId': financialId,
        'staffId': financialId,
        'employeeId': row['employeeId'] ?? '',
        'staffIdentity': row['staffIdentity'] ?? financialId,
        'payrollId': current['id'],
        'status': 'مدفوع',
        'paymentMethod': method,
        'paymentLabel': 'راتب',
        'createdBy': app.session!.id,
        'createdAt': now.toIso8601String(),
        'createdAtMs': now.millisecondsSinceEpoch + index,
      });
    }
    final updated = Map<String, dynamic>.from(current)
      ..['status'] = 'مسدد'
      ..['paidDate'] = date
      ..['paymentMethod'] = method
      ..['paymentReference'] = note
      ..['paidBy'] = app.session!.id
      ..['paidAt'] = now.toIso8601String()
      ..['paidAtMs'] = now.millisecondsSinceEpoch;
    final paymentPosted = await FinanceJournal.postPayrollPayment(app, updated);
    if (!paymentPosted) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('تعذر ترحيل قيد صرف الرواتب؛ لم يتم اعتماد الصرف.', style: TextStyle(fontFamily: 'Cairo'))),
        );
      }
      return;
    }
    await app.storage.write('misadFinancialEntries', entries);
    await app.update(AppConstants.kPayrolls, updated);
    await app.logActivity('صرف مسير رواتب', entityType: 'payroll', entityId: current['id']?.toString() ?? '');
    if (mounted) {
      setState(() {});
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('تم تسجيل صرف الرواتب وإصدار سند لكل موظف.', style: TextStyle(fontFamily: 'Cairo'))),
      );
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
