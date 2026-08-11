import 'dart:convert';
import 'package:http/http.dart' as http;

/// عميل HTTP خفيف لجميع نقاط API.
class ApiClient {
  ApiClient._();
  static final ApiClient instance = ApiClient._();

  // خادم الإنتاج. للاختبار المحلي على المحاكي استخدم http://10.0.2.2:4173
  String baseUrl = 'https://ertiqaa.onrender.com';
  Duration timeout = const Duration(seconds: 30);
  String? _token;

  void setToken(String? token) {
    final value = token?.trim() ?? '';
    _token = value.isEmpty ? null : value;
  }

  /// ضبط قاعدة عنوان الخادم (يمكن تغييرها من شاشة الإعدادات).
  void setBaseUrl(String url) {
    baseUrl = url.replaceAll(RegExp(r'/$'), '');
  }

  Uri _uri(String path, [Map<String, dynamic>? query]) {
    final base = Uri.parse(baseUrl);
    return base.replace(
      path: '${base.path == '/' ? '' : base.path}/$path'.replaceAll('//', '/'),
      queryParameters: query?.map((k, v) => MapEntry(k, v?.toString())),
    );
  }

  Future<dynamic> get(String path, {Map<String, dynamic>? query}) async {
    final res = await http.get(_uri(path, query), headers: _headers()).timeout(timeout);
    return _decode(res);
  }

  Future<dynamic> post(String path, {Object? body, Map<String, dynamic>? query, Map<String, String>? headers, bool isForm = false}) async {
    final res = isForm
        ? await http.post(_uri(path, query), headers: headers, body: body).timeout(timeout)
        : await http.post(_uri(path, query), headers: {..._headers(), ...?headers}, body: jsonEncode(body)).timeout(timeout);
    return _decode(res);
  }

  Future<http.Response> postRaw(String path, {Object? body, Map<String, dynamic>? query}) async {
    return await http.post(_uri(path, query), headers: _headers(), body: jsonEncode(body)).timeout(timeout);
  }

  Future<dynamic> postMultipart(String path, Map<String, String> fields, List<http.MultipartFile> files, {Map<String, dynamic>? query}) async {
    final req = http.MultipartRequest('POST', _uri(path, query));
    req.fields.addAll(fields);
    req.files.addAll(files);
    final streamed = await req.send().timeout(const Duration(minutes: 5));
    final res = await http.Response.fromStream(streamed);
    return _decode(res);
  }

  Map<String, String> _headers() => {
        'Content-Type': 'application/json',
        if (_token != null) 'Authorization': 'Bearer $_token',
      };

  dynamic _decode(http.Response res) {
    if (res.body.isEmpty) return null;
    try {
      return jsonDecode(utf8.decode(res.bodyBytes));
    } catch (_) {
      throw ApiException('استجابة غير صالحة (${res.statusCode})');
    }
  }
}

class ApiException implements Exception {
  final String message;
  ApiException(this.message);
  @override
  String toString() => message;
}
