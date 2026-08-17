import 'package:flutter/material.dart';
import '../../core/constants.dart';
import '../../core/utils.dart';
import '../../models/quote.dart';
import '../../state/app_state.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// إنشاء عرض سعر: أساسي + بنود افتراضية + قطع + بنود مخصصة + الحساب.
class QuoteFormScreen extends StatefulWidget {
  const QuoteFormScreen({super.key});

  @override
  State<QuoteFormScreen> createState() => _QuoteFormScreenState();
}

class _QuoteFormScreenState extends State<QuoteFormScreen> {
  final app = AppState.instance;
  final _titleCtrl = TextEditingController();
  final _detailsCtrl = TextEditingController();
  String _type = 'تركيب';
  String _client = '';
  double _baseValue = 0;
  final _valueCtrl = TextEditingController();
  final _taxRateCtrl = TextEditingController(text: '15');
  bool _taxEnabled = false;
  final List<String> _selectedDefaultIds = [];
  final List<PartsItem> _parts = [];
  final List<CustomItem> _custom = [];

  double get _subtotal {
    var s = _baseValue;
    for (final id in _selectedDefaultIds) {
      for (final d in app.allDefaultItems) {
        if (d['id'].toString() == id) {
          s += (d['price'] as num?)?.toDouble() ?? 0;
          break;
        }
      }
    }
    for (final p in _parts) { s += p.price; }
    for (final c in _custom) { s += c.price; }
    return s;
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _detailsCtrl.dispose();
    _valueCtrl.dispose();
    _taxRateCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final now = DateTime.now();
    final taxRate = _taxEnabled ? (double.tryParse(_taxRateCtrl.text) ?? 0).clamp(0.0, 100.0).toDouble() : 0.0;
    final tax = _subtotal * taxRate / 100;
    final total = _subtotal + tax;
    final quote = {
      'id': 'QTO-${now.millisecondsSinceEpoch}',
      'companyOwnerId': app.ownerId,
      'clientId': '',
      'clientName': _client,
      'clientCompanyUnifiedNumber': '',
      'clientCompanyName': '',
      'client': _client,
      'title': _titleCtrl.text.trim().isEmpty ? 'عرض سعر ${_type}' : _titleCtrl.text.trim(),
      'type': _type,
      'value': total,
      'subtotal': _subtotal,
      'taxEnabled': _taxEnabled,
      'taxRate': taxRate,
      'taxAmount': tax,
      'totalWithTax': total,
      'status': 'بانتظار المراجعة والاعتماد',
      'items': _defaultItems(),
      'partsItems': _parts.map((p) => p.toJson()).toList(),
      'customItems': _custom.map((c) => c.toJson()).toList(),
      'details': _detailsCtrl.text,
      'createdAt': now.toIso8601String(),
      'createdBy': app.session!.id,
    };
    await app.append('misadQuotes', quote);
    await app.logActivity('إنشاء عرض سعر', entityType: 'quote', entityId: quote['id'] as String);
    if (!mounted) return;
    Navigator.of(context).pop();
    app.back();
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم إنشاء عرض السعر.', style: TextStyle(fontFamily: 'Cairo'))));
  }

