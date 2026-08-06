import 'package:flutter/material.dart';
import '../../core/constants.dart';
import '../../core/utils.dart';
import '../../state/app_state.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// روابط التسجيل (invites + إدارة روابط الفريق).
class EntryLinksScreen extends StatefulWidget {
  const EntryLinksScreen({super.key});

  @override
  State<EntryLinksScreen> createState() => _EntryLinksScreenState();
}

class _EntryLinksScreenState extends State<EntryLinksScreen> {
  String _role = 'company_admin';
  bool _busy = false;
  String? _generatedUrl;

  @override
  Widget build(BuildContext context) {
    final app = AppState.instance;
    final invites = app.allInvites.where((i) => i['companyOwnerId']?.toString() == app.ownerId || i['companyOwnerId']?.toString() == app.session!.id).toList();

    return Scaffold(
      backgroundColor: AppTheme.bg,
      body: ListView(
        padding: const EdgeInsets.only(bottom: 40),
        children: [
          const PageTitle('رابط دعوة جديد'),
          Card(
            margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  AppDropdown<String>(
                    label: 'دور المدعو',
                    value: _role,
                    items: const ['company_admin', 'technician', 'engineer', 'client'],
                    labelOf: (v) => AppConstants.roleLabels[v] ?? v,
                    onChanged: (v) => setState(() => _role = v!),
                  ),
                  const SizedBox(height: 10),
                  ElevatedButton.icon(
                    onPressed: _busy ? null : _generate,
                    icon: const Icon(Icons.link_rounded),
                    label: Text(_busy ? 'جارٍ الإنشاء...' : 'إنشاء رابط الدعوة', style: const TextStyle(fontFamily: 'Cairo')),
                  ),
                  if (_generatedUrl != null) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(color: AppTheme.primary.withValues(alpha: 0.06), borderRadius: BorderRadius.circular(12)),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('رابط الدعوة:', style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w700)),
                          const SizedBox(height: 4),
                          SelectableText(_generatedUrl!, style: const TextStyle(fontFamily: 'Cairo', color: AppTheme.primary)),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),

          const PageTitle('الروابط الحالية'),
          if (invites.isEmpty)
            const EmptyState('لا توجد روابط دعوة.')
          else
            for (final i in invites)
              ListCard(
                leadingIcon: const Icon(Icons.link_rounded, color: AppTheme.primary),
                title: i['label']?.toString() ?? '',
                subtitle: i['invitedBy']?.toString() ?? '',
                trailingWidget: StatusBadge(i['status']?.toString()),
              ),
        ],
      ),
    );
  }

  Future<void> _generate() async {
    final app = AppState.instance;
    setState(() => _busy = true);
    // رابط محلي يتبع نمط النظام: /#invite=<token>
    final now = DateTime.now();
    final token = '${now.millisecondsSinceEpoch}-${_role}';
    final url = '${app.storage.api.baseUrl}/#invite=$token';
    await app.append('misadAdminInvites', {
      'id': 'ADMIN-INV-${now.millisecondsSinceEpoch}',
      'userId': '',
      'userName': '',
      'companyOwnerId': app.ownerId,
      'companyName': '',
      'invitedBy': app.session!.id,
      'invitedByName': app.session!.name,
      'status': 'pending',
      'createdAt': now.toIso8601String(),
      'label': AppConstants.roleLabels[_role],
      'targetRole': _role,
      'kind': 'link',
      'url': url,
    });
    if (!mounted) return;
    setState(() { _busy = false; _generatedUrl = url; });
  }
}
