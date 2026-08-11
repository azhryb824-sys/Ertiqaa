import 'package:flutter/material.dart';
import '../../core/constants.dart';
import '../../core/utils.dart';
import '../../finance/finance_journal.dart';
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

  /// حساب الأرصدة من الأستاذ العام، مع استيعاب حركات قديمة لم تُرحّل بعد.
  static ({double cash, List<Map<String, dynamic>> banks, double total, List<Map<String, dynamic>> tx}) treasuryState(AppState app) {
    final tx = app.allTreasuryMoves.where(app.sameCompany).toList();
    final balances = <String, double>{};
    final postedTreasuryRefs = <String>{};
    final journals = app.storage.list('misadJournalEntries').whereType<Map>().map((x) => Map<String, dynamic>.from(x));
    for (final journal in journals.where(app.sameCompany)) {
      if (journal['refType']?.toString() == 'treasury-move') {
        postedTreasuryRefs.add(journal['refId']?.toString() ?? '');
      }
      for (final rawLine in (journal['lines'] as List? ?? const [])) {
        if (rawLine is! Map) continue;
        final line = Map<String, dynamic>.from(rawLine);
        final account = line['account']?.toString() ?? '';
        final amount = (line['amount'] as num?)?.toDouble() ?? 0;
        if (account.isEmpty || amount <= 0) continue;
        balances[account] = (balances[account] ?? 0) + (line['side'] == 'debit' ? amount : -amount);
      }
    }
    final assignedBankAccounts = <String>{};
    final banks = app.allBankAccounts.where(app.sameCompany).map<Map<String, dynamic>>((b) {
      final m = Map<String, dynamic>.from(b);
      final account = m['ledgerAccountId']?.toString() ?? '1200';
      final duplicate = assignedBankAccounts.contains(account);
      m['balance'] = duplicate ? 0.0 : balances[account] ?? 0.0;
      if (duplicate) m['ledgerDuplicate'] = true;
      assignedBankAccounts.add(account);
      return m;
    }).toList();
    var cash = balances['1100'] ?? 0.0;
    final legacyBankAdjustments = <String, double>{};
    tx.sort((a, b) => ((a['createdAtMs'] as num?)?.toInt() ?? 0).compareTo((b['createdAtMs'] as num?)?.toInt() ?? 0));
    for (final t in tx) {
      if (postedTreasuryRefs.contains(t['id']?.toString() ?? '')) continue;
      final amt = ((t['amount'] as num?)?.toDouble() ?? 0).clamp(0.0, double.infinity).toDouble();
      final type = t['type']?.toString() ?? '';
      void apply(String? ref, double delta) {
        if (ref == null || ref == 'cash') { cash += delta; return; }
        legacyBankAdjustments[ref] = (legacyBankAdjustments[ref] ?? 0) + delta;
      }
      if (type == 'opening' || type == 'deposit' || type == 'withdraw') {
        apply(t['account']?.toString(), type == 'withdraw' ? -amt : amt);
      } else if (type == 'transfer') {
        apply(t['from']?.toString(), -amt);
        apply(t['to']?.toString(), amt);
      }
    }
    for (final bank in banks) {
      bank['balance'] = ((bank['balance'] as num?)?.toDouble() ?? 0) + (legacyBankAdjustments[bank['id']?.toString()] ?? 0);
    }
    final mapped = banks.map((b) => b['ledgerAccountId']?.toString() ?? '1200').toSet();
    final unallocated = balances.entries
        .where((entry) => entry.key.startsWith('12') && !mapped.contains(entry.key))
        .fold<double>(0, (sum, entry) => sum + entry.value);
    if (unallocated.abs() > 0.005) {
      banks.add({
        'id': 'BANK-UNALLOCATED',
        'bankName': 'رصيد بنكي غير موزع (قيود سابقة)',
        'accountName': 'تحتاج مراجعة ربط الحساب',
        'balance': unallocated,
        'system': true,
      });
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

  static String _nextBankLedgerAccount(AppState app, String bankId) {
    final used = app.allBankAccounts.where(app.sameCompany).map((b) => b['ledgerAccountId']?.toString() ?? '').toSet();
    final digits = bankId.replaceAll(RegExp(r'\D'), '');
    final suffix = digits.length >= 2 ? digits.substring(digits.length - 2) : '';
    final derived = suffix.isNotEmpty && suffix != '00' ? '12$suffix' : '';
    if (derived.isNotEmpty && !used.contains(derived)) return derived;
    for (var number = 1201; number <= 1299; number++) {
      if (!used.contains(number.toString())) return number.toString();
    }
    return '1200';
  }

  static const Map<String, String> _typeLabels = {
    'opening': 'رصيد افتتاحي',
    'deposit': 'إيداع تمويلي/تسوية',
    'withdraw': 'سحب مالك/تسوية',
    'transfer': 'تحويل',
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
    bank['ledgerAccountId'] = _nextBankLedgerAccount(app, bank['id'] as String);
    final banks = List<Map<String, dynamic>>.from(app.allBankAccounts);
    banks.add(bank);

    final opening = double.tryParse(_openingCtrl.text) ?? 0;
    Map<String, dynamic>? openingMove;
    if (opening > 0) {
      openingMove = <String, dynamic>{
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
      };
      final posted = await FinanceJournal.postTreasury(app, openingMove, banks);
      if (!posted) {
        _snack('تعذر ترحيل الرصيد الافتتاحي محاسبياً.');
        return;
      }
    }
    await app.storage.write(AppConstants.kBankAccounts, banks);
    if (openingMove != null) {
      final tx = List<Map<String, dynamic>>.from(app.allTreasuryMoves)..add(openingMove);
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
    final state = treasuryState(app);
    bool validAccount(String id) => id == 'cash' || state.banks.any((b) => b['id']?.toString() == id);
    double balanceOf(String id) {
      if (id == 'cash') return state.cash;
      for (final bank in state.banks) {
        if (bank['id']?.toString() == id) return (bank['balance'] as num?)?.toDouble() ?? 0;
      }
      return 0;
    }
    if (_moveType == 'transfer') {
      if (!validAccount(_moveFrom) || !validAccount(_moveTo)) {
        _snack('الحساب المحدد غير موجود.');
        return;
      }
      if (balanceOf(_moveFrom) < amount) {
        _snack('الرصيد غير كافٍ؛ المتاح ${AppUtils.money(balanceOf(_moveFrom))}.');
        return;
      }
    } else {
      if (!validAccount(_moveAccount)) {
        _snack('الحساب المحدد غير موجود.');
        return;
      }
      if (_moveType == 'withdraw' && balanceOf(_moveAccount) < amount) {
        _snack('الرصيد غير كافٍ؛ المتاح ${AppUtils.money(balanceOf(_moveAccount))}.');
        return;
      }
      if (_moveType == 'opening' &&
          app.allTreasuryMoves.where(app.sameCompany).any((t) => t['account']?.toString() == _moveAccount)) {
        _snack('لا يمكن إضافة رصيد افتتاحي بعد وجود حركات على الحساب.');
        return;
      }
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
    final posted = await FinanceJournal.postTreasury(app, rec, app.allBankAccounts.where(app.sameCompany).toList());
    if (!posted) {
      _snack('تعذر ترحيل حركة الخزينة محاسبياً.');
      return;
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
    if (bank['system'] == true) {
      _snack('هذا رصيد تجميعي لقيود سابقة ولا يمكن حذفه.');
      return;
    }
    Map<String, dynamic>? current;
    for (final item in treasuryState(app).banks) {
      if (item['id']?.toString() == bank['id']?.toString()) { current = item; break; }
    }
    final hasMoves = app.allTreasuryMoves.where(app.sameCompany).any((t) =>
        t['account']?.toString() == bank['id']?.toString() ||
        t['from']?.toString() == bank['id']?.toString() ||
        t['to']?.toString() == bank['id']?.toString());
    if ((((current?['balance'] as num?)?.toDouble() ?? 0).abs() > 0.005) || hasMoves) {
      _snack('لا يمكن حذف حساب له رصيد أو حركات؛ صفّر الرصيد بتحويل موثق واحتفظ به للأثر المحاسبي.');
      return;
    }
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
                    const Text(
                      'المقبوضات والمدفوعات المسجلة في الفواتير والرواتب والسندات تدخل الأستاذ تلقائياً. لا تكررها هنا؛ استخدم هذه الشاشة للرصيد الافتتاحي والتحويل وتمويل/سحب المالك فقط.',
                      style: TextStyle(fontFamily: 'Cairo', fontSize: 11, color: AppTheme.muted),
                    ),
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
                  children: b['system'] == true ? const [
                    Icon(Icons.warning_amber_rounded, color: AppTheme.danger, size: 20),
                  ] : [
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
