/// قواعد موحّدة لربط الموظف بكل سجلاته المالية القديمة والجديدة.
class StaffFinanceUtils {
  const StaffFinanceUtils._();

  static String normalizeRef(Object? value) {
    var text = (value ?? '').toString().trim();
    const arabic = '٠١٢٣٤٥٦٧٨٩';
    const persian = '۰۱۲۳۴۵۶۷۸۹';
    for (var i = 0; i < 10; i++) {
      text = text.replaceAll(arabic[i], '$i').replaceAll(persian[i], '$i');
    }
    if (text.isEmpty) return '';
    final digits = text.replaceAll(RegExp(r'\D'), '');
    return RegExp(r'^[\d\s-]+$').hasMatch(text) && digits.isNotEmpty ? digits : text.toLowerCase();
  }

  static Set<String> staffRefs(Map<String, dynamic> staff) => {
        normalizeRef(staff['financialId']),
        normalizeRef(staff['identity']),
        normalizeRef(staff['id']),
      }..remove('');

  static Set<String> recordRefs(Map<dynamic, dynamic> record) => {
        normalizeRef(record['staffFinancialId']),
        normalizeRef(record['staffId']),
        normalizeRef(record['employeeId']),
        normalizeRef(record['staffIdentity']),
      }..remove('');

  static String financialId(Map<String, dynamic> staff) {
    for (final value in [staff['financialId'], staff['identity'], staff['id']]) {
      final ref = normalizeRef(value);
      if (ref.isNotEmpty) return ref;
    }
    return '';
  }

  static bool matchesRecord(Map<dynamic, dynamic> record, Map<String, dynamic> staff) {
    final refs = staffRefs(staff);
    return recordRefs(record).any(refs.contains);
  }

  static bool isActive(Map<String, dynamic> staff) {
    if (staff['deletedAt'] != null && staff['deletedAt'].toString().isNotEmpty) return false;
    final status = (staff['employmentStatus'] ?? staff['status'] ?? '').toString().toLowerCase();
    return !const {'منتهي الخدمة', 'محذوف', 'غير نشط', 'deleted', 'inactive'}.contains(status);
  }

  static bool isPaidPayroll(Map<dynamic, dynamic> payroll) {
    final status = (payroll['status'] ?? '').toString().toLowerCase();
    return const {'مسدد', 'مدفوع', 'paid'}.contains(status);
  }

  static bool isCancelled(Map<dynamic, dynamic> record) {
    final status = (record['status'] ?? '').toString().trim().toLowerCase();
    return const {'ملغي', 'ملغى', 'ملغاة', 'ملغية', 'محذوف', 'cancelled', 'canceled', 'deleted'}.contains(status);
  }

  static Map<String, dynamic>? payrollRow(Map<dynamic, dynamic> payroll, Map<String, dynamic> staff) {
    for (final raw in (payroll['rows'] as List?) ?? const []) {
      if (raw is Map) {
        final row = Map<String, dynamic>.from(raw);
        if (matchesRecord(row, staff)) return row;
      }
    }
    return null;
  }

  static bool payrollExistsForPeriod(
    Iterable<Map<String, dynamic>> payrolls,
    String companyOwnerId,
    String period,
  ) {
    return payrolls.any((payroll) {
      final status = (payroll['status'] ?? '').toString().toLowerCase();
      final sameCompany = (payroll['companyOwnerId'] ?? '').toString().isEmpty ||
          payroll['companyOwnerId'].toString() == companyOwnerId;
      return payroll['period']?.toString() == period &&
          sameCompany &&
          !isCancelled(payroll);
    });
  }

  static double amount(Object? value) {
    if (value is num) return value.toDouble();
    return double.tryParse((value ?? '').toString()) ?? 0;
  }

  static Map<String, dynamic> calculateProfile({
    required Map<String, dynamic> staff,
    required Iterable<Map<String, dynamic>> entries,
    required Iterable<Map<String, dynamic>> custodies,
    required Iterable<Map<String, dynamic>> payrolls,
    required Iterable<Map<String, dynamic>> purchases,
    required Iterable<Map<String, dynamic>> vouchers,
  }) {
    final ownEntries = entries.where((x) => matchesRecord(x, staff) && !isCancelled(x)).toList();
    final ownCustodies = custodies.where((x) => matchesRecord(x, staff) && !isCancelled(x)).toList();
    final ownPayrolls = payrolls.where((x) => payrollRow(x, staff) != null && !isCancelled(x)).toList();
    final ownPurchases = purchases.where((x) => matchesRecord(x, staff) && !isCancelled(x)).toList();
    final ownVouchers = vouchers.where((x) => matchesRecord(x, staff) && !isCancelled(x)).toList();

    double sumEntries(String type, {String? direction}) => ownEntries
        .where((x) => x['type'] == type && (direction == null || x['direction'] == direction))
        .fold<double>(0, (sum, x) => sum + amount(x['amount']));

    final advancesIssued = ownEntries
        .where((x) => x['type'] == 'advance' && x['direction'] != 'in')
        .fold<double>(0, (sum, x) => sum + amount(x['amount']));
    final advancesRecovered = sumEntries('advance', direction: 'in');
    var payrollGross = 0.0;
    var payrollNet = 0.0;
    var payrollPaid = 0.0;
    var payrollPayable = 0.0;
    for (final payroll in ownPayrolls) {
      final row = payrollRow(payroll, staff) ?? const <String, dynamic>{};
      final gross = amount(row['gross']) != 0
          ? amount(row['gross'])
          : amount(row['base']) + amount(row['allowances']) - amount(row['deductions']);
      final net = amount(row['net']);
      payrollGross += gross;
      payrollNet += net;
      if (isPaidPayroll(payroll)) {
        payrollPaid += net;
      } else {
        payrollPayable += net;
      }
    }

    return {
      'financialId': financialId(staff),
      'baseSalary': amount(staff['baseSalary']),
      'entries': ownEntries,
      'custodies': ownCustodies,
      'payrolls': ownPayrolls,
      'purchases': ownPurchases,
      'vouchers': ownVouchers,
      'advancesIssued': advancesIssued,
      'advancesRecovered': advancesRecovered,
      'advancesOutstanding': (advancesIssued - advancesRecovered).clamp(0.0, double.infinity).toDouble(),
      'allowances': sumEntries('allowance'),
      'deductions': sumEntries('deduction'),
      'expenses': sumEntries('expense'),
      'payrollGross': payrollGross,
      'payrollNet': payrollNet,
      'payrollPaid': payrollPaid,
      'payrollPayable': payrollPayable,
      'custodyIssued': ownCustodies.fold<double>(0, (sum, x) => sum + amount(x['value'] ?? x['amount'])),
      'custodyRemaining': ownCustodies.fold<double>(0, (sum, x) => sum + amount(x['remaining']).clamp(0.0, double.infinity).toDouble()),
      'purchasesPending': ownPurchases
          .where((x) => !const {'مسدد', 'مدفوع', 'paid'}.contains((x['status'] ?? '').toString().toLowerCase()))
          .fold<double>(0, (sum, x) => sum + amount(x['amount'])),
      'vouchersPaid': ownVouchers.fold<double>(0, (sum, x) => sum + amount(x['amount'])),
    };
  }
}
