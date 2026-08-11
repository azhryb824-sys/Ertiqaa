import '../core/constants.dart';
import '../core/session.dart';
import '../core/utils.dart';
import '../models/contract.dart';
import '../models/ticket.dart';

/// قواعد العمل المحورية — منقولة حرفياً من app.js.
class BusinessRules {
  BusinessRules._();

  /// ownerId الفعّال حسب الدور (مطابق لـ ownerId() في app.js).
  static String ownerId(UserSession s) {
    if (s.role == AppConstants.roleAdmin) {
      return s.linkedCoId.isNotEmpty ? s.linkedCoId : s.companyOwnerId;
    }
    return s.companyOwnerId.isNotEmpty ? s.companyOwnerId : s.id;
  }

  /// owner السجل (من الحقول المستخدمة في التخزين).
  static String recOwner(Map<String, dynamic> r) {
    return (r['companyOwnerId'] ?? r['createdBy'] ?? r['linkedBy'] ?? 'platform').toString();
  }

  /// هل السجل يتبع نفس المنشأة.
  static bool sameCompany(UserSession s, List<Map<String, dynamic>> ownerCompanies, Map<String, dynamic> r) {
    final oid = ownerId(s);
    final ro = recOwner(r);
    if (ro == oid || ro == s.id) return true;
    for (final oc in ownerCompanies) {
      final owners = ((oc['ownerIds'] as List?) ?? []).map((e) => e.toString()).toList();
      final ownerId2 = oc['ownerId']?.toString() ?? '';
      if ((owners.contains(oid) || ownerId2 == oid) &&
          (owners.contains(ro) || ownerId2 == ro)) {
        return true;
      }
    }
    return false;
  }

  /// تطابق عميل (هوية أو رقم موحد منشأة).
  static bool clientMatches(UserSession s, Map<String, dynamic> r, List<Map<String, dynamic>> clientCompanies) {
    final id = s.id;
    if (r['clientId']?.toString() == id) return true;
    final unified = r['clientCompanyUnifiedNumber']?.toString() ?? '';
    if (unified.isNotEmpty) {
      for (final cc in clientCompanies) {
        if (cc['ownerId']?.toString() == id && cc['unifiedNumber']?.toString() == unified) return true;
      }
    }
    return false;
  }

  /// سجل مرئي (per-record visibility).
  static bool visibleRecord(
    UserSession s,
    Map<String, dynamic> r,
    List<Map<String, dynamic>> ownerCompanies,
    List<Map<String, dynamic>> clientCompanies,
  ) {
    if (s.isClient) return clientMatches(s, r, clientCompanies);
    if (s.isTechnician) {
      // الفني: زيارات/بلاغات مسندة له فقط
      return r['assignedTo']?.toString() == s.id;
    }
    return sameCompany(s, ownerCompanies, r);
  }

  /// حالة العقد الحالية بعد انتهاء صلاحيته.
  static bool needsRenewal(Contract c) {
    final end = DateTime.tryParse(c.endDate);
    return end != null && end.isBefore(DateTime.now()) && c.status != AppConstants.statusCancelled &&
        c.status != AppConstants.statusDeleted && c.status != AppConstants.statusExpired;
  }

  /// معلومات العقد المالية.
  static Map<String, dynamic> contractFinance(Contract c, List<Map<String, dynamic>> finEntries) {
    final total = c.value;
    var paid = 0.0;
    for (final e in finEntries) {
      if (e['contractId']?.toString() == c.id && e['direction']?.toString() == 'in') {
        paid += (e['amount'] as num?)?.toDouble() ?? 0;
      }
    }
    final remaining = (total - paid) < 0 ? 0.0 : total - paid;
    // للتركيب فقط: تأخر دفعات الخطة
    var overdue = 0.0;
    final isInstall = c.type == 'تركيب';
    if (isInstall && c.paymentPlan.isNotEmpty) {
      for (final p in c.paymentPlan) {
        final expected = total * (p.percent / 100);
        var received = 0.0;
        for (final e in finEntries) {
          if (e['contractId']?.toString() == c.id &&
              e['direction']?.toString() == 'in' &&
              e['paymentLabel']?.toString() == p.label) {
            received += (e['amount'] as num?)?.toDouble() ?? 0;
          }
        }
        overdue += (expected - received) < 0 ? 0.0 : (expected - received);
      }
    }
    return {
      'total': total, 'paid': paid, 'remaining': remaining, 'overdue': overdue, 'isInstall': isInstall,
    };
  }

