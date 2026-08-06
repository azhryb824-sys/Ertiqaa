/// مستند معتمد (ختم/توقيع/خطاب) — مفتاح misadApprovedDocuments.
/// العلامة (specKind = 'stamp' | 'signature') تُخزَّن في حقل `kind`.
class Doc {
  String id;
  String companyOwnerId;
  String kind;
  String title;
  String status;
  String uploadedAt;
  String? reviewedAt;
  String? reviewedBy;
  String? rejectionReason;
  String? data;
  String? dataName;
  String? expiresAt;

  Doc({
    required this.id,
    this.companyOwnerId = '',
    this.kind = 'stamp',
    this.title = '',
    this.status = 'بانتظار المراجعة والاعتماد',
    this.uploadedAt = '',
    this.reviewedAt,
    this.reviewedBy,
    this.rejectionReason,
    this.data,
    this.dataName,
    this.expiresAt,
  });

  bool get isApproved => status == 'معتمد';
  bool get isExpiringSoon {
    if (expiresAt == null || expiresAt!.isEmpty) return false;
    final now = DateTime.now();
    final exp = DateTime.tryParse(expiresAt!);
    if (exp == null) return false;
    return exp.isBefore(now.add(const Duration(days: 30)));
  }

  factory Doc.fromJson(Map<String, dynamic> j) => Doc(
        id: j['id']?.toString() ?? '',
        companyOwnerId: j['companyOwnerId']?.toString() ?? '',
        kind: j['kind']?.toString() ?? 'stamp',
        title: j['title']?.toString() ?? '',
        status: j['status']?.toString() ?? 'بانتظار المراجعة والاعتماد',
        uploadedAt: j['uploadedAt']?.toString() ?? '',
        reviewedAt: j['reviewedAt']?.toString(),
        reviewedBy: j['reviewedBy']?.toString(),
        rejectionReason: j['rejectionReason']?.toString(),
        data: j['data']?.toString(),
        dataName: j['dataName']?.toString(),
        expiresAt: j['expiresAt']?.toString(),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'companyOwnerId': companyOwnerId,
        'kind': kind,
        'title': title,
        'status': status,
        'uploadedAt': uploadedAt,
        if (reviewedAt != null) 'reviewedAt': reviewedAt,
        if (reviewedBy != null) 'reviewedBy': reviewedBy,
        if (rejectionReason != null) 'rejectionReason': rejectionReason,
        if (data != null) 'data': data,
        if (dataName != null) 'dataName': dataName,
        if (expiresAt != null) 'expiresAt': expiresAt,
      };

  static const Map<String, String> kindLabels = {
    'stamp': 'ختم',
    'signature': 'توقيع',
    'letterhead': 'ترويسة',
    'other': 'أخرى',
  };
}
