/// نموذج عقد صيانة/تركيب — مفتاح misadContracts.
class Contract {
  String id;
  String companyOwnerId;
  String companyId;
  String type;
  String targetType;
  String clientId;
  String clientName;
  String clientCompanyUnifiedNumber;
  String clientCompanyName;
  String clientPhone;
  double value;
  Map<String, dynamic> elevatorInfo;
  Map<String, dynamic> installationInfo;
  String maintenancePeriod;
  List<MaintenanceItem> maintenanceChecklist;
  List<Building> buildings;
  List<DefaultItemRef> items;
  List<CustomItem> customItems;
  String details;
  String paymentMethod;
  String financialNotes;
  String status;
  String startDate;
  String endDate;
  int contractYears;
  String createdAt;
  int createdAtMs;
  String createdBy;
  Map<String, dynamic> company;
  List<PaymentPlanItem> paymentPlan;
  String? deliveryDate;
  String? maintenanceStartDate;
  String? maintenanceEndDate;
  String? oldContractFile;
  String? oldContractFileName;
  String? canceledAt;
  int? canceledAtMs;
  String? canceledBy;
  String? updatedAt;
  String? updatedBy;
  bool? amendmentRequired;
  String? activatedAt;
  String? activatedBy;
  String? renewedAt;
  List<TransferNotice> transferNotices;

  Contract({
    required this.id,
    this.companyOwnerId = '',
    this.companyId = '',
    this.type = 'صيانة',
    this.targetType = 'client',
    this.clientId = '',
    this.clientName = '',
    this.clientCompanyUnifiedNumber = '',
    this.clientCompanyName = '',
    this.clientPhone = '',
    this.value = 0,
    Map<String, dynamic>? elevatorInfo,
    Map<String, dynamic>? installationInfo,
    this.maintenancePeriod = '',
    List<MaintenanceItem>? maintenanceChecklist,
    List<Building>? buildings,
    List<DefaultItemRef>? items,
    List<CustomItem>? customItems,
    this.details = '',
    this.paymentMethod = '',
    this.financialNotes = '',
    this.status = 'بانتظار موافقة العميل',
    this.startDate = '',
    this.endDate = '',
    this.contractYears = 1,
    this.createdAt = '',
    this.createdAtMs = 0,
    this.createdBy = '',
    Map<String, dynamic>? company,
    List<PaymentPlanItem>? paymentPlan,
    this.deliveryDate,
    this.maintenanceStartDate,
    this.maintenanceEndDate,
    this.oldContractFile,
    this.oldContractFileName,
    this.canceledAt,
    this.canceledAtMs,
    this.canceledBy,
    this.updatedAt,
    this.updatedBy,
    this.amendmentRequired,
    this.activatedAt,
    this.activatedBy,
    this.renewedAt,
    List<TransferNotice>? transferNotices,
  })  : elevatorInfo = elevatorInfo ?? {},
        installationInfo = installationInfo ?? {},
        maintenanceChecklist = maintenanceChecklist ?? [],
        buildings = buildings ?? [],
        items = items ?? [],
        customItems = customItems ?? [],
        company = company ?? {},
        paymentPlan = paymentPlan ?? [],
        transferNotices = transferNotices ?? [];

  bool get isInstall => type == 'تركيب';
  bool get isActive => status == 'ساري';

