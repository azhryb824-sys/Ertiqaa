import 'package:flutter/material.dart';
import '../../core/constants.dart';
import '../../core/utils.dart';
import '../../state/app_state.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// قائمة العقود مع بحث وفلترة حسب الحالة.
class ContractsScreen extends StatefulWidget {
  const ContractsScreen({super.key});

  @override
  State<ContractsScreen> createState() => _ContractsScreenState();
}

class _ContractsScreenState extends State<ContractsScreen> {
  String _q = '';
  String? _filter;

  @override
  Widget build(BuildContext context) {
    final app = AppState.instance;
    final all = app.visibleContracts;
    final list = all.where((c) {
      if (_filter != null && c.status != _filter) return false;
      if (_q.isNotEmpty) {
        final hay = '${c.id} ${c.clientLabel} ${c.type}';
        if (!hay.contains(_q)) return false;
      }
      return true;
    }).toList()
      ..sort((a, b) => b.createdAtMs.compareTo(a.createdAtMs));

    final canCreate = app.session!.canManage;

    return Scaffold(
      backgroundColor: AppTheme.bg,
      floatingActionButton: canCreate
          ? Fab(onPressed: () => app.go('contract-form'), label: 'عقد جديد')
          : null,
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: TextField(
              onChanged: (v) => setState(() => _q = v),
              decoration: const InputDecoration(
                hintText: 'بحث بالرقم أو العميل أو النوع',
                prefixIcon: Icon(Icons.search, color: AppTheme.textMuted),
              ),
            ),
          ),
          SizedBox(
            height: 44,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              children: [
                for (final s in [null, 'ساري', 'بانتظار موافقة العميل', 'بانتظار مراجعة إيصال الدفع', 'ملغي', 'منتهيا'])
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: ChoiceChip(
                      label: Text(s ?? 'الكل', style: const TextStyle(fontFamily: 'Cairo')),
                      selected: _filter == s,
                      onSelected: (_) => setState(() => _filter = s),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: list.isEmpty
                ? const EmptyState('لا توجد عقود مطابقة')
                : ListView.builder(
                    padding: const EdgeInsets.only(bottom: 90),
                    itemCount: list.length,
                    itemBuilder: (ctx, i) {
                      final c = list[i];
                      final fin = c.value > 0 ? AppUtils.money(c.value) : '—';
                      return ListCard(
                        title: '${c.id} — ${c.type}',
                        subtitle: '${c.clientLabel}\n${AppUtils.fmtDate(c.startDate)} ← ${AppUtils.fmtDate(c.endDate)}',
                        trailing: fin,
                        trailingWidget: Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [StatusBadge(c.status)],
                        ),
                        onTap: () => app.goWithData('contract-detail', {'id': c.id}),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
