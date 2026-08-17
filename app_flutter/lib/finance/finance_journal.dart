import '../state/app_state.dart';

/// ترحيل قيود مزدوجة صغيرة من تطبيق Flutter مع منع التكرار على مستوى المنشأة.
class FinanceJournal {
  const FinanceJournal._();

  static const _accountNames = <String, String>{
    '1100': 'الصندوق (الخزينة النقدية)',
    '1200': 'البنوك',
    '1320': 'ذمم فواتير العملاء',
    '1330': 'ضريبة قيمة مضافة قابلة للاسترداد',
    '1410': 'سلف الموظفين',
    '1420': 'عهد الموظفين',
    '2200': 'مستحقات',
    '2300': 'ضريبة قيمة مضافة مستحقة',
    '3100': 'رأس المال',
    '3200': 'جاري المالك',
    '4100': 'إيرادات عقود الصيانة',
    '4200': 'إيرادات عقود التركيب',
    '4300': 'إيرادات فواتير العملاء',
    '4400': 'إيرادات أخرى',
    '5100': 'رواتب وأجور',
    '5400': 'مصروفات عامة وإدارية',
  };

  static double _amount(Object? value) {
    if (value is num) return value.toDouble();
    return double.tryParse((value ?? '').toString()) ?? 0;
  }

  static String _date(Object? value) {
    final text = (value ?? '').toString();
    return text.length >= 10 ? text.substring(0, 10) : text;
  }

  static String cashAccount(String method) {
    final value = method.toLowerCase();
    return value.contains('بنك') || value.contains('تحويل') || value.contains('شبكة') ? '1200' : '1100';
  }

  static String cashAccountForApp(AppState app, String method) {
    final fallback = cashAccount(method);
    if (fallback == '1100') return fallback;
    for (final bank in app.allBankAccounts.where(app.sameCompany)) {
      final account = bank['ledgerAccountId']?.toString() ?? '';
      if (RegExp(r'^12\d{2}$').hasMatch(account) && account != '1200') return account;
    }
    return fallback;
  }

  static String treasuryAccount(String? ref, List<Map<String, dynamic>> banks) {
    if (ref == null || ref.isEmpty || ref == 'cash') return '1100';
    for (final bank in banks) {
      if (bank['id']?.toString() != ref) continue;
      final account = bank['ledgerAccountId']?.toString() ?? '';
      return RegExp(r'^12\d{2}$').hasMatch(account) ? account : '1200';
    }
    return '1200';
  }

  static Future<bool> post(
    AppState app, {
    required String refType,
    required String refId,
    required String date,
    required String description,
    required List<Map<String, dynamic>> lines,
  }) async {
    if (refType.isEmpty || refId.isEmpty || lines.length < 2) return false;
    final normalized = <Map<String, dynamic>>[];
    var debit = 0.0;
    var credit = 0.0;
    for (final source in lines) {
      final side = source['side']?.toString() ?? '';
      final account = source['account']?.toString() ?? '';
      final amount = _amount(source['amount']);
      if (!const {'debit', 'credit'}.contains(side) || account.isEmpty || !amount.isFinite || amount <= 0) return false;
      if (side == 'debit') debit += amount; else credit += amount;
      normalized.add({
        ...source,
        'account': account,
        'accountName': source['accountName'] ?? _accountNames[account] ?? account,
        'amount': amount,
        'side': side,
      });
    }
    if ((debit - credit).abs() > 0.01) return false;

    final journals = app.storage
        .list('misadJournalEntries')
        .whereType<Map>()
        .map((x) => Map<String, dynamic>.from(x))
        .toList();
    if (journals.any((entry) =>
        entry['companyOwnerId']?.toString() == app.ownerId &&
        entry['refType']?.toString() == refType &&
        entry['refId']?.toString() == refId)) {
      return true;
    }
    final now = DateTime.now();
    final journal = <String, dynamic>{
      'id': 'JRN-${now.millisecondsSinceEpoch}',
      'companyOwnerId': app.ownerId,
      'date': date,
      'description': description,
      'refType': refType,
      'refId': refId,
      'lines': normalized,
      'debitTotal': debit,
      'creditTotal': credit,
      'createdBy': app.session!.id,
      'createdAt': now.toIso8601String(),
      'createdAtMs': now.millisecondsSinceEpoch,
    };
    journals.insert(0, journal);
    await app.storage.write('misadJournalEntries', journals);

    final audit = app.storage
        .list('misadFinanceAuditLog')
        .whereType<Map>()
        .map((x) => Map<String, dynamic>.from(x))
        .toList();
    audit.insert(0, {
      'id': 'AUD-${now.millisecondsSinceEpoch}',
      'companyOwnerId': app.ownerId,
      'refType': refType,
      'refId': refId,
      'journalId': journal['id'],
      'action': 'post',
      'amount': debit,
      'lineCount': normalized.length,
      'createdBy': app.session!.id,
      'createdAt': now.toIso8601String(),
      'createdAtMs': now.millisecondsSinceEpoch,
    });
    await app.storage.write('misadFinanceAuditLog', audit);
    return true;
  }

