import 'package:flutter/material.dart';
import '../../core/utils.dart';
import '../../state/app_state.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// المخزون: قطع الغيار + تنبيه النقص.
class InventoryScreen extends StatefulWidget {
  const InventoryScreen({super.key});

  @override
  State<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends State<InventoryScreen> {
  final _nameCtrl = TextEditingController();
  final _skuCtrl = TextEditingController();
  final _catCtrl = TextEditingController();
  final _qtyCtrl = TextEditingController();
  final _minCtrl = TextEditingController();
  final _costCtrl = TextEditingController();
  bool _showForm = false;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _skuCtrl.dispose();
    _catCtrl.dispose();
    _qtyCtrl.dispose();
    _minCtrl.dispose();
    _costCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final app = AppState.instance;
    final parts = app.allParts.where(app.sameCompany).toList();
    final low = parts.where((p) {
      final qty = (p['qty'] as num?)?.toInt() ?? 0;
      final min = (p['minQty'] as num?)?.toInt() ?? 0;
      return qty <= min;
    }).toList();

    return Scaffold(
      backgroundColor: AppTheme.bg,
      floatingActionButton: Fab(onPressed: () => setState(() => _showForm = !_showForm), label: 'قطعة جديدة'),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 90),
        children: [
          if (low.isNotEmpty)
            Container(
              margin: const EdgeInsets.all(16),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: AppTheme.danger.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(14)),
              child: Row(
                children: [
                  const Icon(Icons.warning_amber_rounded, color: AppTheme.danger),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text('${low.length} قطع وصلت للحد الأدنى أو أقل.', style: const TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w700, color: AppTheme.danger)),
                  ),
                ],
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
                    const SectionHeader(1, 'قطعة مخزون جديدة'),
                    AppField(label: 'اسم القطعة', controller: _nameCtrl),
                    AppField(label: 'الكود (SKU)', controller: _skuCtrl),
                    AppField(label: 'الفئة', controller: _catCtrl),
                    AppField(label: 'الكمية', keyboard: TextInputType.number, controller: _qtyCtrl),
                    AppField(label: 'الحد الأدنى', keyboard: TextInputType.number, controller: _minCtrl),
                    AppField(label: 'سعر التكلفة (ر.س)', keyboard: TextInputType.number, controller: _costCtrl),
                    const SizedBox(height: 10),
                    ElevatedButton(onPressed: _add, child: const Text('إضافة القطعة')),
                  ],
                ),
              ),
            ),

          const PageTitle('قطع الغيار'),
          if (parts.isEmpty)
            const EmptyState('لا توجد قطع في المخزون')
          else
            for (final p in parts)
              ListCard(
                leadingIcon: const Icon(Icons.construction_rounded, color: AppTheme.primary),
                title: p['name']?.toString() ?? '',
                subtitle: '${p['sku'] ?? ''} • الكمية: ${p['qty']}',
                trailingWidget: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(AppUtils.money(p['unitCost']), style: const TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w800, color: AppTheme.primaryDark)),
                    const SizedBox(height: 4),
                    if (((p['qty'] as num?)?.toInt() ?? 0) <= ((p['minQty'] as num?)?.toInt() ?? 0))
                      const Text('نقص', style: TextStyle(fontFamily: 'Cairo', fontSize: 10, color: AppTheme.danger, fontWeight: FontWeight.w700)),
                  ],
                ),
                onTap: () => _detail(context, app, p),
              ),
        ],
      ),
    );
  }

  Future<void> _add() async {
    final app = AppState.instance;
    final now = DateTime.now();
    final part = {
      'id': 'PRT-${now.millisecondsSinceEpoch}',
      'companyOwnerId': app.ownerId,
      'name': _nameCtrl.text,
      'sku': _skuCtrl.text,
      'category': _catCtrl.text,
      'qty': int.tryParse(_qtyCtrl.text) ?? 0,
      'minQty': int.tryParse(_minCtrl.text) ?? 1,
      'unitCost': double.tryParse(_costCtrl.text) ?? 0,
      'supplier': '',
      'suppliers': [],
      'createdAt': now.toIso8601String(),
    };
    await app.append('misadPartsInventory', part);
    await app.logActivity('إضافة قطعة مخزون', entityType: 'part', entityId: part['id'] as String);
    if (!mounted) return;
    setState(() { _showForm = false; _nameCtrl.clear(); _skuCtrl.clear(); _catCtrl.clear(); _qtyCtrl.clear(); _minCtrl.clear(); _costCtrl.clear(); });
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تمت إضافة القطعة.', style: TextStyle(fontFamily: 'Cairo'))));
  }

  void _detail(BuildContext context, AppState app, Map<String, dynamic> p) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.6,
        maxChildSize: 0.9,
        builder: (ctx, scroll) => Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: ListView(
            controller: scroll,
            padding: const EdgeInsets.all(20),
            children: [
              Text(p['name']?.toString() ?? '', style: const TextStyle(fontFamily: 'Cairo', fontSize: 18, fontWeight: FontWeight.w800)),
              const SizedBox(height: 12),
              _row('الكود', p['sku']?.toString() ?? ''),
              _row('الفئة', p['category']?.toString() ?? ''),
              _row('الكمية', '${p['qty']}'),
              _row('الحد الأدنى', '${p['minQty']}'),
              _row('سعر التكلفة', AppUtils.money(p['unitCost'])),
            ],
          ),
        ),
      ),
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Expanded(flex: 2, child: Text(label, style: const TextStyle(fontFamily: 'Cairo', color: AppTheme.textMuted))),
          Expanded(flex: 3, child: Text(value, textAlign: TextAlign.end, style: const TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w700))),
        ],
      ),
    );
  }
}
