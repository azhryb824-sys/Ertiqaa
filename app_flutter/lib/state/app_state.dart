import 'package:flutter/foundation.dart';
import '../core/auth_service.dart';
import '../core/constants.dart';
import '../core/session.dart';
import '../core/storage_service.dart';
import '../core/utils.dart';
import '../models/contract.dart';
import '../models/ticket.dart';
import 'business_rules.dart';

/// حالة التطبيق الموحدة: الجلسة + التخزين + التنقل + عمليات البيانات.
class AppState extends ChangeNotifier {
  AppState._();
  static final AppState instance = AppState._();

  final StorageService storage = StorageService.instance;
  final AuthService auth = AuthService.instance;
  final SessionManager sessionManager = SessionManager.instance;

  UserSession? _session;
  String _currentPage = 'overview';
  final List<Map<String, dynamic>> _routeStack = [];

  UserSession? get session => _session;
  String get currentPage => _currentPage;
  bool get isLoggedIn => _session != null;
  List<Map<String, dynamic>> get routeStack => _routeStack;

  // ===== التهيئة =====
  Future<void> init() async {
    await sessionManager.init();
    final saved = sessionManager.current;
    if (saved != null) {
      _session = saved;
      notifyListeners();
    }
    await storage.loadAll();
  }

  Future<LoginResult> login(String userId, String password) async {
    final result = await auth.login(userId, password);
    if (result.success && result.user != null) {
      _session = result.user;
      await sessionManager.save(result.user!);
      _currentPage = 'overview';
      notifyListeners();
    }
    return result;
  }

  Future<void> logout() async {
    await sessionManager.clear();
    _session = null;
    _currentPage = 'overview';
    _routeStack.clear();
    notifyListeners();
  }

  // ===== التنقل =====
  void go(String page) {
    if (_currentPage == page) return;
    _routeStack.add({'page': _currentPage, 'data': _currentPageData});
    _currentPage = page;
    _currentPageData = {};
    notifyListeners();
  }

  void goWithData(String page, Map<String, dynamic> data) {
    _routeStack.add({'page': _currentPage, 'data': _currentPageData});
    _currentPage = page;
    _currentPageData = data;
    notifyListeners();
  }

  Map<String, dynamic> _currentPageData = {};
  Map<String, dynamic> get currentPageData => _currentPageData;

  void back() {
    if (_routeStack.isEmpty) {
      _currentPage = 'overview';
    } else {
      final prev = _routeStack.removeLast();
      _currentPage = prev['page']?.toString() ?? 'overview';
      _currentPageData = (prev['data'] as Map<String, dynamic>?) ?? {};
    }
    notifyListeners();
  }

  /// صفحات التنقل حسب الدور (مع حقن knowledge-hub ثانياً).
  List<List<String>> get navPages {
    final s = _session;
    if (s == null) return [];
    final base = AppConstants.navs[s.role] ?? [];
    final pages = <List<String>>[];
    final hub = const ['knowledge-hub', 'المعرفة التقنية'];
    for (final p in base) {
      pages.add(p);
      if (p.first == base.first.first) pages.add(hub);
    }
    if (base.isEmpty) pages.add(hub);
    return pages;
  }

  // ===== بيانات مجمعة =====
  List<Map<String, dynamic>> get ownerCompanies =>
      storage.list(AppConstants.storageKeys[7]).map((e) => Map<String, dynamic>.from(e as Map)).toList();

  List<Map<String, dynamic>> get clientCompanies =>
      storage.list(AppConstants.storageKeys[6]).map((e) => Map<String, dynamic>.from(e as Map)).toList();

  List<Contract> get allContracts =>
      storage.list('misadContracts').map((e) => Contract.fromJson(Map<String, dynamic>.from(e as Map))).toList();

  List<Ticket> get allTickets =>
      storage.list('misadTickets').map((e) => Ticket.fromJson(Map<String, dynamic>.from(e as Map))).toList();

  List<Map<String, dynamic>> get allFinancialEntries =>
      storage.list('misadFinancialEntries').map((e) => Map<String, dynamic>.from(e as Map)).toList();

  List<Map<String, dynamic>> get allStaff =>
      storage.list('misadCompanyStaff').map((e) => Map<String, dynamic>.from(e as Map)).toList();

  List<Map<String, dynamic>> get allVisits =>
      storage.list('misadVisits').map((e) => Map<String, dynamic>.from(e as Map)).toList();

  List<Map<String, dynamic>> get allReports =>
      storage.list('misadVisitReports').map((e) => Map<String, dynamic>.from(e as Map)).toList();

  List<Map<String, dynamic>> get allQuotes =>
      storage.list('misadQuotes').map((e) => Map<String, dynamic>.from(e as Map)).toList();

  List<Map<String, dynamic>> get allParts =>
      storage.list('misadPartsInventory').map((e) => Map<String, dynamic>.from(e as Map)).toList();