  factory Contract.fromJson(Map<String, dynamic> j) {
    return Contract(
      id: j['id']?.toString() ?? '',
      companyOwnerId: j['companyOwnerId']?.toString() ?? '',
      companyId: j['companyId']?.toString() ?? '',
      type: j['type']?.toString() ?? 'صيانة',
      targetType: j['targetType']?.toString() ?? 'client',
      clientId: j['clientId']?.toString() ?? '',
      clientName: j['clientName']?.toString() ?? '',
      clientCompanyUnifiedNumber: j['clientCompanyUnifiedNumber']?.toString() ?? '',
      clientCompanyName: j['clientCompanyName']?.toString() ?? '',
      clientPhone: j['clientPhone']?.toString() ?? '',
      value: (j['value'] as num?)?.toDouble() ?? 0,
      elevatorInfo: Map<String, dynamic>.from(j['elevatorInfo'] as Map? ?? {}),
      installationInfo: Map<String, dynamic>.from(j['installationInfo'] as Map? ?? {}),
      maintenancePeriod: j['maintenancePeriod']?.toString() ?? '',
      maintenanceChecklist: ((j['maintenanceChecklist'] as List?) ?? [])
          .map((e) => MaintenanceItem.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList(),
      buildings: ((j['buildings'] as List?) ?? [])
          .map((e) => Building.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList(),
      items: ((j['items'] as List?) ?? [])
          .map((e) => DefaultItemRef.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList(),
      customItems: ((j['customItems'] as List?) ?? [])
          .map((e) => CustomItem.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList(),
      details: j['details']?.toString() ?? '',
      paymentMethod: j['paymentMethod']?.toString() ?? '',
      financialNotes: j['financialNotes']?.toString() ?? '',
      status: j['status']?.toString() ?? 'بانتظار موافقة العميل',
      startDate: j['startDate']?.toString() ?? '',
      endDate: j['endDate']?.toString() ?? '',
      contractYears: (j['contractYears'] as num?)?.toInt() ?? 1,
      createdAt: j['createdAt']?.toString() ?? '',
      createdAtMs: (j['createdAtMs'] as num?)?.toInt() ?? 0,
      createdBy: j['createdBy']?.toString() ?? '',
      company: Map<String, dynamic>.from(j['company'] as Map? ?? {}),
      paymentPlan: ((j['paymentPlan'] as List?) ?? [])
          .map((e) => PaymentPlanItem.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList(),
      deliveryDate: j['deliveryDate']?.toString(),
      maintenanceStartDate: j['maintenanceStartDate']?.toString(),
      maintenanceEndDate: j['maintenanceEndDate']?.toString(),
      oldContractFile: j['oldContractFile']?.toString(),
      oldContractFileName: j['oldContractFileName']?.toString(),
      canceledAt: j['canceledAt']?.toString(),
      canceledAtMs: (j['canceledAtMs'] as num?)?.toInt(),
      canceledBy: j['canceledBy']?.toString(),
      updatedAt: j['updatedAt']?.toString(),
      updatedBy: j['updatedBy']?.toString(),
      amendmentRequired: j['amendmentRequired'] as bool?,
      activatedAt: j['activatedAt']?.toString(),
      activatedBy: j['activatedBy']?.toString(),
      renewedAt: j['renewedAt']?.toString(),
      transferNotices: ((j['transferNotices'] as List?) ?? [])
          .map((e) => TransferNotice.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'companyOwnerId': companyOwnerId,
        'companyId': companyId,
        'type': type,
        'targetType': targetType,
        'clientId': clientId,
        'clientName': clientName,
        'clientCompanyUnifiedNumber': clientCompanyUnifiedNumber,
        'clientCompanyName': clientCompanyName,
        'clientPhone': clientPhone,
        'value': value,
        'elevatorInfo': elevatorInfo,
        'installationInfo': installationInfo,
        'maintenancePeriod': maintenancePeriod,
        'maintenanceChecklist': maintenanceChecklist.map((e) => e.toJson()).toList(),
        'buildings': buildings.map((e) => e.toJson()).toList(),
        'items': items.map((e) => e.toJson()).toList(),
        'customItems': customItems.map((e) => e.toJson()).toList(),
        'details': details,
        'paymentMethod': paymentMethod,
        'financialNotes': financialNotes,
        'status': status,
        'startDate': startDate,
        'endDate': endDate,
        'contractYears': contractYears,
        'createdAt': createdAt,
        'createdAtMs': createdAtMs,
        'createdBy': createdBy,
        'company': company,
        'paymentPlan': paymentPlan.map((e) => e.toJson()).toList(),
        if (deliveryDate != null) 'deliveryDate': deliveryDate,
        if (maintenanceStartDate != null) 'maintenanceStartDate': maintenanceStartDate,
        if (maintenanceEndDate != null) 'maintenanceEndDate': maintenanceEndDate,
        if (oldContractFile != null && oldContractFile!.isNotEmpty) 'oldContractFile': oldContractFile,
        if (oldContractFileName != null && oldContractFileName!.isNotEmpty) 'oldContractFileName': oldContractFileName,
        if (canceledAt != null) 'canceledAt': canceledAt,
        if (canceledAtMs != null) 'canceledAtMs': canceledAtMs,
        if (canceledBy != null) 'canceledBy': canceledBy,
        if (updatedAt != null) 'updatedAt': updatedAt,
        if (updatedBy != null) 'updatedBy': updatedBy,
        if (amendmentRequired != null) 'amendmentRequired': amendmentRequired,
        if (activatedAt != null) 'activatedAt': activatedAt,
        if (activatedBy != null) 'activatedBy': activatedBy,
        if (renewedAt != null) 'renewedAt': renewedAt,
        'transferNotices': transferNotices.map((e) => e.toJson()).toList(),
      };

  /// اسم الطرف الثاني (contractLabel).
  String label() => clientCompanyName.isNotEmpty
      ? clientCompanyName
      : clientName.isNotEmpty
          ? clientName
          : clientId.isNotEmpty
              ? clientId
              : clientCompanyUnifiedNumber.isNotEmpty
                  ? clientCompanyUnifiedNumber
                  : clientPhone.isNotEmpty
                      ? clientPhone
                      : id;

  /// اسم العميل الظاهر (نفس label لكن كخاصية).
  String get clientLabel => label();

  /// الأيام المتبقية حتى النهاية.
  int? daysLeft() {
    if (endDate.isEmpty) return null;
    final end = DateTime.tryParse('${endDate}T00:00');
    if (end == null) return null;
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final e = DateTime(end.year, end.month, end.day);
    return e.difference(today).inDays;
  }

  bool needsRenewal() {
    final d = daysLeft();
    return d != null && d >= 0 && d <= 30 && !const ['ملغي', 'محذوف'].contains(status);
  }
}

class Building {
  String name;
  String district;
  String mapUrl;
  String guardMobile;
  Building({this.name = '', this.district = '', this.mapUrl = '', this.guardMobile = ''});

  factory Building.fromJson(Map<String, dynamic> j) => Building(
        name: j['name']?.toString() ?? '',
        district: j['district']?.toString() ?? '',
        mapUrl: j['mapUrl']?.toString() ?? '',
        guardMobile: j['guardMobile']?.toString() ?? '',
      );

  Map<String, dynamic> toJson() =>
      {'name': name, 'district': district, 'mapUrl': mapUrl, 'guardMobile': guardMobile};

  String get key => [name, district, mapUrl, guardMobile].join('|');
}

class MaintenanceItem {
  String id;
  String section;
  String title;
  String status;
  bool checked;
  String note;
  MaintenanceItem({this.id = '', this.section = '', this.title = '', this.status = 'مطلوب', this.checked = false, this.note = ''});

  factory MaintenanceItem.fromJson(Map<String, dynamic> j) => MaintenanceItem(
        id: j['id']?.toString() ?? '',
        section: j['section']?.toString() ?? '',
        title: j['title']?.toString() ?? '',
        status: j['status']?.toString() ?? 'مطلوب',
        checked: j['checked'] == true,
        note: j['note']?.toString() ?? '',
      );

  Map<String, dynamic> toJson() => {'id': id, 'section': section, 'title': title, 'status': status, 'checked': checked, 'note': note};
}

class DefaultItemRef {
  dynamic id;
  String type;
  String section;
  String title;
  String description;
  double price;
  String companyOwnerId;
  DefaultItemRef({
    this.id,
    this.type = 'contract',
    this.section = 'بنود عامة',
    this.title = '',
    this.description = '',
    this.price = 0,
    this.companyOwnerId = '',
  });

  factory DefaultItemRef.fromJson(Map<String, dynamic> j) => DefaultItemRef(
        id: j['id'],
        type: j['type']?.toString() ?? 'contract',
        section: j['section']?.toString() ?? 'بنود عامة',
        title: j['title']?.toString() ?? '',
        description: j['description']?.toString() ?? '',
        price: (j['price'] as num?)?.toDouble() ?? 0,
        companyOwnerId: j['companyOwnerId']?.toString() ?? '',
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'type': type,
        'section': section,
        'title': title,
        'description': description,
        'price': price,
        'companyOwnerId': companyOwnerId,
      };
}

class CustomItem {
  String section;
  String title;
  String description;
  double price;
  CustomItem({this.section = 'بنود إضافية', this.title = '', this.description = '', this.price = 0});

  factory CustomItem.fromJson(Map<String, dynamic> j) => CustomItem(
        section: j['section']?.toString() ?? 'بنود إضافية',
        title: j['title']?.toString() ?? '',
        description: j['description']?.toString() ?? '',
        price: (j['price'] as num?)?.toDouble() ?? 0,
      );

  Map<String, dynamic> toJson() => {'section': section, 'title': title, 'description': description, 'price': price};
}

class PaymentPlanItem {
  String label;
  String description;
  double percent;
  PaymentPlanItem({this.label = '', this.description = '', this.percent = 0});

  factory PaymentPlanItem.fromJson(Map<String, dynamic> j) => PaymentPlanItem(
        label: j['label']?.toString() ?? '',
        description: j['description']?.toString() ?? '',
        percent: (j['percent'] as num?)?.toDouble() ?? 0,
      );

  Map<String, dynamic> toJson() => {'label': label, 'description': description, 'percent': percent};
}

class TransferNotice {
  String data;
  String name;
  String? uploadedAt;
  TransferNotice({this.data = '', this.name = '', this.uploadedAt});

  factory TransferNotice.fromJson(Map<String, dynamic> j) => TransferNotice(
        data: j['data']?.toString() ?? '',
        name: j['name']?.toString() ?? '',
        uploadedAt: j['uploadedAt']?.toString(),
      );

  Map<String, dynamic> toJson() => {'data': data, 'name': name, if (uploadedAt != null) 'uploadedAt': uploadedAt};
}
