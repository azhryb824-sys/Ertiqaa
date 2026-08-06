import 'package:flutter/material.dart';
import '../../core/constants.dart';
import '../../core/utils.dart';
import '../../models/ticket.dart';
import '../../pdf/pdf_generator.dart';
import '../../state/app_state.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// تفاصيل بلاغ + إسناد + إغلاق + سجل التحديثات.
class TicketDetailScreen extends StatelessWidget {
  const TicketDetailScreen({super.key});

  Ticket? _find() {
    final app = AppState.instance;
    final id = app.currentPageData['id']?.toString() ?? '';
    for (final t in app.visibleTickets) {
      if (t.id == id) return t;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final app = AppState.instance;
    final t = _find();
    if (t == null) {
      return Scaffold(
        backgroundColor: AppTheme.bg,
        appBar: AppBar(title: const Text('البلاغ')),
        body: const EmptyState('البلاغ غير موجود'),
      );
    }
    final session = app.session!;
    final assignedName = () {
      if (t.assignedTo.isEmpty) return '';
      for (final s in app.allStaff) {
        if (s['id']?.toString() == t.assignedTo) {
          final n = s['name']?.toString() ?? '';
          if (n.isNotEmpty) return n;
        }
      }
      return t.assignedTo;
    }();

    Map<String, dynamic>? invoice;
    for (final inv in app.allInvoices) {
      if (inv['ticketId']?.toString() == t.id || inv['id']?.toString() == t.invoiceId) {
        invoice = inv;
        break;
      }
    }

    return Scaffold(
      backgroundColor: AppTheme.bg,
      appBar: AppBar(title: Text(t.id)),
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
                      child: Text(t.title,
                          style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800, fontFamily: 'Cairo')),
                    ),
                    StatusBadge(t.status),
                  ],
                ),
                const SizedBox(height: 8),
                Text(AppConstants.ticketPriorityLabels[t.priority] ?? t.priority,
                    style: const TextStyle(color: AppTheme.goldLight, fontFamily: 'Cairo')),
              ],
            ),
          ),

          if (invoice != null)
            Card(
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              child: ListTile(
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                leading: const Icon(Icons.receipt_long_rounded, color: AppTheme.gold),
                title: const Text('فاتورة الكشف والصيانة (100 ر.س)',
                    style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w700, fontSize: 14)),
                subtitle: Text('رقم الفاتورة: ${invoice!['id']} • ${invoice!['status']}',
                    style: const TextStyle(fontFamily: 'Cairo', fontSize: 12, color: AppTheme.textMuted)),
                trailing: IconButton(
                  icon: const Icon(Icons.print_rounded, color: AppTheme.primary),
                  onPressed: () => _printInvoice(context, invoice!),
                ),
              ),
            ),

          const PageTitle('التفاصيل'),
          _InfoRow('الوصف', t.description),
          _InfoRow('العميل', t.clientLabel),
          if (assignedName.isNotEmpty) _InfoRow('المسند إليه', assignedName),
          if ((t.building['name'] as String?)?.isNotEmpty ?? false) _InfoRow('المبنى', t.building['name'] as String),

          if (session.canManage && t.status != 'مغلق') ...[
            const SectionDivider(),
            const PageTitle('الإجراءات'),
            Wrap(
              spacing: 8,
              children: [
                if (session.isTechnician || session.canManage)
                  ActionButtonC(icon: Icons.person_add_alt_1_rounded, label: 'إسناد لي', color: AppTheme.primary, onTap: () => _assign(context, app, t, session.id)),
                if (session.canManage)
                  _AssignToButton(ticket: t),
                ActionButtonC(icon: Icons.check_rounded, label: 'إغلاق البلاغ', color: AppTheme.success, onTap: () => _close(context, app, t)),
              ],
            ),
          ],

          const SectionDivider(),
          const PageTitle('سجل التحديثات'),
          if (t.updates.isEmpty)
            const EmptyState('لا توجد تحديثات')
          else
            for (final u in t.updates)
              ListCard(
                leadingIcon: const Icon(Icons.schedule_rounded, color: AppTheme.gold),
                title: (u['byName'] ?? u['by'] ?? '') as String,
                subtitle: (u['text'] ?? '').toString(),
                trailing: AppUtils.fmtDateTime(u['at']),
              ),
        ],
      ),
    );
  }

  Future<void> _printInvoice(BuildContext context, Map<String, dynamic> inv) async {
    final app = AppState.instance;
    try {
      await PdfGenerator.sharePdf('فاتورة',
          PdfGenerator.invoiceContent(inv, app.myOwnerCompany),
          ownerCompany: app.myOwnerCompany);
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تعذر إنشاء PDF.', style: TextStyle(fontFamily: 'Cairo'))));
      }
    }
  }

  Future<void> _assign(BuildContext context, AppState app, Ticket t, String selfId) async {
    await app.update('misadTickets', {
      ...t.toJson(),
      'assignedTo': selfId,
      'assignedName': app.session!.name,
      'updates': [
        ...t.updates,
        {'by': app.session!.id, 'byName': app.session!.name, 'text': 'تم إسناد البلاغ', 'at': DateTime.now().millisecondsSinceEpoch},
      ],
    });
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم إسناد البلاغ إليك.', style: TextStyle(fontFamily: 'Cairo'))));
    }
  }

  Future<void> _close(BuildContext context, AppState app, Ticket t) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('إغلاق البلاغ', style: TextStyle(fontFamily: 'Cairo')),
        content: const Text('هل أنت متأكد من إغلاق هذا البلاغ؟', style: TextStyle(fontFamily: 'Cairo')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('تراجع', style: TextStyle(fontFamily: 'Cairo'))),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('إغلاق', style: TextStyle(fontFamily: 'Cairo', color: AppTheme.success))),
        ],
      ),
    );
    if (confirmed != true) return;
    await app.update('misadTickets', {
      ...t.toJson(),
      'status': 'مغلق',
      'updates': [
        ...t.updates,
        {'by': app.session!.id, 'byName': app.session!.name, 'text': 'تم إغلاق البلاغ', 'at': DateTime.now().millisecondsSinceEpoch},
      ],
    });
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم إغلاق البلاغ.', style: TextStyle(fontFamily: 'Cairo'))));
    }
  }
}

