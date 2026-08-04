import 'package:flutter/material.dart';
import '../core/api_client.dart';
import '../core/utils.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/common.dart';

/// الإشعارات: تُجلب من الخادم (GET /api/notifications?userId&role) مع تمييز المقروء.
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    final app = AppState.instance;
    final session = app.session!;
    try {
      final j = await ApiClient.instance.get('/api/notifications', query: {
        'userId': session.id,
        'role': session.role,
      });
      final list = (j is Map && j['notifications'] is List)
          ? (j['notifications'] as List).whereType<Map>().toList()
          : <Map>[];
      if (!mounted) return;
      setState(() {
        _items = list.map((e) => Map<String, dynamic>.from(e)).toList();
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() { _loading = false; _error = 'تعذر الاتصال بالخادم.'; });
    }
  }

  bool _isRead(Map<String, dynamic> n, String userId) {
    final readBy = (n['readBy'] as List?)?.map((e) => e.toString()).toList() ?? [];
    final archivedBy = (n['archivedBy'] as List?)?.map((e) => e.toString()).toList() ?? [];
    return readBy.contains(userId) || archivedBy.contains(userId);
  }

  Future<void> _markRead(Map<String, dynamic> n) async {
    final app = AppState.instance;
    final userId = app.session!.id;
    try {
      await ApiClient.instance.post('/api/notifications/mark-read', body: {
        'notificationId': n['id']?.toString() ?? '',
        'userId': userId,
      });
    } catch (_) {}
    if (!mounted) return;
    setState(() {
      final readBy = (n['readBy'] as List?)?.map((e) => e.toString()).toList() ?? [];
      if (!readBy.contains(userId)) readBy.add(userId);
      n['readBy'] = readBy;
    });
  }

  Future<void> _markAll() async {
    final app = AppState.instance;
    final session = app.session!;
    try {
      await ApiClient.instance.post('/api/notifications/mark-all-read', body: {
        'userId': session.id,
        'role': session.role,
      });
    } catch (_) {}
    if (!mounted) return;
    setState(() {
      for (final n in _items) {
        final readBy = (n['readBy'] as List?)?.map((e) => e.toString()).toList() ?? [];
        if (!readBy.contains(session.id)) readBy.add(session.id);
        n['readBy'] = readBy;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final app = AppState.instance;
    final session = app.session!;
    final unread = _items.where((n) => !_isRead(n, session.id)).length;

    return Scaffold(
      backgroundColor: AppTheme.bg,
      appBar: AppBar(
        title: Text(unread > 0 ? 'الإشعارات ($unread)' : 'الإشعارات'),
        actions: [
          if (_items.isNotEmpty)
            IconButton(
              tooltip: 'تعليم الكل كمقروء',
              icon: const Icon(Icons.done_all_rounded),
              onPressed: _markAll,
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const EmptyState('تعذر جلب الإشعارات.', icon: Icons.cloud_off_rounded),
                    const SizedBox(height: 8),
                    TextButton(onPressed: _load, child: const Text('إعادة المحاولة', style: TextStyle(fontFamily: 'Cairo'))),
                  ],
                )
              : _items.isEmpty
                  ? const EmptyState('لا توجد إشعارات حالياً.', icon: Icons.notifications_none_rounded)
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.builder(
                        physics: const AlwaysScrollableScrollPhysics(),
                        itemCount: _items.length,
                        itemBuilder: (ctx, i) {
                          final n = _items[i];
                          final read = _isRead(n, session.id);
                          return ListCard(
                            leadingIcon: Icon(
                              read ? Icons.notifications_none_rounded : Icons.notifications_active_rounded,
                              color: read ? AppTheme.textMuted : AppTheme.gold,
                            ),
                            title: n['title']?.toString() ?? '',
                            subtitle: n['body']?.toString() ?? '',
                            trailing: n['createdAt']?.toString()?.split('T').first ?? '',
                            onTap: read ? null : () => _markRead(n),
                          );
                        },
                      ),
                    ),
    );
  }
}
