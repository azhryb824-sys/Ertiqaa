import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

/// أساس التطبيق مع توطين عربي.
class AppLocalizations {
  static const supportedLocales = [Locale('ar')];
  static const delegates = [
    GlobalMaterialLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
  ];
}
