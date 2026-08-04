import 'contract.dart';

/// عرض سعر — مفتاح misadQuotes.
class Quote {
  String id;
  String companyOwnerId;
  String clientId;
  String clientName;
  String clientCompanyUnifiedNumber;
  String clientCompanyName;
  String client;
  String title;
  String type;
  double value;
  double subtotal;
  String status;
  String reportId;
  Map<String, dynamic> elevatorInfo;
  List<MaintenanceItem> maintenanceChecklist;
  List<PaymentPlanItem> paymentPlan;
  List<DefaultItemRef> items;
  List<PartsItem> partsItems;
  List<CustomItem> customItems;
  String details;
  String createdAt;
  String createdBy;
  String? approvedAt;
  String? approvedBy;
  bool? approvedByClient;
  String? rejectedAt;
  String? rejectedBy;

  Quote({
    required this.id,
    this.companyOwnerId = '',
    this.clientId = '',
    this.clientName = '',
    this.clientCompanyUnifiedNumber = '',
    this.clientCompanyName = '',
    this.client = '',
    this.title = '',
    this.type = 'تركيب',
    this.value = 0,
    this.subtotal = 0,
    this.status = 'بانتظار المراجعة والاعتماد',
    this.reportId = '',
    Map<String, dynamic>? elevatorInfo,
    List<MaintenanceItem>? maintenanceChecklist,
    List<PaymentPlanItem>? paymentPlan,
    List<DefaultItemRef>? items,
    List<PartsItem>? partsItems,
    List<CustomItem>? customItems,
    this.details = '',
    this.createdAt = '',
    this.createdBy = '',
    this.approvedAt,
    this.approvedBy,
    this.approvedByClient,
    this.rejectedAt,
    this.rejectedBy,
  })  : elevatorInfo = elevatorInfo ?? {},
        maintenanceChecklist = maintenanceChecklist ?? [],
        paymentPlan = paymentPlan ?? [],
        items = items ?? [],
        partsItems = partsItems ?? [],
        customItems = customItems ?? [];

  factory Quote.fromJson(Map<String, dynamic> j) => Quote(
        id: j['id']?.toString() ?? '',
        companyOwnerId: j['companyOwnerId']?.toString() ?? '',
        clientId: j['clientId']?.toString() ?? '',
        clientName: j['clientName']?.toString() ?? '',
        clientCompanyUnifiedNumber: j['clientCompanyUnifiedNumber']?.toString() ?? '',
        clientCompanyName: j['clientCompanyName']?.toString() ?? '',
        client: j['client']?.toString() ?? '',
        title: j['title']?.toString() ?? '',
        type: j['type']?.toString() ?? 'تركيب',
        value: (j['value'] as num?)?.toDouble() ?? 0,
        subtotal: (j['subtotal'] as num?)?.toDouble() ?? 0,
        status: j['status']?.toString() ?? 'بانتظار المراجعة والاعتماد',
        reportId: j['reportId']?.toString() ?? '',
        elevatorInfo: Map<String, dynamic>.from(j['elevatorInfo'] as Map? ?? {}),
        maintenanceChecklist: ((j['maintenanceChecklist'] as List?) ?? [])
            .map((e) => MaintenanceItem.fromJson(Map<String, dynamic>.from(e as Map)))
            .toList(),
        paymentPlan: ((j['paymentPlan'] as List?) ?? [])
            .map((e) => PaymentPlanItem.fromJson(Map<String, dynamic>.from(e as Map)))
            .toList(),
        items: ((j['items'] as List?) ?? [])
            .map((e) => DefaultItemRef.fromJson(Map<String, dynamic>.from(e as Map)))
            .toList(),
        partsItems: ((j['partsItems'] as List?) ?? [])
            .map((e) => PartsItem.fromJson(Map<String, dynamic>.from(e as Map)))
            .toList(),
        customItems: ((j['customItems'] as List?) ?? [])
            .map((e) => CustomItem.fromJson(Map<String, dynamic>.from(e as Map)))
            .toList(),
        details: j['details']?.toString() ?? '',
        createdAt: j['createdAt']?.toString() ?? '',
        createdBy: j['createdBy']?.toString() ?? '',
        approvedAt: j['approvedAt']?.toString(),
        approvedBy: j['approvedBy']?.toString(),
        approvedByClient: j['approvedByClient'] as bool?,
        rejectedAt: j['rejectedAt']?.toString(),
        rejectedBy: j['rejectedBy']?.toString(),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'companyOwnerId': companyOwnerId,
        'clientId': clientId,
        'clientName': clientName,
        'clientCompanyUnifiedNumber': clientCompanyUnifiedNumber,
        'clientCompanyName': clientCompanyName,
        'client': client,
        'title': title,
        'type': type,
        'value': value,
        'subtotal': subtotal,
        'status': status,
        'reportId': reportId,
        'elevatorInfo': elevatorInfo,
        'maintenanceChecklist': maintenanceChecklist.map((e) => e.toJson()).toList(),
        'paymentPlan': paymentPlan.map((e) => e.toJson()).toList(),
        'items': items.map((e) => e.toJson()).toList(),
        'partsItems': partsItems.map((e) => e.toJson()).toList(),
        'customItems': customItems.map((e) => e.toJson()).toList(),
        'details': details,
        'createdAt': createdAt,
        'createdBy': createdBy,
        if (approvedAt != null) 'approvedAt': approvedAt,
        if (approvedBy != null) 'approvedBy': approvedBy,
        if (approvedByClient != null) 'approvedByClient': approvedByClient,
        if (rejectedAt != null) 'rejectedAt': rejectedAt,
        if (rejectedBy != null) 'rejectedBy': rejectedBy,
      };

  String get clientLabel => client.isNotEmpty
      ? client
      : clientCompanyName.isNotEmpty
          ? clientCompanyName
          : clientName.isNotEmpty
              ? clientName
              : 'عميل';
}

class PartsItem {
  String section;
  String title;
  String description;
  double price;
  String partId;
  String supplierId;
  double unitPrice;
  int qty;
  PartsItem({
    this.section = 'قطع غيار بأقل سعر',
    this.title = '',
    this.description = '',
    this.price = 0,
    this.partId = '',
    this.supplierId = '',
    this.unitPrice = 0,
    this.qty = 1,
  });

  factory PartsItem.fromJson(Map<String, dynamic> j) => PartsItem(
        section: j['section']?.toString() ?? 'قطع غيار بأقل سعر',
        title: j['title']?.toString() ?? '',
        description: j['description']?.toString() ?? '',
        price: (j['price'] as num?)?.toDouble() ?? 0,
        partId: j['partId']?.toString() ?? '',
        supplierId: j['supplierId']?.toString() ?? '',
        unitPrice: (j['unitPrice'] as num?)?.toDouble() ?? 0,
        qty: (j['qty'] as num?)?.toInt() ?? 1,
      );

  Map<String, dynamic> toJson() => {
        'section': section,
        'title': title,
        'description': description,
        'price': price,
        'partId': partId,
        'supplierId': supplierId,
        'unitPrice': unitPrice,
        'qty': qty,
      };
}

class CustomItem {
  String title;
  String description;
  double price;
  CustomItem({this.title = '', this.description = '', this.price = 0});

  factory CustomItem.fromJson(Map<String, dynamic> j) => CustomItem(
        title: j['title']?.toString() ?? '',
        description: j['description']?.toString() ?? '',
        price: (j['price'] as num?)?.toDouble() ?? 0,
      );

  Map<String, dynamic> toJson() => {
        'title': title,
        'description': description,
        'price': price,
      };
}
