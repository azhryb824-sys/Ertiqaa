import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import '../../core/constants.dart';
import '../../core/utils.dart';
import '../../state/app_state.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// فريق العمل: إضافة عضو + ربط/فك ربط مستخدم + قبول/رفض دعوات الإدارة + حذف عضو.
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

  // الربط
  final _linkIdCtrl = TextEditingController();
  Map<String, dynamic>? _lookup;
  bool _linking = false;

  @override
  void dispose() {
    _idCtrl.dispose();
    _nameCtrl.dispose();
    _linkIdCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final app = AppState.instance;
    final session = app.session!;
    final staff = app.allStaff.where(app.sameCompany).toList();
    final isManager = session.canManage;
    final myPending = app.allInvites.where((i) => i['userId']?.toString() == session.id && i['status'] == 'pending').toList();

    return Scaffold(
      backgroundColor: AppTheme.bg,
      floatingActionButton: isManager ? Fab(onPressed: () => setState(() => _showForm = !_showForm), label: 'إضافة عضو') : null,
      body: ListView(
        padding: const EdgeInsets.only(bottom: 90),
        children: [
          if (isManager) ...[
            Card(
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SectionHeader(1, 'ربط مستخدم بالمنشأة'),
                    AppField(label: 'رقم هوية المستخدم', controller: _linkIdCtrl, keyboard: TextInputType.number),
                    const SizedBox(height: 8),
                    ElevatedButton(
                      onPressed: _linking ? null : _lookupUser,
                      child: Text(_lookup == null ? 'بحث عن المستخدم' : 'بحث من جديد', style: const TextStyle(fontFamily: 'Cairo')),
                    ),
                    if (_lookup != null) ...[
                      const SizedBox(height: 10),
                      Card(
                        color: const Color(0xFFf0f7f4),
                        margin: EdgeInsets.zero,
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('${_lookup!['name'] ?? ''} — ${_lookup!['role'] ?? ''}', style: const TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w700)),
                              const SizedBox(height: 4),
                              Text('الهوية: ${_lookup!['id'] ?? ''}', style: const TextStyle(fontFamily: 'Cairo', fontSize: 12)),
                              if ((_lookup!['linkedCompanyName'] ?? '').isNotEmpty)
                                Text('مرتبط بـ: ${_lookup!['linkedCompanyName']}', style: const TextStyle(fontFamily: 'Cairo', fontSize: 12, color: AppTheme.textMuted)),
                              const SizedBox(height: 8),
                              ElevatedButton(onPressed: _linkUser, child: const Text('ربط بالمنشأة', style: TextStyle(fontFamily: 'Cairo'))),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            ],

          if (_showForm)
            Card(
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SectionHeader(2, 'إضافة عضو للفريق'),
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

          if (myPending.isNotEmpty) ...[
            PageTitle('دعوات الإدارة'),
            for (final inv in myPending)
              Card(
                margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 5),
                child: ListTile(
                  leading: const Icon(Icons.mail_rounded, color: AppTheme.gold),
                  title: Text('دعوة للإدارة في ${inv['companyName'] ?? ''}', style: const TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w700, fontSize: 14)),
                  subtitle: Text('من ${inv['invitedByName'] ?? ''}', style: const TextStyle(fontFamily: 'Cairo', fontSize: 12)),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        icon: const Icon(Icons.check_circle_rounded, color: AppTheme.success),
                        onPressed: () => _acceptInvite(inv),
                      ),
                      IconButton(
                        icon: const Icon(Icons.cancel_rounded, color: AppTheme.danger),
                        onPressed: () => _rejectInvite(inv),
                      ),
                    ],
                  ),
                ),
              ),
          ],

          PageTitle(session.isCompanyAdmin ? 'الفنيون' : 'فريق العمل'),
          if (staff.isEmpty)
            const EmptyState('لا يوجد أعضاء بعد')
          else
            for (final s in staff) ...[
              ListCard(
                leadingIcon: const Icon(Icons.person_rounded, color: AppTheme.primary),
                title: s['name']?.toString() ?? '',
                subtitle: '${s['identity'] ?? ''} • ${AppConstants.roleLabels[s['role']] ?? s['role']}',
                trailingWidget: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    StatusBadge(s['availability']?.toString() == 'working' ? 'مجدول' : 'غير متاح'),
                    if (isManager) ...[
                      const SizedBox(width: 4),
                      IconButton(
                        icon: const Icon(Icons.delete_outline, color: AppTheme.danger, size: 20),
                        onPressed: () => _deleteStaff(s),
                      ),
                    ],
                  ],
                ),
              ),
            ],
        ],
      ),
    );
  }

  Future<void> _lookupUser() async {
    final app = AppState.instance;
    final id = AppUtils.cleanId(_linkIdCtrl.text);
    if (id.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('أدخل رقم هوية.', style: TextStyle(fontFamily: 'Cairo'))));
      return;
    }
    setState(() { _linking = true; _lookup = null; });
    try {
      final j = await ApiClient.instance.get('/api/users/lookup', query: {'id': id});
      if (!mounted) return;
      if (j is Map && j['found'] == true) {
        setState(() { _lookup = Map<String, dynamic>.from(j['user'] as Map); _linking = false; });
      } else {
        setState(() { _lookup = {'id': id, 'name': 'غير مسجل', 'role': '', 'linkedCompanyName': ''}; _linking = false; });
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('لم يتم العثور على المستخدم.', style: TextStyle(fontFamily: 'Cairo'))));
      }
    } catch (_) {
      if (!mounted) return;
      setState(() => _linking = false);
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تعذر الاتصال بالخادم.', style: TextStyle(fontFamily: 'Cairo'))));
    }
  }

  Future<void> _linkUser() async {
    final app = AppState.instance;
    final uid = _lookup?['id']?.toString() ?? '';
    if (uid.isEmpty) return;
    try {
      final j = await ApiClient.instance.post('/api/users/link', body: {
        'userId': uid,
        'companyOwnerId': app.ownerId,
        'linkedBy': app.session!.id,
      });
      if (!mounted) return;
      if (j is Map && j['ok'] == true) {
        await app.storage.reload();
        setState(() => _lookup = null);
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم ربط المستخدم بالمنشأة.', style: TextStyle(fontFamily: 'Cairo'))));
      } else {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(j is Map ? j['error']?.toString() ?? 'فشل الربط.' : 'فشل الربط.', style: const TextStyle(fontFamily: 'Cairo'))));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تعذر الاتصال بالخادم.', style: TextStyle(fontFamily: 'Cairo'))));
      }
    }
  }

  Future<void> _acceptInvite(Map<String, dynamic> inv) async {
    final app = AppState.instance;
    try {
      final j = await ApiClient.instance.post('/api/users/link', body: {
        'userId': inv['userId'],
        'companyOwnerId': inv['companyOwnerId'],
        'linkedBy': inv['invitedBy'],
      });
      if (!mounted) return;
      if (j is Map && j['ok'] == true) {
        await app.update('misadAdminInvites', {...inv, 'status': 'accepted'});
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم قبول الدعوة! سجّل الخروج والدخول مجدداً.', style: TextStyle(fontFamily: 'Cairo'))));
      } else {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(j is Map ? j['error']?.toString() ?? 'فشل القبول.' : 'فشل القبول.', style: const TextStyle(fontFamily: 'Cairo'))));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تعذر الاتصال بالخادم.', style: TextStyle(fontFamily: 'Cairo'))));
      }
    }
  }

  Future<void> _rejectInvite(Map<String, dynamic> inv) async {
    final app = AppState.instance;
    await app.update('misadAdminInvites', {...inv, 'status': 'rejected'});
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم رفض الدعوة.', style: TextStyle(fontFamily: 'Cairo'))));
    }
  }

  Future<void> _deleteStaff(Map<String, dynamic> s) async {
    final app = AppState.instance;
    await app.remove('misadCompanyStaff', s['id']?.toString() ?? s['identity']?.toString() ?? '');
    await app.logActivity('حذف عضو فريق', entityType: 'staff', entityId: s['id']?.toString() ?? '');
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم حذف العضو.', style: TextStyle(fontFamily: 'Cairo'))));
    }
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