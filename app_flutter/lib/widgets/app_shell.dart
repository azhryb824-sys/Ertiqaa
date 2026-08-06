import 'package:flutter/material.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../screens/pages.dart';

/// الهيكل الرئيسي: شريط علوي + تبويبات سفلية + لوحة تنقل شبكية للمديرين.
class AppShell extends StatelessWidget {
  const AppShell({super.key});

  static const List<String> _bottomKeys = [
    'overview', 'contracts', 'tickets', 'visits', 'finance',
  ];

  @override
  Widget build(BuildContext context) {
    final app = AppState.instance;
    final session = app.session!;
    final pages = app.navPages;

    // التبويبات السفلية الفعالة حسب الدور
    final visibleBottom = _bottomKeys
        .map((k) => pages.where((p) => p.first == k).isNotEmpty ? k : null)
        .whereType<String>()
        .toList();
    if (visibleBottom.isEmpty && pages.isNotEmpty) visibleBottom.add(pages.first.first);

    final current = app.currentPage;
    int index = visibleBottom.indexOf(current);
    if (index < 0) index = 0;

    return Scaffold(
      backgroundColor: AppTheme.bg,
      body: Column(
        children: [
          _Header(title: _titleFor(current, pages), app: app),
          Expanded(child: pageFor(current)),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (i) {
          final key = visibleBottom[i];
          if (key == 'more') {
            _showMore(context, pages);
          } else {
            app.go(key);
          }
        },
        destinations: [
          for (final key in visibleBottom)
            NavigationDestination(icon: Icon(_iconFor(key)), label: _labelFor(key)),
          NavigationDestination(
            icon: const Icon(Icons.apps_rounded),
            label: 'المزيد',
            selectedIcon: const Icon(Icons.apps_rounded, color: AppTheme.gold),
          ),
        ],
      ),
    );
  }

  String _titleFor(String page, List<List<String>> pages) {
    for (final p in pages) {
      if (p.first == page) return p.last;
    }
    return 'شموس للمصاعد';
  }

  static String _labelFor(String key) {
    return const {
      'overview': 'الرئيسية', 'contracts': 'العقود', 'tickets': 'البلاغات',
      'visits': 'الزيارات', 'finance': 'المالية',
    }[key] ?? key;
  }

  static IconData _iconFor(String key) {
    return const {
      'overview': Icons.home_rounded, 'contracts': Icons.description_rounded,
      'tickets': Icons.report_problem_rounded, 'visits': Icons.event_available_rounded,
      'finance': Icons.account_balance_wallet_rounded,
    }[key] ?? Icons.grid_view_rounded;
  }

  void _showMore(BuildContext context, List<List<String>> pages) {
    final app = AppState.instance;
    final isManager = app.session!.canManage;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.72,
        minChildSize: 0.4,
        maxChildSize: 0.95,
        builder: (ctx, scroll) => Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            children: [
              const SizedBox(height: 10),
              Container(width: 44, height: 5, decoration: BoxDecoration(color: const Color(0xFFdde5e3), borderRadius: BorderRadius.circular(4))),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Text(
                  isManager ? 'لوحة التنقل' : 'التنقل',
                  style: const TextStyle(fontFamily: 'Cairo', fontSize: 17, fontWeight: FontWeight.w800),
                ),
              ),
              const Divider(height: 1),
              Expanded(
                child: GridView.count(
                  controller: scroll,
                  crossAxisCount: 3,
                  padding: const EdgeInsets.all(12),
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  children: [
                    for (final p in pages)
                      _NavTile(key_: p.first, label: p.last, icon: _tileIcon(p.first), onTap: () {
                        Navigator.pop(ctx);
                        app.go(p.first);
                      }),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  static IconData _tileIcon(String key) {
    const map = <String, IconData>{      'overview': Icons.home_rounded,
      'ai-admin': Icons.auto_awesome_rounded,
      'predictions': Icons.monitor_heart_rounded,
      'knowledge-base': Icons.menu_book_rounded,
      'knowledge-hub': Icons.lightbulb_rounded,
      'analytics': Icons.analytics_rounded,
      'drafts': Icons.drafts_rounded,
      'operations': Icons.engineering_rounded,
      'notifications': Icons.notifications_rounded,
      'whatsapp': Icons.chat_rounded,
      'users': Icons.manage_accounts_rounded,
      'companies': Icons.apartment_rounded,
      'system': Icons.dashboard_customize_rounded,
      'banners': Icons.campaign_rounded,
      'contracts': Icons.description_rounded,
      'assets': Icons.elevator_rounded,
      'tickets': Icons.report_problem_rounded,
      'company-customers': Icons.business_rounded,
      'quotes': Icons.request_quote_rounded,
      'default-items': Icons.list_alt_rounded,
      'claims': Icons.receipt_long_rounded,
      'receipts': Icons.receipt_rounded,
      'staff-finance': Icons.payments_rounded,
      'visits': Icons.event_available_rounded,
      'meetings': Icons.groups_rounded,
      'tracking': Icons.location_on_rounded,
      'reports': Icons.assignment_rounded,
      'inventory': Icons.inventory_2_rounded,
      'suppliers': Icons.local_shipping_rounded,
      'team': Icons.people_rounded,
      'company-docs': Icons.folder_open_rounded,
      'activity': Icons.history_rounded,
      'company': Icons.factory_rounded,
      'entry-links': Icons.link_rounded,
      'moderation': Icons.gavel_rounded,
      'data-tools': Icons.settings_rounded,
      'storage-data': Icons.storage_rounded,
      'voice-settings': Icons.record_voice_over_rounded,
      'my-location': Icons.my_location_rounded,
      'finance': Icons.account_balance_wallet_rounded,
      'client-companies': Icons.domain_rounded,
    };
    return map[key] ?? Icons.grid_view_rounded;
  }
}

class _Header extends StatelessWidget {
  final String title;
  final AppState app;
  const _Header({required this.title, required this.app});

  @override
  Widget build(BuildContext context) {
    final s = app.session;
    return Container(
      padding: EdgeInsets.only(top: MediaQuery.of(context).padding.top, bottom: 8),
      decoration: const BoxDecoration(
        gradient: LinearGradient(colors: [AppTheme.primaryDark, AppTheme.primary], begin: Alignment.topCenter, end: Alignment.bottomCenter),
      ),
      child: Row(
        children: [
          const SizedBox(width: 16),
          const Icon(Icons.elevator_rounded, color: AppTheme.gold, size: 26),
          const SizedBox(width: 10),
          Expanded(
            child: Text(title,
                style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800)),
          ),
          IconButton(
            icon: const Icon(Icons.notifications_none_rounded, color: Colors.white),
            onPressed: () => app.go('notifications'),
          ),
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert_rounded, color: Colors.white),
            onSelected: (v) {
              if (v == 'logout') app.logout();
            },
            itemBuilder: (ctx) => [
              PopupMenuItem(value: 'user', enabled: false,
                  child: Text('${s?.name ?? ''}\n${s?.role ?? ''}', style: const TextStyle(fontFamily: 'Cairo'))),
              const PopupMenuDivider(),
              const PopupMenuItem(value: 'logout', child: Text('تسجيل الخروج', style: TextStyle(fontFamily: 'Cairo'))),
            ],
          ),
          const SizedBox(width: 8),
        ],
      ),
    );
  }
}

/// بلاطة تنقل في اللوحة الشبكية "المزيد".
class _NavTile extends StatelessWidget {
  final String key_;
  final String label;
  final IconData icon;
  final VoidCallback onTap;
  const _NavTile({required this.key_, required this.label, required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFFF2F7F5),
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: AppTheme.primary, size: 30),
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 6),
              child: Text(label,
                  maxLines: 2, textAlign: TextAlign.center,
                  style: const TextStyle(fontFamily: 'Cairo', fontSize: 12.5, fontWeight: FontWeight.w700, color: AppTheme.textDark)),
            ),
          ],
        ),
      ),
    );
  }
}
