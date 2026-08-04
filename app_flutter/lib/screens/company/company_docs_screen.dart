import 'package:flutter/material.dart';
import '../../core/utils.dart';
import '../../state/app_state.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// مستندات الشركة: ختم، توقيع، سجل تجاري... مع موافقة.
class CompanyDocsScreen extends StatefulWidget {
  const CompanyDocsScreen({super.key});

  @override
  State<CompanyDocsScreen> createState() => _CompanyDocsScreenState();
}

class _CompanyDocsScreenState extends State<CompanyDocsScreen> {
  final _titleCtrl = TextEditingController();
  final _partyCtrl = TextEditingController();
  final _expiryCtrl = TextEditingController();
  String _kind = 'stamp';
  bool _showForm = false;

  @override
  void dispose() {
    _titleCtrl.dispose();
    _partyCtrl.dispose();
    _expiryCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final app = AppState.instance;
    final docs = app.allDocs.where(app.sameCompany).toList();
    final session = app.session!;
    if (!session.canManage) {
      return const Scaffold(
        backgroundColor: AppTheme.bg,
        body: EmptyState('غير متاح لدورك.', icon: Icons.lock_outline),
      );
    }
    return Scaffold(
      backgroundColor: AppTheme.bg,
      floatingActionButton: Fab(onPressed: () => setState(() => _showForm = !_showForm), label: 'مستند جديد'),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 90),
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: Text(
              'التوقيع والختم المعتمدان يُستخدمان تلقائياً في مستندات PDF.',
              style: TextStyle(fontFamily: 'Cairo', fontSize: 12, color: AppTheme.textMuted),
            ),
          ),
          if (_showForm)
            Card(
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SectionHeader(1, 'مستند جديد'),
                    AppDropdown<String>(
                      label: 'النوع',
                      value: _kind,
                      items: const ['stamp', 'signature', 'commercial', 'other'],
                      labelOf: (v) => const {
                        'stamp': 'ختم', 'signature': 'توقيع', 'commercial': 'سجل تجاري', 'other': 'أخرى',
                      }[v] ?? v,
                      onChanged: (v) => setState(() => _kind = v!),
                    ),
                    AppField(label: 'الاسم', controller: _titleCtrl),
                    AppField(label: 'الطرف', controller: _partyCtrl),
                    AppField(label: 'تاريخ الانتهاء (yyyy-mm-dd)', controller: _expiryCtrl),
                    const SizedBox(height: 10),
                    ElevatedButton(onPressed: _add, child: const Text('إضافة المستند')),
                  ],
                ),
              ),
            ),

          const PageTitle('المستندات'),
          if (docs.isEmpty)
            const EmptyState('لا توجد مستندات')
          else
            for (final d in docs)
              ListCard(
                leadingIcon: Icon(
                  d['type']?.toString() == 'stamp' ? Icons.donut_large_rounded : Icons.draw_rounded,
                  color: AppTheme.gold,
                ),
                title: d['name']?.toString() ?? '',
                subtitle: '${d['type']} • ${d['expiresAt'] ?? 'بدون انتهاء'}',
                trailingWidget: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [StatusBadge(d['status']?.toString())],
                ),
                onTap: () => _actions(d),
              ),
        ],
      ),
    );
  }

  Future<void> _add() async {
    final app = AppState.instance;
    final now = DateTime.now();
    final doc = {
      'id': 'DOC-${now.millisecondsSinceEpoch}',
      'companyOwnerId': app.ownerId,
      'partyName': _partyCtrl.text,
      'type': _kind,
      'name': _titleCtrl.text,
      'expiresAt': _expiryCtrl.text,
      'fileName': '',
      'fileData': '',
      'status': 'بانتظار المراجعة والاعتماد',
      'createdAt': now.toIso8601String(),
      'createdBy': app.session!.id,
    };
    await app.append('misadCompanyDocs', doc);
    await app.logActivity('إضافة مستند شركة', entityType: 'doc', entityId: doc['id'] as String);
    if (!mounted) return;
    setState(() { _showForm = false; _titleCtrl.clear(); _partyCtrl.clear(); _expiryCtrl.clear(); });
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تمت إضافة المستند (بانتظار الاعتماد).', style: TextStyle(fontFamily: 'Cairo'))));
  }

  void _actions(Map<String, dynamic> d) {
    final app = AppState.instance;
    showModalBottomSheet<void>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (d['status']?.toString() == 'بانتظار المراجعة والاعتماد') ...[
              ListTile(
                leading: const Icon(Icons.check_circle_rounded, color: AppTheme.success),
                title: const Text('اعتماد المستند', style: TextStyle(fontFamily: 'Cairo')),
                onTap: () async {
                  await app.update('misadCompanyDocs', {...d, 'status': 'معتمد', 'approvedAt': DateTime.now().toIso8601String(), 'approvedBy': app.session!.id});
                  if (ctx.mounted) Navigator.pop(ctx);
                },
              ),
              ListTile(
                leading: const Icon(Icons.cancel_rounded, color: AppTheme.danger),
                title: const Text('رفض المستند', style: TextStyle(fontFamily: 'Cairo')),
                onTap: () async {
                  await app.update('misadCompanyDocs', {...d, 'status': 'مرفوض', 'rejectedAt': DateTime.now().toIso8601String(), 'rejectedBy': app.session!.id});
                  if (ctx.mounted) Navigator.pop(ctx);
                },
              ),
            ],
            ListTile(
              leading: const Icon(Icons.delete_outline, color: AppTheme.danger),
              title: const Text('حذف المستند', style: TextStyle(fontFamily: 'Cairo')),
              onTap: () async {
                await app.remove('misadCompanyDocs', d['id'].toString());
                if (ctx.mounted) Navigator.pop(ctx);
              },
            ),
          ],
        ),
      ),
    );
  }
}
