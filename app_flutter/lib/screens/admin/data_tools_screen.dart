import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import 'dart:convert';
import 'dart:io';
import '../../core/api_client.dart';
import '../../core/constants.dart';
import '../../core/utils.dart';
import '../../state/app_state.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// إدارة البيانات: تصدير/استيراد/تنظيف/نسخ احتياطي/استيراد عقود Excel (owner + admin).
class DataToolsScreen extends StatefulWidget {
  const DataToolsScreen({super.key});

  @override
  State<DataToolsScreen> createState() => _DataToolsScreenState();
}

class _DataToolsScreenState extends State<DataToolsScreen> {
  bool _busy = false;

  @override
  Widget build(BuildContext context) {
    final app = AppState.instance;
    final session = app.session!;
    if (!session.canManage) {
      return const Scaffold(
        backgroundColor: AppTheme.bg,
        body: EmptyState('غير متاح لدورك.', icon: Icons.lock_outline),
      );
    }
    return Scaffold(
      backgroundColor: AppTheme.bg,
      appBar: AppBar(title: const Text('أدوات البيانات')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _card(
            children: [
              _tile(
                icon: Icons.table_chart_rounded,
                color: AppTheme.primary,
                title: 'استيراد عقود من Excel (ذكاء اصطناعي)',
                subtitle: 'اختر ملف .xlsx وسيتم تحليل العقود وربطها تلقائياً.',
                onTap: () => _aiImport(app),
              ),
              const Divider(height: 1),
              _tile(
                icon: Icons.download_rounded,
                color: AppTheme.primary,
                title: 'تصدير البيانات (JSON)',
                subtitle: 'تصدير كل مفاتيح misad*.',
                onTap: () => _export(app),
              ),
              const Divider(height: 1),
              _tile(
                icon: Icons.cloud_upload_rounded,
                color: AppTheme.gold,
                title: 'نسخة احتياطية كاملة للخادم',
                subtitle: 'رفع نسخة من كل بياناتك إلى التخزين السحابي.',
                onTap: () => _backup(app),
              ),
              const Divider(height: 1),
              _tile(
                icon: Icons.cloud_download_rounded,
                color: AppTheme.success,
                title: 'استعادة من النسخة الاحتياطية',
                subtitle: 'سحب بياناتك المحفوظة من الخادم.',
                onTap: () => _restore(app),
              ),
              const Divider(height: 1),
              _tile(
                icon: Icons.cleaning_services_rounded,
                color: AppTheme.danger,
                title: 'تنظيف المسودات القديمة',
                subtitle: 'حذف مسودات النماذج المتروكة.',
                onTap: () => _cleanDrafts(app),
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Text('ملاحظة: تتطلب النسخة الاحتياطية ربط تخزين سحابي من حسابك في النظام.',
              style: TextStyle(fontFamily: 'Cairo', fontSize: 12, color: AppTheme.textMuted)),
        ],
      ),
    );
  }

  Widget _card({required List<Widget> children}) => Card(
        margin: EdgeInsets.zero,
        child: Column(children: children),
      );

  Widget _tile({
    required IconData icon,
    required Color color,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) =>
      ListTile(
        leading: Icon(icon, color: color),
        title: Text(title, style: const TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w700, fontSize: 14)),
        subtitle: Text(subtitle, style: const TextStyle(fontFamily: 'Cairo', fontSize: 12)),
        trailing: _busy ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : null,
        onTap: onTap,
      );

  Future<void> _aiImport(AppState app) async {
    final picked = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['xlsx'],
    );
    if (picked == null || picked.files.isEmpty) return;
    final f = picked.files.single;
    final path = f.path;
    if (path == null) {
      _snack('تعذر قراءة الملف.');
      return;
    }
    final file = File(path);
    if (!await file.exists()) {
      _snack('الملف غير موجود.');
      return;
    }
    setState(() => _busy = true);
    try {
      final j = await ApiClient.instance.postMultipart(
        '/api/contracts/ai-import-excel',
        {},
        [http.MultipartFile.fromBytes('file', await file.readAsBytes(), filename: f.name)],
        query: {
          'role': app.session!.role,
          'userId': app.session!.id,
          'companyOwnerId': app.ownerId,
        },
      );
      if (!mounted) return;
      if (j is Map && j['ok'] == true) {
        await app.storage.reload();
        _snack('تم استيراد ${j['imported'] ?? ''} عقود بنجاح.');
      } else {
        _snack(j is Map ? j['error']?.toString() ?? 'فشل الاستيراد.' : 'فشل الاستيراد.');
      }
    } catch (_) {
      if (mounted) _snack('تعذر الاتصال بالخادم.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _backup(AppState app) async {
    setState(() => _busy = true);
    try {
      // 1) رمز التخزين (GET، admin فقط)
      final tokRes = await ApiClient.instance.get('/api/auth/storage-token', query: {
        'role': app.session!.role,
        'userId': app.session!.id,
      });
      if (!mounted) return;
      final token = tokRes is Map ? tokRes['token']?.toString() : null;
      if (token == null) {
        setState(() => _busy = false);
        _snack('متاح لمشرف النظام فقط، أو تعذر الحصول على رمز التخزين.');
        return;
      }
      // 2) سحب كامل المخزن
      final store = await ApiClient.instance.get('/api/storage', query: {'admin': token});
      setState(() => _busy = false);
      if (store is! Map) {
        _snack('تعذر سحب البيانات.');
        return;
      }
      // 3) حفظ في ملف JSON محلي
      final dir = await getApplicationDocumentsDirectory();
      final file = File('${dir.path}/shumoos-backup-${DateTime.now().millisecondsSinceEpoch}.json');
      await file.writeAsString(const JsonEncoder.withIndent('  ').convert(store));
      if (!mounted) return;
      _snack('تم حفظ النسخة: ${file.path}');
    } catch (_) {
      if (mounted) {
        setState(() => _busy = false);
        _snack('تعذر الاتصال بالخادم.');
      }
    }
  }

  Future<void> _restore(AppState app) async {
    final picked = await FilePicker.pickFiles(type: FileType.custom, allowedExtensions: ['json']);
    if (picked == null || picked.files.isEmpty) return;
    final path = picked.files.single.path;
    if (path == null) {
      _snack('تعذر قراءة الملف.');
      return;
    }
    final f = File(path);
    if (!await f.exists()) {
      _snack('الملف غير موجود.');
      return;
    }
    Map<String, dynamic>? parsed;
    try {
      final decoded = jsonDecode(await f.readAsString());
      parsed = decoded is Map ? Map<String, dynamic>.from(decoded) : null;
    } catch (_) {
      _snack('ملف JSON غير صالح.');
      return;
    }
    if (parsed == null || parsed.isEmpty) {
      _snack('ملف فارغ.');
      return;
    }
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('تأكيد الاستعادة', style: TextStyle(fontFamily: 'Cairo')),
        content: const Text('سيتم استبدال بيانات النظام الحالية ببيانات النسخة الاحتياطية. هل أنت متأكد؟', style: TextStyle(fontFamily: 'Cairo')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('تراجع', style: TextStyle(fontFamily: 'Cairo'))),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('استعادة', style: TextStyle(fontFamily: 'Cairo', color: AppTheme.danger))),
        ],
      ),
    );
    if (ok != true) return;
    setState(() => _busy = true);
    try {
      final updates = <Map<String, dynamic>>[];
      parsed.forEach((key, value) {
        updates.add({'key': key, 'value': value});
      });
      // رفع بجداول صغيرة (100 تحديث لكل دفعة)
      for (var i = 0; i < updates.length; i += 100) {
        final chunk = updates.sublist(i, i + 100 > updates.length ? updates.length : i + 100);
        await ApiClient.instance.post('/api/storage', body: {'updates': chunk});
      }
      await app.storage.reload();
      if (!mounted) return;
      _snack('تمت الاستعادة بنجاح.');
    } catch (_) {
      if (mounted) _snack('تعذر الاتصال بالخادم.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _export(AppState app) async {
    setState(() => _busy = true);
    final data = <String, dynamic>{};
    for (final key in AppConstants.storageKeys) {
      data[key] = app.storage.list(key);
    }
    final jsonStr = _jsonPretty(data);
    if (!mounted) return;
    setState(() => _busy = false);
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('بيانات التصدير', style: TextStyle(fontFamily: 'Cairo')),
        content: SizedBox(
          width: double.maxFinite,
          child: Text(jsonStr, maxLines: 20, overflow: TextOverflow.ellipsis, style: const TextStyle(fontFamily: 'Cairo', fontSize: 11)),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('إغلاق', style: TextStyle(fontFamily: 'Cairo'))),
        ],
      ),
    );
  }

  Future<void> _cleanDrafts(AppState app) async {
    final drafts = app.storage.list(AppConstants.kFormDrafts);
    if (drafts.isEmpty) {
      _snack('لا توجد مسودات.');
      return;
    }
    await app.storage.write(AppConstants.kFormDrafts, []);
    if (!mounted) return;
    _snack('تم حذف ${drafts.length} مسودة.');
  }

  void _snack(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg, style: const TextStyle(fontFamily: 'Cairo'))));
  }

  String _jsonPretty(Map<String, dynamic> data) {
    final buf = StringBuffer('{\n');
    data.forEach((k, v) {
      buf.writeln('  "$k": ${v.toString()},');
    });
    buf.writeln('}');
    return buf.toString();
  }
}