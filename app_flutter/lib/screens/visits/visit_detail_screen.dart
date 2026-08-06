import 'package:flutter/material.dart';
import '../../core/constants.dart';
import '../../core/utils.dart';
import '../../state/app_state.dart';
import '../../state/business_rules.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// تفاصيل زيارة + إسناد + إنشاء تقرير فني + اعتماد عميل + تقييم.
class VisitDetailScreen extends StatelessWidget {
  const VisitDetailScreen({super.key});

  Map<String, dynamic>? _find() {
    final app = AppState.instance;
    final id = app.currentPageData['id']?.toString() ?? '';
    for (final v in app.allVisits) {
      if (v['id']?.toString() == id) return v;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final app = AppState.instance;
    final v = _find();
    if (v == null) {
      return Scaffold(
        backgroundColor: AppTheme.bg,
        appBar: AppBar(title: const Text('الزيارة')),
        body: const EmptyState('الزيارة غير موجودة'),
      );
    }
    final session = app.session!;
    final status = v['status']?.toString() ?? '';
    final reportId = v['reportId']?.toString() ?? '';
    final hasReport = reportId.isNotEmpty;
    final canWrite = BusinessRules.canWriteReport(session, v);
    final isClient = session.isClient;

    return Scaffold(
      backgroundColor: AppTheme.bg,
      appBar: AppBar(title: Text(v['id']?.toString() ?? '')),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 90),
        children: [
          Container(
            margin: const EdgeInsets.all(16),
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [AppTheme.primaryDark, AppTheme.primary]),
              borderRadius: BorderRadius.circular(18),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(v['visitType']?.toString() == 'دورية' ? 'زيارة دورية' : 'زيارة كشفية',
                          style: const TextStyle(color: Colors.white, fontSize: 19, fontWeight: FontWeight.w800, fontFamily: 'Cairo')),
                    ),
                    StatusBadge(status),
                  ],
                ),
                const SizedBox(height: 8),
                Text(AppUtils.fmtDateTime(v['scheduledAt']),
                    style: const TextStyle(color: AppTheme.goldLight, fontFamily: 'Cairo')),
              ],
            ),
          ),

          const PageTitle('التفاصيل'),
          _IRow('العميل', _clientName(v)),
          if (v['assignedName']?.toString().isNotEmpty == true) _IRow('الفني', v['assignedName'].toString()),
          if (v['notes']?.toString().isNotEmpty == true) _IRow('الملاحظات', v['notes'].toString()),

          const SectionDivider(),
          const PageTitle('الإجراءات'),
          Wrap(
            spacing: 8,
            children: [
              if ((session.canManage || session.isTechnician) && status != 'مكتملة' && status != 'ملغية' && !hasReport)
                _AB(Icons.person_add_alt_1_rounded, 'إسناد لي', AppTheme.primary, () => _assign(context, app, v)),
              if ((session.canManage) && status != 'مكتملة' && status != 'ملغية' && !hasReport)
                _AB(Icons.assignment_ind_rounded, 'إسناد لفني', AppTheme.gold, () => _assignToStaff(context, app, v)),
              if (canWrite && !hasReport)
                _AB(Icons.description_rounded, 'إنشاء التقرير', AppTheme.success, () => _openReport(context, app, v)),
              if (isClient && status == 'بانتظار الاعتماد')
                _AB(Icons.check_rounded, 'اعتماد الزيارة', AppTheme.success, () => _approve(context, app, v)),
              if (isClient && status == 'بانتظار التقييم')
                _AB(Icons.star_rounded, 'تقييم الزيارة', AppTheme.gold, () => _rate(context, app, v)),
            ],
          ),

          if (hasReport) ...[
            const SectionDivider(),
            const PageTitle('تقرير الزيارة'),
            ListCard(
              title: 'التقرير: $reportId',
              subtitle: 'انقر لفتح التقرير',
              trailingWidget: const Icon(Icons.chevron_left_rounded, color: AppTheme.textMuted),
              onTap: () => app.goWithData('reports', {'reportId': reportId}),
            ),
          ],
        ],
      ),
    );
  }

  String _clientName(Map<String, dynamic> v) {
    final cn = v['clientCompanyName']?.toString() ?? '';
    if (cn.isNotEmpty) return cn;
    return v['clientName']?.toString() ?? 'غير محدد';
  }

  Future<void> _assign(BuildContext context, AppState app, Map<String, dynamic> v) async {
    await app.update('misadVisits', {
      ...v,
      'assignedTo': app.session!.id,
      'assignedName': app.session!.name,
      'status': 'مجدولة',
    });
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم إسناد الزيارة إليك.', style: TextStyle(fontFamily: 'Cairo'))));
    }
  }

  Future<void> _assignToStaff(BuildContext context, AppState app, Map<String, dynamic> v) async {
    final staff = app.allStaff.where((s) => s['role']?.toString() == 'technician' || s['role']?.toString() == 'engineer').toList();
    if (staff.isEmpty) return;
    final picked = await showModalBottomSheet<String>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (final s in staff)
              ListTile(
                leading: const Icon(Icons.person_rounded, color: AppTheme.primary),
                title: Text(s['name']?.toString() ?? '', style: const TextStyle(fontFamily: 'Cairo')),
                onTap: () => Navigator.pop(ctx, s['identity']?.toString() ?? s['id']?.toString()),
              ),
          ],
        ),
      ),
    );
    if (picked == null) return;
    final s = staff.firstWhere((x) => (x['identity']?.toString() ?? x['id']?.toString()) == picked, orElse: () => const {});
    await app.update('misadVisits', {
      ...v,
      'assignedTo': picked,
      'assignedName': s['name']?.toString() ?? picked,
      'status': 'مجدولة',
    });
  }

  Future<void> _openReport(BuildContext context, AppState app, Map<String, dynamic> v) async {
    await showDialog<void>(
      context: context,
      builder: (ctx) => _ReportDialog(visit: v),
    );
  }

  Future<void> _approve(BuildContext context, AppState app, Map<String, dynamic> v) async {
    // الاعتماد: تفعيل حالة الزيارة (مطابق /api/visits/approve-by-client)
    await app.update('misadVisits', {
      ...v,
      'status': 'بانتظار التقييم',
      'approvedByClient': true,
    });
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم اعتماد الزيارة.', style: TextStyle(fontFamily: 'Cairo'))));
    }
  }

  Future<void> _rate(BuildContext context, AppState app, Map<String, dynamic> v) async {
    int stars = 5;
    final notesCtrl = TextEditingController();
    await showDialog<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocal) => AlertDialog(
          title: const Text('تقييم الزيارة', style: TextStyle(fontFamily: 'Cairo')),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  for (var i = 1; i <= 5; i++)
                    IconButton(
                      icon: Icon(i <= stars ? Icons.star_rounded : Icons.star_border_rounded,
                          color: i <= stars ? AppTheme.gold : AppTheme.textMuted, size: 34),
                      onPressed: () => setLocal(() => stars = i),
                    ),
                ],
              ),
              const SizedBox(height: 8),
              TextField(controller: notesCtrl, decoration: const InputDecoration(labelText: 'ملاحظات', hintTextDirection: TextDirection.rtl)),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('تراجع', style: TextStyle(fontFamily: 'Cairo'))),
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('حفظ', style: TextStyle(fontFamily: 'Cairo')),
            ),
          ],
        ),
      ),
    );
    await app.update('misadVisits', {
      ...v,
      'status': 'مكتملة',
      'rating': {'stars': stars, 'notes': notesCtrl.text},
      'ratedBy': app.session!.id,
    });
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم تقييم الزيارة.', style: TextStyle(fontFamily: 'Cairo'))));
    }
  }
}

