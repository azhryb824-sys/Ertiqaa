import 'package:flutter/material.dart';
import '../../core/constants.dart';
import '../../core/utils.dart';
import '../../pdf/pdf_generator.dart';
import '../../state/app_state.dart';
import '../../state/business_rules.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// عروض الأسعار: إنشاء، مراجعة/اعتماد (مدير)، اعتماد/رفض (عميل).
class QuotesScreen extends StatelessWidget {
  const QuotesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = AppState.instance;
    final session = app.session!;
    final quotes = app.allQuotes.where((q) {
      if (session.isClient) {
        return BusinessRules.clientMatches(session, q, app.clientCompanies);
      }
      return app.sameCompany(q);
    }).toList()
      ..sort((a, b) => (b['createdAt']?.toString() ?? '').compareTo(a['createdAt']?.toString() ?? ''));

    final canCreate = session.canManage || session.isClient;

    return Scaffold(
      backgroundColor: AppTheme.bg,
      floatingActionButton: canCreate ? Fab(onPressed: () => app.go('quote-form'), label: 'عرض سعر') : null,
      body: quotes.isEmpty
          ? const EmptyState('لا توجد عروض أسعار')
          : ListView.builder(
              padding: const EdgeInsets.only(bottom: 90),
              itemCount: quotes.length,
              itemBuilder: (ctx, i) {
                final q = quotes[i];
                final client = (q['clientCompanyName']?.toString() ?? '').isNotEmpty
                    ? q['clientCompanyName'].toString()
                    : (q['clientName']?.toString() ?? 'عميل');
                return Card(
                  margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 5),
                  child: ListTile(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                    leading: Container(
                      width: 42, height: 42,
                      decoration: BoxDecoration(color: AppTheme.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
                      child: const Icon(Icons.request_quote_rounded, color: AppTheme.primary),
                    ),
                    title: Text('${q['id']} — ${q['title'] ?? ''}', style: const TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w700, fontSize: 14)),
                    subtitle: Text('$client • ${q['type'] ?? ''}', style: const TextStyle(fontFamily: 'Cairo', fontSize: 12, color: AppTheme.textMuted)),
                    trailing: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(AppUtils.money(q['value']), style: const TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w800, color: AppTheme.primaryDark)),
                        const SizedBox(height: 4),
                        StatusBadge(q['status']?.toString()),
                      ],
                    ),
                    onTap: () => _detail(context, q),
                  ),
                );
              },
            ),
    );
  }

  void _detail(BuildContext context, Map<String, dynamic> q) {
    final app = AppState.instance;
    final session = app.session!;
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.7,
        maxChildSize: 0.95,
        builder: (ctx, scroll) => Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: ListView(
            controller: scroll,
            padding: const EdgeInsets.all(20),
            children: [
              Text('${q['id']} — ${q['title']}', style: const TextStyle(fontFamily: 'Cairo', fontSize: 18, fontWeight: FontWeight.w800)),
              const SizedBox(height: 4),
              StatusBadge(q['status']?.toString()),
              const SizedBox(height: 16),
              _row('العميل', (q['clientCompanyName'] ?? q['clientName'] ?? '—').toString()),
              _row('النوع', q['type']?.toString() ?? ''),
              _row('القيمة', AppUtils.money(q['value'])),
              _row('الإجمالي', AppUtils.money(q['subtotal'] ?? q['value'])),
              if (q['details']?.toString().isNotEmpty == true) ...[
                const SizedBox(height: 8),
                Text('التفاصيل:', style: const TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w700)),
                Text(q['details'].toString(), style: const TextStyle(fontFamily: 'Cairo')),
              ],
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: () async {
                  try {
                    await PdfGenerator.sharePdf('عرض سعر',
                        PdfGenerator.quoteContent(q, app.myOwnerCompany),
                        ownerCompany: app.myOwnerCompany);
                  } catch (_) {}
                },
                icon: const Icon(Icons.print_rounded),
                label: const Text('طباعة PDF', style: TextStyle(fontFamily: 'Cairo')),
              ),
              if (session.canManage && q['status'] == 'بانتظار المراجعة والاعتماد') ...[
                const SizedBox(height: 16),
                ElevatedButton.icon(
                  onPressed: () async {
                    await app.update('misadQuotes', {...q, 'status': 'معتمد', 'approvedAt': DateTime.now().toIso8601String(), 'approvedBy': session.id});
                    if (ctx.mounted) Navigator.pop(ctx);
                  },
                  icon: const Icon(Icons.check_circle_rounded),
                  label: const Text('اعتماد العرض', style: TextStyle(fontFamily: 'Cairo')),
                ),
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: () async {
                    await app.update('misadQuotes', {...q, 'status': 'مرفوض', 'rejectedAt': DateTime.now().toIso8601String(), 'rejectedBy': session.id});
                    if (ctx.mounted) Navigator.pop(ctx);
                  },
                  icon: const Icon(Icons.cancel_rounded),
                  label: const Text('رفض العرض', style: TextStyle(fontFamily: 'Cairo')),
                ),
              ],
              if (session.isClient && q['status'] == 'بانتظار المراجعة والاعتماد') ...[
                const SizedBox(height: 16),
                ElevatedButton.icon(
                  onPressed: () async {
                    await app.update('misadQuotes', {...q, 'status': 'معتمد', 'approvedByClient': true, 'approvedAt': DateTime.now().toIso8601String(), 'approvedBy': session.id});
                    if (ctx.mounted) Navigator.pop(ctx);
                  },
                  icon: const Icon(Icons.check_circle_rounded),
                  label: const Text('قبول العرض', style: TextStyle(fontFamily: 'Cairo')),
                ),
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: () async {
                    await app.update('misadQuotes', {...q, 'status': 'مرفوض', 'rejectedAt': DateTime.now().toIso8601String(), 'rejectedBy': session.id});
                    if (ctx.mounted) Navigator.pop(ctx);
                  },
                  icon: const Icon(Icons.cancel_rounded),
                  label: const Text('رفض العرض', style: TextStyle(fontFamily: 'Cairo')),
                ),
              ],
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
