import 'package:flutter/material.dart';
import '../../core/constants.dart';
import '../../core/utils.dart';
import '../../models/contract.dart';
import '../../state/app_state.dart';
import '../../state/business_rules.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// فواتير العملاء: إنشاء فاتورة على عقد، تحصيل الدفعات، وعرض التفاصيل.
class CustomerInvoicesScreen extends StatefulWidget {
  const CustomerInvoicesScreen({super.key});

  @override
  State<CustomerInvoicesScreen> createState() => _CustomerInvoicesScreenState();
}

class _CustomerInvoicesScreenState extends State<CustomerInvoicesScreen> {
  bool _showForm = false;

  // نموذج الفاتورة
  String? _contractId;
  final _invoiceNoCtrl = TextEditingController();
  final _dateCtrl = TextEditingController();
  final _dueDateCtrl = TextEditingController();
  final _taxRateCtrl = TextEditingController(text: '15');
  final _discountCtrl = TextEditingController(text: '0');
  final _notesCtrl = TextEditingController();
  final _items = <({TextEditingController desc, TextEditingController qty, TextEditingController price})>[];

  // تحصيل
  final _payAmountCtrl = TextEditingController();
  final _payDateCtrl = TextEditingController();
  final _payNoteCtrl = TextEditingController();
  String _payMethod = 'نقداً';
  Map<String, dynamic>? _payingInvoice;

  @override
  void dispose() {
    _invoiceNoCtrl.dispose();
    _dateCtrl.dispose();
    _dueDateCtrl.dispose();
    _taxRateCtrl.dispose();
    _discountCtrl.dispose();
    _notesCtrl.dispose();
    for (final it in _items) {
      it.desc.dispose();
      it.qty.dispose();
      it.price.dispose();
    }
    _payAmountCtrl.dispose();
    _payDateCtrl.dispose();
    _payNoteCtrl.dispose();
    super.dispose();
  }

  /// حساب حالة الفاتورة ومبالغها (مطابق customerInvoiceInfo في web).
  static ({double paid, double total, double due, String status}) invoiceInfo(Map<String, dynamic> inv) {
    final payments = (inv['payments'] as List?) ?? const [];
    var paid = (inv['paid'] as num?)?.toDouble() ?? 0;
    for (final p in payments) {
      paid += (p['amount'] as num?)?.toDouble() ?? 0;
    }
    final total = (inv['total'] as num?)?.toDouble() ?? 0;
    final due = (total - paid).clamp(0.0, double.infinity).toDouble();
    final status = inv['status']?.toString() == 'ملغاة'
        ? 'ملغاة'
        : (due <= 0 && total > 0)
            ? 'مدفوعة'
            : (paid > 0)
                ? 'جزئية'
                : 'مستحقة';
    return (paid: paid, total: total, due: due, status: status);
  }

  String _clientLabel(AppState app, Map<String, dynamic> inv) {
    final name = inv['clientName']?.toString() ?? '';
    if (name.isNotEmpty) return name;
    for (final c in app.allContracts) {
      if (c.id == inv['contractId']?.toString()) return c.clientLabel;
    }
    return inv['clientCompanyName']?.toString() ?? '—';
  }

  void _addItemRow() {
    setState(() {
      _items.add((
        desc: TextEditingController(),
        qty: TextEditingController(text: '1'),
        price: TextEditingController(text: ''),
      ));
    });
  }

