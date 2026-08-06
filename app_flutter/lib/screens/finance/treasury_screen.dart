import 'package:flutter/material.dart';
import '../../core/constants.dart';
import '../../core/utils.dart';
import '../../pdf/pdf_generator.dart';
import '../../state/app_state.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// الخزينة والبنوك: حسابات بنكية + حركات خزينة (إيداع/سحب/تحويل/رصيد افتتاحي).
class TreasuryScreen extends StatefulWidget {
  const TreasuryScreen({super.key});

  /// واجهة عامة لحساب حالة الخزينة (تستخدم في التقارير واللوحات الأخرى).
  static ({double cash, List<Map<String, dynamic>> banks, double total, List<Map<String, dynamic>> tx})
      computeState(AppState app) => _TreasuryScreenState.treasuryState(app);

  @override
  State<TreasuryScreen> createState() => _TreasuryScreenState();
}

class _TreasuryScreenState extends State<TreasuryScreen> {
  bool _showMoveForm = false;
  bool _showBankForm = false;

  // نموذج الحساب البنكي
  final _bankNameCtrl = TextEditingController();
  final _accountNameCtrl = TextEditingController();
  final _accountNumberCtrl = TextEditingController();
  final _ibanCtrl = TextEditingController();
  final _openingCtrl = TextEditingController(text: '0');

  // نموذج حركة الخزينة
  final _moveAmountCtrl = TextEditingController();
  final _moveDateCtrl = TextEditingController();
  final _moveNoteCtrl = TextEditingController();
  String _moveType = 'deposit';
  String _moveAccount = 'cash';
  String _moveFrom = 'cash';
  String _moveTo = 'cash';

  // تعديل حساب بنكي
  String? _editingBankId;
  final _editBankNameCtrl = TextEditingController();
  final _editAccountNameCtrl = TextEditingController();
  final _editAccountNumberCtrl = TextEditingController();
  final _editIbanCtrl = TextEditingController();

  @override
  void dispose() {
    _bankNameCtrl.dispose();
    _accountNameCtrl.dispose();
    _accountNumberCtrl.dispose();
    _ibanCtrl.dispose();
    _openingCtrl.dispose();
    _moveAmountCtrl.dispose();
    _moveDateCtrl.dispose();
    _moveNoteCtrl.dispose();
    _editBankNameCtrl.dispose();
    _editAccountNameCtrl.dispose();
    _editAccountNumberCtrl.dispose();
    _editIbanCtrl.dispose();
    super.dispose();
  }

  /// حساب أرصدة الخزينة والبنوك (مطابق treasuryState في web).
  static ({double cash, List<Map<String, dynamic>> banks, double total, List<Map<String, dynamic>> tx}) treasuryState(AppState app) {
    final tx = app.allTreasuryMoves.where(app.sameCompany).toList();
    final banks = app.allBankAccounts.where(app.sameCompany).map<Map<String, dynamic>>((b) {
      final m = Map<String, dynamic>.from(b);
      m['balance'] = 0.0;
      return m;
    }).toList();
    var cash = 0.0;
    tx.sort((a, b) => ((a['createdAtMs'] as num?)?.toInt() ?? 0).compareTo((b['createdAtMs'] as num?)?.toInt() ?? 0));
    for (final t in tx) {
      final amt = (t['amount'] as num?)?.toDouble() ?? 0;
      final type = t['type']?.toString() ?? '';
      Map<String, dynamic>? target;
      if (type == 'opening' || type == 'deposit' || type == 'withdraw') {
        target = t['account']?.toString() == 'cash' ? null : _findBank(banks, t['account']?.toString());
        if (type == 'opening') {
          if (target != null) { target['balance'] = amt; } else { cash = amt; }
        } else if (type == 'deposit') {
          if (target != null) { target['balance'] = (target['balance'] as num).toDouble() + amt; } else { cash += amt; }
        } else {
          if (target != null) { target['balance'] = mathMax(0, (target['balance'] as num).toDouble() - amt); } else { cash = mathMax(0, cash - amt); }
        }
      } else if (type == 'transfer') {
        final from = t['from']?.toString() == 'cash' ? null : _findBank(banks, t['from']?.toString());
        final to = t['to']?.toString() == 'cash' ? null : _findBank(banks, t['to']?.toString());
        if (from != null) { from['balance'] = mathMax(0, (from['balance'] as num).toDouble() - amt); } else { cash = mathMax(0, cash - amt); }
        if (to != null) { to['balance'] = (to['balance'] as num).toDouble() + amt; } else { cash += amt; }
      }
    }
    final total = cash + banks.fold<double>(0, (s, b) => s + ((b['balance'] as num?)?.toDouble() ?? 0));
    final sortedTx = List<Map<String, dynamic>>.of(tx)
      ..sort((a, b) => ((b['createdAtMs'] as num?)?.toInt() ?? 0).compareTo((a['createdAtMs'] as num?)?.toInt() ?? 0));
    return (cash: cash, banks: banks, total: total, tx: sortedTx);
  }

