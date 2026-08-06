/// سند قبض — مفتاح misadReceipts.
class Receipt {
  String id;
  String companyOwnerId;
  String contractId;
  String clientId;
  String clientName;
  String clientCompanyName;
  String clientCompanyUnifiedNumber;
  double amount;
  String purpose;
  String purposeKey;
  String paymentMethod;
  String details;
  String status;
  String createdAt;
  int createdAtMs;
  String createdBy;

  Receipt({
    required this.id,
    this.companyOwnerId = '',
    this.contractId = '',
    this.clientId = '',
    this.clientName = '',
    this.clientCompanyName = '',
    this.clientCompanyUnifiedNumber = '',
    this.amount = 0,
    this.purpose = '',
    this.purposeKey = '',
    this.paymentMethod = '',
    this.details = '',
    this.status = 'معتمد',
    this.createdAt = '',
    this.createdAtMs = 0,
    this.createdBy = '',
  });

  factory Receipt.fromJson(Map<String, dynamic> j) => Receipt(
        id: j['id']?.toString() ?? '',
        companyOwnerId: j['companyOwnerId']?.toString() ?? '',
        contractId: j['contractId']?.toString() ?? '',
        clientId: j['clientId']?.toString() ?? '',
        clientName: j['clientName']?.toString() ?? '',
        clientCompanyName: j['clientCompanyName']?.toString() ?? '',
        clientCompanyUnifiedNumber: j['clientCompanyUnifiedNumber']?.toString() ?? '',
        amount: (j['amount'] as num?)?.toDouble() ?? 0,
        purpose: j['purpose']?.toString() ?? '',
        purposeKey: j['purposeKey']?.toString() ?? '',
        paymentMethod: j['paymentMethod']?.toString() ?? '',
        details: j['details']?.toString() ?? '',
        status: j['status']?.toString() ?? 'معتمد',
        createdAt: j['createdAt']?.toString() ?? '',
        createdAtMs: (j['createdAtMs'] as num?)?.toInt() ?? 0,
        createdBy: j['createdBy']?.toString() ?? '',
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'companyOwnerId': companyOwnerId,
        'contractId': contractId,
        'clientId': clientId,
        'clientName': clientName,
        'clientCompanyName': clientCompanyName,
        'clientCompanyUnifiedNumber': clientCompanyUnifiedNumber,
        'amount': amount,
        'purpose': purpose,
        'purposeKey': purposeKey,
        if (paymentMethod.isNotEmpty) 'paymentMethod': paymentMethod,
        'details': details,
        'status': status,
        'createdAt': createdAt,
        'createdAtMs': createdAtMs,
        'createdBy': createdBy,
      };
}

/// مستخلص مالي — مفتاح misadClaims.
class Claim {
  String id;
  String companyOwnerId;
  String contractId;
  double value;
  String period;
  String status;
  String? receiptEntryId;
  String? createdAt;

  Claim({
    required this.id,
    this.companyOwnerId = '',
    this.contractId = '',
    this.value = 0,
    this.period = '',
    this.status = 'قيد المراجعة',
    this.receiptEntryId,
    this.createdAt,
  });

  factory Claim.fromJson(Map<String, dynamic> j) => Claim(
        id: j['id']?.toString() ?? '',
        companyOwnerId: j['companyOwnerId']?.toString() ?? '',
        contractId: j['contractId']?.toString() ?? '',
        value: (j['value'] as num?)?.toDouble() ?? 0,
        period: j['period']?.toString() ?? '',
        status: j['status']?.toString() ?? 'قيد المراجعة',
        receiptEntryId: j['receiptEntryId']?.toString(),
        createdAt: j['createdAt']?.toString(),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'companyOwnerId': companyOwnerId,
        'contractId': contractId,
        'value': value,
        'period': period,
        'status': status,
        if (receiptEntryId != null) 'receiptEntryId': receiptEntryId,
        if (createdAt != null) 'createdAt': createdAt,
      };
}

/// قيد مالي — مفتاح misadFinancialEntries.
class FinancialEntry {
  String id;
  String companyOwnerId;
  String type;
  String direction;
  double amount;
  String date;
  String description;
  String contractId;
  String supplierId;
  String partId;
  String staffId;
  String employeeId;
  String status;
  String paymentMethod;
  String paymentLabel;
  String receiptId;
  String collectionForStatus;
  String createdBy;
  String createdAt;
  int createdAtMs;

  FinancialEntry({
    required this.id,
    this.companyOwnerId = '',
    this.type = 'sale',
    this.direction = 'in',
    this.amount = 0,
    this.date = '',
    this.description = '',
    this.contractId = '',
    this.supplierId = '',
    this.partId = '',
    this.staffId = '',
    this.employeeId = '',
    this.status = 'معتمد',
    this.paymentMethod = '',
    this.paymentLabel = '',
    this.receiptId = '',
    this.collectionForStatus = '',
    this.createdBy = '',
    this.createdAt = '',
    this.createdAtMs = 0,
  });

  factory FinancialEntry.fromJson(Map<String, dynamic> j) => FinancialEntry(
        id: j['id']?.toString() ?? '',
        companyOwnerId: j['companyOwnerId']?.toString() ?? '',
        type: j['type']?.toString() ?? 'sale',
        direction: j['direction']?.toString() ?? 'in',
        amount: (j['amount'] as num?)?.toDouble() ?? 0,
        date: j['date']?.toString() ?? '',
        description: j['description']?.toString() ?? '',
        contractId: j['contractId']?.toString() ?? '',
        supplierId: j['supplierId']?.toString() ?? '',
        partId: j['partId']?.toString() ?? '',
        staffId: j['staffId']?.toString() ?? '',
        employeeId: j['employeeId']?.toString() ?? '',
        status: j['status']?.toString() ?? 'معتمد',
        paymentMethod: j['paymentMethod']?.toString() ?? '',
        paymentLabel: j['paymentLabel']?.toString() ?? '',
        receiptId: j['receiptId']?.toString() ?? '',
        collectionForStatus: j['collectionForStatus']?.toString() ?? '',
        createdBy: j['createdBy']?.toString() ?? '',
        createdAt: j['createdAt']?.toString() ?? '',
        createdAtMs: (j['createdAtMs'] as num?)?.toInt() ?? 0,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'companyOwnerId': companyOwnerId,
        'type': type,
        'direction': direction,
        'amount': amount,
        'date': date,
        'description': description,
        'contractId': contractId,
        'supplierId': supplierId,
        'partId': partId,
        'staffId': staffId,
        'employeeId': employeeId,
        'status': status,
        if (paymentMethod.isNotEmpty) 'paymentMethod': paymentMethod,
        if (paymentLabel.isNotEmpty) 'paymentLabel': paymentLabel,
        if (receiptId.isNotEmpty) 'receiptId': receiptId,
        if (collectionForStatus.isNotEmpty) 'collectionForStatus': collectionForStatus,
        'createdBy': createdBy,
        'createdAt': createdAt,
        'createdAtMs': createdAtMs,
      };

  static const Map<String, String> typeLabels = {
    'sale': 'مبيعات', 'purchase': 'مشتريات', 'expense': 'مصروف',
    'salary': 'راتب', 'advance': 'سلفة', 'deduction': 'خصم',
    'allowance': 'بدل', 'custody': 'عهدة',
  };
}
