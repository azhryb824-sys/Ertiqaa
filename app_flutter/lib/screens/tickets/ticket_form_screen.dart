import 'package:flutter/material.dart';
import '../../core/constants.dart';
import '../../core/utils.dart';
import '../../models/ticket.dart';
import '../../state/app_state.dart';
import '../../state/business_rules.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// إنشاء بلاغ جديد (عميل/فني/مدير). ينشئ فاتورة 100 ريال إن لم يوجد عقد صيانة ساري.
class TicketFormScreen extends StatefulWidget {
  const TicketFormScreen({super.key});

  @override
  State<TicketFormScreen> createState() => _TicketFormScreenState();
}

class _TicketFormScreenState extends State<TicketFormScreen> {
  final app = AppState.instance;
  final _titleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  String _priority = 'medium';
  String _contractId = '';
  String _clientId = '';
  String _clientName = '';
  String _clientCompanyName = '';
  String _clientCompanyUnifiedNumber = '';
  bool _loading = false;
  bool _prefillDone = false;

  @override
  void initState() {
    super.initState();
    _prefill();
  }

  void _prefill() {
    final s = app.session!;
    if (s.isClient) {
      _clientId = s.id;
      _clientName = s.name;
      // استنتاج المنشأة من العقود المرئية
      final my = app.visibleContracts;
      if (my.isNotEmpty) {
        _clientCompanyName = my.first.clientCompanyName;
        _clientCompanyUnifiedNumber = my.first.clientCompanyUnifiedNumber;
        _contractId = my.first.id;
        final b = my.first.buildings;
        if (b.isNotEmpty) _building = b.first.toJson();
        final ei = my.first.elevatorInfo;
        _elevatorInfo = ei;
      }
      _prefillDone = true;
    }
  }

  Map<String, dynamic> _building = {};
  Map<String, dynamic> _elevatorInfo = {};

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_titleCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('أدخل عنوان البلاغ.', style: TextStyle(fontFamily: 'Cairo'))));
      return;
    }
    setState(() => _loading = true);
    final now = DateTime.now();
    final session = app.session!;
    final ticket = {
      'id': 'TKT-${now.millisecondsSinceEpoch}',
      'companyOwnerId': app.ownerId,
      'title': _titleCtrl.text.trim(),
      'description': _descCtrl.text.trim(),
      'priority': _priority,
      'status': 'مفتوح',
      'contractId': _contractId,
      'clientId': _clientId,
      'clientName': _clientName,
      'clientCompanyUnifiedNumber': _clientCompanyUnifiedNumber,
      'clientCompanyName': _clientCompanyName,
      'building': _building,
      'elevatorInfo': _elevatorInfo,
      'assignedTo': '',
      'createdBy': session.id,
      'createdByName': session.name,
      'createdAt': now.toIso8601String(),
      'createdAtMs': now.millisecondsSinceEpoch,
      'updates': [],
    };

    // الفاتورة التلقائية (100 ريال) إن لم يوجد عقد صيانة ساري
    final invoice = BusinessRules.autoInvoice(ticket, app.allContracts.map((c) => c.toJson()).toList(), app.ownerCompanies);
    if (invoice != null) {
      final invoices = List<dynamic>.from(app.storage.list(AppConstants.kInvoices));
      invoices.add(invoice);
      await app.storage.write(AppConstants.kInvoices, invoices);
      ticket['invoiceId'] = invoice['id'];
    }

    await app.append('misadTickets', ticket);
    await app.logActivity('إنشاء بلاغ', entityType: 'ticket', entityId: ticket['id'] as String);
    if (!mounted) return;
    setState(() => _loading = false);
    Navigator.of(context).pop();
    app.back();
    ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(invoice != null ? 'تم إنشاء البلاغ وفتح فاتورة بقيمة 100 ر.س.' : 'تم إنشاء البلاغ.', style: const TextStyle(fontFamily: 'Cairo'))));
  }

  @override
  Widget build(BuildContext context) {
    final s = app.session!;
    final myContracts = app.visibleContracts.where((c) => c.status == 'ساري').toList();
    return Scaffold(
      backgroundColor: AppTheme.bg,
      appBar: AppBar(title: const Text('بلاغ جديد')),
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
                  const SectionHeader(1, 'بيانات البلاغ'),
                  AppField(label: 'عنوان البلاغ', controller: _titleCtrl, hint: 'مثال: المصعد متوقف عن العمل'),
                  AppField(label: 'وصف تفصيلي', maxLines: 4, controller: _descCtrl),
                  AppDropdown<String>(
                    label: 'الأولوية',
                    value: _priority,
                    items: AppConstants.ticketPriorityLabels.keys.toList(),
                    labelOf: (v) => AppConstants.ticketPriorityLabels[v] ?? v,
                    onChanged: (v) => setState(() => _priority = v!),
                  ),
                  if (s.isClient && myContracts.isNotEmpty)
                    AppDropdown<String>(
                      label: 'العقد (اختياري)',
                      value: _contractId.isEmpty ? null : _contractId,
                      items: [for (final c in myContracts) c.id],
                      labelOf: (id) => id,
                      onChanged: (v) => setState(() => _contractId = v ?? ''),
                    ),
                  const SizedBox(height: 12),
                  const Text('معلومة: إذا لم يوجد عقد صيانة ساري يغطي هذا البلاغ، ستُفتح فاتورة بقيمة 100 ر.س.',
                      style: TextStyle(fontFamily: 'Cairo', fontSize: 12, color: AppTheme.textMuted)),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: ElevatedButton(
              onPressed: _loading ? null : _save,
              child: _loading
                  ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('إرسال البلاغ'),
            ),
          ),
        ],
      ),
    );
  }
}
