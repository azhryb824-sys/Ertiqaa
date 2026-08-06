/// عضو فريق — مفتاح misadCompanyStaff.
class Staff {
  String id;
  String companyOwnerId;
  String identity;
  String name;
  String role;
  String availability;
  String status;
  String createdAt;
  String? jobTitle;
  String? department;
  String? employmentType;
  String? employmentStatus;
  String? hireDate;
  double baseSalary;
  String? bankAccount;
  double leaveBalance;
  String? hrNotes;

  Staff({
    required this.id,
    this.companyOwnerId = '',
    this.identity = '',
    this.name = '',
    this.role = 'technician',
    this.availability = 'working',
    this.status = 'مرتبط',
    this.createdAt = '',
    this.jobTitle,
    this.department,
    this.employmentType,
    this.employmentStatus,
    this.hireDate,
    this.baseSalary = 0,
    this.bankAccount,
    this.leaveBalance = 0,
    this.hrNotes,
  });

  bool get isAvailable => availability == 'working';

  factory Staff.fromJson(Map<String, dynamic> j) => Staff(
        id: j['id']?.toString() ?? '',
        companyOwnerId: j['companyOwnerId']?.toString() ?? '',
        identity: j['identity']?.toString() ?? '',
        name: j['name']?.toString() ?? '',
        role: j['role']?.toString() ?? 'technician',
        availability: j['availability']?.toString() ?? 'working',
        status: j['status']?.toString() ?? 'مرتبط',
        createdAt: j['createdAt']?.toString() ?? '',
        jobTitle: j['jobTitle']?.toString(),
        department: j['department']?.toString(),
        employmentType: j['employmentType']?.toString(),
        employmentStatus: j['employmentStatus']?.toString(),
        hireDate: j['hireDate']?.toString(),
        baseSalary: (j['baseSalary'] as num?)?.toDouble() ?? 0,
        bankAccount: j['bankAccount']?.toString(),
        leaveBalance: (j['leaveBalance'] as num?)?.toDouble() ?? 0,
        hrNotes: j['hrNotes']?.toString(),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'companyOwnerId': companyOwnerId,
        'identity': identity,
        'name': name,
        'role': role,
        'availability': availability,
        'status': status,
        'createdAt': createdAt,
        if (jobTitle != null) 'jobTitle': jobTitle,
        if (department != null) 'department': department,
        if (employmentType != null) 'employmentType': employmentType,
        if (employmentStatus != null) 'employmentStatus': employmentStatus,
        if (hireDate != null) 'hireDate': hireDate,
        'baseSalary': baseSalary,
        if (bankAccount != null) 'bankAccount': bankAccount,
        'leaveBalance': leaveBalance,
        if (hrNotes != null) 'hrNotes': hrNotes,
      };
}

/// قطعة مخزون — مفتاح misadPartsInventory.
class Part {
  String id;
  String companyOwnerId;
  String name;
  String sku;
  String category;
  int qty;
  int minQty;
  double unitCost;
  String supplier;
  List<PartOffer> suppliers;
  String createdAt;

  Part({
    required this.id,
    this.companyOwnerId = '',
    this.name = '',
    this.sku = '',
    this.category = '',
    this.qty = 0,
    this.minQty = 1,
    this.unitCost = 0,
    this.supplier = '',
    List<PartOffer>? suppliers,
    this.createdAt = '',
  }) : suppliers = suppliers ?? [];

  factory Part.fromJson(Map<String, dynamic> j) => Part(
        id: j['id']?.toString() ?? '',
        companyOwnerId: j['companyOwnerId']?.toString() ?? '',
        name: j['name']?.toString() ?? '',
        sku: j['sku']?.toString() ?? '',
        category: j['category']?.toString() ?? '',
        qty: (j['qty'] as num?)?.toInt() ?? 0,
        minQty: (j['minQty'] as num?)?.toInt() ?? 1,
        unitCost: (j['unitCost'] as num?)?.toDouble() ?? 0,
        supplier: j['supplier']?.toString() ?? '',
        suppliers: ((j['suppliers'] as List?) ?? [])
            .map((e) => PartOffer.fromJson(Map<String, dynamic>.from(e as Map)))
            .toList(),
        createdAt: j['createdAt']?.toString() ?? '',
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'companyOwnerId': companyOwnerId,
        'name': name,
        'sku': sku,
        'category': category,
        'qty': qty,
        'minQty': minQty,
        'unitCost': unitCost,
        'supplier': supplier,
        'suppliers': suppliers.map((e) => e.toJson()).toList(),
        'createdAt': createdAt,
      };