  static Future<bool> postCustody(AppState app, Map<String, dynamic> custody) {
    final amount = _amount(custody['value'] ?? custody['amount']);
    final staffId = (custody['staffFinancialId'] ?? custody['staffId'] ?? custody['staffIdentity'] ?? '').toString();
    return post(
      app,
      refType: 'custody',
      refId: custody['id']?.toString() ?? '',
      date: _date(custody['createdAt']),
      description: 'عهدة ${custody['id']} - ${custody['staffName'] ?? staffId}',
      lines: [
        {'account': '1420', 'side': 'debit', 'amount': amount, 'refStaffId': staffId},
        {'account': '1100', 'side': 'credit', 'amount': amount, 'refStaffId': staffId},
      ],
    );
  }

  static Future<bool> postStaffAdvance(AppState app, Map<String, dynamic> entry) {
    final amount = _amount(entry['amount']);
    final staffId = (entry['staffFinancialId'] ?? entry['staffId'] ?? entry['staffIdentity'] ?? '').toString();
    final incoming = entry['direction']?.toString() == 'in';
    final cash = cashAccountForApp(app, entry['paymentMethod']?.toString() ?? 'نقداً');
    return post(
      app,
      refType: 'staff-advance',
      refId: entry['id']?.toString() ?? '',
      date: entry['date']?.toString() ?? '',
      description: entry['description']?.toString() ?? 'حركة سلفة موظف $staffId',
      lines: incoming
          ? [
              {'account': cash, 'side': 'debit', 'amount': amount, 'refStaffId': staffId},
              {'account': '1410', 'side': 'credit', 'amount': amount, 'refStaffId': staffId},
            ]
          : [
              {'account': '1410', 'side': 'debit', 'amount': amount, 'refStaffId': staffId},
              {'account': cash, 'side': 'credit', 'amount': amount, 'refStaffId': staffId},
            ],
    );
  }

  static Future<bool> postCustodyRecovery(
    AppState app,
    Map<String, dynamic> custody,
    Map<String, dynamic> recovery,
  ) {
    final amount = _amount(recovery['amount']);
    final staffId = (custody['staffFinancialId'] ?? custody['staffId'] ?? custody['staffIdentity'] ?? '').toString();
    return post(
      app,
      refType: 'custody-recovery',
      refId: recovery['id']?.toString() ?? '',
      date: recovery['date']?.toString() ?? '',
      description: 'استرداد نقدي من عهدة ${custody['id']}',
      lines: [
        {'account': '1100', 'side': 'debit', 'amount': amount, 'refStaffId': staffId},
        {'account': '1420', 'side': 'credit', 'amount': amount, 'refStaffId': staffId},
      ],
    );
  }

