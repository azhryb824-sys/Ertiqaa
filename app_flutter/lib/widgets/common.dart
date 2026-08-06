import 'package:flutter/material.dart';
import '../core/utils.dart';
import '../theme.dart';

/// شارة حالة ملونة.
class StatusBadge extends StatelessWidget {
  final String? status;
  const StatusBadge(this.status, {super.key});

  @override
  Widget build(BuildContext context) {
    final kind = AppUtils.statusKind(status);
    final (bg, fg) = switch (kind) {
      'success' => (const Color(0xFFe2f3e9), AppTheme.success),
      'cancelled' => (const Color(0xFFfdecea), AppTheme.danger),
      'danger' => (const Color(0xFFfdecea), AppTheme.danger),
      _ => (const Color(0xFFFFF3DF), AppTheme.gold),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
      child: Text(AppUtils.badgeLabel(status),
          style: TextStyle(color: fg, fontSize: 11, fontWeight: FontWeight.w700)),
    );
  }
}

/// رأس قسم مرقّم في النماذج.
class SectionHeader extends StatelessWidget {
  final int number;
  final String title;
  const SectionHeader(this.number, this.title, {super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 18, bottom: 10),
      child: Row(
        children: [
          Container(
            width: 30, height: 30,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: AppTheme.primary,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text('$number',
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontFamily: 'Cairo')),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(title,
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, fontFamily: 'Cairo')),
          ),
        ],
      ),
    );
  }
}

/// بطاقة كليك مع سهم.
class ListCard extends StatelessWidget {
  final String title;
  final String? subtitle;
  final String? trailing;
  final Widget? leadingIcon;
  final Widget? trailingWidget;
  final VoidCallback? onTap;
  const ListCard({
    super.key,
    required this.title,
    this.subtitle,
    this.trailing,
    this.leadingIcon,
    this.trailingWidget,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 5),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
        leading: leadingIcon ??
            Container(
              width: 42, height: 42,
              decoration: BoxDecoration(color: AppTheme.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
              child: const Icon(Icons.description_outlined, color: AppTheme.primary),
            ),
        title: Text(title, style: const TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w700, fontSize: 14)),
        subtitle: subtitle != null
            ? Text(subtitle!, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontFamily: 'Cairo', fontSize: 12, color: AppTheme.textMuted))
            : null,
        trailing: trailingWidget ??
            (trailing != null
                ? Text(trailing!, style: const TextStyle(fontFamily: 'Cairo', fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.primary))
                : const Icon(Icons.chevron_left_rounded, color: AppTheme.textMuted)),
        onTap: onTap,
      ),
    );
  }
}

/// ملخص عددي في لوحة التحكم.
class StatCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  const StatCard({super.key, required this.label, required this.value, required this.icon, this.color = AppTheme.primary});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 8)],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 26),
          const SizedBox(height: 10),
          Text(value, style: const TextStyle(fontFamily: 'Cairo', fontSize: 20, fontWeight: FontWeight.w800)),
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(fontFamily: 'Cairo', fontSize: 12, color: AppTheme.textMuted)),
        ],
      ),
    );
  }
}

/// حقل نصي موحّد (يتولى الحفاظ على الحالة داخلياً).
class AppField extends StatefulWidget {
  final String label;
  final TextEditingController? controller;
  final TextInputType keyboard;
  final bool obscure;
  final String? hint;
  final String? initialText;
  final int maxLines;
  final ValueChanged<String>? onChanged;
  const AppField({
    super.key,
    required this.label,
    this.controller,
    this.keyboard = TextInputType.text,
    this.obscure = false,
    this.hint,
    this.initialText,
    this.maxLines = 1,
    this.onChanged,
  });

  @override
  State<AppField> createState() => _AppFieldState();
}

class _AppFieldState extends State<AppField> {
  late TextEditingController _controller;
  bool _seeded = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_seeded) {
      _seeded = true;
      _controller = widget.controller ?? TextEditingController(text: widget.initialText ?? '');
    }
  }

  @override
  void dispose() {
    if (widget.controller == null) _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: TextField(
        controller: widget.controller ?? _controller,
        keyboardType: widget.keyboard,
        obscureText: widget.obscure,
        maxLines: widget.maxLines,
        onChanged: widget.onChanged,
        decoration: InputDecoration(labelText: widget.label, hintText: widget.hint),
      ),
    );
  }
}

/// حقل اختيار من قائمة.
class AppDropdown<T> extends StatelessWidget {
  final String label;
  final T? value;
  final List<T> items;
  final String Function(T) labelOf;
  final ValueChanged<T?> onChanged;
  const AppDropdown({
    super.key,
    required this.label,
    required this.value,
    required this.items,
    required this.labelOf,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: DropdownButtonFormField<T>(
        initialValue: value,
        decoration: InputDecoration(labelText: label),
        items: [for (final it in items) DropdownMenuItem(value: it, child: Text(labelOf(it), style: const TextStyle(fontFamily: 'Cairo')))],
        onChanged: onChanged,
      ),
    );
  }
}

/// حالة فارغة.
class EmptyState extends StatelessWidget {
  final String message;
  final IconData icon;
  const EmptyState(this.message, {this.icon = Icons.inbox_outlined, super.key});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 52, color: AppTheme.textMuted.withValues(alpha: 0.4)),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center, style: const TextStyle(fontFamily: 'Cairo', color: AppTheme.textMuted)),
          ],
        ),
      ),
    );
  }
}

/// زر عائم موحّد.
class Fab extends StatelessWidget {
  final VoidCallback onPressed;
  final String label;
  const Fab({super.key, required this.onPressed, required this.label});

  @override
  Widget build(BuildContext context) {
    return FloatingActionButton.extended(
      onPressed: onPressed,
      backgroundColor: AppTheme.gold,
      foregroundColor: AppTheme.primaryDark,
      icon: const Icon(Icons.add_rounded),
      label: Text(label, style: const TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.w800)),
    );
  }
}

/// شريط عنوان داخلي لصفحات القوائم.
class PageTitle extends StatelessWidget {
  final String title;
  final String? subtitle;
  const PageTitle(this.title, {this.subtitle, super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
      child: Row(
        children: [
          Expanded(
            child: Text(title, style: const TextStyle(fontFamily: 'Cairo', fontSize: 20, fontWeight: FontWeight.w800)),
          ),
        ],
      ),
    );
  }
}

/// بطاقة مبلغ مالية.
class MoneyText extends StatelessWidget {
  final dynamic amount;
  final bool large;
  const MoneyText(this.amount, {this.large = false, super.key});

  @override
  Widget build(BuildContext context) {
    return Text(AppUtils.money(amount),
        style: TextStyle(
          fontFamily: 'Cairo',
          fontSize: large ? 22 : 14,
          fontWeight: FontWeight.w800,
          color: AppTheme.primaryDark,
        ));
  }
}

/// فاصل أنيق.
class SectionDivider extends StatelessWidget {
  const SectionDivider({super.key});
  @override
  Widget build(BuildContext context) => const Divider(height: 28, indent: 16, endIndent: 16);
}
