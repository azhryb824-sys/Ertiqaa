import 'package:flutter/material.dart';
import '../../core/utils.dart';
import '../../state/app_state.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// الشركات والمؤسسات (مشرف النظام فقط).
class CompaniesScreen extends StatelessWidget {
  const CompaniesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = AppState.instance;
    final session = app.session!;
    if (session.role != 'admin') {
      return const Scaffold(
        backgroundColor: AppTheme.bg,
        body: EmptyState('متاح لمشرف النظام فقط.', icon: Icons.lock_outline),
      );
    }
    final companies = app.ownerCompanies;
    return Scaffold(
      backgroundColor: AppTheme.bg,
      body: companies.isEmpty
          ? const EmptyState('لا توجد شركات مسجلة.')
          : ListView.builder(
              itemCount: companies.length,
              itemBuilder: (ctx, i) {
                final c = companies[i];
                return ListCard(
                  leadingIcon: const Icon(Icons.apartment_rounded, color: AppTheme.primary),
                  title: c['name']?.toString() ?? '',
                  subtitle: 'الرقم الموحد: ${c['unifiedNumber'] ?? ''}',
                  trailing: c['taxNumber']?.toString() ?? '',
                );
              },
            ),
    );
  }
}
