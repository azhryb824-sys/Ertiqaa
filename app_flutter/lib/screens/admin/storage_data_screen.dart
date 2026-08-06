import 'package:flutter/material.dart';
import '../../core/constants.dart';
import '../../state/app_state.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// بيانات التخزين (مشرف النظام): استعراض مفاتيح misad*.
class StorageDataScreen extends StatelessWidget {
  const StorageDataScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = AppState.instance;
    final session = app.session!;
    if (session.role != 'admin') {
      return const Scaffold(
        backgroundColor: AppTheme.bg,
        body: EmptyState('متاح لمشرف النظام فقط.', icon: Icons.lock_outline),
      );
    }
    return Scaffold(
      backgroundColor: AppTheme.bg,
      body: ListView(
        padding: const EdgeInsets.only(bottom: 40),
        children: [
          const PageTitle('مفاتيح التخزين'),
          for (final key in AppConstants.storageKeys)
            ListCard(
              leadingIcon: const Icon(Icons.storage_rounded, color: AppTheme.primary),
              title: key,
              subtitle: '${app.storage.list(key).length} سجل',
              onTap: () => _preview(context, key, app),
            ),
        ],
      ),
    );
  }

  void _preview(BuildContext context, String key, AppState app) {
    final list = app.storage.list(key);
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.7,
        maxChildSize: 0.95,
        builder: (ctx, scroll) => Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.all(16),
                child: Text('$key (${list.length})', style: const TextStyle(fontFamily: 'Cairo', fontSize: 17, fontWeight: FontWeight.w800)),
              ),
              const Divider(height: 1),
              Expanded(
                child: ListView.builder(
                  controller: scroll,
                  itemCount: list.length,
                  itemBuilder: (ctx, i) {
                    final item = list[i];
                    final id = item is Map ? (item['id'] ?? item['identity'] ?? '') : item;
                    return ListTile(
                      dense: true,
                      title: Text(id.toString(), style: const TextStyle(fontFamily: 'Cairo')),
                      subtitle: Text(item.toString(), maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontFamily: 'Cairo', fontSize: 11, color: AppTheme.textMuted)),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
