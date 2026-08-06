import 'package:flutter/foundation.dart';

/// سجل نشاط — مفتاح misadActivity.
@immutable
class ActivityLog {
  final String id;
  final String companyOwnerId;
  final String userId;
  final String userName;
  final String action;
  final String entityType;
  final String entityId;
  final String details;
  final String ip;
  final int createdAtMs;
  final String createdAt;

  const ActivityLog({
    required this.id,
    this.companyOwnerId = '',
    this.userId = '',
    this.userName = '',
    this.action = '',
    this.entityType = '',
    this.entityId = '',
    this.details = '',
    this.ip = '',
    this.createdAtMs = 0,
    this.createdAt = '',
  });

  factory ActivityLog.fromJson(Map<String, dynamic> j) => ActivityLog(
        id: j['id']?.toString() ?? '',
        companyOwnerId: j['companyOwnerId']?.toString() ?? '',
        userId: j['userId']?.toString() ?? '',
        userName: j['userName']?.toString() ?? '',
        action: j['action']?.toString() ?? '',
        entityType: j['entityType']?.toString() ?? '',
        entityId: j['entityId']?.toString() ?? '',
        details: j['details']?.toString() ?? '',
        ip: j['ip']?.toString() ?? '',
        createdAtMs: (j['createdAtMs'] as num?)?.toInt() ?? 0,
        createdAt: j['createdAt']?.toString() ?? '',
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'companyOwnerId': companyOwnerId,
        'userId': userId,
        'userName': userName,
        'action': action,
        'entityType': entityType,
        'entityId': entityId,
        'details': details,
        'ip': ip,
        'createdAtMs': createdAtMs,
        'createdAt': createdAt,
      };
}

/// حساب مستخدم — مفتاح misadUsers.
@immutable
class UserAccount {
  final String identity;
  final String password;
  final String name;
  final String role;
  final bool active;
  final bool mustChangePassword;
  final String companyOwnerId;
  final String adminMode;
  final String linkedCoId;
  final List<String> permissions;
  final String? createdAt;

  const UserAccount({
    required this.identity,
    this.password = '',
    this.name = '',
    this.role = 'client',
    this.active = true,
    this.mustChangePassword = false,
    this.companyOwnerId = '',
    this.adminMode = '',
    this.linkedCoId = '',
    this.permissions = const [],
    this.createdAt,
  });

  factory UserAccount.fromJson(Map<String, dynamic> j) => UserAccount(
        identity: j['identity']?.toString() ?? '',
        password: j['password']?.toString() ?? '',
        name: j['name']?.toString() ?? '',
        role: j['role']?.toString() ?? 'client',
        active: j['active'] != false,
        mustChangePassword: j['mustChangePassword'] == true,
        companyOwnerId: j['companyOwnerId']?.toString() ?? '',
        adminMode: j['adminMode']?.toString() ?? '',
        linkedCoId: j['linkedCoId']?.toString() ?? '',
        permissions: (j['permissions'] as List?)?.map((e) => e.toString()).toList() ?? const [],
        createdAt: j['createdAt']?.toString(),
      );

  Map<String, dynamic> toJson() => {
        'identity': identity,
        'password': password,
        'name': name,
        'role': role,
        'active': active,
        'mustChangePassword': mustChangePassword,
        'companyOwnerId': companyOwnerId,
        'adminMode': adminMode,
        'linkedCoId': linkedCoId,
        'permissions': permissions,
        if (createdAt != null) 'createdAt': createdAt,
      };
}

/// إشعار — مفتاح misadNotifications.
@immutable
class AppNotification {
  final String id;
  final String userId;
  final String title;
  final String body;
  final String route;
  final bool read;
  final int createdAtMs;
  final String createdAt;

  const AppNotification({
    required this.id,
    this.userId = '',
    this.title = '',
    this.body = '',
    this.route = '',
    this.read = false,
    this.createdAtMs = 0,
    this.createdAt = '',
  });

  factory AppNotification.fromJson(Map<String, dynamic> j) => AppNotification(
        id: j['id']?.toString() ?? '',
        userId: j['userId']?.toString() ?? '',
        title: j['title']?.toString() ?? '',
        body: j['body']?.toString() ?? '',
        route: j['route']?.toString() ?? '',
        read: j['read'] == true,
        createdAtMs: (j['createdAtMs'] as num?)?.toInt() ?? 0,
        createdAt: j['createdAt']?.toString() ?? '',
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'userId': userId,
        'title': title,
        'body': body,
        'route': route,
        'read': read,
        'createdAtMs': createdAtMs,
        'createdAt': createdAt,
      };
}

/// بانر — مفتاح misadBanners.
@immutable
class Banner {
  final String id;
  final String title;
  final String subtitle;
  final String color;
  final String image;
  final String route;
  final bool active;
  final int order;

  const Banner({
    required this.id,
    this.title = '',
    this.subtitle = '',
    this.color = '#1a4a44',
    this.image = '',
    this.route = '',
    this.active = true,
    this.order = 0,
  });

  factory Banner.fromJson(Map<String, dynamic> j) => Banner(
        id: j['id']?.toString() ?? '',
        title: j['title']?.toString() ?? '',
        subtitle: j['subtitle']?.toString() ?? '',
        color: j['color']?.toString() ?? '#1a4a44',
        image: j['image']?.toString() ?? '',
        route: j['route']?.toString() ?? '',
        active: j['active'] != false,
        order: (j['order'] as num?)?.toInt() ?? 0,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'subtitle': subtitle,
        'color': color,
        'image': image,
        'route': route,
        'active': active,
        'order': order,
      };
}

/// معرفة (مقال) — مفتاح misadKnowledgeBase.
@immutable
class Knowledge {
  final String id;
  final String title;
  final String category;
  final String content;
  final String author;
  final int createdAtMs;
  final String createdAt;

  const Knowledge({
    required this.id,
    this.title = '',
    this.category = '',
    this.content = '',
    this.author = '',
    this.createdAtMs = 0,
    this.createdAt = '',
  });

  factory Knowledge.fromJson(Map<String, dynamic> j) => Knowledge(
        id: j['id']?.toString() ?? '',
        title: j['title']?.toString() ?? '',
        category: j['category']?.toString() ?? '',
        content: j['content']?.toString() ?? '',
        author: j['author']?.toString() ?? '',
        createdAtMs: (j['createdAtMs'] as num?)?.toInt() ?? 0,
        createdAt: j['createdAt']?.toString() ?? '',
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'category': category,
        'content': content,
        'author': author,
        'createdAtMs': createdAtMs,
        'createdAt': createdAt,
      };
}
