import 'package:flutter/material.dart';
import '../../core/constants.dart';
import '../../core/utils.dart';
import '../../finance/finance_journal.dart';
import '../../models/contract.dart';
import '../../pdf/pdf_generator.dart';
import '../../state/app_state.dart';
import '../../state/business_rules.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// سندات القبض + إصدار سند جديد مع عقد.
class ReceiptsScreen extends StatefulWidget {
  const ReceiptsScreen({super.key});

  @override
  State<ReceiptsScreen> createState() => _ReceiptsScreenState();
}

class _ReceiptsScreenState extends State<ReceiptsScreen> {
  final _amountCtrl = TextEditingController();
  final _detailsCtrl = TextEditingController();
  String _purpose = 'دفعة عقد';
  String _paymentMethod = 'نقداً';
  String? _contractId;
  bool _showForm = false;

  @override
  void dispose() {
    _amountCtrl.dispose();
    _detailsCtrl.dispose();
    super.dispose();
  }

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
    final receipts = app.allReceipts.where(app.sameCompany).toList()
      ..sort((a, b) => ((b['createdAtMs'] as num?)?.toInt() ?? 0).compareTo((a['createdAtMs'] as num?)?.toInt() ?? 0));

    final contracts = app.allContracts.where((c) => app.sameCompany(c.toJson())).toList();

    return Scaffold(
      backgroundColor: AppTheme.bg,
      floatingActionButton: Fab(onPressed: () => setState(() => _showForm = !_showForm), label: 'سند قبض'),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 90),
        children: [
          if (_showForm)
            Card(
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SectionHeader(1, 'إصدار سند قبض'),
                    if (contracts.isNotEmpty)
                      AppDropdown<String>(
                        label: 'العقد',
                        value: _contractId,
                        items: [for (final c in contracts) c.id],
                        labelOf: (id) => '${id} — ${contracts.firstWhere((c) => c.id == id).clientLabel}',
                        onChanged: (v) => setState(() => _contractId = v),
                      ),
                    AppDropdown<String>(
                      label: 'الغرض',
                      value: _purpose,
                      items: const ['دفعة عقد', 'سداد كامل', 'مقدم العقد', 'صيانة', 'أخرى'],
                      labelOf: (v) => v,
                      onChanged: (v) => setState(() => _purpose = v!),
                    ),
                    AppDropdown<String>(
                      label: 'طريقة الدفع',
                      value: _paymentMethod,
                      items: const ['نقداً', 'تحويل بنكي', 'شيك', 'شبكة'],
                      labelOf: (v) => v,
                      onChanged: (v) => setState(() => _paymentMethod = v!),
                    ),
                    AppField(label: 'المبلغ (ر.س)', keyboard: TextInputType.number, controller: _amountCtrl),
                    AppField(label: 'تفاصيل', controller: _detailsCtrl),
                    const SizedBox(height: 10),
                    ElevatedButton(onPressed: _issue, child: const Text('إصدار السند')),
                  ],
                ),
              ),
            ),

          const PageTitle('سندات القبض'),
          if (receipts.isEmpty)
            const EmptyState('لا توجد سندات قبض')
          else
            for (final r in receipts)
              ListCard(
                leadingIcon: const Icon(Icons.receipt_rounded, color: AppTheme.gold),
                title: r['id'].toString(),
                subtitle: '${r['purpose']} • ${AppUtils.fmtDateTime(r['createdAtMs'])}',
                trailing: AppUtils.money(r['amount']),
                trailingWidget: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    StatusBadge(r['status']?.toString()),
                    IconButton(
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                      icon: const Icon(Icons.print_rounded, size: 20, color: AppTheme.primary),
                      onPressed: () => _print(r),
                    ),
                  ],
                ),
              ),
        ],
      ),
    );
  }

  Future<void> _print(Map<String, dynamic> r) async {
    final app = AppState.instance;
    try {
      await PdfGenerator.sharePdf('سند قبض',
          PdfGenerator.receiptContent(r, app.myOwnerCompany),
          ownerCompany: app.myOwnerCompany);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تعذر إنشاء PDF.', style: TextStyle(fontFamily: 'Cairo'))));
      }
    }
  }

  Future<void> _issue() async {
    final app = AppState.instance;
    final now = DateTime.now();
    final amount = double.tryParse(_amountCtrl.text) ?? 0;
    if (amount <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('أدخل مبلغاً صحيحاً.', style: TextStyle(fontFamily: 'Cairo'))));
      return;
    }
    Contract? c;
    if (_contractId != null) {
      for (final x in app.allContracts) { if (x.id == _contractId) { c = x; break; } }
    }
    if (c != null) {
      final remaining = (BusinessRules.contractFinance(c, app.allFinancialEntries)['remaining'] as num?)?.toDouble() ?? 0;
      if (amount > remaining + 0.005) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('المبلغ يتجاوز المتبقي على العقد (${AppUtils.money(remaining)}).', style: const TextStyle(fontFamily: 'Cairo')),
        ));
        return;
      }
    }
    final receipt = <String, dynamic>{
      'id': 'RCT-${now.millisecondsSinceEpoch}',
      'companyOwnerId': app.ownerId,
      'contractId': c?.id ?? '',
      'clientId': c?.clientId ?? '',
      'clientName': c?.clientName ?? '',
      'clientCompanyName': c?.clientCompanyName ?? '',
      'clientCompanyUnifiedNumber': c?.clientCompanyUnifiedNumber ?? '',
      'amount': amount,
      'date': AppUtils.dateVal(now),
      'purpose': _purpose,
      'purposeKey': _purpose,
      'paymentMethod': _paymentMethod,
      'details': _detailsCtrl.text,
      'status': 'معتمد',
      'createdAt': now.toIso8601String(),
      'createdAtMs': now.millisecondsSinceEpoch,
      'createdBy': app.session!.id,
    };
    final posted = await FinanceJournal.postReceipt(app, receipt);
    if (!posted) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تعذر ترحيل سند القبض محاسبياً.', style: TextStyle(fontFamily: 'Cairo'))));
      }
      return;
    }
    await app.append('misadReceipts', receipt);

    // قيد مالي مقترن بالسند (مطابق web)
    final entry = {
      'id': 'FIN-${now.millisecondsSinceEpoch}',
      'companyOwnerId': app.ownerId,
      'type': 'sale',
      'direction': 'in',
      'amount': amount,
      'date': AppUtils.dateVal(now),
      'description': 'سند قبض: ${receipt['id']} — ${_purpose}',
      'contractId': c?.id ?? '',
      'status': 'معتمد',
      'paymentMethod': _paymentMethod,
      'paymentLabel': _purpose,
      'receiptId': receipt['id'],
      'collectionForStatus': 'ساري',
      'createdBy': app.session!.id,
      'createdAt': now.toIso8601String(),
      'createdAtMs': now.millisecondsSinceEpoch,
    };
    await app.append('misadFinancialEntries', entry);

    // مستخلص تلقائي
    final claims = List<Map<String, dynamic>>.from(app.allClaims);
    final claim = BusinessRules.ensureClaimForEntry(entry, claims);
    if (claim != null) {
      claims.add(claim);
      await app.storage.write(AppConstants.kClaims, claims);
    }
    await app.logActivity('إصدار سند قبض', entityType: 'receipt', entityId: receipt['id'] as String);
    if (!mounted) return;
    setState(() { _showForm = false; _amountCtrl.clear(); _detailsCtrl.clear(); });
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم إصدار السند.', style: TextStyle(fontFamily: 'Cairo'))));
  }
}
