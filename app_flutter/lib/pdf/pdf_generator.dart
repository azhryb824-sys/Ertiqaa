import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import '../core/utils.dart';
import '../models/contract.dart';

/// مولّد مستندات PDF — ترجمة حرفية لقالب pdfmake-gen.js.
class PdfGenerator {
  PdfGenerator._();

  static const _green = PdfColor.fromInt(0xFF0d312f);
  static const _gold = PdfColor.fromInt(0xFFd4a24e);

  /// بناء الترويسة: اسم المنشأة + الرقم الموحد + الترويسة (إن وجدت كخلفية).
  static pw.Widget _letterhead(
    Map<String, dynamic> ownerCompany,
    String title,
  ) {
    final name = ownerCompany['name']?.toString() ?? 'شركة شموس للمصاعد';
    final unified = ownerCompany['unifiedNumber']?.toString() ?? '';
    return pw.Container(
      padding: const pw.EdgeInsets.only(bottom: 8),
      decoration: const pw.BoxDecoration(
        border: pw.Border(bottom: pw.BorderSide(color: _gold, width: 2)),
      ),
      child: pw.Row(
        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
        children: [
          pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Text(name,
                  style: pw.TextStyle(fontSize: 18, fontWeight: pw.FontWeight.bold, color: _green)),
              if (unified.isNotEmpty)
                pw.Text('الرقم الموحد: $unified',
                    style: pw.TextStyle(fontSize: 9, color: const PdfColor.fromInt(0xFF666666))),
            ],
          ),
          pw.Text(title,
              style: pw.TextStyle(fontSize: 14, fontWeight: pw.FontWeight.bold, color: _gold)),
        ],
      ),
    );
  }

  static pw.Widget _footer(Map<String, dynamic> ownerCompany) {
    return pw.Column(
      mainAxisSize: pw.MainAxisSize.min,
      children: [
        pw.Divider(color: _green, height: 8),
        pw.Text(ownerCompany['pdfFooter']?.toString() ?? '© شموس للمصاعد — جميع الحقوق محفوظة',
            style: pw.TextStyle(fontSize: 8, color: const PdfColor.fromInt(0xFF888888))),
      ],
    );
  }

  static Future<void> sharePdf(String title, pw.Widget content, {Map<String, dynamic>? ownerCompany}) async {
    final doc = pw.Document(theme: pw.ThemeData.withFont(base: await PdfGoogleFonts.cairoRegular()));
    final company = ownerCompany ?? const {};
    doc.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.fromLTRB(40, 36, 40, 36),
        header: (ctx) => _letterhead(company, title),
        footer: (ctx) => _footer(company),
        build: (ctx) => [content],
      ),
    );
    await Printing.layoutPdf(onLayout: (format) async => doc.save());
  }

  static Future<void> previewPdf(String title, pw.Widget content) async {
    final doc = pw.Document();
    doc.addPage(pw.Page(
      pageFormat: PdfPageFormat.a4,
      build: (ctx) => content,
    ));
    await Printing.layoutPdf(onLayout: (format) async => doc.save());
  }

  /// عقد صيانة/تركيب.
  static pw.Widget contractContent(Contract c, Map<String, dynamic> ownerCompany) {
    final companyName = ownerCompany['name']?.toString() ?? 'شركة شموس للمصاعد';
    final unified = ownerCompany['unifiedNumber']?.toString() ?? '';

    final label = c.label();
    final value = AppUtils.moneyEn(c.value);
    final start = _fmt(c.startDate);
    final end = _fmt(c.endDate);

    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Center(
          child: pw.Text('عقد ${c.type}',
              style: pw.TextStyle(fontSize: 18, fontWeight: pw.FontWeight.bold, color: _green)),
        ),
        pw.SizedBox(height: 12),
        pw.Text('الطرف الأول: $companyName (الرقم الموحد: $unified)',
            style: pw.TextStyle(fontSize: 11)),
        pw.SizedBox(height: 4),
        pw.Text('الطرف الثاني: $label', style: pw.TextStyle(fontSize: 11)),
        pw.SizedBox(height: 12),
        pw.Divider(color: _gold),
        pw.SizedBox(height: 8),
        _field('نوع العقد', c.type),
        _field('قيمة العقد', '$value ر.س'),
        _field('تاريخ البداية', start),
        _field('تاريخ النهاية', end),
        _field('مدة العقد', '${c.contractYears} سنة'),
        if (c.maintenancePeriod.isNotEmpty) _field('فترة الصيانة', c.maintenancePeriod),
        if (c.details.isNotEmpty) _field('التفاصيل', c.details),
        pw.SizedBox(height: 12),

        pw.Text('البنود:', style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold, color: _green)),
        pw.SizedBox(height: 4),
        if (c.items.isEmpty && c.customItems.isEmpty)
          pw.Text('(لا توجد بنود محددة)', style: pw.TextStyle(fontSize: 10, color: const PdfColor.fromInt(0xFF888888)))
        else
          for (final it in c.items)
            pw.Padding(
              padding: const pw.EdgeInsets.symmetric(vertical: 1),
              child: pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  pw.Text('• ${it.title}', style: pw.TextStyle(fontSize: 10)),
                  pw.Text(it.price > 0 ? '${AppUtils.moneyEn(it.price)} ر.س' : '',
                      style: pw.TextStyle(fontSize: 10)),
                ],
              ),
            ),
        for (final ci in c.customItems)
          pw.Padding(
            padding: const pw.EdgeInsets.symmetric(vertical: 1),
            child: pw.Row(
              mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
              children: [
                pw.Text('• ${ci.title}', style: pw.TextStyle(fontSize: 10)),
                pw.Text(ci.price > 0 ? '${AppUtils.moneyEn(ci.price)} ر.س' : '',
                    style: pw.TextStyle(fontSize: 10)),
              ],
            ),
          ),

        if (c.paymentPlan.isNotEmpty) ...[
          pw.SizedBox(height: 12),
          pw.Text('خطة الدفعات:', style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold, color: _green)),
          pw.SizedBox(height: 4),
          for (final p in c.paymentPlan)
            pw.Padding(
              padding: const pw.EdgeInsets.symmetric(vertical: 1),
              child: pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  pw.Text('${p.label}: ${p.description}', style: pw.TextStyle(fontSize: 10)),
                  pw.Text('${p.percent}%', style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold)),
                ],
              ),
            ),
        ],

        pw.SizedBox(height: 24),
        pw.Row(
          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
          children: [
            pw.Text('توقيع الطرف الأول', style: pw.TextStyle(fontSize: 11)),
            pw.Text('توقيع الطرف الثاني', style: pw.TextStyle(fontSize: 11)),
          ],
        ),
        pw.SizedBox(height: 30),
        pw.Text('_________________________          _________________________',
            style: pw.TextStyle(fontSize: 11)),
      ],
    );
  }

  /// عرض سعر.
  static pw.Widget quoteContent(Map<String, dynamic> q, Map<String, dynamic> ownerCompany) {
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Center(
          child: pw.Text('عرض سعر — ${q['type'] ?? ''}',
              style: pw.TextStyle(fontSize: 18, fontWeight: pw.FontWeight.bold, color: _green)),
        ),
        pw.SizedBox(height: 12),
        _field('العميل', (q['clientCompanyName'] ?? q['clientName'] ?? q['client'] ?? '—').toString()),
        _field('العنوان', q['title']?.toString() ?? ''),
        if (q['details']?.toString().isNotEmpty == true) _field('التفاصيل', q['details'].toString()),
        pw.SizedBox(height: 10),
        pw.Text('البنود:', style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold, color: _green)),
        pw.SizedBox(height: 4),
        _quoteLine('القيمة الأساسية', q['value']),
        for (final it in (q['items'] as List? ?? []))
          if (it is Map) _quoteLine(it['title']?.toString() ?? '', it['price']),
        for (final p in (q['partsItems'] as List? ?? []))
          if (p is Map) _quoteLine('قطعة: ${p['title']}', p['price']),
        for (final ci in (q['customItems'] as List? ?? []))
          if (ci is Map) _quoteLine(ci['title']?.toString() ?? '', ci['price']),
        pw.SizedBox(height: 10),
        pw.Divider(color: _gold),
        pw.Row(
          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
          children: [
            pw.Text('الإجمالي:', style: pw.TextStyle(fontSize: 13, fontWeight: pw.FontWeight.bold, color: _green)),
            pw.Text('${AppUtils.moneyEn(q['subtotal'] ?? q['value'])} ر.س',
                style: pw.TextStyle(fontSize: 14, fontWeight: pw.FontWeight.bold, color: _gold)),
          ],
        ),
      ],
    );
  }

  /// سند قبض.
  static pw.Widget receiptContent(Map<String, dynamic> r, Map<String, dynamic> ownerCompany) {
    final paymentMethod = r['paymentMethod']?.toString() ?? '';
    final companyName = ownerCompany['name']?.toString() ?? 'شركة شموس للمصاعد';
    final secondParty = (r['clientCompanyName'] ?? r['clientName'] ?? '').toString();
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Center(
          child: pw.Text('سند قبض',
              style: pw.TextStyle(fontSize: 18, fontWeight: pw.FontWeight.bold, color: _green)),
        ),
        pw.SizedBox(height: 12),
        _field('رقم السند', r['id']?.toString() ?? ''),
        _field('الغرض', r['purpose']?.toString() ?? ''),
        if (paymentMethod.isNotEmpty) _field('طريقة الدفع', paymentMethod),
        if (r['details']?.toString().isNotEmpty == true) _field('التفاصيل', r['details'].toString()),
        _field('التاريخ', _fmt(r['createdAtMs'])),
        pw.SizedBox(height: 14),
        pw.Center(
          child: pw.Text(
            'استلمنا نحن ($companyName) من الأخ (${secondParty.isEmpty ? 'الطرف الثاني' : secondParty}) مبلغ……………… قيمة ${r['purpose'] ?? ''}',
            textAlign: pw.TextAlign.center,
            style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold, color: _green, height: 1.8),
          ),
        ),
        pw.SizedBox(height: 8),
        pw.Center(
          child: pw.Container(
            padding: const pw.EdgeInsets.all(12),
            decoration: pw.BoxDecoration(
              border: pw.Border.all(color: _gold, width: 1.5),
              borderRadius: pw.BorderRadius.circular(8),
            ),
            child: pw.Text('المبلغ: ${AppUtils.moneyEn(r['amount'])} ر.س',
                style: pw.TextStyle(fontSize: 18, fontWeight: pw.FontWeight.bold, color: _green)),
          ),
        ),
        pw.SizedBox(height: 24),
        pw.Divider(color: const PdfColor.fromInt(0xFFe2e8f0), height: 10),
        pw.SizedBox(height: 6),
        pw.Row(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
          children: [
            pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.center,
              children: [
                pw.Text('الطرف الثاني',
                    style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold, color: _green)),
                pw.SizedBox(height: 4),
                pw.Text(secondParty.isEmpty ? 'الاسم: ......................' : secondParty,
                    style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold, color: _green)),
                pw.SizedBox(height: 4),
                pw.Text('التوقيع: .................................',
                    style: pw.TextStyle(fontSize: 9, color: const PdfColor.fromInt(0xFF94a3b8))),
              ],
            ),
            pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.center,
              children: [
                pw.Text('المصدر (المنشأة)',
                    style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold, color: _green)),
                pw.SizedBox(height: 4),
                pw.Text(ownerCompany['name']?.toString() ?? 'شركة شموس للمصاعد',
                    style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold, color: _green)),
                pw.SizedBox(height: 4),
                pw.Text('التوقيع / الختم: .................................',
                    style: pw.TextStyle(fontSize: 9, color: const PdfColor.fromInt(0xFF94a3b8))),
              ],
            ),
          ],
        ),
      ],
    );
  }

  /// مستخلص مالي.
  static pw.Widget claimContent(Map<String, dynamic> cl, Map<String, dynamic> ownerCompany) {
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Center(
          child: pw.Text('مستخلص مالي',
              style: pw.TextStyle(fontSize: 18, fontWeight: pw.FontWeight.bold, color: _green)),
        ),
        pw.SizedBox(height: 12),
        _field('رقم المستخلص', cl['id']?.toString() ?? ''),
        _field('العقد', cl['contractId']?.toString() ?? '—'),
        _field('الفترة', cl['period']?.toString() ?? '—'),
        _field('الحالة', cl['status']?.toString() ?? ''),
        pw.SizedBox(height: 14),
        pw.Center(
          child: pw.Text('القيمة: ${AppUtils.moneyEn(cl['value'])} ر.س',
              style: pw.TextStyle(fontSize: 18, fontWeight: pw.FontWeight.bold, color: _gold)),
        ),
      ],
    );
  }

  /// تقرير زيارة.
  static pw.Widget reportContent(Map<String, dynamic> r, Map<String, dynamic> ownerCompany) {
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Center(
          child: pw.Text('تقرير زيارة فنية',
              style: pw.TextStyle(fontSize: 18, fontWeight: pw.FontWeight.bold, color: _green)),
        ),
        pw.SizedBox(height: 12),
        _field('رقم التقرير', r['id']?.toString() ?? ''),
        _field('الزيارة', r['visitId']?.toString() ?? ''),
        _field('العميل', (r['clientCompanyName'] ?? r['clientName'] ?? '—').toString()),
        _field('الفني', r['technician']?.toString() ?? ''),
        _field('حالة المصعد', r['elevatorStatus']?.toString() ?? ''),
        _field('التاريخ', _fmt(r['createdAtMs'])),
        pw.SizedBox(height: 8),
        _multi('الأعمال المنفذة', r['workDone']?.toString() ?? ''),
        _multi('الملاحظات', r['issues']?.toString() ?? ''),
        _multi('القطع المستخدمة', r['parts']?.toString() ?? ''),
        _multi('التوصيات', r['recommendations']?.toString() ?? ''),
      ],
    );
  }

  static pw.Widget _field(String label, String value) {
    return pw.Padding(
      padding: const pw.EdgeInsets.symmetric(vertical: 2),
      child: pw.Row(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.SizedBox(width: 110, child: pw.Text(label, style: pw.TextStyle(fontSize: 10, color: const PdfColor.fromInt(0xFF666666)))),
          pw.Expanded(child: pw.Text(value, style: pw.TextStyle(fontSize: 11))),
        ],
      ),
    );
  }

  static pw.Widget _multi(String label, String value) {
    return pw.Padding(
      padding: const pw.EdgeInsets.symmetric(vertical: 2),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Text(label, style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold, color: _green)),
          pw.Text(value.isEmpty ? '—' : value, style: pw.TextStyle(fontSize: 11)),
        ],
      ),
    );
  }

  static pw.Widget _quoteLine(String label, dynamic value) {
    return pw.Padding(
      padding: const pw.EdgeInsets.symmetric(vertical: 1),
      child: pw.Row(
        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
        children: [
          pw.Text('• $label', style: pw.TextStyle(fontSize: 10)),
          pw.Text(value != null ? '${AppUtils.moneyEn(value)} ر.س' : '',
              style: pw.TextStyle(fontSize: 10)),
        ],
      ),
    );
  }

  static String _fmt(dynamic v) {
    if (v == null) return '—';
    if (v is num) {
      return DateFormat('yyyy/MM/dd', 'ar')
          .format(DateTime.fromMillisecondsSinceEpoch(v.toInt()));
    }
    final s = v.toString();
    if (s.isEmpty) return '—';
    final d = DateTime.tryParse(s);
    if (d == null) return s;
    return DateFormat('yyyy/MM/dd', 'ar').format(d);
  }

  /// فاتورة بلاغ (100 ريال).
  static pw.Widget invoiceContent(Map<String, dynamic> inv, Map<String, dynamic> ownerCompany) {
    final companyName = ownerCompany['name']?.toString() ?? 'شركة شموس للمصاعد';
    final clientName = (inv['clientCompanyName'] ?? inv['clientName'] ?? '—').toString();
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Center(
          child: pw.Text('فاتورة',
              style: pw.TextStyle(fontSize: 18, fontWeight: pw.FontWeight.bold, color: _green)),
        ),
        pw.SizedBox(height: 12),
        _field('رقم الفاتورة', inv['id']?.toString() ?? ''),
        _field('العميل', clientName),
        _field('البلاغ', inv['ticketId']?.toString() ?? '—'),
        _field('التاريخ', _fmt(inv['createdAt'])),
        pw.SizedBox(height: 14),
        pw.Center(
          child: pw.Text('استلمنا نحن ($companyName) من الأخ (${clientName.isEmpty ? 'الطرف الثاني' : clientName}) مبلغ مقابل زيارة الكشف والصيانة',
              textAlign: pw.TextAlign.center,
              style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold, color: _green, height: 1.8)),
        ),
        pw.SizedBox(height: 8),
        pw.Center(
          child: pw.Container(
            padding: const pw.EdgeInsets.all(12),
            decoration: pw.BoxDecoration(
              border: pw.Border.all(color: _gold, width: 1.5),
              borderRadius: pw.BorderRadius.circular(8),
            ),
            child: pw.Text('المبلغ: ${AppUtils.moneyEn(inv['value'])} ر.س',
                style: pw.TextStyle(fontSize: 18, fontWeight: pw.FontWeight.bold, color: _green)),
          ),
        ),
        pw.SizedBox(height: 6),
        pw.Center(
          child: pw.Text('الحالة: ${inv['status'] ?? 'غير مدفوعة'}',
              style: pw.TextStyle(fontSize: 11, color: const PdfColor.fromInt(0xFF666666))),
        ),
        pw.SizedBox(height: 18),
        pw.Divider(color: const PdfColor.fromInt(0xFFe2e8f0), height: 10),
        pw.SizedBox(height: 6),
        pw.Row(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
          children: [
            pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.center,
              children: [
                pw.Text('العميل',
                    style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold, color: _green)),
                pw.SizedBox(height: 4),
                pw.Text('التوقيع: .................................',
                    style: pw.TextStyle(fontSize: 9, color: const PdfColor.fromInt(0xFF94a3b8))),
              ],
            ),
            pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.center,
              children: [
                pw.Text('المصدر (المنشأة)',
                    style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold, color: _green)),
                pw.SizedBox(height: 4),
                pw.Text(ownerCompany['name']?.toString() ?? 'شركة شموس للمصاعد',
                    style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold, color: _green)),
                pw.SizedBox(height: 4),
                pw.Text('التوقيع / الختم: .................................',
                    style: pw.TextStyle(fontSize: 9, color: const PdfColor.fromInt(0xFF94a3b8))),
              ],
            ),
          ],
        ),
      ],
    );
  }

  /// سند استلام عهدة / إثبات عهدة.
  static pw.Widget custodyContent(Map<String, dynamic> c, Map<String, dynamic> ownerCompany) {
    final companyName = ownerCompany['name']?.toString() ?? 'شركة شموس للمصاعد';
    final staffName = c['staffName']?.toString() ?? '';
    final staffId = c['staffIdentity']?.toString() ?? '';
    final amount = (c['value'] as num?)?.toDouble() ?? 0;
    final deducted = (c['deducted'] as num?)?.toDouble() ?? 0;
    final remaining = ((c['remaining'] as num?)?.toDouble() ?? amount) - deducted;
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Center(
          child: pw.Text('سند عهدة',
              style: pw.TextStyle(fontSize: 18, fontWeight: pw.FontWeight.bold, color: _green)),
        ),
        pw.SizedBox(height: 12),
        _field('رقم العهدة', c['id']?.toString() ?? ''),
        _field('الموظف', '$staffName (${staffId.isEmpty ? '—' : staffId})'),
        _field('التاريخ', _fmt(c['createdAt'])),
        _field('البيان', c['description']?.toString() ?? ''),
        pw.SizedBox(height: 14),
        pw.Center(
          child: pw.Text(
            'أنا الموظف (${staffName.isEmpty ? '………………' : staffName}) أقر باستلامي من مؤسسة ($companyName) عهدة مالية قدرها ${AppUtils.moneyEn(amount)} ر.س مخصصة لـ ${c['description'] ?? 'الأعمال'} وأتعهد بردها أو خصمها من راتبي عند التسوية.',
            textAlign: pw.TextAlign.center,
            style: pw.TextStyle(fontSize: 11, fontWeight: pw.FontWeight.bold, color: _green, height: 1.8),
          ),
        ),
        pw.SizedBox(height: 12),
        pw.Center(
          child: pw.Column(
            children: [
              _line('قيمة العهدة', amount),
              _line('المخصوم من الراتب', deducted),
              _line('المتبقي', remaining > 0 ? remaining : 0, bold: true, color: _gold),
            ],
          ),
        ),
        pw.SizedBox(height: 18),
        pw.Divider(color: const PdfColor.fromInt(0xFFe2e8f0), height: 10),
        pw.SizedBox(height: 6),
        pw.Row(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
          children: [
            pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.center,
              children: [
                pw.Text('الموظف',
                    style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold, color: _green)),
                pw.SizedBox(height: 4),
                pw.Text('التوقيع: .................................',
                    style: pw.TextStyle(fontSize: 9, color: const PdfColor.fromInt(0xFF94a3b8))),
              ],
            ),
            pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.center,
              children: [
                pw.Text('المؤسسة',
                    style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold, color: _green)),
                pw.SizedBox(height: 4),
                pw.Text(ownerCompany['name']?.toString() ?? 'شركة شموس للمصاعد',
                    style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold, color: _green)),
                pw.SizedBox(height: 4),
                pw.Text('التوقيع / الختم: .................................',
                    style: pw.TextStyle(fontSize: 9, color: const PdfColor.fromInt(0xFF94a3b8))),
              ],
            ),
          ],
        ),
      ],
    );
  }

  /// سند قبض راتب الموظف.
  static pw.Widget salaryReceiptContent(Map<String, dynamic> r, Map<String, dynamic> ownerCompany) {
    final companyName = ownerCompany['name']?.toString() ?? 'شركة شموس للمصاعد';
    final staffName = r['staffName']?.toString() ?? '';
    final staffId = r['staffIdentity']?.toString() ?? '';
    final period = r['period']?.toString() ?? '';
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Center(
          child: pw.Text('سند قبض راتب',
              style: pw.TextStyle(fontSize: 18, fontWeight: pw.FontWeight.bold, color: _green)),
        ),
        pw.SizedBox(height: 12),
        _field('رقم السند', r['id']?.toString() ?? ''),
        _field('الموظف', '$staffName (${staffId.isEmpty ? '—' : staffId})'),
        if (period.isNotEmpty) _field('عن شهر', period),
        _field('التاريخ', _fmt(r['createdAtMs'])),
        pw.SizedBox(height: 14),
        pw.Center(
          child: pw.Text(
            'استلمنا نحن (${staffName.isEmpty ? 'الموظف' : staffName}) من مؤسسة ($companyName) مبلغ صافي راتب',
            textAlign: pw.TextAlign.center,
            style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold, color: _green, height: 1.8),
          ),
        ),
        pw.SizedBox(height: 8),
        pw.Center(
          child: pw.Container(
            padding: const pw.EdgeInsets.all(12),
            decoration: pw.BoxDecoration(
              border: pw.Border.all(color: _gold, width: 1.5),
              borderRadius: pw.BorderRadius.circular(8),
            ),
            child: pw.Text('صافي المبلغ: ${AppUtils.moneyEn(r['amount'])} ر.س',
                style: pw.TextStyle(fontSize: 18, fontWeight: pw.FontWeight.bold, color: _green)),
          ),
        ),
        pw.SizedBox(height: 12),
        if ((r['details'] as List?)?.isNotEmpty == true)
          for (final d in (r['details'] as List))
            if (d is Map && (d['value'] as num?)?.toDouble() != null)
              _line(d['label']?.toString() ?? '', (d['value'] as num).toDouble()),
        pw.SizedBox(height: 18),
        pw.Divider(color: const PdfColor.fromInt(0xFFe2e8f0), height: 10),
        pw.SizedBox(height: 6),
        pw.Row(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
          children: [
            pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.center,
              children: [
                pw.Text('الموظف',
                    style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold, color: _green)),
                pw.SizedBox(height: 4),
                pw.Text('التوقيع: .................................',
                    style: pw.TextStyle(fontSize: 9, color: const PdfColor.fromInt(0xFF94a3b8))),
              ],
            ),
            pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.center,
              children: [
                pw.Text('المصدر (المنشأة)',
                    style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold, color: _green)),
                pw.SizedBox(height: 4),
                pw.Text(ownerCompany['name']?.toString() ?? 'شركة شموس للمصاعد',
                    style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold, color: _green)),
                pw.SizedBox(height: 4),
                pw.Text('التوقيع / الختم: .................................',
                    style: pw.TextStyle(fontSize: 9, color: const PdfColor.fromInt(0xFF94a3b8))),
              ],
            ),
          ],
        ),
      ],
    );
  }

  /// مسير رواتب شهرية.
  static pw.Widget payrollContent(Map<String, dynamic> p, Map<String, dynamic> ownerCompany) {
    final companyName = ownerCompany['name']?.toString() ?? 'شركة شموس للمصاعد';
    final rows = (p['rows'] as List?) ?? <dynamic>[];
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Center(
          child: pw.Text('مسير رواتب',
              style: pw.TextStyle(fontSize: 18, fontWeight: pw.FontWeight.bold, color: _green)),
        ),
        pw.SizedBox(height: 8),
        _field('عن شهر', p['period']?.toString() ?? ''),
        _field('الحالة', p['status']?.toString() ?? ''),
        _field('التاريخ', _fmt(p['createdAt'])),
        pw.SizedBox(height: 12),
        pw.TableHelper.fromTextArray(
          headers: ['الموظف', 'الراتب الأساسي', 'البدلات', 'الخصومات', 'خصم العهد', 'الصافي'],
          data: [
            for (final row in rows.cast<Map>())
              [
                row['staffName']?.toString() ?? '',
                AppUtils.moneyEn(row['base']),
                AppUtils.moneyEn(row['allowances']),
                AppUtils.moneyEn(row['deductions']),
                AppUtils.moneyEn(row['custodyDeduction']),
                AppUtils.moneyEn(row['net']),
              ],
          ],
          headerStyle: pw.TextStyle(fontWeight: pw.FontWeight.bold, color: const PdfColor.fromInt(0xFFffffff), fontSize: 8),
          headerDecoration: const pw.BoxDecoration(color: _green),
          cellStyle: const pw.TextStyle(fontSize: 8),
          cellAlignments: {
            0: pw.Alignment.centerRight,
            1: pw.Alignment.center,
            2: pw.Alignment.center,
            3: pw.Alignment.center,
            4: pw.Alignment.center,
            5: pw.Alignment.center,
          },
          border: pw.TableBorder.all(color: const PdfColor.fromInt(0xFFdde5e3), width: 0.6),
        ),
        pw.SizedBox(height: 12),
        pw.Center(
          child: pw.Text('الإجمالي المسدد للموظفين: ${AppUtils.moneyEn(p['totalNet'])} ر.س',
              style: pw.TextStyle(fontSize: 13, fontWeight: pw.FontWeight.bold, color: _gold)),
        ),
      ],
    );
  }

  static pw.Widget _line(String label, double value, {bool bold = false, PdfColor? color}) {
    return pw.Padding(
      padding: const pw.EdgeInsets.symmetric(vertical: 2),
      child: pw.Row(
        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
        children: [
          pw.Text(label, style: pw.TextStyle(fontSize: 11, fontWeight: bold ? pw.FontWeight.bold : pw.FontWeight.normal)),
          pw.Text('${AppUtils.moneyEn(value)} ر.س',
              style: pw.TextStyle(fontSize: 11, fontWeight: bold ? pw.FontWeight.bold : pw.FontWeight.normal, color: color ?? _green)),
        ],
      ),
    );
  }

  /// تقرير مالي شامل.
  static pw.Widget financialReportContent(Map<String, dynamic> r, Map<String, dynamic> ownerCompany) {
    final breakdown = (r['breakdown'] as List?) ?? <dynamic>[];
    final entries = (r['entries'] as List?) ?? <dynamic>[];
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Center(
          child: pw.Text('تقرير مالي',
              style: pw.TextStyle(fontSize: 18, fontWeight: pw.FontWeight.bold, color: _green)),
        ),
        pw.SizedBox(height: 10),
        _field('الفترة', r['periodLabel']?.toString() ?? ''),
        _field('تاريخ التقرير', _fmt(r['generatedAt'])),
        pw.SizedBox(height: 14),
        pw.Row(
          mainAxisAlignment: pw.MainAxisAlignment.spaceEvenly,
          children: [
            _summaryBox('إجمالي الوارد', AppUtils.moneyEn(r['totalIn']), _green),
            _summaryBox('إجمالي الصادر', AppUtils.moneyEn(r['totalOut']), const PdfColor.fromInt(0xFFc0392b)),
            _summaryBox('الصافي', AppUtils.moneyEn(r['net']), _gold),
          ],
        ),
        pw.SizedBox(height: 16),
        pw.Text('التوزيع حسب الفئة',
            style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold, color: _green)),
        pw.SizedBox(height: 4),
        pw.TableHelper.fromTextArray(
          headers: ['الفئة', 'وارد', 'صادر', 'الصافي'],
          data: [
            for (final b in breakdown.cast<Map>())
              [
                b['label']?.toString() ?? '',
                AppUtils.moneyEn(b['inn']),
                AppUtils.moneyEn(b['out']),
                AppUtils.moneyEn(((b['inn'] as num?)?.toDouble() ?? 0) - ((b['out'] as num?)?.toDouble() ?? 0)),
              ],
          ],
          headerStyle: pw.TextStyle(fontWeight: pw.FontWeight.bold, color: const PdfColor.fromInt(0xFFffffff), fontSize: 8),
          headerDecoration: const pw.BoxDecoration(color: _green),
          cellStyle: const pw.TextStyle(fontSize: 8),
          cellAlignments: {
            0: pw.Alignment.centerRight,
            1: pw.Alignment.center,
            2: pw.Alignment.center,
            3: pw.Alignment.center,
          },
          border: pw.TableBorder.all(color: const PdfColor.fromInt(0xFFdde5e3), width: 0.6),
        ),
        pw.SizedBox(height: 16),
        pw.Text('القيود المالية (${entries.length})',
            style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold, color: _green)),
        pw.SizedBox(height: 4),
        if (entries.isEmpty)
          pw.Text('(لا توجد قيود في هذه الفترة)', style: pw.TextStyle(fontSize: 10, color: const PdfColor.fromInt(0xFF888888)))
        else
          pw.TableHelper.fromTextArray(
            headers: ['رقم القيد', 'النوع', 'الوصف', 'الاتجاه', 'المبلغ', 'التاريخ'],
            data: [
              for (final e in entries.cast<Map>())
                [
                  e['id']?.toString() ?? '',
                  _entryTypeLabel(e['type']?.toString() ?? ''),
                  _truncate(e['description']?.toString() ?? '', 32),
                  e['direction']?.toString() == 'in' ? 'وارد' : 'صادر',
                  AppUtils.moneyEn(e['amount']),
                  _fmt(e['createdAtMs'] ?? e['createdAt']),
                ],
            ],
            headerStyle: pw.TextStyle(fontWeight: pw.FontWeight.bold, color: const PdfColor.fromInt(0xFFffffff), fontSize: 7),
            headerDecoration: const pw.BoxDecoration(color: _green),
            cellStyle: const pw.TextStyle(fontSize: 7),
            cellAlignments: {
              0: pw.Alignment.centerRight,
              1: pw.Alignment.center,
              2: pw.Alignment.centerRight,
              3: pw.Alignment.center,
              4: pw.Alignment.center,
              5: pw.Alignment.center,
            },
            border: pw.TableBorder.all(color: const PdfColor.fromInt(0xFFdde5e3), width: 0.6),
          ),
        pw.SizedBox(height: 16),
        pw.Center(
          child: pw.Text('— نهاية التقرير —',
              style: pw.TextStyle(fontSize: 9, color: const PdfColor.fromInt(0xFF94a3b8))),
        ),
      ],
    );
  }

  static pw.Widget _summaryBox(String label, String value, PdfColor color) {
    return pw.Container(
      padding: const pw.EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: pw.BoxDecoration(
        border: pw.Border.all(color: color, width: 1.2),
        borderRadius: pw.BorderRadius.circular(8),
      ),
      child: pw.Column(
        children: [
          pw.Text(label, style: pw.TextStyle(fontSize: 9, color: color, fontWeight: pw.FontWeight.bold)),
          pw.SizedBox(height: 4),
          pw.Text('$value ر.س', style: pw.TextStyle(fontSize: 11, fontWeight: pw.FontWeight.bold, color: _green)),
        ],
      ),
    );
  }

  static String _entryTypeLabel(String type) {
    const labels = {
      'sale': 'مبيعات', 'purchase': 'مشتريات', 'expense': 'مصروف',
      'salary': 'راتب', 'advance': 'سلفة', 'deduction': 'خصم',
      'allowance': 'بدل', 'custody': 'عهدة',
    };
    return labels[type] ?? type;
  }

  static String _truncate(String s, int max) {
    if (s.length <= max) return s;
    return '${s.substring(0, max)}...';
  }
}