  List<Map<String, dynamic>> _defaultItems() {
    final out = <Map<String, dynamic>>[];
    for (final id in _selectedDefaultIds) {
      for (final d in app.allDefaultItems) {
        if (d['id'].toString() == id) { out.add(Map<String, dynamic>.from(d)); break; }
      }
    }
    return out;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bg,
      appBar: AppBar(title: const Text('عرض سعر جديد')),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 110),
        children: [
          Card(
            margin: const EdgeInsets.all(16),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SectionHeader(1, 'بيانات العرض'),
                  AppField(label: 'العميل الظاهر في العرض', initialText: _client, onChanged: (v) => _client = v),
                  AppField(label: 'عنوان العرض', controller: _titleCtrl, hint: 'مثال: تركيب مصعد ركاب 6 أشخاص'),
                  AppDropdown<String>(
                    label: 'نوع العرض',
                    value: _type,
                    items: const ['تركيب', 'صيانة', 'توريد وتركيب قطع غيار'],
                    labelOf: (v) => v,
                    onChanged: (v) => setState(() => _type = v!),
                  ),
                  AppField(
                    label: 'القيمة الأساسية (ر.س)',
                    keyboard: TextInputType.number,
                    controller: _valueCtrl,
                    onChanged: (v) => setState(() => _baseValue = double.tryParse(v) ?? 0),
                  ),
                ],
              ),
            ),
          ),

          Card(
            margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SectionHeader(2, 'البنود الافتراضية'),
                  if (app.allDefaultItems.isEmpty)
                    const Text('لا توجد بنود افتراضية.', style: TextStyle(fontFamily: 'Cairo', color: AppTheme.textMuted))
                  else
                    for (final d in app.allDefaultItems)
                      CheckboxListTile(
                        dense: true,
                        contentPadding: EdgeInsets.zero,
                        title: Text(d['title']?.toString() ?? '', style: const TextStyle(fontFamily: 'Cairo', fontSize: 13)),
                        subtitle: Text(d['description']?.toString() ?? '', style: const TextStyle(fontFamily: 'Cairo', fontSize: 11, color: AppTheme.textMuted)),
                        secondary: Text(AppUtils.money(d['price']), style: const TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w700, fontSize: 12)),
                        value: _selectedDefaultIds.contains(d['id'].toString()),
                        onChanged: (v) => setState(() {
                          final id = d['id'].toString();
                          if (v == true) _selectedDefaultIds.add(id);
                          else _selectedDefaultIds.remove(id);
                        }),
                      ),
                ],
              ),
            ),
          ),

          Card(
            margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SectionHeader(3, 'قطع غيار من المخزون'),
                  if (_parts.isEmpty)
                    const Text('لم تُضف قطع.', style: TextStyle(fontFamily: 'Cairo', color: AppTheme.textMuted))
                  else
                    for (var i = 0; i < _parts.length; i++)
                      ListTile(
                        dense: true,
                        contentPadding: EdgeInsets.zero,
                        title: Text('${_parts[i].title} × ${_parts[i].qty}', style: const TextStyle(fontFamily: 'Cairo', fontSize: 13)),
                        subtitle: Text(AppUtils.money(_parts[i].price), style: const TextStyle(fontFamily: 'Cairo', fontSize: 12, color: AppTheme.primary)),
                        trailing: IconButton(
                          icon: const Icon(Icons.delete_outline, color: AppTheme.danger),
                          onPressed: () => setState(() => _parts.removeAt(i)),
                        ),
                      ),
                  TextButton.icon(
                    onPressed: _addPart,
                    icon: const Icon(Icons.add_rounded),
                    label: const Text('إضافة قطعة', style: TextStyle(fontFamily: 'Cairo')),
                  ),
                ],
              ),
            ),
          ),

          Card(
            margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SectionHeader(4, 'بنود مخصصة'),
                  if (_custom.isEmpty)
                    const Text('لم تُضف بنود.', style: TextStyle(fontFamily: 'Cairo', color: AppTheme.textMuted))
                  else
                    for (var i = 0; i < _custom.length; i++)
                      ListTile(
                        dense: true,
                        contentPadding: EdgeInsets.zero,
                        title: Text(_custom[i].title, style: const TextStyle(fontFamily: 'Cairo', fontSize: 13)),
                        subtitle: Text(AppUtils.money(_custom[i].price), style: const TextStyle(fontFamily: 'Cairo', fontSize: 12, color: AppTheme.primary)),
                        trailing: IconButton(
                          icon: const Icon(Icons.delete_outline, color: AppTheme.danger),
                          onPressed: () => setState(() => _custom.removeAt(i)),
                        ),
                      ),
                  TextButton.icon(
                    onPressed: _addCustom,
                    icon: const Icon(Icons.add_rounded),
                    label: const Text('إضافة بند مخصص', style: TextStyle(fontFamily: 'Cairo')),
                  ),
                ],
              ),
            ),
          ),

          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppTheme.primary.withValues(alpha: 0.06),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Row(
                    children: [
                      const Text('الإجمالي:', style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w800)),
                      const Spacer(),
                      MoneyText(_subtotal + (_taxEnabled ? _subtotal * (double.tryParse(_taxRateCtrl.text) ?? 0).clamp(0.0, 100.0) / 100 : 0), large: true),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('تطبيق الضريبة على هذا العرض', style: TextStyle(fontFamily: 'Cairo')),
                  value: _taxEnabled,
                  onChanged: (value) => setState(() => _taxEnabled = value),
                ),
                if (_taxEnabled) AppField(label: 'نسبة الضريبة (%)', keyboard: TextInputType.number, controller: _taxRateCtrl, onChanged: (_) => setState(() {})),
                ElevatedButton(onPressed: _save, child: const Text('حفظ عرض السعر')),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _addPart() async {
    final parts = app.allParts;
    if (parts.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('لا توجد قطع في المخزون.', style: TextStyle(fontFamily: 'Cairo'))));
      return;
    }
    final picked = await showModalBottomSheet<String>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (final p in parts)
              ListTile(
                leading: const Icon(Icons.construction_rounded, color: AppTheme.primary),
                title: Text(p['name']?.toString() ?? '', style: const TextStyle(fontFamily: 'Cairo')),
                subtitle: Text(AppUtils.money(p['unitCost']), style: const TextStyle(fontFamily: 'Cairo', fontSize: 12)),
                onTap: () => Navigator.pop(ctx, p['id']?.toString()),
              ),
          ],
        ),
      ),
    );
    if (picked == null) return;
    final p = parts.firstWhere((x) => x['id']?.toString() == picked);
    final qtyCtrl = TextEditingController(text: '1');
    final price = await showDialog<double>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('قطعة من المخزون', style: TextStyle(fontFamily: 'Cairo')),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(p['name']?.toString() ?? '', style: const TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            TextField(controller: qtyCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'الكمية')),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('تراجع', style: TextStyle(fontFamily: 'Cairo'))),
          TextButton(onPressed: () => Navigator.pop(ctx, 1), child: const Text('إضافة', style: TextStyle(fontFamily: 'Cairo'))),
        ],
      ),
    );
    if (price == null) return;
    final qty = int.tryParse(qtyCtrl.text) ?? 1;
    final unitPrice = (p['unitCost'] as num?)?.toDouble() ?? 0;
    setState(() {
      _parts.add(PartsItem(
        section: 'قطع غيار بأقل سعر',
        title: p['name']?.toString() ?? '',
        description: '',
        partId: p['id']?.toString() ?? '',
        qty: qty,
        unitPrice: unitPrice,
        price: unitPrice * qty,
      ));
    });
  }

  Future<void> _addCustom() async {
    final titleCtrl = TextEditingController();
    final priceCtrl = TextEditingController();
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('بند مخصص', style: TextStyle(fontFamily: 'Cairo')),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: titleCtrl, decoration: const InputDecoration(labelText: 'العنوان', hintTextDirection: TextDirection.rtl)),
            const SizedBox(height: 8),
            TextField(controller: priceCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'السعر (ر.س)')),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('تراجع', style: TextStyle(fontFamily: 'Cairo'))),
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('إضافة', style: TextStyle(fontFamily: 'Cairo'))),
        ],
      ),
    );
    if (titleCtrl.text.isNotEmpty) {
      setState(() {
        _custom.add(CustomItem(title: titleCtrl.text, price: double.tryParse(priceCtrl.text) ?? 0));
      });
    }
  }
}