  bool get isLow => qty <= minQty;

  /// أفضل عرض سعر من الموردين (الأقل سعراً).
  PartOffer? bestOffer() {
    final offers = suppliers.where((o) => o.price > 0).toList()..sort((a, b) => a.price.compareTo(b.price));
    if (offers.isNotEmpty) return offers.first;
    if (unitCost > 0) return PartOffer(supplierName: supplier.isNotEmpty ? supplier : 'سعر القطعة', price: unitCost);
    return null;
  }
}

class PartOffer {
  String supplierId;
  String supplierName;
  double price;
  String leadTime;
  String warranty;
  PartOffer({this.supplierId = '', this.supplierName = '', this.price = 0, this.leadTime = '', this.warranty = ''});

  factory PartOffer.fromJson(Map<String, dynamic> j) => PartOffer(
        supplierId: j['supplierId']?.toString() ?? '',
        supplierName: j['supplierName']?.toString() ?? '',
        price: (j['price'] as num?)?.toDouble() ?? 0,
        leadTime: j['leadTime']?.toString() ?? '',
        warranty: j['warranty']?.toString() ?? '',
      );

  Map<String, dynamic> toJson() => {
        'supplierId': supplierId,
        'supplierName': supplierName,
        'price': price,
        'leadTime': leadTime,
        'warranty': warranty,
      };
}

/// مورد — مفتاح misadSuppliers.
class Supplier {
  String id;
  String companyOwnerId;
  String name;
  String phone;
  String email;
  String city;
  String category;
  String rating;
  String notes;
  String createdAt;

  Supplier({
    required this.id,
    this.companyOwnerId = '',
    this.name = '',
    this.phone = '',
    this.email = '',
    this.city = '',
    this.category = 'توريد شامل',
    this.rating = 'تحت التجربة',
    this.notes = '',
    this.createdAt = '',
  });

  factory Supplier.fromJson(Map<String, dynamic> j) => Supplier(
        id: j['id']?.toString() ?? '',
        companyOwnerId: j['companyOwnerId']?.toString() ?? '',
        name: j['name']?.toString() ?? '',
        phone: j['phone']?.toString() ?? '',
        email: j['email']?.toString() ?? '',
        city: j['city']?.toString() ?? '',
        category: j['category']?.toString() ?? 'توريد شامل',
        rating: j['rating']?.toString() ?? 'تحت التجربة',
        notes: j['notes']?.toString() ?? '',
        createdAt: j['createdAt']?.toString() ?? '',
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'companyOwnerId': companyOwnerId,
        'name': name,
        'phone': phone,
        'email': email,
        'city': city,
        'category': category,
        'rating': rating,
        'notes': notes,
        'createdAt': createdAt,
      };
}

/// بند افتراضي — مفتاح misadDefaultItems.
class DefaultItem {
  dynamic id;
  String companyOwnerId;
  String type;
  String section;
  String title;
  String description;
  double price;

  DefaultItem({
    this.id,
    this.companyOwnerId = '',
    this.type = 'contract',
    this.section = 'بنود عامة',
    this.title = '',
    this.description = '',
    this.price = 0,
  });

  factory DefaultItem.fromJson(Map<String, dynamic> j) => DefaultItem(
        id: j['id'],
        companyOwnerId: j['companyOwnerId']?.toString() ?? '',
        type: j['type']?.toString() ?? 'contract',
        section: j['section']?.toString() ?? 'بنود عامة',
        title: j['title']?.toString() ?? '',
        description: j['description']?.toString() ?? '',
        price: (j['price'] as num?)?.toDouble() ?? 0,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'companyOwnerId': companyOwnerId,
        'type': type,
        'section': section,
        'title': title,
        'description': description,
        'price': price,
      };
}