  Future<void> _createInvoice() async {
    final app = AppState.instance;
    final now = DateTime.now();
    if (_contractId == null) {
      _snack('اختر العقد أولاً.');
      return;
    }
    final items = <Map<String, dynamic>>[];
    for (final it in _items) {
      final desc = it.desc.text.trim();
      final qty = double.tryParse(it.qty.text) ?? 1;
      final price = double.tryParse(it.price.text) ?? 0;
      if (desc.isNotEmpty && price > 0) items.add({'description': desc, 'qty': qty, 'unitPrice': price});
    }
    if (items.isEmpty) {
      _snack('أضف بنداً واحداً على الأقل.');
      return;
    }
    final taxRate = double.tryParse(_taxRateCtrl.text) ?? 0;
    final discount = double.tryParse(_discountCtrl.text) ?? 0;
    var subtotal = 0.0;
    for (final it in items) {
      subtotal += (it['qty'] as double) * (it['unitPrice'] as double);
    }
    final tax = subtotal * taxRate / 100;
    final total = (subtotal + tax - discount).clamp(0.0, double.infinity).toDouble();

    Contract? c;
    for (final x in app.allContracts) {
      if (x.id == _contractId) { c = x; break; }
    }

    final invoices = List<Map<String, dynamic>>.from(app.allCustomerInvoices);
    final invNo = _invoiceNoCtrl.text.trim().isNotEmpty
        ? _invoiceNoCtrl.text.trim()
        : 'CINV-${invoices.length + 1}';
    final inv = <String, dynamic>{
      'id': 'CINV-${now.millisecondsSinceEpoch}',
      'companyOwnerId': app.ownerId,
      'invoiceNo': invNo,
      'contractId': _contractId,
      'clientId': c?.clientId ?? '',
      'clientName': c?.clientLabel ?? '',
      'clientCompanyName': c?.clientCompanyName ?? '',
      'clientCompanyUnifiedNumber': c?.clientCompanyUnifiedNumber ?? '',
      'date': _dateCtrl.text.isNotEmpty ? _dateCtrl.text : AppUtils.dateVal(now),
      'dueDate': _dueDateCtrl.text,
      'items': items,
      'taxRate': taxRate,
      'discount': discount,
      'subtotal': subtotal,
      'tax': tax,
      'total': total,
      'paid': 0,
      'payments': [],
      'notes': _notesCtrl.text,
      'status': 'مستحقة',
      'createdAt': now.toIso8601String(),
      'createdAtMs': now.millisecondsSinceEpoch,
      'createdBy': app.session!.id,
    };
    invoices.insert(0, inv);
    await app.storage.write(AppConstants.kCustomerInvoices, invoices);
    await app.logActivity('فاتورة عميل', entityType: 'customer-invoice', entityId: inv['id'] as String);
    if (!mounted) return;
    setState(() {
      _showForm = false;
      _contractId = null;
      _invoiceNoCtrl.clear();
      _dateCtrl.clear();
      _dueDateCtrl.clear();
      _notesCtrl.clear();
      for (final it in _items) {
        it.desc.dispose();
        it.qty.dispose();
        it.price.dispose();
      }
      _items.clear();
    });
    _snack('تم حفظ الفاتورة $invNo.');
  }

