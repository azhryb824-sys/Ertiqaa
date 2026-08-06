import 'package:flutter/material.dart';
import '../../core/utils.dart';
import '../../models/contract.dart';
import '../../state/app_state.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// أصول المصاعد: يدوية + مستخلصة من العقود (assetRows).
class AssetsScreen extends StatefulWidget {
  const AssetsScreen({super.key});

  @override
  State<AssetsScreen> createState() => _AssetsScreenState();
}

class _AssetsScreenState extends State<AssetsScreen> {
  final _serialCtrl = TextEditingController();
  final _brandCtrl = TextEditingController();
  final _typeCtrl = TextEditingController();
  final _statusCtrl = TextEditingController();
  bool _showForm = false;

  @override
  void dispose() {
    _serialCtrl.dispose();
    _brandCtrl.dispose();
    _typeCtrl.dispose();
    _statusCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final app = AppState.instance;
    final rows = _assetRows(app);

    return Scaffold(
      backgroundColor: AppTheme.bg,
      floatingActionButton: app.session!.canManage
          ? Fab(onPressed: () => setState(() => _showForm = !_showForm), label: 'أصل جديد')
          : null,
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
                    const SectionHeader(1, 'أصل مصعد جديد'),
                    AppField(label: 'الرقم التسلسلي', controller: _serialCtrl),
                    AppField(label: 'العلامة التجارية', controller: _brandCtrl),
                    AppField(label: 'النوع', controller: _typeCtrl),
                    AppField(label: 'الحالة', controller: _statusCtrl),
                    const SizedBox(height: 10),
                    ElevatedButton(onPressed: _add, child: const Text('إضافة الأصل')),
                  ],
                ),
              ),
            ),

          const PageTitle('أصول المصاعد'),
          if (rows.isEmpty)
            const EmptyState('لا توجد أصول بعد')
          else
            for (final a in rows)
              ListCard(
                leadingIcon: const Icon(Icons.elevator_rounded, color: AppTheme.primary),
                title: a['title'] ?? '',
                subtitle: a['subtitle'] ?? '',
                trailingWidget: StatusBadge(a['status']?.toString()),
              ),
        ],
      ),
    );
  }

  /// الأصول = اليدوي + من العقود المرئية (مطابق assetRows في app.js).
  List<Map<String, dynamic>> _assetRows(AppState app) {
    final rows = <Map<String, dynamic>>[];
    final manual = app.allAssets.where(app.sameCompany).toList();
    for (final a in manual) {
      rows.add({
        'title': a['serial']?.toString() ?? '',
        'subtitle': '${a['manufacturer'] ?? ''} — ${a['type'] ?? ''}',
        'status': a['status']?.toString() ?? 'يعمل',
      });
    }
    for (final Contract c in app.visibleContracts) {
      final ei = c.elevatorInfo;
      final count = int.tryParse(ei['count']?.toString() ?? '1') ?? 1;
      for (var i = 0; i < count; i++) {
        rows.add({
          'title': '${c.id} — ${ei['elevatorType'] ?? c.type}',
          'subtitle': '${ei['motorManufacturer'] ?? ei['manufacturer'] ?? ''} — ${ei['capacity'] ?? ''}',
          'status': c.status,
        });
      }
    }
    return rows;
  }

  Future<void> _add() async {
    final app = AppState.instance;
    final now = DateTime.now();
    final a = {
      'id': 'AST-${now.millisecondsSinceEpoch}',
      'companyOwnerId': app.ownerId,
      'source': 'يدوي',
      'client': '',
      'building': '',
      'district': '',
      'serial': _serialCtrl.text,
      'brand': _brandCtrl.text,
      'manufacturer': _brandCtrl.text,
      'motorManufacturer': 'محلي',
      'type': _typeCtrl.text,
      'status': _statusCtrl.text.isEmpty ? 'يعمل' : _statusCtrl.text,
      'createdAt': now.toIso8601String(),
    };
    await app.append('misadElevatorAssets', a);
    if (!mounted) return;
    setState(() { _showForm = false; _serialCtrl.clear(); _brandCtrl.clear(); _typeCtrl.clear(); _statusCtrl.clear(); });
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تمت إضافة الأصل.', style: TextStyle(fontFamily: 'Cairo'))));
  }
}
