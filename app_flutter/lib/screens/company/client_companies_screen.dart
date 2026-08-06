import 'package:flutter/material.dart';
import '../../core/utils.dart';
import '../../state/app_state.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// منشآت العميل: قائمة + إضافة منشأة جديدة (برقم موحد).
class ClientCompaniesScreen extends StatefulWidget {
  const ClientCompaniesScreen({super.key});

  @override
  State<ClientCompaniesScreen> createState() => _ClientCompaniesScreenState();
}

class _ClientCompaniesScreenState extends State<ClientCompaniesScreen> {
  final _nameCtrl = TextEditingController();
  final _unifiedCtrl = TextEditingController();
  final _taxCtrl = TextEditingController();
  bool _showForm = false;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _unifiedCtrl.dispose();
    _taxCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final app = AppState.instance;
    final session = app.session!;
    // للعميل: منشآته؛ للمدير: كل منشآت العملاء المرئية
    final companies = session.isClient
        ? app.clientCompanies.where((c) => c['ownerId']?.toString() == session.id).toList()
        : app.clientCompanies.where((c) => app.sameCompany(c) || c['ownerId']?.toString() == session.id).toList();

    return Scaffold(
      backgroundColor: AppTheme.bg,
      floatingActionButton: Fab(onPressed: () => setState(() => _showForm = !_showForm), label: 'منشأة جديدة'),
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
                    const SectionHeader(1, 'منشأة عميل جديدة'),
                    AppField(label: 'اسم المنشأة', controller: _nameCtrl),
                    AppField(label: 'الرقم الموحد', controller: _unifiedCtrl),
                    AppField(label: 'الرقم الضريبي', controller: _taxCtrl),
                    const SizedBox(height: 10),
                    ElevatedButton(onPressed: _add, child: const Text('إضافة المنشأة')),
                  ],
                ),
              ),
            ),

          const PageTitle('المنشآت'),
          if (companies.isEmpty)
            const EmptyState('لا توجد منشآت بعد')
          else
            for (final c in companies)
              ListCard(
                leadingIcon: const Icon(Icons.domain_rounded, color: AppTheme.primary),
                title: c['name']?.toString() ?? '',
                subtitle: 'الرقم الموحد: ${c['unifiedNumber'] ?? ''}',
                trailing: c['taxNumber']?.toString() ?? '',
              ),
        ],
      ),
    );
  }

  Future<void> _add() async {
    final app = AppState.instance;
    final now = DateTime.now();
    final c = {
      'id': 'CMP-${now.millisecondsSinceEpoch}',
      'ownerId': app.session!.id,
      'name': _nameCtrl.text,
      'unifiedNumber': _unifiedCtrl.text,
      'taxNumber': _taxCtrl.text,
      'createdAt': now.toIso8601String(),
    };
    await app.append('misadClientCompanies', c);
    if (!mounted) return;
    setState(() { _showForm = false; _nameCtrl.clear(); _unifiedCtrl.clear(); _taxCtrl.clear(); });
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تمت إضافة المنشأة.', style: TextStyle(fontFamily: 'Cairo'))));
  }
}
