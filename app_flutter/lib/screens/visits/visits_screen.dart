import 'package:flutter/material.dart';
import '../../core/utils.dart';
import '../../models/contract.dart';
import '../../state/app_state.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// قائمة الزيارات (كشفية/دورية) مع فلترة.
class VisitsScreen extends StatefulWidget {
  const VisitsScreen({super.key});

  @override
  State<VisitsScreen> createState() => _VisitsScreenState();
}

class _VisitsScreenState extends State<VisitsScreen> {
  String? _filter;

  @override
  Widget build(BuildContext context) {
    final app = AppState.instance;
    final session = app.session!;
    final all = app.visibleVisits;

    final list = all.where((v) {
      if (_filter != null && v['status']?.toString() != _filter) return false;
      return true;
    }).toList()
      ..sort((a, b) => ((b['scheduledAt'] as num?)?.toInt() ?? 0).compareTo((a['scheduledAt'] as num?)?.toInt() ?? 0));

    return Scaffold(
      backgroundColor: AppTheme.bg,
      floatingActionButton: session.canManage || session.isTechnician
          ? Fab(onPressed: () => _newVisit(context), label: 'زيارة كشفية')
          : null,
      body: Column(
        children: [
          SizedBox(
            height: 44,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              children: [
                for (final st in [null, 'مجدولة', 'بانتظار الإسناد', 'بانتظار الاعتماد', 'بانتظار التقييم', 'مكتملة', 'ملغية'])
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
            child: list.isEmpty
                ? const EmptyState('لا توجد زيارات')
                : ListView.builder(
                    padding: const EdgeInsets.only(bottom: 90),
                    itemCount: list.length,
                    itemBuilder: (ctx, i) {
                      final v = list[i];
                      final client = (v['clientCompanyName']?.toString() ?? '')
                              .isNotEmpty
                          ? v['clientCompanyName'].toString()
                          : (v['clientName']?.toString() ?? 'غير محدد');
                      return ListCard(
                        leadingIcon: Icon(
                          v['visitType']?.toString() == 'دورية' ? Icons.repeat_rounded : Icons.search_rounded,
                          color: AppTheme.gold,
                        ),
                        title: '${v['id']} — ${v['visitType']?.toString() == 'دورية' ? 'زيارة دورية' : 'زيارة كشفية'}',
                        subtitle: '$client\n${AppUtils.fmtDateTime(v['scheduledAt'])}',
                        trailingWidget: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [StatusBadge(v['status']?.toString())],
                        ),
                        onTap: () => app.goWithData('visit-detail', {'id': v['id']?.toString() ?? ''}),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  void _newVisit(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _NewVisitSheet(app: app),
    );
  }
}

/// ورقة إنشاء زيارة كشفية.
class _NewVisitSheet extends StatefulWidget {
  final AppState app;
  const _NewVisitSheet({required this.app});

  @override
  State<_NewVisitSheet> createState() => _NewVisitSheetState();
}

class _NewVisitSheetState extends State<_NewVisitSheet> {
  final _notesCtrl = TextEditingController();
  String? _contractId;

  @override
  void dispose() {
    _notesCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final app = widget.app;
    final contracts = app.visibleContracts.where((c) => c.status == 'ساري').toList();
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('زيارة كشفية جديدة', textAlign: TextAlign.center, style: TextStyle(fontFamily: 'Cairo', fontSize: 17, fontWeight: FontWeight.w800)),
            const SizedBox(height: 16),
            if (contracts.isNotEmpty)
              AppDropdown<String>(
                label: 'العقد',
                value: _contractId,
                items: [for (final c in contracts) c.id],
                labelOf: (id) => '${id} — ${contracts.firstWhere((c) => c.id == id).clientLabel}',
                onChanged: (v) => setState(() => _contractId = v),
              ),
            AppField(label: 'ملاحظات', maxLines: 2, controller: _notesCtrl),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () => _save(context),
              child: const Text('إنشاء الزيارة'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _save(BuildContext context) async {
    final app = widget.app;
    final now = DateTime.now();
    Contract? c;
    if (_contractId != null) {
      for (final x in app.allContracts) { if (x.id == _contractId) { c = x; break; } }
    }
    final visit = {
      'id': 'VIS-K-${now.millisecondsSinceEpoch}',
      'companyOwnerId': app.ownerId,
      'contractId': c?.id ?? '',
      'visitType': 'كشفية',
      'clientId': c?.clientId ?? '',
      'clientName': c?.clientName ?? '',
      'clientCompanyUnifiedNumber': c?.clientCompanyUnifiedNumber ?? '',
      'clientCompanyName': c?.clientCompanyName ?? '',
      'building': c != null && c.buildings.isNotEmpty ? c.buildings.first.toJson() : {},
      'elevatorInfo': c?.elevatorInfo ?? {},
      'assignedTo': '',
      'assignedName': '',
      'scheduledAt': now.millisecondsSinceEpoch,
      'status': 'مجدولة',
      'periodic': false,
      'notes': _notesCtrl.text,
      'createdAt': now.millisecondsSinceEpoch,
    };
    await app.append('misadVisits', visit);
    await app.logActivity('إنشاء زيارة كشفية', entityType: 'visit', entityId: visit['id'] as String);
    if (context.mounted) {
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم إنشاء الزيارة.', style: TextStyle(fontFamily: 'Cairo'))));
    }
  }
}