  static Map<String, dynamic>? _findBank(List<Map<String, dynamic>> banks, String? id) {
    if (id == null || id.isEmpty) return null;
    for (final b in banks) {
      if (b['id']?.toString() == id) return b;
    }
    return null;
  }

  static double mathMax(double a, double b) => a > b ? a : b;

  static const Map<String, String> _typeLabels = {
    'opening': 'رصيد افتتاحي', 'deposit': 'إيداع', 'withdraw': 'سحب', 'transfer': 'تحويل',
  };

  String _accountLabel(AppState app, String? id, String? key) {
    if (id == null || id == 'cash') return 'الخزينة';
    final st = treasuryState(app);
    for (final b in st.banks) {
      if (b['id']?.toString() == id) return b['bankName']?.toString() ?? b['accountName']?.toString() ?? id;
    }
    return key ?? id;
  }

  String _moveTargetLabel(AppState app, Map<String, dynamic> t) {
    final type = t['type']?.toString() ?? '';
    if (type == 'transfer') {
      final from = _accountLabel(app, t['from']?.toString(), null);
      final to = _accountLabel(app, t['to']?.toString(), null);
      return '$from ← $to';
    }
    return _accountLabel(app, t['account']?.toString(), null);
  }

  Future<void> _saveBank() async {
    final app = AppState.instance;
    final now = DateTime.now();
    if (_bankNameCtrl.text.trim().isEmpty || _accountNameCtrl.text.trim().isEmpty) {
      _snack('أدخل اسم البنك واسم الحساب.');
      return;
    }
    final bank = <String, dynamic>{
      'id': 'BANK-${now.millisecondsSinceEpoch}',
      'companyOwnerId': app.ownerId,
      'bankName': _bankNameCtrl.text.trim(),
      'accountName': _accountNameCtrl.text.trim(),
      'accountNumber': _accountNumberCtrl.text.trim(),
      'iban': _ibanCtrl.text.trim(),
      'opening': double.tryParse(_openingCtrl.text) ?? 0,
      'createdAt': now.toIso8601String(),
      'createdAtMs': now.millisecondsSinceEpoch,
      'createdBy': app.session!.id,
    };
    final banks = List<Map<String, dynamic>>.from(app.allBankAccounts);
    banks.add(bank);
    await app.storage.write(AppConstants.kBankAccounts, banks);

    final opening = double.tryParse(_openingCtrl.text) ?? 0;
    if (opening > 0) {
      final tx = List<Map<String, dynamic>>.from(app.allTreasuryMoves);
      tx.add(<String, dynamic>{
        'id': 'TRS-${DateTime.now().millisecondsSinceEpoch}',
        'companyOwnerId': app.ownerId,
        'type': 'opening',
        'account': bank['id'],
        'amount': opening,
        'date': AppUtils.dateVal(),
        'note': 'رصيد افتتاحي للحساب',
        'createdAt': now.toIso8601String(),
        'createdAtMs': now.millisecondsSinceEpoch,
        'createdBy': app.session!.id,
      });
      await app.storage.write(AppConstants.kTreasury, tx);
    }
    await app.logActivity('حساب بنكي', entityType: 'bank', entityId: bank['id'] as String);
    if (!mounted) return;
    setState(() {
      _showBankForm = false;
      _bankNameCtrl.clear();
      _accountNameCtrl.clear();
      _accountNumberCtrl.clear();
      _ibanCtrl.clear();
      _openingCtrl.text = '0';
    });
    _snack('تم حفظ الحساب البنكي.');
  }