  static Future<bool> postPayrollAccrual(AppState app, Map<String, dynamic> payroll) {
    final gross = _amount(payroll['totalGross']);
    final custody = _amount(payroll['totalCustodyDeducted']);
    final net = _amount(payroll['totalNet']);
    if (gross <= 0 || (gross - custody - net).abs() > 0.01) return Future.value(false);
    return post(
      app,
      refType: 'payroll',
      refId: payroll['id']?.toString() ?? '',
      date: payroll['accrualDate']?.toString() ?? '',
      description: 'استحقاق رواتب ${payroll['period'] ?? ''}',
      lines: [
        {'account': '5100', 'side': 'debit', 'amount': gross},
        if (custody > 0) {'account': '1420', 'side': 'credit', 'amount': custody},
        if (net > 0) {'account': '2200', 'side': 'credit', 'amount': net},
      ],
    );
  }

  static Future<bool> postPayrollPayment(AppState app, Map<String, dynamic> payroll) {
    final net = _amount(payroll['totalNet']);
    if (net <= 0) return Future.value(true);
    return post(
      app,
      refType: 'payroll-payment',
      refId: payroll['id']?.toString() ?? '',
      date: payroll['paidDate']?.toString() ?? '',
      description: 'صرف رواتب ${payroll['period'] ?? ''}',
      lines: [
        {'account': '2200', 'side': 'debit', 'amount': net},
        {'account': cashAccountForApp(app, payroll['paymentMethod']?.toString() ?? ''), 'side': 'credit', 'amount': net},
      ],
    );
  }

  static Future<bool> postManual(AppState app, Map<String, dynamic> entry) {
    final amount = _amount(entry['amount']);
    final kind = entry['accountingKind']?.toString() ?? '';
    if (entry['source']?.toString() != 'manual-journal' || amount <= 0 || !const {'other-income', 'general-expense'}.contains(kind)) {
      return Future.value(false);
    }
    final cash = cashAccountForApp(app, entry['paymentMethod']?.toString() ?? 'نقداً');
    final income = kind == 'other-income';
    return post(
      app,
      refType: 'manual-finance',
      refId: entry['id']?.toString() ?? '',
      date: entry['date']?.toString() ?? '',
      description: entry['description']?.toString() ?? '',
      lines: income
          ? [
              {'account': cash, 'side': 'debit', 'amount': amount},
              {'account': '4400', 'side': 'credit', 'amount': amount},
            ]
          : [
              {'account': '5400', 'side': 'debit', 'amount': amount},
              {'account': cash, 'side': 'credit', 'amount': amount},
            ],
    );
  }

  static Future<bool> postCustomerInvoice(AppState app, Map<String, dynamic> invoice) {
    final amount = _amount(invoice['total']);
    final tax = _amount(invoice['tax']).clamp(0.0, amount).toDouble();
    final revenue = amount - tax;
    if (amount <= 0) return Future.value(false);
    return post(
      app,
      refType: 'customer-invoice',
      refId: invoice['id']?.toString() ?? '',
      date: invoice['date']?.toString() ?? '',
      description: 'فاتورة عميل ${invoice['invoiceNo'] ?? invoice['id']} - ${invoice['clientName'] ?? ''}',
      lines: [
        {
          'account': '1320',
          'side': 'debit',
          'amount': amount,
          'refClientId': invoice['clientId'] ?? '',
          'refContractId': invoice['contractId'] ?? '',
        },
        if (tax > 0) {
          'account': '2300',
          'side': 'credit',
          'amount': tax,
          'refClientId': invoice['clientId'] ?? '',
          'refContractId': invoice['contractId'] ?? '',
        },
        {
          'account': '4300',
          'side': 'credit',
          'amount': revenue,
          'refClientId': invoice['clientId'] ?? '',
          'refContractId': invoice['contractId'] ?? '',
        },
      ],
    );
  }

