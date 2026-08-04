import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import '../../core/constants.dart';
import '../../core/utils.dart';
import '../../state/app_state.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// إدارة البيانات: تصدير/استيراد/تنظيف (owner + admin).
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
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            margin: EdgeInsets.zero,
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.download_rounded, color: AppTheme.primary),
                  title: const Text('تصدير البيانات (JSON)', style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w700)),
                  subtitle: const Text('تصدير كل مفاتيح misad*.', style: TextStyle(fontFamily: 'Cairo')),
                  onTap: () => _export(app),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.cleaning_services_rounded, color: AppTheme.danger),
                  title: const Text('تنظيف المسودات القديمة', style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w700)),
                  subtitle: const Text('حذف مسودات النماذج المتروكة.', style: TextStyle(fontFamily: 'Cairo')),
                  onTap: () => _cleanDrafts(app),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          const Text('ملاحظة: الاستيراد من Excel متاح عبر نقطة /api/contracts/ai-import-excel في الخادم.',
              style: TextStyle(fontFamily: 'Cairo', fontSize: 12, color: AppTheme.textMuted)),
        ],
      ),
    );
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
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('لا توجد مسودات.', style: TextStyle(fontFamily: 'Cairo'))));
      return;
    }
    await app.storage.write(AppConstants.kFormDrafts, []);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('تم حذف ${drafts.length} مسودة.', style: const TextStyle(fontFamily: 'Cairo'))));
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