  Future<void> _saveMove() async {
    final app = AppState.instance;
    final now = DateTime.now();
    final amount = double.tryParse(_moveAmountCtrl.text) ?? 0;
    if (amount <= 0) {
      _snack('أدخل مبلغاً صحيحاً.');
      return;
    }
    if (_moveType == 'transfer' && _moveFrom == _moveTo) {
      _snack('يجب أن يختلف الحسابان في التحويل.');
      return;
    }
    final rec = <String, dynamic>{
      'id': 'TRS-${now.millisecondsSinceEpoch}',
      'companyOwnerId': app.ownerId,
      'type': _moveType,
      'amount': amount,
      'date': _moveDateCtrl.text.isNotEmpty ? _moveDateCtrl.text : AppUtils.dateVal(),
      'note': _moveNoteCtrl.text.trim(),
      'createdAt': now.toIso8601String(),
      'createdAtMs': now.millisecondsSinceEpoch,
      'createdBy': app.session!.id,
    };
    if (_moveType == 'transfer') {
      rec['from'] = _moveFrom;
      rec['to'] = _moveTo;
      rec['account'] = _moveFrom;
    } else {
      rec['account'] = _moveAccount;
    }
    final tx = List<Map<String, dynamic>>.from(app.allTreasuryMoves);
    tx.insert(0, rec);
    await app.storage.write(AppConstants.kTreasury, tx);
    await app.logActivity('حركة خزينة', entityType: 'treasury', entityId: rec['id'] as String);
    if (!mounted) return;
    setState(() {
      _showMoveForm = false;
      _moveAmountCtrl.clear();
      _moveDateCtrl.clear();
      _moveNoteCtrl.clear();
      _moveType = 'deposit';
      _moveAccount = 'cash';
      _moveFrom = 'cash';
      _moveTo = 'cash';
    });
    _snack('تم تسجيل الحركة.');
  }

