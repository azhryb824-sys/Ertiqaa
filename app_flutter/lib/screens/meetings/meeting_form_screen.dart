import 'package:flutter/material.dart';
import '../../core/utils.dart';
import '../../state/app_state.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// نموذج اجتماع جديد.
class MeetingFormScreen extends StatefulWidget {
  const MeetingFormScreen({super.key});

  @override
  State<MeetingFormScreen> createState() => _MeetingFormScreenState();
}

class _MeetingFormScreenState extends State<MeetingFormScreen> {
  final _titleCtrl = TextEditingController();
  final _dateCtrl = TextEditingController();
  final _timeCtrl = TextEditingController();
  final _locationCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();

  @override
  void dispose() {
    _titleCtrl.dispose();
    _dateCtrl.dispose();
    _timeCtrl.dispose();
    _locationCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final app = AppState.instance;
    final now = DateTime.now();
    final m = {
      'id': 'MTG-${now.millisecondsSinceEpoch}',
      'companyOwnerId': app.ownerId,
      'title': _titleCtrl.text,
      'date': _dateCtrl.text,
      'time': _timeCtrl.text,
      'location': _locationCtrl.text,
      'participants': <String>[],
      'notes': _notesCtrl.text,
      'createdAt': now.toIso8601String(),
      'createdAtMs': now.millisecondsSinceEpoch,
      'createdBy': app.session!.id,
      'createdByName': app.session!.name,
      'room': 'shumoos-${now.millisecondsSinceEpoch}',
      'url': 'https://meet.jit.si/shumoos-${now.millisecondsSinceEpoch}',
    };
    await app.append('misadMeetings', m);
    if (!mounted) return;
    Navigator.of(context).pop();
    app.back();
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم إنشاء الاجتماع.', style: TextStyle(fontFamily: 'Cairo'))));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bg,
      appBar: AppBar(title: const Text('اجتماع جديد')),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 40),
        children: [
          Card(
            margin: const EdgeInsets.all(16),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SectionHeader(1, 'بيانات الاجتماع'),
                  AppField(label: 'عنوان الاجتماع', controller: _titleCtrl),
                  AppField(label: 'التاريخ (yyyy-mm-dd)', controller: _dateCtrl),
                  AppField(label: 'الوقت', controller: _timeCtrl),
                  AppField(label: 'الموقع', controller: _locationCtrl),
                  AppField(label: 'الملاحظات', maxLines: 3, controller: _notesCtrl),
                  const SizedBox(height: 12),
                  ElevatedButton(onPressed: _save, child: const Text('حفظ الاجتماع')),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
