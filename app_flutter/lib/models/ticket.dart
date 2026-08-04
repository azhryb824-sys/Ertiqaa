import 'contract.dart';

/// بلاغ — مفتاح misadTickets.
class Ticket {
  String id;
  String companyOwnerId;
  String title;
  String description;
  String priority;
  String status;
  String contractId;
  String clientId;
  String clientName;
  String clientCompanyUnifiedNumber;
  String clientCompanyName;
  Map<String, dynamic> building;
  Map<String, dynamic> elevatorInfo;
  String assignedTo;
  String createdBy;
  String createdByName;
  String createdAt;
  int createdAtMs;
  List<dynamic> updates;
  String? invoiceId;

  Ticket({
    required this.id,
    this.companyOwnerId = '',
    this.title = '',
    this.description = '',
    this.priority = 'medium',
    this.status = 'مفتوح',
    this.contractId = '',
    this.clientId = '',
    this.clientName = '',
    this.clientCompanyUnifiedNumber = '',
    this.clientCompanyName = '',
    Map<String, dynamic>? building,
    Map<String, dynamic>? elevatorInfo,
    this.assignedTo = '',
    this.createdBy = '',
    this.createdByName = '',
    this.createdAt = '',
    this.createdAtMs = 0,
    List<dynamic>? updates,
    this.invoiceId,
  })  : building = building ?? {},
        elevatorInfo = elevatorInfo ?? {},
        updates = updates ?? [];

  factory Ticket.fromJson(Map<String, dynamic> j) => Ticket(
        id: j['id']?.toString() ?? '',
        companyOwnerId: j['companyOwnerId']?.toString() ?? '',
        title: j['title']?.toString() ?? '',
        description: j['description']?.toString() ?? '',
        priority: j['priority']?.toString() ?? 'medium',
        status: j['status']?.toString() ?? 'مفتوح',
        contractId: j['contractId']?.toString() ?? '',
        clientId: j['clientId']?.toString() ?? '',
        clientName: j['clientName']?.toString() ?? '',
        clientCompanyUnifiedNumber: j['clientCompanyUnifiedNumber']?.toString() ?? '',
        clientCompanyName: j['clientCompanyName']?.toString() ?? '',
        building: Map<String, dynamic>.from(j['building'] as Map? ?? {}),
        elevatorInfo: Map<String, dynamic>.from(j['elevatorInfo'] as Map? ?? {}),
        assignedTo: j['assignedTo']?.toString() ?? '',
        createdBy: j['createdBy']?.toString() ?? '',
        createdByName: j['createdByName']?.toString() ?? '',
        createdAt: j['createdAt']?.toString() ?? '',
        createdAtMs: (j['createdAtMs'] as num?)?.toInt() ?? 0,
        updates: (j['updates'] as List?) ?? [],
        invoiceId: j['invoiceId']?.toString(),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'companyOwnerId': companyOwnerId,
        'title': title,
        'description': description,
        'priority': priority,
        'status': status,
        'contractId': contractId,
        'clientId': clientId,
        'clientName': clientName,
        'clientCompanyUnifiedNumber': clientCompanyUnifiedNumber,
        'clientCompanyName': clientCompanyName,
        'building': building,
        'elevatorInfo': elevatorInfo,
        'assignedTo': assignedTo,
        'createdBy': createdBy,
        'createdByName': createdByName,
        'createdAt': createdAt,
        'createdAtMs': createdAtMs,
        'updates': updates,
        if (invoiceId != null) 'invoiceId': invoiceId,
      };

  String get clientLabel => clientCompanyName.isNotEmpty
      ? clientCompanyName
      : clientName.isNotEmpty
          ? clientName
          : 'غير محدد';
}
