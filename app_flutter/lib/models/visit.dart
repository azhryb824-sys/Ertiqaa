/// زيارة — مفتاح misadVisits.
class Visit {
  String id;
  String companyOwnerId;
  String contractId;
  String visitType;
  String clientId;
  String clientName;
  String clientCompanyUnifiedNumber;
  String clientCompanyName;
  Map<String, dynamic> building;
  Map<String, dynamic> elevatorInfo;
  String assignedTo;
  String assignedName;
  String scheduledAt;
  String status;
  bool periodic;
  String notes;
  String createdAt;
  int createdAtMs;
  String? reportId;
  Rating? rating;
  String? canceledAt;
  int? canceledAtMs;
  String? canceledBy;
  String? cancelReason;

  Visit({
    required this.id,
    this.companyOwnerId = '',
    this.contractId = '',
    this.visitType = '',
    this.clientId = '',
    this.clientName = '',
    this.clientCompanyUnifiedNumber = '',
    this.clientCompanyName = '',
    Map<String, dynamic>? building,
    Map<String, dynamic>? elevatorInfo,
    this.assignedTo = '',
    this.assignedName = '',
    this.scheduledAt = '',
    this.status = 'مجدولة',
    this.periodic = false,
    this.notes = '',
    this.createdAt = '',
    this.createdAtMs = 0,
    this.reportId,
    this.rating,
    this.canceledAt,
    this.canceledAtMs,
    this.canceledBy,
    this.cancelReason,
  })  : building = building ?? {},
        elevatorInfo = elevatorInfo ?? {};

  factory Visit.fromJson(Map<String, dynamic> j) => Visit(
        id: j['id']?.toString() ?? '',
        companyOwnerId: j['companyOwnerId']?.toString() ?? '',
        contractId: j['contractId']?.toString() ?? '',
        visitType: j['visitType']?.toString() ?? '',
        clientId: j['clientId']?.toString() ?? '',
        clientName: j['clientName']?.toString() ?? '',
        clientCompanyUnifiedNumber: j['clientCompanyUnifiedNumber']?.toString() ?? '',
        clientCompanyName: j['clientCompanyName']?.toString() ?? '',
        building: Map<String, dynamic>.from(j['building'] as Map? ?? {}),
        elevatorInfo: Map<String, dynamic>.from(j['elevatorInfo'] as Map? ?? {}),
        assignedTo: j['assignedTo']?.toString() ?? '',
        assignedName: j['assignedName']?.toString() ?? '',
        scheduledAt: j['scheduledAt']?.toString() ?? '',
        status: j['status']?.toString() ?? 'مجدولة',
        periodic: j['periodic'] == true,
        notes: j['notes']?.toString() ?? '',
        createdAt: j['createdAt']?.toString() ?? '',
        createdAtMs: (j['createdAtMs'] as num?)?.toInt() ?? 0,
        reportId: j['reportId']?.toString(),
        rating: j['rating'] != null ? Rating.fromJson(Map<String, dynamic>.from(j['rating'] as Map)) : null,
        canceledAt: j['canceledAt']?.toString(),
        canceledAtMs: (j['canceledAtMs'] as num?)?.toInt(),
        canceledBy: j['canceledBy']?.toString(),
        cancelReason: j['cancelReason']?.toString(),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'companyOwnerId': companyOwnerId,
        'contractId': contractId,
        'visitType': visitType,
        'clientId': clientId,
        'clientName': clientName,
        'clientCompanyUnifiedNumber': clientCompanyUnifiedNumber,
        'clientCompanyName': clientCompanyName,
        'building': building,
        'elevatorInfo': elevatorInfo,
        'assignedTo': assignedTo,
        'assignedName': assignedName,
        'scheduledAt': scheduledAt,
        'status': status,
        'periodic': periodic,
        'notes': notes,
        'createdAt': createdAt,
        'createdAtMs': createdAtMs,
        if (reportId != null) 'reportId': reportId,
        if (rating != null) 'rating': rating!.toJson(),
        if (canceledAt != null) 'canceledAt': canceledAt,
        if (canceledAtMs != null) 'canceledAtMs': canceledAtMs,
        if (canceledBy != null) 'canceledBy': canceledBy,
        if (cancelReason != null) 'cancelReason': cancelReason,
      };

  bool get isCancelled => status == 'ملغية';
}

class Rating {
  int stars;
  String notes;
  Rating({this.stars = 0, this.notes = ''});

  factory Rating.fromJson(Map<String, dynamic> j) =>
      Rating(stars: (j['stars'] as num?)?.toInt() ?? 0, notes: j['notes']?.toString() ?? '');

  Map<String, dynamic> toJson() => {'stars': stars, 'notes': notes};
}
