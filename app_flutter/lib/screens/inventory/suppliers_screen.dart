import 'package:flutter/material.dart';
import '../../core/utils.dart';
import '../../state/app_state.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// الموردون.
class SuppliersScreen extends StatefulWidget {
  const SuppliersScreen({super.key});

  @override
  State<SuppliersScreen> createState() => _SuppliersScreenState();
}

class _SuppliersScreenState extends State<SuppliersScreen> {
  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _cityCtrl = TextEditingController();
  bool _showForm = false;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _emailCtrl.dispose();
    _cityCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final app = AppState.instance;
    final suppliers = app.allSuppliers.where(app.sameCompany).toList();
    return Scaffold(
      backgroundColor: AppTheme.bg,
      floatingActionButton: Fab(onPressed: () => setState(() => _showForm = !_showForm), label: 'مورد جديد'),
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
                    const SectionHeader(1, 'مورد جديد'),
                    AppField(label: 'اسم المورد', controller: _nameCtrl),
                    AppField(label: 'رقم الجوال', keyboard: TextInputType.phone, controller: _phoneCtrl),
                    AppField(label: 'البريد الإلكتروني', keyboard: TextInputType.emailAddress, controller: _emailCtrl),
                    AppField(label: 'المدينة', controller: _cityCtrl),
                    const SizedBox(height: 10),
                    ElevatedButton(onPressed: _add, child: const Text('إضافة المورد')),
                  ],
                ),
              ),
            ),

          const PageTitle('الموردون'),
          if (suppliers.isEmpty)
            const EmptyState('لا يوجد موردون')
          else
            for (final s in suppliers)
              ListCard(
                leadingIcon: const Icon(Icons.local_shipping_rounded, color: AppTheme.gold),
                title: s['name']?.toString() ?? '',
                subtitle: '${s['city'] ?? ''} • ${s['phone'] ?? ''}',
                trailingWidget: StatusBadge(s['rating']?.toString()),
              ),
        ],
      ),
    );
  }

  Future<void> _add() async {
    final app = AppState.instance;
    final now = DateTime.now();
    final s = {
      'id': 'SUP-${now.millisecondsSinceEpoch}',
      'companyOwnerId': app.ownerId,
      'name': _nameCtrl.text,
      'phone': _phoneCtrl.text,
      'email': _emailCtrl.text,
      'city': _cityCtrl.text,
      'category': 'توريد شامل',
      'rating': 'تحت التجربة',
      'notes': '',
      'createdAt': now.toIso8601String(),
    };
    await app.append('misadSuppliers', s);
    await app.logActivity('إضافة مورد', entityType: 'supplier', entityId: s['id'] as String);
    if (!mounted) return;
    setState(() { _showForm = false; _nameCtrl.clear(); _phoneCtrl.clear(); _emailCtrl.clear(); _cityCtrl.clear(); });
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تمت إضافة المورد.', style: TextStyle(fontFamily: 'Cairo'))));
  }
}
