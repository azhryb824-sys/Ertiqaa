import 'package:flutter/material.dart';
import '../../core/utils.dart';
import '../../models/ticket.dart';
import '../../state/app_state.dart';
import '../../theme.dart';
import '../../widgets/common.dart';
import '../../state/business_rules.dart';

/// قائمة البلاغات مع SLA.
class TicketsScreen extends StatefulWidget {
  const TicketsScreen({super.key});

  @override
  State<TicketsScreen> createState() => _TicketsScreenState();
}

class _TicketsScreenState extends State<TicketsScreen> {
  String _q = '';
  String? _filter;

  @override
  Widget build(BuildContext context) {
    final app = AppState.instance;
    final session = app.session!;
    final all = app.visibleTickets;
    final list = all.where((t) {
      if (_filter != null && t.status != _filter) return false;
      if (_q.isNotEmpty && !'${t.id} ${t.title} ${t.clientLabel}'.contains(_q)) return false;
      return true;
    }).toList()
      ..sort((a, b) => b.createdAtMs.compareTo(a.createdAtMs));

    final canCreate = session.isClient || session.isTechnician || session.canManage;

    return Scaffold(
      backgroundColor: AppTheme.bg,
      floatingActionButton: canCreate ? Fab(onPressed: () => app.go('ticket-form'), label: 'بلاغ جديد') : null,
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: TextField(
              onChanged: (v) => setState(() => _q = v),
              decoration: const InputDecoration(
                hintText: 'بحث في البلاغات',
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
                for (final s in [null, 'مفتوح', 'مغلق'])
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
                ? const EmptyState('لا توجد بلاغات')
                : ListView.builder(
                    padding: const EdgeInsets.only(bottom: 90),
                    itemCount: list.length,
                    itemBuilder: (ctx, i) {
                      final t = list[i];
                      final sla = BusinessRules.slaInfo(t);
                      return ListCard(
                        leadingIcon: Icon(Icons.report_problem_rounded, color: t.status == 'مغلق' ? AppTheme.success : AppTheme.danger),
                        title: '${t.id} — ${t.title}',
                        subtitle: '${t.clientLabel} • ${AppUtils.fmtDateTime(t.createdAtMs)}',
                        trailingWidget: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            StatusBadge(t.status),
                            if (sla['overdue'] == true)
                              const Padding(
                                padding: EdgeInsets.only(top: 3),
                                child: Text('متأخر عن SLA', style: TextStyle(fontFamily: 'Cairo', fontSize: 10, color: AppTheme.danger, fontWeight: FontWeight.w700)),
                              ),
                          ],
                        ),
                        onTap: () => app.goWithData('ticket-detail', {'id': t.id}),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
