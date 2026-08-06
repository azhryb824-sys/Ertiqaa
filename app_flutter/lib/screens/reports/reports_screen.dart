import 'package:flutter/material.dart';
import '../../core/utils.dart';
import '../../pdf/pdf_generator.dart';
import '../../state/app_state.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// تقارير الزيارات (للعميل: اعتمادها؛ للفني/المدير: الاطلاع).
class ReportsScreen extends StatelessWidget {
  const ReportsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = AppState.instance;
    final session = app.session!;
    var reports = app.allReports;

    if (session.isClient) {
      reports = reports.where((r) {
        return r['clientId']?.toString() == session.id ||
            r['clientName']?.toString() == session.name;
      }).toList();
    } else if (session.isTechnician) {
      reports = reports.where((r) => r['technicianId']?.toString() == session.id).toList();
    } else {
      reports = reports.where((r) => app.sameCompany(r)).toList();
    }
    reports = reports.toList()..sort((a, b) => ((b['createdAtMs'] as num?)?.toInt() ?? 0).compareTo((a['createdAtMs'] as num?)?.toInt() ?? 0));

    // التقارير شبه القابلة للعرض تكون خلفية من visitId
    return Scaffold(
      backgroundColor: AppTheme.bg,
      body: reports.isEmpty
          ? const EmptyState('لا توجد تقارير زيارات')
          : ListView.builder(
              padding: const EdgeInsets.only(bottom: 40),
              itemCount: reports.length,
              itemBuilder: (ctx, i) {
                final r = reports[i];
                final client = (r['clientCompanyName']?.toString() ?? '').isNotEmpty
                    ? r['clientCompanyName'].toString()
                    : (r['clientName']?.toString() ?? '');
                return ListCard(
                  leadingIcon: const Icon(Icons.assignment_rounded, color: AppTheme.primary),
                  title: r['id'].toString(),
                  subtitle: '${r['elevatorStatus']} • $client',
                  trailingWidget: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      StatusBadge(r['status']?.toString()),
                      const SizedBox(height: 4),
                      Text(AppUtils.fmtDateTime(r['createdAtMs']), style: const TextStyle(fontFamily: 'Cairo', fontSize: 10, color: AppTheme.textMuted)),
                    ],
                  ),
                  onTap: () => _detail(context, r),
                );
              },
            ),
    );
  }

  void _detail(BuildContext context, Map<String, dynamic> r) {
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
              Text('${r['id']} — ${r['elevatorStatus']}', style: const TextStyle(fontFamily: 'Cairo', fontSize: 18, fontWeight: FontWeight.w800)),
              const SizedBox(height: 6),
              StatusBadge(r['status']?.toString()),
              const SizedBox(height: 16),
              _row('الفني', r['technician']?.toString() ?? ''),
              _row('التاريخ', AppUtils.fmtDateTime(r['createdAtMs'])),
              _row('الأعمال المنفذة', r['workDone']?.toString() ?? ''),
              _row('الملاحظات', r['issues']?.toString() ?? ''),
              _row('القطع المستخدمة', r['parts']?.toString() ?? ''),
              _row('التوصيات', r['recommendations']?.toString() ?? ''),
              const SizedBox(height: 12),
              ElevatedButton.icon(
                onPressed: () async {
                  final app = AppState.instance;
                  try {
                    await PdfGenerator.sharePdf('تقرير زيارة فنية',
                        PdfGenerator.reportContent(r, app.myOwnerCompany),
                        ownerCompany: app.myOwnerCompany);
                  } catch (_) {
                    if (ctx.mounted) {
                      ScaffoldMessenger.of(ctx).showSnackBar(const SnackBar(
                          content: Text('تعذر إنشاء PDF.', style: TextStyle(fontFamily: 'Cairo'))));
                    }
                  }
                },
                icon: const Icon(Icons.print_rounded),
                label: const Text('طباعة PDF', style: TextStyle(fontFamily: 'Cairo')),
              ),
              if (session.isClient && r['status']?.toString() == 'بانتظار اعتماد العميل') ...[
                const SizedBox(height: 16),
                ElevatedButton.icon(
                  onPressed: () async {
                    await app.update('misadVisitReports', {...r, 'status': 'معتمد'});
                    // تحديث الزيارة المقابلة (حفظ بقية حقولها)
                    final visitId = r['visitId']?.toString() ?? '';
                    final visits = app.allVisits.map((v) => Map<String, dynamic>.from(v)).toList();
                    for (final v in visits) {
                      if (v['id']?.toString() == visitId) {
                        v['status'] = 'بانتظار التقييم';
                        break;
                      }
                    }
                    await app.storage.write('misadVisits', visits);
                    if (ctx.mounted) Navigator.pop(ctx);
                  },
                  icon: const Icon(Icons.check_rounded),
                  label: const Text('اعتماد التقرير', style: TextStyle(fontFamily: 'Cairo')),
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
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(flex: 2, child: Text(label, style: const TextStyle(fontFamily: 'Cairo', color: AppTheme.textMuted))),
          Expanded(flex: 3, child: Text(value, textAlign: TextAlign.end, style: const TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w700))),
        ],
      ),
    );
  }
}