/// نموذج تقرير الزيارة الفني.
class _ReportDialog extends StatefulWidget {
  final Map<String, dynamic> visit;
  const _ReportDialog({required this.visit});

  @override
  State<_ReportDialog> createState() => _ReportDialogState();
}

class _ReportDialogState extends State<_ReportDialog> {
  String _elevatorStatus = 'يعمل بشكل طبيعي';
  final _workCtrl = TextEditingController();
  final _issuesCtrl = TextEditingController();
  final _partsCtrl = TextEditingController();
  final _recCtrl = TextEditingController();
  bool _saving = false;

  @override
  void dispose() {
    _workCtrl.dispose();
    _issuesCtrl.dispose();
    _partsCtrl.dispose();
    _recCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final app = AppState.instance;
    final v = widget.visit;
    final now = DateTime.now();
    final description = [_workCtrl.text, _issuesCtrl.text, _partsCtrl.text, _recCtrl.text]
        .where((s) => s.isNotEmpty)
        .join('\n');
    final report = {
      'id': 'REP-${now.millisecondsSinceEpoch}',
      'companyOwnerId': app.ownerId,
      'visitId': v['id'],
      'visitType': v['visitType'],
      'contractId': v['contractId'],
      'clientId': v['clientId'],
      'clientName': v['clientName'],
      'clientCompanyUnifiedNumber': v['clientCompanyUnifiedNumber'],
      'clientCompanyName': v['clientCompanyName'],
      'buildingName': (v['building'] is Map) ? ((v['building'] as Map)['name']?.toString() ?? '') : '',
      'technicianId': app.session!.id,
      'technician': app.session!.name,
      'elevatorStatus': _elevatorStatus,
      'workDone': _workCtrl.text,
      'issues': _issuesCtrl.text,
      'parts': _partsCtrl.text,
      'recommendations': _recCtrl.text,
      'attachments': '',
      'description': description,
      'status': 'بانتظار اعتماد العميل',
      'locked': true,
      'createdAt': now.toIso8601String(),
      'createdAtMs': now.millisecondsSinceEpoch,
    };
    setState(() => _saving = true);
    await app.append('misadVisitReports', report);
    await app.update('misadVisits', {
      ...v,
      'status': 'بانتظار الاعتماد',
      'reportId': report['id'],
    });
    await app.logActivity('إنشاء تقرير زيارة', entityType: 'report', entityId: report['id'] as String);
    if (!mounted) return;
    Navigator.pop(context);
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم حفظ التقرير.', style: TextStyle(fontFamily: 'Cairo'))));
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('تقرير الزيارة الفني', style: TextStyle(fontFamily: 'Cairo')),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AppDropdown<String>(
              label: 'حالة المصعد',
              value: _elevatorStatus,
              items: const ['يعمل بشكل طبيعي', 'يعمل مع ملاحظات', 'متوقف عن العمل', 'يحتاج زيارة إضافية'],
              labelOf: (v) => v,
              onChanged: (v) => setState(() => _elevatorStatus = v!),
            ),
            AppField(label: 'الأعمال المنفذة', maxLines: 3, controller: _workCtrl),
            AppField(label: 'الملاحظات/الأعطال', maxLines: 3, controller: _issuesCtrl),
            AppField(label: 'القطع المستخدمة', maxLines: 2, controller: _partsCtrl),
            AppField(label: 'التوصيات', maxLines: 2, controller: _recCtrl),
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('تراجع', style: TextStyle(fontFamily: 'Cairo'))),
        TextButton(
          onPressed: _saving ? null : _save,
          child: const Text('حفظ التقرير', style: TextStyle(fontFamily: 'Cairo', color: AppTheme.success)),
        ),
      ],
    );
  }
}

class _IRow extends StatelessWidget {
  final String label;
  final String value;
  const _IRow(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(flex: 2, child: Text(label, style: const TextStyle(fontFamily: 'Cairo', color: AppTheme.textMuted))),
          Expanded(flex: 3, child: Text(value, textAlign: TextAlign.end, style: const TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w700))),
        ],
      ),
    );
  }
}

class _AB extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;
  const _AB(this.icon, this.label, this.color, this.onTap);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
      child: Material(
        color: color,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, color: Colors.white, size: 18),
                const SizedBox(width: 6),
                Text(label, style: const TextStyle(color: Colors.white, fontFamily: 'Cairo', fontWeight: FontWeight.w700)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
