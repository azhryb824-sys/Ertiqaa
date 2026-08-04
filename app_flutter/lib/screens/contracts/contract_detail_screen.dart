import 'package:flutter/material.dart';
import '../../core/constants.dart';
import '../../core/utils.dart';
import '../../models/contract.dart';
import '../../pdf/pdf_generator.dart';
import '../../state/app_state.dart';
import '../../theme.dart';
import '../../widgets/common.dart';
import '../../state/business_rules.dart';

/// تفاصيل عقد + إجراءات (تفعيل/إلغاء/تجديد/تعديل) + معلومات مالية.
class ContractDetailScreen extends StatelessWidget {
  const ContractDetailScreen({super.key});

  Contract? _find() {
    final app = AppState.instance;
    final id = app.currentPageData['id']?.toString() ?? '';
    for (final c in app.visibleContracts) {
      if (c.id == id) return c;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final app = AppState.instance;
    final c = _find();
    if (c == null) {
      return Scaffold(
        backgroundColor: AppTheme.bg,
        appBar: AppBar(title: const Text('العقد')),
        body: const EmptyState('العقد غير موجود أو غير مرئي'),
      );
    }

    final fin = BusinessRules.contractFinance(c, app.allFinancialEntries);
    final session = app.session!;
    final editable = BusinessRules.canEditContract(session, c.status);
    final isManager = session.canManage;

    return Scaffold(
      backgroundColor: AppTheme.bg,
      appBar: AppBar(title: Text(c.id)),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 90),
        children: [
          Container(
            padding: const EdgeInsets.all(18),
            margin: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [AppTheme.primaryDark, AppTheme.primary]),
              borderRadius: BorderRadius.circular(18),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(child: Text(c.type, style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800, fontFamily: 'Cairo'))),
                    StatusBadge(c.status),
                  ],
                ),
                const SizedBox(height: 10),
                Text('العميل: ${c.clientLabel}', style: const TextStyle(color: Colors.white70, fontFamily: 'Cairo')),
                Text('القيمة: ${AppUtils.money(c.value)}', style: const TextStyle(color: AppTheme.goldLight, fontWeight: FontWeight.w700, fontFamily: 'Cairo')),
              ],
            ),
          ),

          if (isManager) ...[
            const PageTitle('الإجراءات'),
            Wrap(
              spacing: 8,
              children: [
                if (c.status == 'بانتظار موافقة العميل')
                  ActionButton(icon: Icons.check_circle_rounded, label: 'تفعيل', color: AppTheme.success, onTap: () => _activate(context, app, c)),
                if (c.status == 'ساري' || c.status == 'منتهيا')
                  ActionButton(icon: Icons.refresh_rounded, label: 'تجديد', color: AppTheme.primary, onTap: () => _renew(context, app, c)),
                if (c.status != 'ملغي' && c.status != 'محذوف')
                  ActionButton(icon: Icons.cancel_rounded, label: 'إلغاء', color: AppTheme.danger, onTap: () => _cancel(context, app, c)),
              if (editable)
                ActionButton(icon: Icons.edit_rounded, label: 'تعديل', color: AppTheme.gold, onTap: () => app.goWithData('contract-form', {'id': c.id})),
              ActionButton(icon: Icons.print_rounded, label: 'طباعة PDF', color: AppTheme.primaryDark, onTap: () => _printPdf(context, app, c)),
            ],
          ),
          ],

          const SectionDivider(),
          const PageTitle('المعلومات المالية'),
          _InfoRow('الإجمالي', AppUtils.money(fin['total'])),
          _InfoRow('المحصَّل', AppUtils.money(fin['paid']), color: AppTheme.success),
          _InfoRow('المتبقي', AppUtils.money(fin['remaining']), color: AppTheme.danger),
          if ((fin['overdue'] as num) > 0)
            _InfoRow('متأخر عن الخطة', AppUtils.money(fin['overdue']), color: AppTheme.danger),

          const SectionDivider(),
          const PageTitle('معلومات العقد'),
          _InfoRow('تاريخ البداية', AppUtils.fmtDate(c.startDate)),
          _InfoRow('تاريخ النهاية', AppUtils.fmtDate(c.endDate)),
          _InfoRow('مدة العقد', '${c.contractYears} سنة'),
          if (c.maintenancePeriod.isNotEmpty) _InfoRow('فترة الصيانة', c.maintenancePeriod),
          if (c.details.isNotEmpty) _InfoRow('التفاصيل', c.details),

          if (c.buildings.isNotEmpty) ...[
            const SectionDivider(),
            const PageTitle('المباني'),
            for (final b in c.buildings)
              ListCard(title: b.name, subtitle: b.district),
          ],

          if (c.elevatorInfo.isNotEmpty) ...[
            const SectionDivider(),
            const PageTitle('مواصفات المصعد'),
            for (final e in c.elevatorInfo.entries)
              if (e.value != null && e.value.toString().isNotEmpty)
                _InfoRow(e.key, e.value.toString()),
          ],

          if (c.items.isNotEmpty || c.customItems.isNotEmpty) ...[
            const SectionDivider(),
            const PageTitle('البنود'),
            for (final it in c.items)
              ListCard(
                title: it.title,
                subtitle: it.description,
                trailing: it.price > 0 ? AppUtils.money(it.price) : null,
              ),
            for (final ci in c.customItems)
              ListCard(
                title: ci.title,
                subtitle: ci.description,
                trailing: ci.price > 0 ? AppUtils.money(ci.price) : null,
              ),
          ],

          if (c.paymentPlan.isNotEmpty) ...[
            const SectionDivider(),
            const PageTitle('خطة الدفعات'),
            for (final p in c.paymentPlan)
              ListCard(title: p.label, subtitle: p.description, trailing: '${p.percent}%'),
          ],
        ],
      ),
    );
  }

  Future<void> _printPdf(BuildContext context, AppState app, Contract c) async {
    try {
      await PdfGenerator.sharePdf('عقد ${c.type}',
          PdfGenerator.contractContent(c, app.myOwnerCompany),
          ownerCompany: app.myOwnerCompany);
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تعذر إنشاء PDF.', style: TextStyle(fontFamily: 'Cairo'))));
      }
    }
  }

  Future<void> _activate(BuildContext context, AppState app, Contract c) async {
    await app.activateContract(c);
    await app.logActivity('تفعيل العقد', entityType: 'contract', entityId: c.id);
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم تفعيل العقد.', style: TextStyle(fontFamily: 'Cairo'))));
    }
  }

  Future<void> _renew(BuildContext context, AppState app, Contract c) async {
    await app.renewContract(c);
    await app.logActivity('تجديد العقد', entityType: 'contract', entityId: c.id);
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم تجديد العقد.', style: TextStyle(fontFamily: 'Cairo'))));
    }
  }

  Future<void> _cancel(BuildContext context, AppState app, Contract c) async {
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('إلغاء العقد', style: TextStyle(fontFamily: 'Cairo')),
        content: const Text('سيتم تعليق جميع الزيارات المرتبطة. هل أنت متأكد؟', style: TextStyle(fontFamily: 'Cairo')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, null), child: const Text('تراجع', style: TextStyle(fontFamily: 'Cairo'))),
          TextButton(onPressed: () => Navigator.pop(ctx, 'confirmed'), child: const Text('إلغاء العقد', style: TextStyle(fontFamily: 'Cairo', color: AppTheme.danger))),
        ],
      ),
    );
    if (reason == null) return;
    await app.cancelContract(c);
    await app.logActivity('إلغاء العقد', entityType: 'contract', entityId: c.id);
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم إلغاء العقد.', style: TextStyle(fontFamily: 'Cairo'))));
    }
  }
}

class ActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;
  const ActionButton({super.key, required this.icon, required this.label, required this.color, required this.onTap});

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

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;
  final Color? color;
  const _InfoRow(this.label, this.value, {this.color});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(flex: 2, child: Text(label, style: const TextStyle(fontFamily: 'Cairo', color: AppTheme.textMuted))),
          Expanded(
            flex: 3,
            child: Text(value,
                textAlign: TextAlign.end,
                style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w700, color: color)),
          ),
        ],
      ),
    );
  }
}
