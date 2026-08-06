import 'package:flutter/material.dart';
import '../../core/utils.dart';
import '../../state/app_state.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// قاعدة المعرفة / المعرفة التقنية (knowledge-base و knowledge-hub).
class KnowledgeScreen extends StatefulWidget {
  final bool isHub;
  const KnowledgeScreen({this.isHub = false, super.key});

  @override
  State<KnowledgeScreen> createState() => _KnowledgeScreenState();
}

class _KnowledgeScreenState extends State<KnowledgeScreen> {
  final _titleCtrl = TextEditingController();
  final _categoryCtrl = TextEditingController();
  final _bodyCtrl = TextEditingController();
  bool _showForm = false;

  @override
  void dispose() {
    _titleCtrl.dispose();
    _categoryCtrl.dispose();
    _bodyCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final app = AppState.instance;
    final pages = app.allKnowledge.where((k) => app.sameCompany(k) || k['companyOwnerId']?.toString() == 'platform').toList();
    final canCreate = app.session!.canManage;
    final title = widget.isHub ? 'المعرفة التقنية' : 'قاعدة المعرفة';

    return Scaffold(
      backgroundColor: AppTheme.bg,
      floatingActionButton: canCreate ? Fab(onPressed: () => setState(() => _showForm = !_showForm), label: 'مقال جديد') : null,
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
                    const SectionHeader(1, 'مقال جديد'),
                    AppField(label: 'العنوان', controller: _titleCtrl),
                    AppField(label: 'التصنيف', controller: _categoryCtrl),
                    AppField(label: 'المحتوى', maxLines: 6, controller: _bodyCtrl),
                    const SizedBox(height: 10),
                    ElevatedButton(onPressed: _add, child: const Text('نشر المقال')),
                  ],
                ),
              ),
            ),

          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
            child: Text(title, style: const TextStyle(fontFamily: 'Cairo', fontSize: 20, fontWeight: FontWeight.w800)),
          ),
          if (pages.isEmpty)
            const EmptyState('لا توجد مقالات معرفية')
          else
            for (final k in pages)
              ListCard(
                leadingIcon: const Icon(Icons.menu_book_rounded, color: AppTheme.gold),
                title: k['title']?.toString() ?? '',
                subtitle: k['category']?.toString() ?? '',
                trailingWidget: const Icon(Icons.chevron_left_rounded, color: AppTheme.textMuted),
                onTap: () => _detail(context, k),
              ),
        ],
      ),
    );
  }

  void _detail(BuildContext context, Map<String, dynamic> k) {
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
          child: ListView(
            controller: scroll,
            padding: const EdgeInsets.all(20),
            children: [
              Text(k['title']?.toString() ?? '', style: const TextStyle(fontFamily: 'Cairo', fontSize: 18, fontWeight: FontWeight.w800)),
              const SizedBox(height: 6),
              Text(k['category']?.toString() ?? '', style: const TextStyle(fontFamily: 'Cairo', color: AppTheme.gold)),
              const SizedBox(height: 12),
              Text(k['body']?.toString() ?? '', style: const TextStyle(fontFamily: 'Cairo', height: 1.7)),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _add() async {
    final app = AppState.instance;
    final now = DateTime.now();
    final k = {
      'id': 'KNO-${now.millisecondsSinceEpoch}',
      'companyOwnerId': app.ownerId,
      'title': _titleCtrl.text,
      'category': _categoryCtrl.text,
      'summary': '',
      'body': _bodyCtrl.text,
      'order': 0,
      'status': 'published',
      'createdAt': now.toIso8601String(),
      'createdAtMs': now.millisecondsSinceEpoch,
      'createdBy': app.session!.id,
    };
    await app.append('misadKnowledgePages', k);
    if (!mounted) return;
    setState(() { _showForm = false; _titleCtrl.clear(); _categoryCtrl.clear(); _bodyCtrl.clear(); });
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم نشر المقال.', style: TextStyle(fontFamily: 'Cairo'))));
  }
}