  List<Map<String, dynamic>> get allSuppliers =>
      storage.list('misadSuppliers').map((e) => Map<String, dynamic>.from(e as Map)).toList();

  List<Map<String, dynamic>> get allDefaultItems =>
      storage.list('misadDefaultItems').map((e) => Map<String, dynamic>.from(e as Map)).toList();

  List<Map<String, dynamic>> get allReceipts =>
      storage.list('misadReceipts').map((e) => Map<String, dynamic>.from(e as Map)).toList();

  List<Map<String, dynamic>> get allClaims =>
      storage.list(AppConstants.kClaims).map((e) => Map<String, dynamic>.from(e as Map)).toList();

  List<Map<String, dynamic>> get allDocs =>
      storage.list('misadCompanyDocs').map((e) => Map<String, dynamic>.from(e as Map)).toList();

  List<Map<String, dynamic>> get allActivity =>
      storage.list('misadActivityLog').map((e) => Map<String, dynamic>.from(e as Map)).toList();

  List<Map<String, dynamic>> get allAssets =>
      storage.list('misadElevatorAssets').map((e) => Map<String, dynamic>.from(e as Map)).toList();

  List<Map<String, dynamic>> get allMeetings =>
      storage.list('misadMeetings').map((e) => Map<String, dynamic>.from(e as Map)).toList();

  List<Map<String, dynamic>> get allBanners =>
      storage.list('misadSystemBanners').map((e) => Map<String, dynamic>.from(e as Map)).toList();

  List<Map<String, dynamic>> get allKnowledge =>
      storage.list('misadKnowledgePages').map((e) => Map<String, dynamic>.from(e as Map)).toList();

  List<Map<String, dynamic>> get allInvites =>
      storage.list('misadAdminInvites').map((e) => Map<String, dynamic>.from(e as Map)).toList();

  List<Map<String, dynamic>> get allUsers =>
      storage.list('misadUsers').map((e) => Map<String, dynamic>.from(e as Map)).toList();

  // ===== النطاق والفلترة =====
  String get ownerId => BusinessRules.ownerId(_session!);

  bool sameCompany(Map<String, dynamic> r) =>
      BusinessRules.sameCompany(_session!, ownerCompanies, r);

  /// منشأة المالك الحالية (الترويسة/البنك للفواتير).
  Map<String, dynamic> get myOwnerCompany {
    for (final oc in ownerCompanies) {
      final owners = ((oc['ownerIds'] as List?) ?? []).map((e) => e.toString()).toList();
      final oid = oc['ownerId']?.toString() ?? '';
      if (owners.contains(ownerId) || oid == ownerId) return oc;
    }
    return {};
  }

  /// العقود المرئية للجلسة.
  List<Contract> get visibleContracts {
    final s = _session!;
    if (s.isClient) {
      final u = clientCompanies;
      return allContracts.where((c) =>
              BusinessRules.clientMatches(s, c.toJson(), u)).toList();
    }
    return allContracts.where((c) => sameCompany(c.toJson())).toList();
  }

  /// البلاغات المرئية.
  List<Ticket> get visibleTickets {
    final s = _session!;
    if (s.isClient) {
      final u = clientCompanies;
      return allTickets.where((t) =>
              BusinessRules.clientMatches(s, t.toJson(), u)).toList();
    }
    return allTickets.where((t) {
      if (s.isTechnician) return t.assignedTo == s.id;
      return sameCompany(t.toJson());
    }).toList();
  }

  /// الزيارات المرئية.
  List<Map<String, dynamic>> get visibleVisits {
    final s = _session!;
    if (s.isClient) {
      final u = clientCompanies;
      return allVisits.where((v) =>
              BusinessRules.clientMatches(s, v, u)).toList();
    }
    final now = DateTime.now().millisecondsSinceEpoch;
    return allVisits.where((v) {
      if (s.isTechnician) {
        if (v['assignedTo']?.toString() == s.id) return true;
        // الملغاة تظهر للفني خلال ساعة من الإلغاء
        if (v['status']?.toString() == 'ملغية') {
          final canceledAtMs = (v['canceledAtMs'] as num?)?.toInt() ?? 0;
          if (canceledAtMs > 0 && now - canceledAtMs < 3600000) return true;
        }
        return false;
      }
      return sameCompany(v);
    }).toList();
  }

  // ===== الكتابة (مع تحديث فوري) =====
  Future<void> saveList(String key, List<dynamic> value) => storage.write(key, value);

  Future<void> append(String key, Map<String, dynamic> record) async {
    final list = List<dynamic>.from(storage.list(key));
    list.add(record);
    await storage.write(key, list);
  }

