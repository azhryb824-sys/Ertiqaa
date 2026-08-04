import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api_client.dart';
import 'constants.dart';

/// إدارة التخزين: قراءة/كتابة مفاتيح misad* عبر /api/storage.
///
/// - عند الاتصال: قراءة دفعة (keys=) عند بدء التشغيل، وكتابة دفعة عند أي تغيير.
/// - عند الأوفلاين: كاش محلي (SharedPreferences) ثم مزامنة عند عودة الاتصال.
class StorageService extends ChangeNotifier {
  StorageService._();
  static final StorageService instance = StorageService._();

  final ApiClient api = ApiClient.instance;
  final Map<String, dynamic> _store = {};
  final Map<String, dynamic> _summaries = {};
  final List<String> _pendingSync = [];
  SharedPreferences? _prefs;
  bool _loaded = false;
  Timer? _flushTimer;
  final List<String> _criticalKeys = const ['misadContracts', 'misadCompanyStaff'];

  bool get loaded => _loaded;

  void attachPrefs(SharedPreferences prefs) {
    _prefs = prefs;
  }

  /// تحميل جميع مفاتيح dashboardKeys دفعة واحدة.
  Future<void> loadAll() async {
    if (_loaded) return;
    // كاش محلي أولاً للعرض الفوري
    if (_prefs != null) {
      for (final k in AppConstants.storageKeys) {
        final raw = _prefs!.getString(k);
        if (raw != null) _store[k] = _decode(raw);
      }
    }
    try {
      final j = await api.get('/api/storage', query: {'keys': AppConstants.storageKeys.join(',')});
      final values = (j?['values'] as Map?) ?? {};
      final summaries = (j?['summaries'] as Map?) ?? {};
      values.forEach((k, v) {
        _store[k.toString()] = v is String ? _decode(v) : v;
      });
      _summaries.clear();
      summaries.forEach((k, v) => _summaries[k.toString()] = v);
      await _persistAll();
      _loaded = true;
      notifyListeners();
    } catch (_) {
      _loaded = true; // الأوفلاين: نعمل من الكاش المحلي
      notifyListeners();
    }
  }

  /// قراءة مفتاح واحد.
  List<dynamic> list(String key) {
    final v = _store[key];
    if (v is List) return v;
    if (v is Map) return [v];
    return [];
  }

  dynamic raw(String key) => _store[key];

  /// كتابة قائمة (JSON) لمفتاح، مع مزامنة فورية عبر الشبكة.
  Future<void> write(String key, List<dynamic> value) async {
    _store[key] = value;
    await _persistLocal(key, value);
    _flush(key, jsonEncode(value), remove: false);
    notifyListeners();
  }

  Future<void> removeKey(String key) async {
    _store.remove(key);
    await _prefs?.remove(key);
    _flush(key, '', remove: true);
    notifyListeners();
  }

  void _flush(String key, String value, {required bool remove}) {
    _pendingSync.add(jsonEncode({'key': key, 'value': value, 'remove': remove}));
    if (_flushTimer != null) _flushTimer!.cancel();
    _flushTimer = Timer(const Duration(milliseconds: 300), _syncNow);
  }

  Future<void> _syncNow() async {
    if (_pendingSync.isEmpty) return;
    final updates = _pendingSync.map((s) => jsonDecode(s)).toList();
    _pendingSync.clear();
    try {
      await api.post('/api/storage/batch', body: {'updates': updates});
    } catch (_) {
      // إعادة المحاولة لاحقاً (تُترك القائمة في الذاكرة)
      _retryQueue.addAll(updates);
      _scheduleRetry();
    }
  }

  final List<dynamic> _retryQueue = [];
  bool _retrying = false;

  void _scheduleRetry() {
    if (_retrying) return;
    _retrying = true;
    Timer(const Duration(seconds: 8), () async {
      _retrying = false;
      if (_retryQueue.isEmpty) return;
      final batch = List.of(_retryQueue);
      _retryQueue.clear();
      try {
        await api.post('/api/storage/batch', body: {'updates': batch});
      } catch (_) {
        _retryQueue.addAll(batch);
        _scheduleRetry();
      }
    });
  }

  /// مزامنة كل ما تبقى عند عودة التطبيق/الاتصال.
  Future<void> syncPending() async {
    if (_retryQueue.isEmpty && _pendingSync.isEmpty) return;
    final batch = [..._retryQueue, ..._pendingSync.map((s) => jsonDecode(s))];
    _retryQueue.clear();
    _pendingSync.clear();
    try {
      await api.post('/api/storage/batch', body: {'updates': batch});
    } catch (_) {
      _retryQueue.addAll(batch);
      _scheduleRetry();
    }
  }

  dynamic _decode(String s) {
    try {
      return jsonDecode(s);
    } catch (_) {
      return s;
    }
  }

  Future<void> _persistAll() async {
    if (_prefs == null) return;
    for (final e in _store.entries) {
      await _prefs!.setString(e.key, e.value is String ? e.value as String : jsonEncode(e.value));
    }
  }

  Future<void> _persistLocal(String key, dynamic value) async {
    await _prefs?.setString(key, value is String ? value : jsonEncode(value));
  }

  /// ملخصات من الخادم (تُستخدم لعرض أسرع).
  Map<String, dynamic> get summaries => _summaries;
}
