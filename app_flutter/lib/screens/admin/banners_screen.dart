import 'package:flutter/material.dart';
import '../../core/constants.dart';
import '../../core/utils.dart';
import '../../state/app_state.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// إدارة البنرات (مشرف النظام).
class AdminBannersScreen extends StatefulWidget {
  const AdminBannersScreen({super.key});

  @override
  State<AdminBannersScreen> createState() => _AdminBannersScreenState();
}

class _AdminBannersScreenState extends State<AdminBannersScreen> {
  final _titleCtrl = TextEditingController();
  final _labelCtrl = TextEditingController();
  bool _active = true;
  bool _showForm = false;

  @override
  void dispose() {
    _titleCtrl.dispose();
    _labelCtrl.dispose();
    super.dispose();
  }

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
    final banners = app.allBanners;
    return Scaffold(
      backgroundColor: AppTheme.bg,
      appBar: AppBar(title: const Text('البنرات')),
      floatingActionButton: Fab(onPressed: () => setState(() => _showForm = !_showForm), label: 'إضافة بنر'),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 90),
        children: [
          if (_showForm)
            Card(
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SectionHeader(1, 'بنر جديد'),
                    AppField(label: 'العنوان', controller: _titleCtrl),
                    AppField(label: 'النص / الملصق', controller: _labelCtrl),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('نشط', style: TextStyle(fontFamily: 'Cairo')),
                      value: _active,
                      onChanged: (v) => setState(() => _active = v),
                    ),
                    const SizedBox(height: 6),
                    ElevatedButton(onPressed: _add, child: const Text('إضافة البنر')),
                  ],
                ),
              ),
            ),
          if (banners.isEmpty)
            const EmptyState('لا توجد بنرات.')
          else
            for (final b in banners) ...[
              ListCard(
                leadingIcon: const Icon(Icons.campaign_rounded, color: AppTheme.gold),
                title: b['title']?.toString() ?? '',
                subtitle: b['label']?.toString() ?? '',
                trailingWidget: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    StatusBadge(b['status']?.toString() == 'active' ? 'نشط' : 'متوقف'),
                    const SizedBox(width: 6),
                    IconButton(
                      icon: const Icon(Icons.toggle_on_rounded, color: AppTheme.primary),
                      onPressed: () => _toggle(b),
                    ),
                    IconButton(
                      icon: const Icon(Icons.delete_outline, color: AppTheme.danger, size: 20),
                      onPressed: () => _delete(b),
                    ),
                  ],
                ),
              ),
            ],
        ],
      ),
    );
  }

  Future<void> _add() async {
    final app = AppState.instance;
    if (_titleCtrl.text.trim().isEmpty) {
      _snack('أدخل عنوان البنر.');
      return;
    }
    final now = DateTime.now();
    final b = {
      'id': 'BNR-${now.millisecondsSinceEpoch}',
      'title': _titleCtrl.text.trim(),
      'label': _labelCtrl.text.trim(),
      'status': _active ? 'active' : 'disabled',
      'order': app.allBanners.length + 1,
      'createdAt': now.toIso8601String(),
    };
    await app.append('misadSystemBanners', b);
    if (!mounted) return;
    setState(() { _showForm = false; _titleCtrl.clear(); _labelCtrl.clear(); });
    _snack('تمت إضافة البنر.');
  }

  Future<void> _toggle(Map<String, dynamic> b) async {
    final app = AppState.instance;
    final next = (b['status']?.toString() ?? 'active') == 'active' ? 'disabled' : 'active';
    await app.update('misadSystemBanners', {...b, 'status': next});
    if (mounted) _snack(next == 'active' ? 'تم تفعيل البنر.' : 'تم إيقاف البنر.');
  }

  Future<void> _delete(Map<String, dynamic> b) async {
    final app = AppState.instance;
    await app.remove('misadSystemBanners', b['id']?.toString() ?? '');
    if (mounted) _snack('تم حذف البنر.');
  }

  void _snack(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg, style: const TextStyle(fontFamily: 'Cairo'))));
  }
}