/// تقرير زيارة فنية — مفتاح misadVisitReports.
class VisitReport {
  String id;
  String companyOwnerId;
  String visitId;
  String visitType;
  String contractId;
  String clientId;
  String clientName;
  String clientCompanyUnifiedNumber;
  String clientCompanyName;
  String buildingName;
  String technicianId;
  String technician;
  String elevatorStatus;
  String workDone;
  String issues;
  String parts;
  String recommendations;
  String attachments;
  String description;
  String status;
  bool locked;
  String createdAt;
  int createdAtMs;

  VisitReport({
    required this.id,
    this.companyOwnerId = '',
    this.visitId = '',
    this.visitType = '',
    this.contractId = '',
    this.clientId = '',
    this.clientName = '',
    this.clientCompanyUnifiedNumber = '',
    this.clientCompanyName = '',
    this.buildingName = '',
    this.technicianId = '',
    this.technician = '',
    this.elevatorStatus = 'يعمل بشكل طبيعي',
    this.workDone = '',
    this.issues = '',
    this.parts = '',
    this.recommendations = '',
    this.attachments = '',
    this.description = '',
    this.status = 'بانتظار اعتماد العميل',
    this.locked = true,
    this.createdAt = '',
    this.createdAtMs = 0,
  });

  factory VisitReport.fromJson(Map<String, dynamic> j) => VisitReport(
        id: j['id']?.toString() ?? '',
        companyOwnerId: j['companyOwnerId']?.toString() ?? '',
        visitId: j['visitId']?.toString() ?? '',
        visitType: j['visitType']?.toString() ?? '',
        contractId: j['contractId']?.toString() ?? '',
        clientId: j['clientId']?.toString() ?? '',
        clientName: j['clientName']?.toString() ?? '',
        clientCompanyUnifiedNumber: j['clientCompanyUnifiedNumber']?.toString() ?? '',
        clientCompanyName: j['clientCompanyName']?.toString() ?? '',
        buildingName: j['buildingName']?.toString() ?? '',
        technicianId: j['technicianId']?.toString() ?? '',
        technician: j['technician']?.toString() ?? '',
        elevatorStatus: j['elevatorStatus']?.toString() ?? 'يعمل بشكل طبيعي',
        workDone: j['workDone']?.toString() ?? '',
        issues: j['issues']?.toString() ?? '',
        parts: j['parts']?.toString() ?? '',
        recommendations: j['recommendations']?.toString() ?? '',
        attachments: j['attachments']?.toString() ?? '',
        description: j['description']?.toString() ?? '',
        status: j['status']?.toString() ?? 'بانتظار اعتماد العميل',
        locked: j['locked'] == true,
        createdAt: j['createdAt']?.toString() ?? '',
        createdAtMs: (j['createdAtMs'] as num?)?.toInt() ?? 0,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'companyOwnerId': companyOwnerId,
        'visitId': visitId,
        'visitType': visitType,
        'contractId': contractId,
        'clientId': clientId,
        'clientName': clientName,
        'clientCompanyUnifiedNumber': clientCompanyUnifiedNumber,
        'clientCompanyName': clientCompanyName,
        'buildingName': buildingName,
        'technicianId': technicianId,
        'technician': technician,
        'elevatorStatus': elevatorStatus,
        'workDone': workDone,
        'issues': issues,
        'parts': parts,
        'recommendations': recommendations,
        'attachments': attachments,
        'description': description,
        'status': status,
        'locked': locked,
        'createdAt': createdAt,
        'createdAtMs': createdAtMs,
      };
}
