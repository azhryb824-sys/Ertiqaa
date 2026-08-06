import 'package:flutter/material.dart';
import '../../core/utils.dart';
import '../../state/app_state.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// تتبع الفنيين: مواقعهم المخزنة في misadStaffLocations + misadLiveLocation.
class TrackingScreen extends StatelessWidget {
  const TrackingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = AppState.instance;
    final locations = app.storage.list('misadStaffLocations').whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
    final staff = app.allStaff.where(app.sameCompany).toList();

    return Scaffold(
      backgroundColor: AppTheme.bg,
      body: locations.isEmpty
          ? const EmptyState('لا توجد مواقع مرسلة من الفنيين بعد.')
          : ListView(
              padding: const EdgeInsets.only(bottom: 24),
              children: [
                const PageTitle('مواقع الفنيين'),
                for (final loc in locations)
                  ListCard(
                    leadingIcon: const Icon(Icons.location_on_rounded, color: AppTheme.danger),
                    title: _staffName(app, staff, loc),
                    subtitle: '${loc['lat'] ?? ''}, ${loc['lng'] ?? ''}',
                    trailing: AppUtils.fmtDateTime(loc['updatedAt'] ?? loc['timestamp']),
                  ),
              ],
            ),
    );
  }

  String _staffName(AppState app, List<Map<String, dynamic>> staff, Map<String, dynamic> loc) {
    final userId = loc['userId']?.toString() ?? '';
    for (final s in staff) {
      if (s['identity']?.toString() == userId || s['id']?.toString() == userId) {
        return s['name']?.toString() ?? userId;
      }
    }
    return userId.isEmpty ? 'فني غير معروف' : userId;
  }
}
