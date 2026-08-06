import 'package:flutter/material.dart';
import '../../core/constants.dart';
import '../../core/utils.dart';
import '../../pdf/pdf_generator.dart';
import '../../state/app_state.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// المستخلصات (قيد المراجعة → معتمد/مرفوض).
class ClaimsScreen extends StatefulWidget {
  const ClaimsScreen({super.key});

  @override
  State<ClaimsScreen> createState() => _ClaimsScreenState();
}

class _ClaimsScreenState extends State<ClaimsScreen> {
  String? _filter;

  @override
  Widget build(BuildContext context) {
    final app = AppState.instance;
    final session = app.session!;
    if (!session.canManage) {
      return const Scaffold(
        backgroundColor: AppTheme.bg,
        body: EmptyState('غير متاح لدورك.', icon: Icons.lock_outline),
      );
    }
    final claims = app.allClaims.where(app.sameCompany).where((c) {
      if (_filter != null && c['status']?.toString() != _filter) return false;
      return true;
    }).toList()
      ..sort((a, b) => ((b['createdAt'] is num ? b['createdAt'] as num : 0) as num)
          .compareTo((a['createdAt'] is num ? a['createdAt'] as num : 0) as num));

    return Scaffold(
      backgroundColor: AppTheme.bg,
      body: Column(
        children: [
          SizedBox(
            height: 44,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              children: [
                for (final st in [null, 'قيد المراجعة', 'معتمد', 'مرفوض'])
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: ChoiceChip(
                      label: Text(st ?? 'الكل', style: const TextStyle(fontFamily: 'Cairo')),
                      selected: _filter == st,
                      onSelected: (_) => setState(() => _filter = st),
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: claims.isEmpty
                ? const EmptyState('لا توجد مستخلصات')
                : ListView.builder(
                    padding: const EdgeInsets.only(bottom: 90),
                    itemCount: claims.length,
                    itemBuilder: (ctx, i) {
                      final c = claims[i];
                      final contractId = c['contractId']?.toString() ?? '';
                      final contractLabel = contractId.isEmpty ? 'بدون عقد' : contractId;
                      return Card(
                        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 5),
                        child: ListTile(
                          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                          leading: Container(
                            width: 42, height: 42,
                            decoration: BoxDecoration(color: AppTheme.gold.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(12)),
                            child: const Icon(Icons.receipt_long_rounded, color: AppTheme.gold),
                          ),
                          title: Text('${c['id']} — $contractLabel', style: const TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w700, fontSize: 14)),
                          subtitle: Text('الفترة: ${c['period'] ?? '—'}', style: const TextStyle(fontFamily: 'Cairo', fontSize: 12, color: AppTheme.textMuted)),
                          trailing: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(AppUtils.money(c['value']), style: const TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w800, color: AppTheme.primaryDark)),
                              const SizedBox(height: 4),
                              StatusBadge(c['status']?.toString()),
                            ],
                          ),
                          onTap: () => _actions(c),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  void _actions(Map<String, dynamic> claim) {
    showModalBottomSheet<void>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.check_circle_rounded, color: AppTheme.success),
              title: const Text('اعتماد المستخلص', style: TextStyle(fontFamily: 'Cairo')),
              onTap: () async {
                await AppState.instance.update(AppConstants.kClaims, {...claim, 'status': 'معتمد'});
                if (ctx.mounted) Navigator.pop(ctx);
              },
            ),
            ListTile(
              leading: const Icon(Icons.cancel_rounded, color: AppTheme.danger),
              title: const Text('رفض المستخلص', style: TextStyle(fontFamily: 'Cairo')),
              onTap: () async {
                await AppState.instance.update(AppConstants.kClaims, {...claim, 'status': 'مرفوض'});
                if (ctx.mounted) Navigator.pop(ctx);
              },
            ),
            ListTile(
              leading: const Icon(Icons.print_rounded, color: AppTheme.primaryDark),
              title: const Text('طباعة PDF', style: TextStyle(fontFamily: 'Cairo')),
              onTap: () async {
                Navigator.pop(ctx);
                final app = AppState.instance;
                try {
                  await PdfGenerator.sharePdf('مستخلص مالي',
                      PdfGenerator.claimContent(claim, app.myOwnerCompany),
                      ownerCompany: app.myOwnerCompany);
                } catch (_) {
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                        content: Text('تعذر إنشاء PDF.', style: TextStyle(fontFamily: 'Cairo'))));
                  }
                }
              },
            ),
          ],
        ),
      ),
    );
  }
}