  Future<void> _editBank(Map<String, dynamic> bank) async {
    _editingBankId = bank['id']?.toString();
    _editBankNameCtrl.text = bank['bankName']?.toString() ?? '';
    _editAccountNameCtrl.text = bank['accountName']?.toString() ?? '';
    _editAccountNumberCtrl.text = bank['accountNumber']?.toString() ?? '';
    _editIbanCtrl.text = bank['iban']?.toString() ?? '';
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('تعديل الحساب البنكي', style: TextStyle(fontFamily: 'Cairo')),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AppField(label: 'اسم البنك', controller: _editBankNameCtrl),
            AppField(label: 'اسم الحساب', controller: _editAccountNameCtrl),
            AppField(label: 'رقم الحساب', controller: _editAccountNumberCtrl),
            AppField(label: 'الآيبان IBAN', controller: _editIbanCtrl),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('إلغاء', style: TextStyle(fontFamily: 'Cairo'))),
          FilledButton(onPressed: () => _saveBankEdit(ctx), child: const Text('حفظ التعديل', style: TextStyle(fontFamily: 'Cairo'))),
        ],
      ),
    );
  }

  Future<void> _saveBankEdit(BuildContext dialogContext) async {
    final app = AppState.instance;
    if (_editingBankId == null) return;
    final banks = List<Map<String, dynamic>>.from(app.allBankAccounts);
    final idx = banks.indexWhere((b) => b['id']?.toString() == _editingBankId);
    if (idx < 0) return;
    banks[idx] = Map<String, dynamic>.from(banks[idx])
      ..['bankName'] = _editBankNameCtrl.text
      ..['accountName'] = _editAccountNameCtrl.text
      ..['accountNumber'] = _editAccountNumberCtrl.text
      ..['iban'] = _editIbanCtrl.text;
    await app.storage.write(AppConstants.kBankAccounts, banks);
    await app.logActivity('تعديل حساب بنكي', entityType: 'bank', entityId: _editingBankId!);
    if (dialogContext.mounted) Navigator.pop(dialogContext);
    if (mounted) setState(() => _editingBankId = null);
    _snack('تم حفظ التعديل.');
  }

  Future<void> _deleteBank(Map<String, dynamic> bank) async {
    final app = AppState.instance;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('حذف الحساب البنكي', style: TextStyle(fontFamily: 'Cairo')),
        content: Text('حذف ${bank['bankName']}؟', style: const TextStyle(fontFamily: 'Cairo')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('تراجع', style: TextStyle(fontFamily: 'Cairo'))),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('حذف', style: TextStyle(fontFamily: 'Cairo', color: AppTheme.danger)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await app.remove(AppConstants.kBankAccounts, bank['id']?.toString() ?? '');
    if (mounted) setState(() {});
    _snack('تم حذف الحساب.');
  }

  void _snack(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg, style: const TextStyle(fontFamily: 'Cairo'))));
  }

  Future<void> _printStatement() async {
    final app = AppState.instance;
    final st = treasuryState(app);
    try {
      await PdfGenerator.sharePdf('كشف الخزينة والبنوك',
          PdfGenerator.treasuryStatementContent(
            cash: st.cash,
            banks: st.banks,
            total: st.total,
            tx: st.tx,
            ownerCompany: app.myOwnerCompany,
          ),
          ownerCompany: app.myOwnerCompany);
    } catch (_) {
      _snack('تعذر إنشاء PDF.');
    }
  }

  List<String> _accountOptions(AppState app) => ['cash', for (final b in app.allBankAccounts.where(app.sameCompany)) b['id']?.toString() ?? ''];

  @override
  Widget build(BuildContext context) {
    final app = AppState.instance;
    if (!app.session!.isOwner) {
      return const Scaffold(
        backgroundColor: AppTheme.bg,
        body: EmptyState('غير متاح لدورك.', icon: Icons.lock_outline),
      );
    }
    final st = treasuryState(app);
    final bankOpts = _accountOptions(app);

    return Scaffold(
      backgroundColor: AppTheme.bg,
      body: ListView(
        padding: const EdgeInsets.only(bottom: 40),
        children: [
          const PageTitle('الخزينة والبنوك'),
          GridView.count(
            crossAxisCount: 3,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 8,
            crossAxisSpacing: 8,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            children: [
              StatCard(label: 'رصيد الخزينة', value: AppUtils.money(st.cash), icon: Icons.account_balance_wallet_rounded, color: st.cash >= 0 ? AppTheme.success : AppTheme.danger),
              StatCard(label: 'إجمالي البنوك', value: AppUtils.money(st.banks.fold<double>(0, (s, b) => s + ((b['balance'] as num?)?.toDouble() ?? 0))), icon: Icons.account_balance_rounded, color: AppTheme.primary),
              StatCard(label: 'الإجمالي', value: AppUtils.money(st.total), icon: Icons.payments_rounded, color: AppTheme.gold),
            ],
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: Row(
              children: [
                Expanded(
                  child: FilledButton.tonalIcon(
                    onPressed: () => setState(() => _showMoveForm = !_showMoveForm),
                    icon: const Icon(Icons.swap_horiz_rounded, size: 18),
                    label: const Text('حركة خزينة', style: TextStyle(fontFamily: 'Cairo')),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: FilledButton.tonalIcon(
                    onPressed: () => setState(() => _showBankForm = !_showBankForm),
                    icon: const Icon(Icons.add_card_rounded, size: 18),
                    label: const Text('حساب بنكي', style: TextStyle(fontFamily: 'Cairo')),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: FilledButton.tonalIcon(
                    onPressed: _printStatement,
                    icon: const Icon(Icons.print_rounded, size: 18),
                    label: const Text('كشف PDF', style: TextStyle(fontFamily: 'Cairo')),
                  ),
                ),
              ],
            ),
          ),
          if (_showBankForm)
            Card(
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SectionHeader(1, 'حساب بنكي جديد'),
                    AppField(label: 'اسم البنك', controller: _bankNameCtrl),
                    AppField(label: 'اسم الحساب', controller: _accountNameCtrl),
                    AppField(label: 'رقم الحساب', controller: _accountNumberCtrl),
                    AppField(label: 'الآيبان IBAN', controller: _ibanCtrl),
                    AppField(label: 'الرصيد الافتتاحي (ر.س)', keyboard: TextInputType.number, controller: _openingCtrl),
                    const SizedBox(height: 10),
                    ElevatedButton(onPressed: _saveBank, child: const Text('حفظ الحساب')),
                  ],
                ),
              ),
            ),
          if (_showMoveForm)
            Card(
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SectionHeader(1, 'حركة خزينة'),
                    AppDropdown<String>(
                      label: 'النوع',
                      value: _moveType,
                      items: const ['deposit', 'withdraw', 'transfer', 'opening'],
                      labelOf: (v) => _typeLabels[v] ?? v,
                      onChanged: (v) => setState(() => _moveType = v!),
                    ),
                    if (_moveType != 'transfer')
                      AppDropdown<String>(
                        label: 'الحساب',
                        value: _moveAccount,
                        items: bankOpts,
                        labelOf: (v) => v == 'cash' ? 'الخزينة' : _accountLabel(app, v, null),
                        onChanged: (v) => setState(() => _moveAccount = v!),
                      )
                    else ...[
                      AppDropdown<String>(
                        label: 'من',
                        value: _moveFrom,
                        items: bankOpts,
                        labelOf: (v) => v == 'cash' ? 'الخزينة' : _accountLabel(app, v, null),
                        onChanged: (v) => setState(() => _moveFrom = v!),
                      ),
                      AppDropdown<String>(
                        label: 'إلى',
                        value: _moveTo,
                        items: bankOpts,
                        labelOf: (v) => v == 'cash' ? 'الخزينة' : _accountLabel(app, v, null),
                        onChanged: (v) => setState(() => _moveTo = v!),
                      ),
                    ],
                    AppField(label: 'المبلغ (ر.س)', keyboard: TextInputType.number, controller: _moveAmountCtrl),
                    AppField(label: 'التاريخ', controller: _moveDateCtrl, hint: 'YYYY-MM-DD'),
                    AppField(label: 'البيان', controller: _moveNoteCtrl),
                    const SizedBox(height: 10),
                    ElevatedButton(onPressed: _saveMove, child: const Text('تسجيل الحركة')),
                  ],
                ),
              ),
            ),

          const Padding(
            padding: EdgeInsets.fromLTRB(16, 18, 16, 6),
            child: Text('الحسابات البنكية',
                style: TextStyle(fontFamily: 'Cairo', fontSize: 14, fontWeight: FontWeight.w800)),
          ),
          if (st.banks.isEmpty)
            const EmptyState('لا توجد حسابات بنكية', icon: Icons.account_balance_rounded)
          else
            for (final b in st.banks)
              ListCard(
                leadingIcon: const Icon(Icons.account_balance_rounded, color: AppTheme.primary),
                title: '${b['bankName']} — ${b['accountName']}',
                subtitle: '${b['accountNumber'] ?? b['iban'] ?? '—'}',
                trailing: AppUtils.money(b['balance']),
                trailingWidget: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      padding: const EdgeInsets.all(2),
                      constraints: const BoxConstraints(),
                      icon: const Icon(Icons.edit_rounded, size: 18, color: AppTheme.primary),
                      onPressed: () => _editBank(b),
                    ),
                    IconButton(
                      padding: const EdgeInsets.all(2),
                      constraints: const BoxConstraints(),
                      icon: const Icon(Icons.delete_outline_rounded, size: 18, color: AppTheme.danger),
                      onPressed: () => _deleteBank(b),
                    ),
                  ],
                ),
              ),

          const Padding(
            padding: EdgeInsets.fromLTRB(16, 18, 16, 6),
            child: Text('حركات الخزينة والبنوك',
                style: TextStyle(fontFamily: 'Cairo', fontSize: 14, fontWeight: FontWeight.w800)),
          ),
          if (st.tx.isEmpty)
            const EmptyState('لا توجد حركات', icon: Icons.swap_horiz_rounded)
          else
            for (final t in st.tx)
              ListCard(
                leadingIcon: Icon(
                  _moveTypeIcon(t['type']?.toString() ?? ''),
                  color: t['type']?.toString() == 'withdraw' ? AppTheme.danger : AppTheme.success,
                ),
                title: '${_typeLabels[t['type']?.toString()] ?? t['type']} — ${AppUtils.money(t['amount'])}',
                subtitle: '${_moveTargetLabel(app, t)} • ${t['date']} ${(t['note']?.toString() ?? '').isNotEmpty ? '• ${t['note']}' : ''}',
                trailing: AppUtils.money(t['amount']),
              ),
        ],
      ),
    );
  }

  IconData _moveTypeIcon(String type) {
    switch (type) {
      case 'deposit': return Icons.south_west_rounded;
      case 'withdraw': return Icons.north_east_rounded;
      case 'transfer': return Icons.swap_horiz_rounded;
      default: return Icons.account_balance_wallet_rounded;
    }
  }
}
