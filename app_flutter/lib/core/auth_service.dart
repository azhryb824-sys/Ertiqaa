import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'api_client.dart';
import 'constants.dart';
import 'session.dart';
import 'utils.dart';

/// إدارة الجلسة: قراءة/حفظ misadSession محلياً + توليد deviceId.
class SessionManager {
  SessionManager._();
  static final SessionManager instance = SessionManager._();

  static const String _sessionKey = AppConstants.kSession;
  static const String _deviceKey = AppConstants.kDeviceId;
  static const String _accessTokenKey = 'misadAccessToken';

  UserSession? _session;

  UserSession? get current => _session;

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    ApiClient.instance.setToken(prefs.getString(_accessTokenKey));
    final raw = prefs.getString(_sessionKey);
    if (raw != null) {
      try {
        _session = UserSession.fromJson(jsonDecode(raw));
      } catch (_) {}
    }
  }

  Future<String> getDeviceId() async {
    final prefs = await SharedPreferences.getInstance();
    var id = prefs.getString(_deviceKey);
    if (id == null || id.isEmpty) {
      id = '${DateTime.now().millisecondsSinceEpoch}-${DateTime.now().microsecondsSinceEpoch}'
          .replaceAll(RegExp(r'[^a-zA-Z0-9-]'), '');
      await prefs.setString(_deviceKey, id);
    }
    return id;
  }

  Future<void> save(UserSession session) async {
    _session = session;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_sessionKey, jsonEncode(session.toJson()));
  }

  Future<void> saveAccessToken(String token) async {
    ApiClient.instance.setToken(token);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_accessTokenKey, token);
  }

  Future<void> clear() async {
    _session = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_sessionKey);
    await prefs.remove(_accessTokenKey);
    ApiClient.instance.setToken(null);
  }

  /// تحويل جلسة من استجابة /api/auth/login.
  UserSession fromLoginResponse(Map<String, dynamic> j) {
    return UserSession(
      id: AppUtils.cleanId(j['id']),
      role: j['role'] ?? '',
      name: j['name'] ?? '',
      permissions: (j['permissions'] as List?)?.cast<String>() ?? [],
      mustChangePassword: j['mustChangePassword'] == true,
      companyOwnerId: j['companyOwnerId']?.toString() ?? '',
    );
  }
}

/// المصادقة.
class AuthService {
  AuthService._();
  static final AuthService instance = AuthService._();

  final ApiClient api = ApiClient.instance;
  final SessionManager session = SessionManager.instance;

  /// دخول: يحاول الخادم أولاً، وعند عدم توفره يتحقق محلياً (users + مستخدمو النظام).
  Future<LoginResult> login(String userIdRaw, String password) async {
    final userId = AppUtils.cleanId(userIdRaw);
    if (!AppUtils.isValidId(userId)) {
      return LoginResult(error: 'رقم الهوية غير صالح.');
    }
    UserSession? user;
    try {
      final j = await api.post('/api/auth/login', body: {'userId': userId, 'password': password});
      if (j != null && j['id'] != null) {
        final token = j['accessToken']?.toString() ?? '';
        if (token.isNotEmpty) await session.saveAccessToken(token);
        user = session.fromLoginResponse(j);
      }
    } catch (_) {
      // الخادم غير متاح → تحقق محلي
    }
    if (user == null) {
      user = _localLogin(userId, password);
    }
    if (user == null) {
      return LoginResult(error: 'رقم الهوية أو كلمة المرور غير صحيحة.');
    }
    return LoginResult(success: true, user: user);
  }

  UserSession? _localLogin(String userId, String password) {
    // من مستخدمي النظام المخزنين
    final rawUsers = _readLocalList(AppConstants.storageKeys.first); // misadUsers
    for (final u in rawUsers) {
      final id = AppUtils.cleanId(u['id']);
      final storedId = AppUtils.cleanId(u['companyOwnerId']);
      if (id == userId && u['password'] == password) {
        return UserSession(
          id: id,
          role: u['role'] ?? '',
          name: u['name'] ?? '',
          permissions: (u['permissions'] as List?)?.cast<String>() ?? [],
          mustChangePassword: u['mustChangePassword'] == true,
          companyOwnerId: u['role'] == AppConstants.roleOwner ? id : (storedId.isNotEmpty ? storedId : ''),
        );
      }
    }
    // من مستخدمي النظام الثابتين
    for (final u in AppConstants.systemUsers) {
      final fallbackId = AppUtils.cleanId(u['id']);
      final fallbackPassword = u['password']?.toString() ?? '';
      // لا تسمح أبداً بتسجيل دخول احتياطي ما لم تُضبط القيم السرية وقت البناء.
      if (fallbackId.isEmpty || fallbackPassword.isEmpty) continue;
      if (fallbackId == userId && fallbackPassword == password) {
        return UserSession(
          id: fallbackId,
          role: u['role'] as String,
          name: u['name'] as String,
          permissions: (u['permissions'] as List).cast<String>(),
          mustChangePassword: u['mustChangePassword'] == true,
          companyOwnerId: u['role'] == AppConstants.roleOwner ? fallbackId : (u['companyOwnerId']?.toString() ?? ''),
        );
      }
    }
    return null;
  }

  List<Map<String, dynamic>> _readLocalList(String key) {
    final prefs = _prefs;
    if (prefs == null) return [];
    final raw = prefs.getString(key);
    if (raw == null) return [];
    try {
      final v = jsonDecode(raw);
      if (v is List) return v.cast<Map<String, dynamic>>();
    } catch (_) {}
    return [];
  }

  SharedPreferences? _prefs;

  /// تفويض الجهاز عبر /api/device/authorize (عند وجود رابط دعوة).
  Future<bool> authorizeDevice(UserSession user) async {
    try {
      final deviceId = await session.getDeviceId();
      final r = await api.post('/api/device/authorize', body: {
        'userId': user.id, 'role': user.role, 'deviceId': deviceId,
      });
      return r is Map && (r['ok'] == true || r['authorized'] == true);
    } catch (_) {
      return false;
    }
  }

  void attachPrefs(SharedPreferences prefs) => _prefs = prefs;
}

class LoginResult {
  final bool success;
  final UserSession? user;
  final String? error;
  LoginResult({this.success = false, this.user, this.error});
}