  static Future<bool> postCustomerInvoicePayment(
    AppState app,
    Map<String, dynamic> invoice,
    Map<String, dynamic> payment,
  ) {
    final amount = _amount(payment['amount']);
    if (amount <= 0) return Future.value(false);
    return post(
      app,
      refType: 'customer-invoice-payment',
      refId: '${invoice['id']}:${payment['id']}',
      date: payment['date']?.toString() ?? '',
      description: 'تحصيل فاتورة ${invoice['invoiceNo'] ?? invoice['id']} - ${invoice['clientName'] ?? ''}',
      lines: [
        {
          'account': cashAccountForApp(app, payment['paymentMethod']?.toString() ?? ''),
          'side': 'debit',
          'amount': amount,
          'refClientId': invoice['clientId'] ?? '',
          'refContractId': invoice['contractId'] ?? '',
        },
        {
          'account': '1320',
          'side': 'credit',
          'amount': amount,
          'refClientId': invoice['clientId'] ?? '',
          'refContractId': invoice['contractId'] ?? '',
        },
      ],
    );
  }

  static Future<bool> postReceipt(AppState app, Map<String, dynamic> receipt) {
    final amount = _amount(receipt['amount']);
    if (amount <= 0) return Future.value(false);
    var revenue = '4100';
    for (final contract in app.allContracts) {
      if (contract.id == receipt['contractId']?.toString()) {
        revenue = contract.type == 'تركيب' ? '4200' : '4100';
        break;
      }
    }
    return post(
      app,
      refType: 'receipt',
      refId: receipt['id']?.toString() ?? '',
      date: _date(receipt['date'] ?? receipt['createdAt']),
      description: 'سند قبض ${receipt['id']} - ${receipt['clientName'] ?? receipt['clientCompanyName'] ?? ''}',
      lines: [
        {
          'account': cashAccountForApp(app, receipt['paymentMethod']?.toString() ?? ''),
          'side': 'debit',
          'amount': amount,
          'refContractId': receipt['contractId'] ?? '',
        },
        {'account': revenue, 'side': 'credit', 'amount': amount, 'refContractId': receipt['contractId'] ?? ''},
      ],
    );
  }

  static Future<bool> postTreasury(
    AppState app,
    Map<String, dynamic> move,
    List<Map<String, dynamic>> banks,
  ) {
    final amount = _amount(move['amount']);
    final type = move['type']?.toString() ?? '';
    if (amount <= 0 || !const {'opening', 'deposit', 'withdraw', 'transfer'}.contains(type)) {
      return Future.value(false);
    }
    final lines = <Map<String, dynamic>>[];
    if (type == 'opening') {
      lines.add({'account': treasuryAccount(move['account']?.toString(), banks), 'side': 'debit', 'amount': amount});
      lines.add({'account': '3100', 'side': 'credit', 'amount': amount});
    } else if (type == 'deposit') {
      lines.add({'account': treasuryAccount(move['account']?.toString(), banks), 'side': 'debit', 'amount': amount});
      lines.add({'account': '3200', 'side': 'credit', 'amount': amount});
    } else if (type == 'withdraw') {
      lines.add({'account': '3200', 'side': 'debit', 'amount': amount});
      lines.add({'account': treasuryAccount(move['account']?.toString(), banks), 'side': 'credit', 'amount': amount});
    } else {
      lines.add({'account': treasuryAccount(move['to']?.toString(), banks), 'side': 'debit', 'amount': amount});
      lines.add({'account': treasuryAccount(move['from']?.toString(), banks), 'side': 'credit', 'amount': amount});
    }
    return post(
      app,
      refType: 'treasury-move',
      refId: move['id']?.toString() ?? '',
      date: move['date']?.toString() ?? '',
      description: 'حركة خزينة $type - ${move['note'] ?? ''}',
      lines: lines,
    );
  }
}