class _AssignToButton extends StatelessWidget {
  final Ticket ticket;
  const _AssignToButton({required this.ticket});

  @override
  Widget build(BuildContext context) {
    final app = AppState.instance;
    final staff = app.allStaff.where((s) => s['role']?.toString() == 'technician' || s['role']?.toString() == 'engineer');
    return ActionButtonC(
      icon: Icons.assignment_ind_rounded,
      label: 'إسناد لفني',
      color: AppTheme.gold,
      onTap: () async {
        if (staff.isEmpty) return;
        final picked = await showModalBottomSheet<String>(
          context: context,
          builder: (ctx) => SafeArea(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Padding(
                  padding: EdgeInsets.all(12),
                  child: Text('إسناد البلاغ إلى', style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w800)),
                ),
                for (final s in staff)
                  ListTile(
                    leading: const Icon(Icons.person_rounded, color: AppTheme.primary),
                    title: Text(s['name']?.toString() ?? '', style: const TextStyle(fontFamily: 'Cairo')),
                    subtitle: Text(s['role']?.toString() ?? '', style: const TextStyle(fontFamily: 'Cairo', fontSize: 12)),
                    onTap: () => Navigator.pop(ctx, s['identity']?.toString() ?? s['id']?.toString()),
                  ),
              ],
            ),
          ),
        );
        if (picked == null) return;
        final s = staff.firstWhere((x) => (x['identity']?.toString() ?? x['id']?.toString()) == picked, orElse: () => const {});
        await app.update('misadTickets', {
          ...ticket.toJson(),
          'assignedTo': picked,
          'assignedName': s['name']?.toString() ?? picked,
          'updates': [
            ...ticket.updates,
            {'by': app.session!.id, 'byName': app.session!.name, 'text': 'تم إسناد البلاغ إلى ${s['name'] ?? picked}', 'at': DateTime.now().millisecondsSinceEpoch},
          ],
        });
      },
    );
  }
}

class ActionButtonC extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;
  const ActionButtonC({super.key, required this.icon, required this.label, required this.color, required this.onTap});

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
  const _InfoRow(this.label, this.value);

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
