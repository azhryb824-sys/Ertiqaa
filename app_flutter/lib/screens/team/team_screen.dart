import 'package:flutter/material.dart';
import '../../core/constants.dart';
import '../../core/utils.dart';
import '../../state/app_state.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// فريق العمل (إضافة عضو بإحدى الأدوار: technician/engineer/company_admin).
class TeamScreen extends StatefulWidget {
  const TeamScreen({super.key});

  @override
  State<TeamScreen> createState() => _TeamScreenState();
}

class _TeamScreenState extends State<TeamScreen> {
  final _idCtrl = TextEditingController();
  final _nameCtrl = TextEditingController();
  String _role = 'technician';
  bool _showForm = false;

  @override
  void dispose() {
    _idCtrl.dispose();
    _nameCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final app = AppState.instance;
    final session = app.session!;
    final staff = app.allStaff.where(app.sameCompany).toList();
    final isManager = session.canManage;

    return Scaffold(
      backgroundColor: AppTheme.bg,
      floatingActionButton: isManager ? Fab(onPressed: () => setState(() => _showForm = !_showForm), label: 'إضافة عضو') : null,
      body: ListView(
        padding: const EdgeInsets.only(bottom: 90),
        children: [
          if (_showForm)
            Card(
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SectionHeader(1, 'إضافة عضو للفريق'),
                    AppField(label: 'رقم هوية العضو', keyboard: TextInputType.number, controller: _idCtrl),
                    AppField(label: 'اسم العضو', controller: _nameCtrl),
                    AppDropdown<String>(
                      label: 'الدور',
                      value: _role,
                      items: const ['technician', 'engineer'],
                      labelOf: (v) => v == 'engineer' ? 'مهندس' : 'فني',
                      onChanged: (v) => setState(() => _role = v!),
                    ),
                    const SizedBox(height: 4),
                    const Text('ملاحظة: إضافة إداري للشركة تتم عبر رابط الدعوة/ربط المستخدمين.',
                        style: TextStyle(fontFamily: 'Cairo', fontSize: 11, color: AppTheme.textMuted)),
                    const SizedBox(height: 10),
                    ElevatedButton(onPressed: _add, child: const Text('إضافة العضو')),
                  ],
                ),
              ),
            ),

          const PageTitle(session.isCompanyAdmin ? 'الفنيون' : 'فريق العمل'),
          if (staff.isEmpty)
            const EmptyState('لا يوجد أعضاء بعد')
          else
            for (final s in staff)
              ListCard(
                leadingIcon: const Icon(Icons.person_rounded, color: AppTheme.primary),
                title: s['name']?.toString() ?? '',
                subtitle: '${s['identity'] ?? ''} • ${AppConstants.roleLabels[s['role']] ?? s['role']}',
                trailingWidget: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    StatusBadge(s['availability']?.toString() == 'working' ? 'مجدول' : 'غير متاح'),
                  ],
                ),
              ),
        ],
      ),
    );
  }

  Future<void> _add() async {
    final app = AppState.instance;
    final id = AppUtils.cleanId(_idCtrl.text);
    if (id.isEmpty || _nameCtrl.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('أدخل هوية واسم العضو.', style: TextStyle(fontFamily: 'Cairo'))));
      return;
    }
    final now = DateTime.now();
    final m = {
      'id': 'STF-${now.millisecondsSinceEpoch}',
      'companyOwnerId': app.ownerId,
      'identity': id,
      'name': _nameCtrl.text,
      'role': _role,
      'availability': 'working',
      'status': 'مرتبط',
      'createdAt': now.toIso8601String(),
      'baseSalary': 0,
      'leaveBalance': 0,
    };
    await app.append('misadCompanyStaff', m);
    await app.logActivity('إضافة عضو فريق', entityType: 'staff', entityId: m['id'] as String);
    if (!mounted) return;
    setState(() { _showForm = false; _idCtrl.clear(); _nameCtrl.clear(); });
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تمت إضافة العضو.', style: TextStyle(fontFamily: 'Cairo'))));
  }
}