  /// SLA للبلاغ: urgent=4h، high=12h، غيرها 24h.
  static Map<String, dynamic> slaInfo(Ticket t, {DateTime? now}) {
    final nowMs = (now ?? DateTime.now()).millisecondsSinceEpoch;
    final createdAtMs = t.createdAtMs > 0 ? t.createdAtMs : nowMs;
    final hours = (nowMs - createdAtMs) / 3600000.0;
    final limit = switch (t.priority) {
      'urgent' => 4.0,
      'high' => 12.0,
      _ => 24.0,
    };
    return {
      'hours': hours,
      'limit': limit,
      'overdue': hours > limit && t.status != 'مغلق',
      'overdueBy': hours > limit ? hours - limit : 0.0,
    };
  }

  /// هل يمكن للمستخدم تعديل العقد.
  static bool canEditContract(UserSession s, String status) {
    if (!s.canManage) return false;
    return !const ['ساري', 'ملغي', 'محذوف'].contains(status);
  }

  /// صلاحية كتابة تقرير زيارة (الفني المسند فقط).
  static bool canWriteReport(UserSession s, Map<String, dynamic> visit) {
    return s.isTechnician && visit['assignedTo']?.toString() == s.id;
  }

  /// خطة الدفعات الافتراضية لعقود التركيب.
  static List<Map<String, dynamic>> defaultPaymentPlan() {
    return AppConstants.defaultPaymentPlan.map((e) => Map<String, dynamic>.from(e)).toList();
  }

  /// توليد الزيارات الدورية لعقد صيانة (شهرياً من البداية إلى النهاية، T09:00).
  static List<Map<String, dynamic>> generateVisits(
    Contract c,
    List<Map<String, dynamic>> staff,
    {required List<String> existingVisitIds, DateTime? nowTime})
  {
    final visits = <Map<String, dynamic>>[];
    if (c.type != 'صيانة') return visits;
    final start = DateTime.tryParse(c.startDate);
    final end = DateTime.tryParse(c.endDate);
    if (start == null || end == null) return visits;
    final available = staff
        .where((s) =>
            (s['role']?.toString() == 'technician' || s['role']?.toString() == 'engineer') &&
            s['availability']?.toString() == 'working')
        .toList();
    final now = nowTime ?? DateTime.now();
    var ts = start.millisecondsSinceEpoch;
    var i = 0;
    final usedIds = existingVisitIds.toSet();
    while (ts <= end.millisecondsSinceEpoch) {
      final d = DateTime.fromMillisecondsSinceEpoch(ts);
      final sched = DateTime(d.year, d.month, d.day, 9, 0);
      if (!sched.isBefore(now)) {
        final id = 'VIS-${DateTime.now().millisecondsSinceEpoch}-${i + 1}';
        var assignedTo = '';
        var assignedName = '';
        var status = 'بانتظار الإسناد';
        if (available.isNotEmpty) {
          final staffM = available[(i) % available.length];
          assignedTo = staffM['identity']?.toString() ?? staffM['id']?.toString() ?? '';
          assignedName = staffM['name']?.toString() ?? '';
          status = 'مجدولة';
        }
        var vid = id;
        var n = 0;
        while (usedIds.contains(vid)) { n++; vid = 'VIS-${DateTime.now().millisecondsSinceEpoch + n}-${i + 1}'; }
        usedIds.add(vid);
        visits.add({
          'id': vid,
          'companyOwnerId': c.companyOwnerId,
          'contractId': c.id,
          'visitType': 'دورية',
          'clientId': c.clientId,
          'clientName': c.clientName,
          'clientCompanyUnifiedNumber': c.clientCompanyUnifiedNumber,
          'clientCompanyName': c.clientCompanyName,
          'building': c.buildings.isNotEmpty ? c.buildings.first.toJson() : {},
          'elevatorInfo': c.elevatorInfo,
          'assignedTo': assignedTo,
          'assignedName': assignedName,
          'scheduledAt': sched.millisecondsSinceEpoch,
          'status': status,
          'periodic': true,
          'notes': '',
          'createdAt': DateTime.now().millisecondsSinceEpoch,
        });
      }
      ts = DateTime(d.year, d.month + 1, d.day).millisecondsSinceEpoch;
      i++;
    }
    return visits;
  }