  void _openPay(Map<String, dynamic> inv) {
    final info = invoiceInfo(inv);
    if (info.due <= 0) {
      _snack('الفاتورة مسددة.');
      return;
    }
    setState(() {
      _payingInvoice = inv;
      _payAmountCtrl.text = info.due.toStringAsFixed(2);
      _payDateCtrl.text = AppUtils.dateVal();
      _payNoteCtrl.clear();
    });
    showDialog<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => _payDialog(ctx, setDialogState),
      ),
    );
  }

  Future<void> _submitPay(BuildContext dialogContext, VoidCallback setDialogState) async {
    final app = AppState.instance;
    final inv = _payingInvoice;
    if (inv == null) return;
    final now = DateTime.now();
    final info = invoiceInfo(inv);
    final amount = double.tryParse(_payAmountCtrl.text) ?? 0;
    if (amount <= 0 || amount > info.due) {
      _snack('مبلغ غير صحيح (الحد الأقصى ${AppUtils.money(info.due)}).');
      setDialogState();
      return;
    }
    final pay = <String, dynamic>{
      'amount': amount,
      'date': _payDateCtrl.text.isNotEmpty ? _payDateCtrl.text : AppUtils.dateVal(),
      'paymentMethod': _payMethod,
      'note': _payNoteCtrl.text,
    };
    final invoices = List<Map<String, dynamic>>.from(app.allCustomerInvoices);
    final idx = invoices.indexWhere((x) => x['id']?.toString() == inv['id']?.toString());
    if (idx < 0) return;
    final updated = Map<String, dynamic>.from(invoices[idx]);
    final payments = List<Map<String, dynamic>>.from((updated['payments'] as List?) ?? const []);
    payments.add(pay);
    updated['payments'] = payments;
    updated['paid'] = info.paid + amount;
    updated['status'] = invoiceInfo(updated).status;
    invoices[idx] = updated;
    await app.storage.write(AppConstants.kCustomerInvoices, invoices);

    final entry = <String, dynamic>{
      'id': 'FIN-${now.millisecondsSinceEpoch}',
      'companyOwnerId': app.ownerId,
      'type': 'sale',
      'direction': 'in',
      'amount': amount,
      'date': pay['date'],
      'description': 'تحصيل فاتورة عميل: ${updated['invoiceNo']} - ${updated['clientName']}',
      'contractId': updated['contractId'] ?? '',
      'clientId': updated['clientId'] ?? '',
      'clientName': updated['clientName'] ?? '',
      'paymentMethod': _payMethod,
      'status': 'معتمد',
      'invoiceId': updated['id'],
      'createdBy': app.session!.id,
      'createdAt': now.toIso8601String(),
      'createdAtMs': now.millisecondsSinceEpoch,
    };
    await app.append('misadFinancialEntries', entry);

    // مستخلص تلقائي (مطابق ensureClaimForEntry)
    final claims = List<Map<String, dynamic>>.from(app.allClaims);
    final claim = BusinessRules.ensureClaimForEntry(entry, claims);
    if (claim != null) {
      claims.add(claim);
      await app.storage.write(AppConstants.kClaims, claims);
    }
    await app.logActivity('تحصيل فاتورة',
        entityType: 'customer-invoice', entityId: updated['id']?.toString() ?? '');
    if (mounted) {
      setState(() {
        _payingInvoice = null;
        _payAmountCtrl.clear();
        _payDateCtrl.clear();
        _payNoteCtrl.clear();
      });
    }
    if (dialogContext.mounted) Navigator.pop(dialogContext);
    _snack('تم تسجيل التحصيل.');
  }

  void _showDetail(AppState app, Map<String, dynamic> inv) {
    final info = invoiceInfo(inv);
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.bg,
      builder: (ctx) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.9,
        maxChildSize: 0.95,
        builder: (ctx, scroll) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Row(
              children: [
                const Expanded(
                  child: Text('تفاصيل الفاتورة',
                      style: TextStyle(fontFamily: 'Cairo', fontSize: 16, fontWeight: FontWeight.w800)),
                ),
                IconButton(
                  icon: const Icon(Icons.close_rounded),
                  onPressed: () => Navigator.pop(ctx),
                ),
              ],
            ),
            Text('${inv['invoiceNo']} — ${_clientLabel(app, inv)}',
                style: const TextStyle(fontFamily: 'Cairo', fontSize: 14, fontWeight: FontWeight.w700)),
            const SizedBox(height: 12),
            GridView.count(
              crossAxisCount: 3,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 8,
              crossAxisSpacing: 8,
              children: [
                StatCard(label: 'الإجمالي', value: AppUtils.money(info.total), icon: Icons.receipt_rounded, color: AppTheme.primary),
                StatCard(label: 'المحصل', value: AppUtils.money(info.paid), icon: Icons.check_circle_rounded, color: AppTheme.success),
                StatCard(label: 'المتبقي', value: AppUtils.money(info.due), icon: Icons.schedule_rounded, color: info.due > 0 ? AppTheme.gold : AppTheme.success),
              ],
            ),
            const SizedBox(height: 14),
            const _SectionLabel('بنود الفاتورة'),
            ...((inv['items'] as List?) ?? const []).map<Widget>((it) {
              final qty = (it['qty'] as num?)?.toDouble() ?? 1;
              final price = (it['unitPrice'] as num?)?.toDouble() ?? 0;
              return ListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                title: Text(it['description']?.toString() ?? '—', style: const TextStyle(fontFamily: 'Cairo', fontSize: 12.5)),
                subtitle: Text('الكمية $qty × ${AppUtils.money(price)}', style: const TextStyle(fontFamily: 'Cairo', fontSize: 11, color: AppTheme.textMuted)),
                trailing: Text(AppUtils.money(qty * price), style: const TextStyle(fontFamily: 'Cairo', fontSize: 12.5, fontWeight: FontWeight.w700)),
              );
            }),
            const SizedBox(height: 10),
            const _SectionLabel('سجل التحصيل'),
            if (((inv['payments'] as List?) ?? const []).isEmpty)
              const Padding(
                padding: EdgeInsets.all(8),
                child: Text('لا توجد دفعات محصلة', style: TextStyle(fontFamily: 'Cairo', color: AppTheme.textMuted, fontSize: 12)),
              )
            else
              ...((inv['payments'] as List?) ?? const []).map<Widget>((p) => ListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    title: Text('${p['date']} — ${p['paymentMethod']}', style: const TextStyle(fontFamily: 'Cairo', fontSize: 12.5)),
                    subtitle: Text(p['note']?.toString() ?? '', style: const TextStyle(fontFamily: 'Cairo', fontSize: 11, color: AppTheme.textMuted)),
                    trailing: Text(AppUtils.money(p['amount']), style: const TextStyle(fontFamily: 'Cairo', fontSize: 12.5, fontWeight: FontWeight.w700, color: AppTheme.success)),
                  )),
            if (info.due > 0)
              Padding(
                padding: const EdgeInsets.only(top: 16),
                child: FilledButton.icon(
                  onPressed: () {
                    Navigator.pop(ctx);
                    _openPay(inv);
                  },
                  icon: const Icon(Icons.payments_rounded),
                  label: const Text('تحصيل', style: TextStyle(fontFamily: 'Cairo')),
                ),
              ),
          ],
        ),
      ),
    );
  }

  void _snack(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg, style: const TextStyle(fontFamily: 'Cairo'))));
  }

  @override
  Widget build(BuildContext context) {
    final app = AppState.instance;
    if (!app.session!.isOwner) {
      return const Scaffold(
        backgroundColor: AppTheme.bg,
        body: EmptyState('غير متاح لدورك.', icon: Icons.lock_outline),
      );
    }
    final invoices = app.allCustomerInvoices.where(app.sameCompany).toList()
      ..sort((a, b) => ((b['createdAtMs'] as num?)?.toInt() ?? 0).compareTo((a['createdAtMs'] as num?)?.toInt() ?? 0));
    final contracts = app.allContracts.where((c) => app.sameCompany(c.toJson())).toList();

    return Scaffold(
      backgroundColor: AppTheme.bg,
      floatingActionButton: Fab(onPressed: () => setState(() => _showForm = !_showForm), label: 'فاتورة جديدة'),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 90),
        children: [
          if (_showForm) _buildForm(app, contracts),
          const PageTitle('فواتير العملاء'),
          if (invoices.isEmpty)
            const EmptyState('لا توجد فواتير عملاء', icon: Icons.receipt_long_rounded)
          else
            for (final inv in invoices)
              _buildInvoiceTile(app, inv),
        ],
      ),
    );
  }

  Widget _buildForm(AppState app, List<Contract> contracts) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SectionHeader(1, 'فاتورة عميل جديدة'),
            if (contracts.isEmpty)
              const Padding(
                padding: EdgeInsets.all(8),
                child: Text('لا توجد عقود، أنشئ عقداً أولاً.',
                    style: TextStyle(fontFamily: 'Cairo', color: AppTheme.textMuted, fontSize: 12)),
              )
            else ...[
              AppDropdown<String>(
                label: 'العقد / العميل',
                value: _contractId,
                items: [for (final c in contracts) c.id],
                labelOf: (id) => '${id} — ${contracts.firstWhere((c) => c.id == id).clientLabel}',
                onChanged: (v) => setState(() => _contractId = v),
              ),
            ],
            AppField(label: 'رقم الفاتورة (اختياري)', controller: _invoiceNoCtrl),
            AppField(label: 'التاريخ', controller: _dateCtrl, hint: 'YYYY-MM-DD'),
            AppField(label: 'تاريخ الاستحقاق (اختياري)', controller: _dueDateCtrl, hint: 'YYYY-MM-DD'),
            const SizedBox(height: 6),
            const Text('بنود الفاتورة', style: TextStyle(fontFamily: 'Cairo', fontSize: 12.5, fontWeight: FontWeight.w700)),
            for (final it in _items)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Row(
                  children: [
                    Expanded(
                      flex: 3,
                      child: TextField(
                        controller: it.desc,
                        decoration: const InputDecoration(labelText: 'الوصف', isDense: true),
                        style: const TextStyle(fontFamily: 'Cairo', fontSize: 12),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      flex: 2,
                      child: TextField(
                        controller: it.qty,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(labelText: 'الكمية', isDense: true),
                        style: const TextStyle(fontFamily: 'Cairo', fontSize: 12),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      flex: 3,
                      child: TextField(
                        controller: it.price,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(labelText: 'سعر الوحدة (ر.س)', isDense: true),
                        style: const TextStyle(fontFamily: 'Cairo', fontSize: 12),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, size: 18, color: AppTheme.textMuted),
                      onPressed: () => setState(() => _items.remove(it)),
                    ),
                  ],
                ),
              ),
            TextButton.icon(
              onPressed: _addItemRow,
              icon: const Icon(Icons.add_rounded, size: 18),
              label: const Text('إضافة بند', style: TextStyle(fontFamily: 'Cairo')),
            ),
            AppField(label: 'الضريبة (%)', keyboard: TextInputType.number, controller: _taxRateCtrl),
            AppField(label: 'الخصم (ر.س)', keyboard: TextInputType.number, controller: _discountCtrl),
            AppField(label: 'ملاحظات', controller: _notesCtrl, maxLines: 2),
            const SizedBox(height: 10),
            ElevatedButton(onPressed: _createInvoice, child: const Text('حفظ الفاتورة')),
          ],
        ),
      ),
    );
  }

  Widget _buildInvoiceTile(AppState app, Map<String, dynamic> inv) {
    final info = invoiceInfo(inv);
    final payments = (inv['payments'] as List?) ?? const [];
    return ListCard(
      leadingIcon: Icon(info.due > 0 ? Icons.receipt_long_rounded : Icons.task_alt_rounded,
          color: info.due > 0 ? AppTheme.gold : AppTheme.success),
      title: '${inv['invoiceNo'] ?? inv['id']} — ${_clientLabel(app, inv)}',
      subtitle: '${inv['date']} • ${AppUtils.money(info.total)}',
      trailing: AppUtils.money(info.due),
      trailingWidget: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          StatusBadge(info.status),
          if (payments.isNotEmpty)
            Text('${payments.length} دفعة', style: const TextStyle(fontFamily: 'Cairo', fontSize: 10, color: AppTheme.textMuted)),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (info.due > 0)
                IconButton(
                  padding: const EdgeInsets.all(2),
                  constraints: const BoxConstraints(),
                  icon: const Icon(Icons.payments_rounded, size: 20, color: AppTheme.success),
                  onPressed: () => _openPay(inv),
                ),
              IconButton(
                padding: const EdgeInsets.all(2),
                constraints: const BoxConstraints(),
                icon: const Icon(Icons.info_outline_rounded, size: 20, color: AppTheme.primary),
                onPressed: () => _showDetail(app, inv),
              ),
            ],
          ),
        ],
      ),
    );
  }

  /// حوار تحصيل فاتورة.
  Widget _payDialog(BuildContext dialogContext, VoidCallback setDialogState) {
    final inv = _payingInvoice;
    if (inv == null) return const SizedBox.shrink();
    final info = invoiceInfo(inv);
    return AlertDialog(
      title: const Text('تحصيل فاتورة عميل', style: TextStyle(fontFamily: 'Cairo')),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('المتبقي من ${inv['invoiceNo']}: ${AppUtils.money(info.due)}',
              style: const TextStyle(fontFamily: 'Cairo', fontSize: 12, color: AppTheme.textMuted)),
          const SizedBox(height: 8),
          AppField(label: 'المبلغ (ر.س)', keyboard: TextInputType.number, controller: _payAmountCtrl),
          AppField(label: 'التاريخ', controller: _payDateCtrl, hint: 'YYYY-MM-DD'),
          AppDropdown<String>(
            label: 'طريقة الدفع',
            value: _payMethod,
            items: const ['نقداً', 'تحويل بنكي', 'شيك', 'شبكة'],
            labelOf: (v) => v,
            onChanged: (v) => setDialogState(() => _payMethod = v!),
          ),
          AppField(label: 'بيان', controller: _payNoteCtrl),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(dialogContext),
          child: const Text('إلغاء', style: TextStyle(fontFamily: 'Cairo')),
        ),
        FilledButton(
          onPressed: () => _submitPay(dialogContext, setDialogState),
          child: const Text('تسجيل التحصيل', style: TextStyle(fontFamily: 'Cairo')),
        ),
      ],
    );
  }
}

/// عنوان قسم فرعي في التفاصيل.
class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Text(text, style: const TextStyle(fontFamily: 'Cairo', fontSize: 13, fontWeight: FontWeight.w800)),
    );
  }
}
