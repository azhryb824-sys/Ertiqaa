import 'package:intl/intl.dart';
import 'constants.dart';

/// أدوات مساعدة مطابقة لـ app.js.
class AppUtils {
  AppUtils._();

  /// تحويل الأرقام العربية/الفارسية إلى لاتينية وإزالة غير الأرقام.
  static String cleanId(dynamic v) {
    var s = String(v ?? '').replaceAll(RegExp('[٠-٩]'), (m) => '٠١٢٣٤٥٦٧٨٩'.indexOf(m.group(0)!).toString());
    s = s.replaceAll(RegExp('[۰-۹]'), (m) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(m.group(0)!).toString());
    return s.replaceAll(RegExp(r'\D'), '');
  }

  static bool isValidId(dynamic v) {
    final c = cleanId(v);
    return c.length >= 6 && !AppConstants.blockedIds.contains(c) && RegExp(r'^[12]').hasMatch(c);
  }

  /// هروب نص HTML.
  static String esc(dynamic v) {
    return String(v ?? '').replaceAllMapped(RegExp(r'''[&<>"']'''), (m) {
      switch (m.group(0)) {
        case '&': return '&amp;';
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '"': return '&quot;';
        case "'": return '&#39;';
        default: return m.group(0)!;
      }
    });
  }

  /// تنسيق المبالغ: "١٢٣٬٤٥٦٫٠٠ ر.س"
  static String money(dynamic n) {
    final value = NumberFormat('#,##0.00', 'ar').format(double.tryParse(n?.toString() ?? '') ?? 0);
    return '$value ر.س';
  }

  static String moneyEn(dynamic n) {
    final value = NumberFormat('#,##0.00').format(double.tryParse(n?.toString() ?? '') ?? 0);
    return value;
  }

  /// تاريخ عربي.
  static String fmtDate(dynamic v) {
    if (v == null || v.toString().isEmpty) return 'غير محدد';
    final d = _tryParse(v);
    if (d == null) return v.toString();
    return DateFormat.yMMMd('ar').format(d);
  }

  static String fmtDateTime(dynamic v) {
    if (v == null || v.toString().isEmpty) return 'غير محدد';
    final d = _tryParse(v);
    if (d == null) return v.toString();
    return DateFormat('yyyy/MM/dd hh:mm a', 'ar').format(d);
  }

  static DateTime? _tryParse(dynamic v) {
    if (v is num) return DateTime.fromMillisecondsSinceEpoch(v.toInt());
    final d = DateTime.tryParse(v.toString());
    return d;
  }

  /// تاريخ اليوم بصيغة yyyy-MM-dd
  static String dateVal([DateTime? date]) {
    final d = date ?? DateTime.now();
    return '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  }

  /// إضافة سنوات ثم التراجع يوماً (مطابق لـ addYears في app.js).
  static DateTime addYears(DateTime date, int years) {
    final d = DateTime(date.year + years, date.month, date.day);
    return d.subtract(const Duration(days: 1));
  }

  /// الحالة → نوع الشارة.
  static String statusKind(String? s) {
    if (AppConstants.successStatuses.contains(s)) return 'success';
    if (s == AppConstants.statusCancelled) return 'cancelled';
    if (s == 'منتهيا' || s == 'مرفوض') return 'danger';
    return 'pending';
  }

  static String badgeLabel(String? s) {
    if (s == 'بانتظار المراجعة والاعتماد') return 'قيد الاعتماد';
    return s ?? 'غير محدد';
  }
}
