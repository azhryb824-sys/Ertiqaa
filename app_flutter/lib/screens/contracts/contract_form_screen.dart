import 'package:flutter/material.dart';
import '../../core/constants.dart';
import '../../core/utils.dart';
import '../../models/contract.dart';
import '../../state/app_state.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// نموذج إنشاء/تعديل عقد — أقسام مرقّمة: البيانات، المواصفات، البنود، الخطة.
class ContractFormScreen extends StatefulWidget {
  const ContractFormScreen({super.key});

  @override
  State<ContractFormScreen> createState() => _ContractFormScreenState();
}

class _ContractFormScreenState extends State<ContractFormScreen> {
  final app = AppState.instance;

  String? _editId;
  Contract? _existing;
  String _type = 'صيانة';
  String _targetType = 'client';
  String _clientId = '';
  String _clientName = '';
  String _clientCompanyUnifiedNumber = '';
  String _clientCompanyName = '';
  String _clientPhone = '';
  double _value = 0;
  final _detailsCtrl = TextEditingController();
  String _maintenancePeriod = 'سنة';
  int _contractYears = 1;
  final _paymentMethodCtrl = TextEditingController();
  final _financialNotesCtrl = TextEditingController();

  final Map<String, String> _specs = Map.of(AppConstants.specDefaults);
  final List<Map<String, dynamic>> _buildings = [];
  final List<Map<String, dynamic>> _customItems = [];
  final List<String> _selectedDefaultItemIds = [];
  final List<MaintenanceItem> _checklist = [];
  List<Map<String, dynamic>> _paymentPlan = [];

  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _buildChecklist();
    _load();
  }

  void _buildChecklist() {
    for (final sec in AppConstants.maintenanceSections) {
      final items = (sec['items'] as List).cast<String>();
      for (var i = 0; i < items.length; i++) {
        _checklist.add(MaintenanceItem(
          id: '${sec['section']}-${i + 1}',
          section: sec['section'] as String,
          title: items[i],
        ));
      }
    }
  }

  Future<void> _load() async {
    final id = app.currentPageData['id']?.toString() ?? '';
    if (id.isNotEmpty) {
      for (final c in app.allContracts) {
        if (c.id == id) { _existing = c; _editId = id; break; }
      }
    }
    if (_existing != null) {
      final c = _existing!;
      _type = c.type;
      _targetType = c.targetType;
      _clientId = c.clientId;
      _clientName = c.clientName;
      _clientCompanyUnifiedNumber = c.clientCompanyUnifiedNumber;
      _clientCompanyName = c.clientCompanyName;
      _clientPhone = c.clientPhone;
      _value = c.value;
      _detailsCtrl.text = c.details;
      _maintenancePeriod = c.maintenancePeriod.isEmpty ? 'سنة' : c.maintenancePeriod;
      _contractYears = c.contractYears;
      _paymentMethodCtrl.text = c.paymentMethod;
      _financialNotesCtrl.text = c.financialNotes;
      _specs.addAll(c.elevatorInfo.map((k, v) => MapEntry(k, v.toString())));
      _buildings.addAll(c.buildings.map((b) => b.toJson()));
      _customItems.addAll(c.customItems.map((ci) => ci.toJson()));
      _selectedDefaultItemIds.addAll(c.items.map((i) => i.id?.toString() ?? '').where((i) => i.isNotEmpty));
      _checklist.clear();
      for (final m in c.maintenanceChecklist) {
        _checklist.add(m);
      }
      if (_checklist.isEmpty) _buildChecklist();
      _paymentPlan = c.paymentPlan.map((p) => p.toJson()).toList();
    } else {
      _paymentPlan = AppConstants.defaultPaymentPlan.map((e) => Map<String, dynamic>.from(e)).toList();
    }
    setState(() => _loading = false);
  }

  @override
  void dispose() {
    _detailsCtrl.dispose();
    _paymentMethodCtrl.dispose();
    _financialNotesCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final now = DateTime.now();
    final startDate = AppUtils.dateVal(now);
    final endDate = AppUtils.addYears(now, _contractYears).toIso8601String().split('T').first;

    final contract = {
      'id': _editId ?? app.nextContractId(),
      'companyOwnerId': app.ownerId,
      'companyId': app.ownerId,
      'type': _type,
      'targetType': _targetType,
      'clientId': _clientId,
      'clientName': _clientName,
      'clientCompanyUnifiedNumber': _clientCompanyUnifiedNumber,
      'clientCompanyName': _clientCompanyName,
      'clientPhone': _clientPhone,
      'value': _value,
      'elevatorInfo': _specs,
      'installationInfo': {},
      'maintenancePeriod': _type == 'صيانة' ? _maintenancePeriod : '',
      'maintenanceChecklist': _checklist.map((m) => m.toJson()).toList(),
      'buildings': _buildings,
      'items': _defaultItems(),
      'customItems': _customItems,
      'details': _detailsCtrl.text,
      'paymentMethod': _paymentMethodCtrl.text,
      'financialNotes': _financialNotesCtrl.text,
      'status': 'بانتظار موافقة العميل',
      'startDate': startDate,
      'contractYears': _contractYears,
      'endDate': endDate,
      'createdAt': DateTime.now().toIso8601String(),
      'createdAtMs': now.millisecondsSinceEpoch,
      'createdBy': app.session!.id,
      'company': {'name': ''},
      'paymentPlan': _type == 'تركيب' ? _paymentPlan : [],
    };

    if (_existing != null) {
      contract['updatedAt'] = DateTime.now().toIso8601String();
      contract['updatedBy'] = app.session!.id;
      contract['amendmentRequired'] = true;
      contract['status'] = 'بانتظار موافقة العميل';
    }

    await app.update('misadContracts', contract);
    await app.logActivity(_editId != null ? 'تعديل العقد' : 'إنشاء العقد',
        entityType: 'contract', entityId: contract['id'] as String);
    if (mounted) {
      Navigator.of(context).pop();
      app.back();
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('تم ${_editId != null ? 'تعديل' : 'إنشاء'} العقد.', style: const TextStyle(fontFamily: 'Cairo'))));
    }
  }

  List<Map<String, dynamic>> _defaultItems() {
    final out = <Map<String, dynamic>>[];
    for (final id in _selectedDefaultItemIds) {
      for (final d in app.allDefaultItems) {
        if (d['id'].toString() == id) { out.add(Map<String, dynamic>.from(d)); break; }
      }
    }
    return out;
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        backgroundColor: AppTheme.bg,
        appBar: AppBar(title: Text('العقد')),
        body: Center(child: CircularProgressIndicator(color: AppTheme.primary)),
      );
    }
    final clients = app.clientCompanies;
    return Scaffold(
      backgroundColor: AppTheme.bg,
      appBar: AppBar(title: Text(_editId != null ? 'تعديل العقد' : 'عقد جديد')),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 110),
        children: [
          _section(1, 'بيانات العقد', [
            AppDropdown<String>(
              label: 'نوع العقد',
              value: _type,
              items: AppConstants.contractTypes,
              labelOf: (v) => v,
              onChanged: (v) => setState(() => _type = v!),
            ),
            AppDropdown<String>(
              label: 'العميل (فرد / منشأة)',
              value: _targetType,
              items: const ['client', 'company'],
              labelOf: (v) => v == 'company' ? 'منشأة' : 'فرد',
              onChanged: (v) => setState(() => _targetType = v!),
            ),
            if (_targetType == 'company' && clients.isNotEmpty)
              AppDropdown<String>(
                label: 'اختر منشأة العميل',
                value: null,
                items: [for (final c in clients) c['id'] as String],
                labelOf: (id) => clients.firstWhere((c) => c['id'] == id)['name']?.toString() ?? id,
                onChanged: (id) {
                  final c = clients.firstWhere((cl) => cl['id'] == id);
                  setState(() {
                    _clientId = '';
                    _clientCompanyName = c['name']?.toString() ?? '';
                    _clientCompanyUnifiedNumber = c['unifiedNumber']?.toString() ?? '';
                  });
                },
              ),
            AppField(label: 'رقم هوية العميل', keyboard: TextInputType.number, initialText: _clientId, onChanged: (v) => _clientId = v),
            AppField(label: 'اسم العميل', initialText: _clientName, onChanged: (v) => _clientName = v),
            AppField(label: 'رقم الوحدة (إن وجد)', initialText: _clientCompanyUnifiedNumber, onChanged: (v) => _clientCompanyUnifiedNumber = v),
            AppField(label: 'اسم المنشأة (إن وجدت)', initialText: _clientCompanyName, onChanged: (v) => _clientCompanyName = v),
            AppField(label: 'رقم جوال العميل', keyboard: TextInputType.phone, initialText: _clientPhone, onChanged: (v) => _clientPhone = v),
            AppField(label: 'قيمة العقد (ر.س)', keyboard: TextInputType.number, initialText: _value > 0 ? _value.toString() : '', onChanged: (v) => _value = double.tryParse(v) ?? 0),
            AppDropdown<int>(
              label: 'عدد سنوات العقد',
              value: _contractYears,
              items: const [1, 2, 3, 4, 5],
              labelOf: (v) => '$v سنة',
              onChanged: (v) => setState(() => _contractYears = v!),
            ),
            if (_type == 'صيانة')
              AppDropdown<String>(
                label: 'فترة الصيانة',
                value: _maintenancePeriod,
                items: const ['سنة', 'سنتان', '3 سنوات', '5 سنوات'],
                labelOf: (v) => v,
                onChanged: (v) => setState(() => _maintenancePeriod = v!),
              ),
            AppField(label: 'تفاصيل العقد', maxLines: 3, onChanged: (v) => _detailsCtrl.text = v, controller: _detailsCtrl),
          ]),

          _section(2, 'مواصفات المصعد', _specsSection()),

          if (_type == 'صيانة')
            _section(3, 'بنود الصيانة الدورية', _checklistSection()),

          _section(4, 'البنود والمواصفات الإضافية', _itemsSection()),

          if (_type == 'تركيب')
            _section(5, 'خطة الدفعات', _paymentPlanSection()),

          _section(6, 'الدفع والملاحظات', [
            AppField(label: 'طريقة الدفع', onChanged: (v) => _paymentMethodCtrl.text = v, controller: _paymentMethodCtrl),
            AppField(label: 'ملاحظات مالية', maxLines: 2, onChanged: (v) => _financialNotesCtrl.text = v, controller: _financialNotesCtrl),
          ]),

          Padding(
            padding: const EdgeInsets.all(16),
            child: ElevatedButton(onPressed: _save, child: const Text('حفظ العقد')),
          ),
        ],
      ),
    );
  }

  Widget _section(int n, String title, List<Widget> children) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SectionHeader(n, title),
            ...children,
          ],
        ),
      ),
    );
  }

  List<Widget> _specsSection() {
    return [
      for (final group in AppConstants.specGroups)
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Text(group['tab'] as String,
                  style: const TextStyle(fontWeight: FontWeight.w800, fontFamily: 'Cairo')),
            ),
            for (final f in (group['fields'] as List))
              _specField(f as List),
          ],
        ),
    ];
  }

  Widget _specField(List f) {
    final key = f[0] as String;
    final label = f[1] as String;
    final type = f[2] as String;
    final options = f.length > 3 ? (f[3] as List?)?.cast<String>() : null;
    final current = _specs[key] ?? '';
    if (type == 'select' && options != null) {
      return AppDropdown<String>(
        label: label,
        value: options.contains(current) ? current : options.first,
        items: options,
        labelOf: (v) => v,
        onChanged: (v) => setState(() => _specs[key] = v!),
      );
    }
    return AppField(
      label: label,
      maxLines: type == 'textarea' ? 3 : 1,
      initialText: current,
      onChanged: (v) => setState(() => _specs[key] = v),
    );
  }

  List<Widget> _checklistSection() {
    final bySection = <String, List<MaintenanceItem>>{};
    for (final m in _checklist) {
      bySection.putIfAbsent(m.section, () => []).add(m);
    }
    return [
      for (final entry in bySection.entries)
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Text(entry.key, style: const TextStyle(fontWeight: FontWeight.w800, fontFamily: 'Cairo')),
            ),
            for (final m in entry.value)
              CheckboxListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                title: Text(m.title, style: const TextStyle(fontFamily: 'Cairo', fontSize: 13)),
                value: m.checked,
                onChanged: (v) => setState(() {
                  m.checked = v ?? false;
                  m.status = (v ?? false) ? 'تم' : 'مطلوب';
                }),
              ),
          ],
        ),
    ];
  }

  List<Widget> _itemsSection() {
    return [
      const Padding(
        padding: EdgeInsets.symmetric(vertical: 6),
        child: Text('البنود الافتراضية', style: TextStyle(fontWeight: FontWeight.w800, fontFamily: 'Cairo')),
      ),
      if (app.allDefaultItems.isEmpty)
        const Text('لا توجد بنود افتراضية — أضفها من صفحة البنود الافتراضية.', style: TextStyle(fontFamily: 'Cairo', color: AppTheme.textMuted, fontSize: 12))
      else
        for (final d in app.allDefaultItems)
          CheckboxListTile(
            dense: true,
            contentPadding: EdgeInsets.zero,
            title: Text(d['title']?.toString() ?? '', style: const TextStyle(fontFamily: 'Cairo', fontSize: 13)),
            subtitle: Text(d['description']?.toString() ?? '', style: const TextStyle(fontFamily: 'Cairo', fontSize: 11, color: AppTheme.textMuted)),
            secondary: Text(AppUtils.money(d['price']), style: const TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w700, fontSize: 12)),
            value: _selectedDefaultItemIds.contains(d['id'].toString()),
            onChanged: (v) => setState(() {
              final id = d['id'].toString();
              if (v == true) _selectedDefaultItemIds.add(id);
              else _selectedDefaultItemIds.remove(id);
            }),
          ),
      const Padding(
        padding: EdgeInsets.symmetric(vertical: 6),
        child: Text('بنود إضافية', style: TextStyle(fontWeight: FontWeight.w800, fontFamily: 'Cairo')),
      ),
      for (var i = 0; i < _customItems.length; i++)
        ListTile(
          dense: true,
          contentPadding: EdgeInsets.zero,
          title: Text('${_customItems[i]['title']} — ${AppUtils.money(_customItems[i]['price'])}', style: const TextStyle(fontFamily: 'Cairo', fontSize: 13)),
          trailing: IconButton(
            icon: const Icon(Icons.delete_outline, color: AppTheme.danger),
            onPressed: () => setState(() => _customItems.removeAt(i)),
          ),
        ),
      TextButton.icon(
        onPressed: () => _addCustomItem(),
        icon: const Icon(Icons.add_rounded),
        label: const Text('إضافة بند مخصص', style: TextStyle(fontFamily: 'Cairo')),
      ),
    ];
  }

  Future<void> _addCustomItem() async {
    final titleCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    final priceCtrl = TextEditingController();
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('بند مخصص', style: TextStyle(fontFamily: 'Cairo')),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: titleCtrl, decoration: const InputDecoration(labelText: 'العنوان', hintText: 'مثال: صيانة إضافية', hintTextDirection: TextDirection.rtl)),
            const SizedBox(height: 8),
            TextField(controller: descCtrl, decoration: const InputDecoration(labelText: 'الوصف', hintTextDirection: TextDirection.rtl)),
            const SizedBox(height: 8),
            TextField(controller: priceCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'السعر (ر.س)')),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('تراجع', style: TextStyle(fontFamily: 'Cairo'))),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
            },
            child: const Text('إضافة', style: TextStyle(fontFamily: 'Cairo')),
          ),
        ],
      ),
    );
    if (titleCtrl.text.isNotEmpty) {
      setState(() {
        _customItems.add({
          'section': 'بنود إضافية',
          'title': titleCtrl.text,
          'description': descCtrl.text,
          'price': double.tryParse(priceCtrl.text) ?? 0,
        });
      });
    }
  }

  List<Widget> _paymentPlanSection() {
    final total = _paymentPlan.fold<double>(0, (s, p) => s + ((p['percent'] as num?)?.toDouble() ?? 0));
    return [
      for (var i = 0; i < _paymentPlan.length; i++)
        Card(
          elevation: 0,
          color: AppTheme.bg,
          child: ListTile(
            title: Text('${_paymentPlan[i]['label']}', style: const TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w700)),
            subtitle: Text(_paymentPlan[i]['description'] ?? '', style: const TextStyle(fontFamily: 'Cairo', fontSize: 12)),
            trailing: Text('${_paymentPlan[i]['percent']}%', style: const TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w800, color: AppTheme.gold)),
          ),
        ),
      Row(
        children: [
          Expanded(child: Text('المجموع: ${total.toStringAsFixed(0)}%', style: const TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w800))),
          if (total != 100)
            const Text('(يجب أن يكون 100%)', style: TextStyle(fontFamily: 'Cairo', fontSize: 12, color: AppTheme.danger)),
        ],
      ),
    ];
  }
}
