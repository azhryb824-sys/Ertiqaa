/// أصل (مصعد) — مفتاح misadAssets.
class Asset {
  String id;
  String companyOwnerId;
  String buildingId;
  String serial;
  String manufacturer;
  String motorManufacturer;
  String type;
  String status;
  int capacity;
  String installationDate;
  String lastMaintenanceDate;
  String nextMaintenanceDate;
  String contractId;
  String notes;

  Asset({
    required this.id,
    this.companyOwnerId = '',
    this.buildingId = '',
    this.serial = '',
    this.manufacturer = 'محلي',
    this.motorManufacturer = 'محلي',
    this.type = 'ركاب',
    this.status = 'يعمل',
    this.capacity = 0,
    this.installationDate = '',
    this.lastMaintenanceDate = '',
    this.nextMaintenanceDate = '',
    this.contractId = '',
    this.notes = '',
  });

  factory Asset.fromJson(Map<String, dynamic> j) => Asset(
        id: j['id']?.toString() ?? '',
        companyOwnerId: j['companyOwnerId']?.toString() ?? '',
        buildingId: j['buildingId']?.toString() ?? '',
        serial: j['serial']?.toString() ?? '',
        manufacturer: j['manufacturer']?.toString() ?? 'محلي',
        motorManufacturer: j['motorManufacturer']?.toString() ?? 'محلي',
        type: j['type']?.toString() ?? 'ركاب',
        status: j['status']?.toString() ?? 'يعمل',
        capacity: (j['capacity'] as num?)?.toInt() ?? 0,
        installationDate: j['installationDate']?.toString() ?? '',
        lastMaintenanceDate: j['lastMaintenanceDate']?.toString() ?? '',
        nextMaintenanceDate: j['nextMaintenanceDate']?.toString() ?? '',
        contractId: j['contractId']?.toString() ?? '',
        notes: j['notes']?.toString() ?? '',
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'companyOwnerId': companyOwnerId,
        'buildingId': buildingId,
        'serial': serial,
        'manufacturer': manufacturer,
        'motorManufacturer': motorManufacturer,
        'type': type,
        'status': status,
        'capacity': capacity,
        'installationDate': installationDate,
        'lastMaintenanceDate': lastMaintenanceDate,
        'nextMaintenanceDate': nextMaintenanceDate,
        'contractId': contractId,
        'notes': notes,
      };
}

/// اجتماع — مفتاح misadMeetings.
class Meeting {
  String id;
  String companyOwnerId;
  String title;
  String date;
  String time;
  String location;
  List<String> participants;
  String notes;
  String createdAt;

  Meeting({
    required this.id,
    this.companyOwnerId = '',
    this.title = '',
    this.date = '',
    this.time = '',
    this.location = '',
    List<String>? participants,
    this.notes = '',
    this.createdAt = '',
  }) : participants = participants ?? [];

  factory Meeting.fromJson(Map<String, dynamic> j) => Meeting(
        id: j['id']?.toString() ?? '',
        companyOwnerId: j['companyOwnerId']?.toString() ?? '',
        title: j['title']?.toString() ?? '',
        date: j['date']?.toString() ?? '',
        time: j['time']?.toString() ?? '',
        location: j['location']?.toString() ?? '',
        participants: (j['participants'] as List?)?.map((e) => e.toString()).toList() ?? [],
        notes: j['notes']?.toString() ?? '',
        createdAt: j['createdAt']?.toString() ?? '',
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'companyOwnerId': companyOwnerId,
        'title': title,
        'date': date,
        'time': time,
        'location': location,
        'participants': participants,
        'notes': notes,
        'createdAt': createdAt,
      };
}