  /// إنشاء فاتورة البلاغ غير المكفول (100 ريال) إذا لم يوجد عقد صيانة ساري.
  static Map<String, dynamic>? autoInvoice(
    Map<String, dynamic> ticket,
    List<Map<String, dynamic>> contracts,
    List<Map<String, dynamic>> ownerCompanies,
  ) {
    final clientId = ticket['clientId']?.toString() ?? '';
    final contractId = ticket['contractId']?.toString() ?? '';
    final now = DateTime.now();
    for (final c in contracts) {
      if (c['status']?.toString() != 'ساري') continue;
      if (c['type']?.toString() != 'صيانة') continue;
      final matchesContract = contractId.isNotEmpty && c['id']?.toString() == contractId;
      final matchesClient = clientId.isNotEmpty && c['clientId']?.toString() == clientId;
      if (!matchesContract && !matchesClient) continue;
      final start = DateTime.tryParse(c['startDate']?.toString() ?? '');
      final end = DateTime.tryParse(c['endDate']?.toString() ?? '');
      if (start != null && end != null && !now.isBefore(start) && !now.isAfter(end)) return null;
    }
    var bank = '';
    for (final oc in ownerCompanies) {
      bank = oc['bankAccount']?.toString() ?? '';
      if (bank.isNotEmpty) break;
    }
    return {
      'id': 'INV-${DateTime.now().millisecondsSinceEpoch}',
      'companyOwnerId': ticket['companyOwnerId'],
      'contractId': contractId,
      'clientId': clientId,
      'clientName': ticket['clientName'],
      'clientCompanyUnifiedNumber': ticket['clientCompanyUnifiedNumber'],
      'clientCompanyName': ticket['clientCompanyName'],
      'value': 100,
      'status': 'غير مدفوعة',
      'bankAccount': bank,
      'createdAt': DateTime.now().millisecondsSinceEpoch,
      'source': 'ticket',
      'ticketId': ticket['id'],
    };
  }

  /// مهجور: تفعيل العقد لا يثبت تحصيلاً. استخدم مسار الدفعة/سند القبض الفعلي.
  @Deprecated('Contract activation must not create a financial collection')
  static Map<String, dynamic>? recordContractCollection(Map<String, dynamic> contract, UserSession s) {
    return null;
  }

  /// توليد مستخلص تلقائي لقيد البيع إذا لم يوجد مستخلص بنفس القيد.
  static Map<String, dynamic>? ensureClaimForEntry(Map<String, dynamic> entry, List<Map<String, dynamic>> claims) {
    if (entry['type']?.toString() != 'sale') return null;
    if (entry['contractId']?.toString().isEmpty ?? true) return null;
    final amount = (entry['amount'] as num?)?.toDouble() ?? 0;
    if (amount <= 0) return null;
    if (entry['collectionForStatus']?.toString() != 'ساري') return null;
    final eid = entry['id']?.toString() ?? '';
    for (final cl in claims) {
      if (cl['receiptEntryId']?.toString() == eid) return null;
    }
    return {
      'id': 'RCT-${DateTime.now().millisecondsSinceEpoch}',
      'companyOwnerId': entry['companyOwnerId'],
      'contractId': entry['contractId'],
      'value': amount,
      'period': '',
      'status': 'قيد المراجعة',
      'receiptEntryId': eid,
      'createdAt': DateTime.now().millisecondsSinceEpoch,
    };
  }

  /// تصنيف دفعة مالية.
  static String entryTypeLabel(String type) {
    const labels = {
      'sale': 'مبيعات', 'purchase': 'مشتريات', 'expense': 'مصروف',
      'salary': 'راتب', 'advance': 'سلفة', 'deduction': 'خصم',
      'allowance': 'بدل', 'custody': 'عهدة',
    };
    return labels[type] ?? type;
  }
}
