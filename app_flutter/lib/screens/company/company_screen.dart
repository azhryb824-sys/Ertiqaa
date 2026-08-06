import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/utils.dart';
import '../../state/app_state.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// بيانات المنشأة (المالك) + ترويسة الشركة.
class CompanyScreen extends StatefulWidget {
  const CompanyScreen({super.key});

  @override
  State<CompanyScreen> createState() => _CompanyScreenState();
}

class _CompanyScreenState extends State<CompanyScreen> {
  final _nameCtrl = TextEditingController();
  final _unifiedCtrl = TextEditingController();
  final _commercialCtrl = TextEditingController();
  final _taxCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  final _footerCtrl = TextEditingController();
  final _bankCtrl = TextEditingController();
  bool _loaded = false;
  Map<String, dynamic>? _existing;
  String? _letterheadName;
  String? _letterheadData;

  Future<void> _pickLetterhead() async {
    final picked = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 1600, imageQuality: 75);
    if (picked == null) return;
    final bytes = await picked.readAsBytes();
    if (!mounted) return;
    setState(() {
      _letterheadName = picked.name;
      _letterheadData = 'data:${picked.mimeType ?? 'image/jpeg'};base64,${base64Encode(bytes)}';
    });
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() {
    final app = AppState.instance;
    for (final oc in app.ownerCompanies) {
      final owners = ((oc['ownerIds'] as List?) ?? []).map((e) => e.toString()).toList();
      final oid = oc['ownerId']?.toString() ?? '';
      if (owners.contains(app.ownerId) || oid == app.ownerId) {
        _existing = Map<String, dynamic>.from(oc);
        break;
      }
    }
    final src = _existing ?? const <String, dynamic>{};
    _nameCtrl.text = src['name']?.toString() ?? '';
    _unifiedCtrl.text = src['unifiedNumber']?.toString() ?? '';
    _commercialCtrl.text = src['commercialNumber']?.toString() ?? '';
    _taxCtrl.text = src['taxNumber']?.toString() ?? '';
    _phoneCtrl.text = src['phone']?.toString() ?? '';
    _emailCtrl.text = src['email']?.toString() ?? '';
    _addressCtrl.text = src['address']?.toString() ?? '';
    _footerCtrl.text = src['pdfFooter']?.toString() ?? '';
    _bankCtrl.text = src['bankAccount']?.toString() ?? '';
    _letterheadName = src['companyLetterheadName']?.toString() ?? '';
    _letterheadData = src['companyLetterhead']?.toString() ?? '';
    _loaded = true;
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _unifiedCtrl.dispose();
    _commercialCtrl.dispose();
    _taxCtrl.dispose();
    _phoneCtrl.dispose();
    _emailCtrl.dispose();
    _addressCtrl.dispose();
    _footerCtrl.dispose();
    _bankCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final app = AppState.instance;
    final now = DateTime.now();
    final data = {
      'id': _existing?['id'] ?? 'OWN-${now.millisecondsSinceEpoch}',
      'ownerIds': [_existing?['ownerIds']?.first ?? app.ownerId],
      'ownerId': _existing?['ownerId'] ?? app.ownerId,
      'name': _nameCtrl.text,
      'unifiedNumber': _unifiedCtrl.text,
      'commercialNumber': _commercialCtrl.text,
      'taxNumber': _taxCtrl.text,
      'phone': _phoneCtrl.text,
      'email': _emailCtrl.text,
      'address': _addressCtrl.text,
      'pdfFooter': _footerCtrl.text,
      'companyLetterhead': _letterheadData ?? '',
      'companyLetterheadName': _letterheadName ?? '',
      'bankAccount': _bankCtrl.text,
      'createdAt': _existing?['createdAt'] ?? now.toIso8601String(),
      'updatedAt': now.toIso8601String(),
    };
    await app.update('misadOwnerCompanies', data);
    await app.logActivity('تحديث بيانات المنشأة', entityType: 'company', entityId: data['id'] as String);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم حفظ بيانات المنشأة.', style: TextStyle(fontFamily: 'Cairo'))));
  }

  @override
  Widget build(BuildContext context) {
    final session = AppState.instance.session!;
    if (!session.canManage) {
      return const Scaffold(
        backgroundColor: AppTheme.bg,
        body: EmptyState('غير متاح لدورك.', icon: Icons.lock_outline),
      );
    }
    if (!_loaded) return const Scaffold(backgroundColor: AppTheme.bg);
    return Scaffold(
      backgroundColor: AppTheme.bg,
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
                  const SectionHeader(1, 'بيانات المنشأة'),
                  AppField(label: 'اسم المنشأة', controller: _nameCtrl),
                  AppField(label: 'الرقم الموحد', controller: _unifiedCtrl),
                  AppField(label: 'السجل التجاري', controller: _commercialCtrl),
                  AppField(label: 'الرقم الضريبي', controller: _taxCtrl),
                  AppField(label: 'رقم الجوال', keyboard: TextInputType.phone, controller: _phoneCtrl),
                  AppField(label: 'البريد الإلكتروني', keyboard: TextInputType.emailAddress, controller: _emailCtrl),
                  AppField(label: 'العنوان', controller: _addressCtrl),
                  AppField(label: 'رقم الحساب البنكي (للفواتير)', controller: _bankCtrl),
                  AppField(label: 'تذييل المستندات (PDF)', maxLines: 2, controller: _footerCtrl),
                  const SizedBox(height: 12),
                  const SectionHeader(2, 'الترويسة (للمستندات PDF)'),
                  const SizedBox(height: 8),
                  if (_letterheadData != null)
                    Container(
                      height: 80,
                      width: double.infinity,
                      margin: const EdgeInsets.only(bottom: 8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFf0f4f8),
                        borderRadius: BorderRadius.circular(10),
                        image: DecorationImage(
                          image: MemoryImage(base64Decode(_letterheadData!.replaceFirst(RegExp(r'^data:[^;]*;base64,'), ''))),
                          fit: BoxFit.contain,
                        ),
                      ),
                    )
                  else
                    const Padding(
                      padding: EdgeInsets.only(bottom: 8),
                      child: Text('لا توجد ترويسة مرفوعة بعد.', style: TextStyle(fontFamily: 'Cairo', fontSize: 12, color: AppTheme.textMuted)),
                    ),
                  OutlinedButton.icon(
                    onPressed: _pickLetterhead,
                    icon: const Icon(Icons.image_rounded),
                    label: Text(_letterheadName == null ? 'رفع صورة الترويسة' : 'تغيير: $_letterheadName',
                        style: const TextStyle(fontFamily: 'Cairo')),
                  ),
                  const SizedBox(height: 12),
                  ElevatedButton(onPressed: _save, child: const Text('حفظ البيانات')),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
