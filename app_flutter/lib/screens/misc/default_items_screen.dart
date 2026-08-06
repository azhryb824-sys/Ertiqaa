import 'package:flutter/material.dart';
import '../../core/utils.dart';
import '../../state/app_state.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// البنود الافتراضية (للعقود وعروض الأسعار).
class DefaultItemsScreen extends StatefulWidget {
  const DefaultItemsScreen({super.key});

  @override
  State<DefaultItemsScreen> createState() => _DefaultItemsScreenState();
}

class _DefaultItemsScreenState extends State<DefaultItemsScreen> {
  final _titleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _priceCtrl = TextEditingController();
  String _type = 'contract';
  bool _showForm = false;

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descCtrl.dispose();
    _priceCtrl.dispose();
    super.dispose();
  }

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
    final items = app.allDefaultItems.where((d) => d['companyOwnerId']?.toString() == app.ownerId || d['companyOwnerId']?.toString() == 'platform').toList();

    return Scaffold(
      backgroundColor: AppTheme.bg,
      floatingActionButton: Fab(onPressed: () => setState(() => _showForm = !_showForm), label: 'بند جديد'),
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
                    const SectionHeader(1, 'بند افتراضي جديد'),
                    AppDropdown<String>(
                      label: 'النوع',
                      value: _type,
                      items: const ['contract', 'quote'],
                      labelOf: (v) => v == 'contract' ? 'عقد' : 'عرض سعر',
                      onChanged: (v) => setState(() => _type = v!),
                    ),
                    AppField(label: 'العنوان', controller: _titleCtrl),
                    AppField(label: 'الوصف', maxLines: 2, controller: _descCtrl),
                    AppField(label: 'السعر (ر.س)', keyboard: TextInputType.number, controller: _priceCtrl),
                    const SizedBox(height: 10),
                    ElevatedButton(onPressed: _add, child: const Text('إضافة البند')),
                  ],
                ),
              ),
            ),

          const PageTitle('البنود الافتراضية'),
          if (items.isEmpty)
            const EmptyState('لا توجد بنود افتراضية')
          else
            for (final d in items)
              ListCard(
                leadingIcon: const Icon(Icons.list_alt_rounded, color: AppTheme.primary),
                title: d['title']?.toString() ?? '',
                subtitle: d['description']?.toString() ?? '',
                trailing: AppUtils.money(d['price']),
              ),
        ],
      ),
    );
  }

  Future<void> _add() async {
    final app = AppState.instance;
    final now = DateTime.now();
    final d = {
      'id': now.millisecondsSinceEpoch,
      'companyOwnerId': app.ownerId,
      'type': _type,
      'section': 'بنود عامة',
      'title': _titleCtrl.text,
      'description': _descCtrl.text,
      'price': double.tryParse(_priceCtrl.text) ?? 0,
    };
    await app.append('misadDefaultItems', d);
    if (!mounted) return;
    setState(() { _showForm = false; _titleCtrl.clear(); _descCtrl.clear(); _priceCtrl.clear(); });
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تمت إضافة البند.', style: TextStyle(fontFamily: 'Cairo'))));
  }
}
