/// منشأة المالك — مفتاح misadOwnerCompanies.
class OwnerCompany {
  String id;
  List<String> ownerIds;
  String ownerId;
  String name;
  String unifiedNumber;
  String commercialNumber;
  String taxNumber;
  String phone;
  String email;
  String address;
  String pdfFooter;
  String companyLetterhead;
  String companyLetterheadName;
  String bankAccount;
  String createdAt;
  String updatedAt;
  String? deletedAt;

  OwnerCompany({
    required this.id,
    List<String>? ownerIds,
    this.ownerId = '',
    this.name = '',
    this.unifiedNumber = '',
    this.commercialNumber = '',
    this.taxNumber = '',
    this.phone = '',
    this.email = '',
    this.address = '',
    this.pdfFooter = '',
    this.companyLetterhead = '',
    this.companyLetterheadName = '',
    this.bankAccount = '',
    this.createdAt = '',
    this.updatedAt = '',
    this.deletedAt,
  }) : ownerIds = ownerIds ?? [];

  factory OwnerCompany.fromJson(Map<String, dynamic> j) => OwnerCompany(
        id: j['id']?.toString() ?? '',
        ownerIds: (j['ownerIds'] as List?)?.map((e) => e.toString()).toList() ?? [],
        ownerId: j['ownerId']?.toString() ?? '',
        name: j['name']?.toString() ?? '',
        unifiedNumber: j['unifiedNumber']?.toString() ?? '',
        commercialNumber: j['commercialNumber']?.toString() ?? '',
        taxNumber: j['taxNumber']?.toString() ?? '',
        phone: j['phone']?.toString() ?? '',
        email: j['email']?.toString() ?? '',
        address: j['address']?.toString() ?? '',
        pdfFooter: j['pdfFooter']?.toString() ?? '',
        companyLetterhead: j['companyLetterhead']?.toString() ?? '',
        companyLetterheadName: j['companyLetterheadName']?.toString() ?? '',
        bankAccount: j['bankAccount']?.toString() ?? '',
        createdAt: j['createdAt']?.toString() ?? '',
        updatedAt: j['updatedAt']?.toString() ?? '',
        deletedAt: j['deletedAt']?.toString(),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'ownerIds': ownerIds,
        'ownerId': ownerId,
        'name': name,
        'unifiedNumber': unifiedNumber,
        'commercialNumber': commercialNumber,
        'taxNumber': taxNumber,
        'phone': phone,
        'email': email,
        'address': address,
        'pdfFooter': pdfFooter,
        'companyLetterhead': companyLetterhead,
        'companyLetterheadName': companyLetterheadName,
        'bankAccount': bankAccount,
        'createdAt': createdAt,
        'updatedAt': updatedAt,
        if (deletedAt != null) 'deletedAt': deletedAt,
      };
}

/// منشأة عميل — مفتاح misadClientCompanies.
class ClientCompany {
  String id;
  String ownerId;
  String name;
  String unifiedNumber;
  String taxNumber;
  String createdAt;

  ClientCompany({
    required this.id,
    this.ownerId = '',
    this.name = '',
    this.unifiedNumber = '',
    this.taxNumber = '',
    this.createdAt = '',
  });

  factory ClientCompany.fromJson(Map<String, dynamic> j) => ClientCompany(
        id: j['id']?.toString() ?? '',
        ownerId: j['ownerId']?.toString() ?? '',
        name: j['name']?.toString() ?? '',
        unifiedNumber: j['unifiedNumber']?.toString() ?? '',
        taxNumber: j['taxNumber']?.toString() ?? '',
        createdAt: j['createdAt']?.toString() ?? '',
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'ownerId': ownerId,
        'name': name,
        'unifiedNumber': unifiedNumber,
        'taxNumber': taxNumber,
        'createdAt': createdAt,
      };
}
