/// جلسة المستخدم (مطابقة لمفتاح misadSession في النظام).
class UserSession {
  final String id;
  final String role;
  final String name;
  final List<String> permissions;
  final bool mustChangePassword;
  final String companyOwnerId;
  final String adminMode; // "company" | "system" (للمشرف)
  final String linkedCoId;

  const UserSession({
    required this.id,
    required this.role,
    required this.name,
    this.permissions = const [],
    this.mustChangePassword = false,
    this.companyOwnerId = '',
    this.adminMode = '',
    this.linkedCoId = '',
  });

  bool get isOwner => role == 'owner';
  bool get isCompanyAdmin => role == 'company_admin';
  bool get isAdmin => role == 'admin';
  bool get isTechnician => role == 'technician' || role == 'engineer';
  bool get isClient => role == 'client';
  bool get canManage => const ['owner', 'company_admin', 'admin'].contains(role);
  bool get canUseLetterhead => canManage;

  UserSession copyWith({
    String? id, String? role, String? name, List<String>? permissions,
    bool? mustChangePassword, String? companyOwnerId, String? adminMode, String? linkedCoId,
  }) {
    return UserSession(
      id: id ?? this.id,
      role: role ?? this.role,
      name: name ?? this.name,
      permissions: permissions ?? this.permissions,
      mustChangePassword: mustChangePassword ?? this.mustChangePassword,
      companyOwnerId: companyOwnerId ?? this.companyOwnerId,
      adminMode: adminMode ?? this.adminMode,
      linkedCoId: linkedCoId ?? this.linkedCoId,
    );
  }

  factory UserSession.fromJson(Map<String, dynamic> j) {
    return UserSession(
      id: j['id']?.toString() ?? '',
      role: j['role']?.toString() ?? '',
      name: j['name']?.toString() ?? '',
      permissions: (j['permissions'] as List?)?.map((e) => e.toString()).toList() ?? const [],
      mustChangePassword: j['mustChangePassword'] == true,
      companyOwnerId: j['companyOwnerId']?.toString() ?? '',
      adminMode: j['adminMode']?.toString() ?? '',
      linkedCoId: j['_linkedCoId']?.toString() ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'role': role,
        'name': name,
        'permissions': permissions,
        'mustChangePassword': mustChangePassword,
        'companyOwnerId': companyOwnerId,
        'adminMode': adminMode,
        '_linkedCoId': linkedCoId,
      };
}