  Future<void> update(String key, Map<String, dynamic> record, {String? idField}) {
    final f = idField ?? 'id';
    final list = storage.list(key).map((e) => Map<String, dynamic>.from(e as Map)).toList();
    final idx = list.indexWhere((e) => e[f]?.toString() == record[f]?.toString());
    if (idx >= 0) {
      list[idx] = record;
    } else {
      list.add(record);
    }
    return storage.write(key, list);
  }

  Future<void> remove(String key, String id, {String? idField}) {
    final f = idField ?? 'id';
    final list = storage.list(key).map((e) => Map<String, dynamic>.from(e as Map)).toList()
      ..removeWhere((e) => e[f]?.toString() == id);
    return storage.write(key, list);
  }

  // ===== عمليات منطق العمل =====
  String nextContractId() =>
      AppConstants.nextContractId(allContracts.map((c) => c.id).toList());

  /// تفعيل عقد: تسجيل التحصيل + توليد الزيارات الدورية + إنشاء المستخلص.
  Future<void> activateContract(Contract c) async {
    final json = c.toJson();
    json['status'] = AppConstants.statusActive;
    json['activatedAt'] = DateTime.now().millisecondsSinceEpoch;
    json['activatedBy'] = _session!.id;

    // قيد المبيعات (تسجيل التحصيل)
    final entry = BusinessRules.recordContractCollection(json, _session!);
    final entries = List<Map<String, dynamic>>.from(allFinancialEntries);
    if (entry != null) {
      final dup = entries.any((e) =>
          e['contractId']?.toString() == c.id &&
          e['type']?.toString() == 'sale' &&
          e['collectionForStatus']?.toString() == 'ساري');
      if (!dup) {
        entries.add(entry);
        await storage.write('misadFinancialEntries', entries);
        // مستخلص تلقائي
        final claims = List<Map<String, dynamic>>.from(allClaims);
        final claim = BusinessRules.ensureClaimForEntry(entry, claims);
        if (claim != null) {
          claims.add(claim);
          await storage.write(AppConstants.kClaims, claims);
        }
      }
    }

    // زيارات دورية للصيانة
    if (c.type == 'صيانة') {
      final visits = List<Map<String, dynamic>>.from(allVisits);
      final existing = visits.map((v) => v['id']?.toString() ?? '').toList();
      final generated = BusinessRules.generateVisits(c, allStaff, existingVisitIds: existing);
      visits.addAll(generated);
      await storage.write('misadVisits', visits);
    }

    await update('misadContracts', json);
  }

  /// إلغاء عقد: تعليق كل زياراته.
  Future<void> cancelContract(Contract c, {String reason = ''}) async {
    final json = c.toJson();
    json['status'] = AppConstants.statusCancelled;
    json['canceledAt'] = DateTime.now().millisecondsSinceEpoch;
    json['canceledAtMs'] = DateTime.now().millisecondsSinceEpoch;
    json['canceledBy'] = _session!.id;
    if (reason.isNotEmpty) json['cancelReason'] = reason;

    final visits = allVisits.map((v) => Map<String, dynamic>.from(v)).toList();
    for (final v in visits) {
      if (v['contractId']?.toString() == c.id && v['status'] != 'مكتملة') {
        v['status'] = 'ملغية';
      }
    }
    await storage.write('misadVisits', visits);
    await update('misadContracts', json);
  }

  /// تجديد عقد: تمديد النهاية +contractYears وإرجاع الحالة ساري.
  Future<void> renewContract(Contract c) async {
    final json = c.toJson();
    final end = DateTime.tryParse(json['endDate']?.toString() ?? '');
    if (end != null) {
      final years = (json['contractYears'] as num?)?.toInt() ?? 1;
      json['endDate'] = AppUtils.addYears(end, years).toIso8601String();
    }
    json['status'] = AppConstants.statusActive;
    json['renewedAt'] = DateTime.now().millisecondsSinceEpoch;
    await update('misadContracts', json);
  }

  /// إنشاء عقد جديد.
  Future<Contract> createContract(Map<String, dynamic> data) async {
    final c = Contract.fromJson(data);
    await append('misadContracts', c.toJson());
    return c;
  }

  /// سجل النشاط.
  Future<void> logActivity(String action, {String entityType = '', String entityId = '', String details = ''}) async {
    final entry = {
      'id': 'ACT-${DateTime.now().millisecondsSinceEpoch}',
      'companyOwnerId': ownerId,
      'userId': _session!.id,
      'userName': _session!.name,
      'action': action,
      'entityType': entityType,
      'entityId': entityId,
      'details': details,
      'ip': '',
      'createdAtMs': DateTime.now().millisecondsSinceEpoch,
      'createdAt': DateTime.now().toIso8601String(),
    };
    await append('misadActivityLog', entry);
  }

  /// بيانات عربية/رقمية للتسلسل الرقمي.
  static int nowMs() => DateTime.now().millisecondsSinceEpoch;
}
