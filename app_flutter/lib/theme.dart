import 'package:flutter/material.dart';

/// هوية "شموس للمصاعد" — أخضر + ذهبي، خط Cairo، RTL.
class AppTheme {
  AppTheme._();

  static const Color primaryDark = Color(0xFF0d312f);
  static const Color primary = Color(0xFF1a4a44);
  static const Color primaryLight = Color(0xFF2c6e66);
  static const Color gold = Color(0xFFd4a24e);
  static const Color goldLight = Color(0xFFe8c88a);
  static const Color bg = Color(0xFFF4F6F5);
  static const Color surface = Colors.white;
  static const Color textDark = Color(0xFF10201e);
  static const Color textMuted = Color(0xFF6b7d7a);
  static const Color danger = Color(0xFFc0392b);
  static const Color success = Color(0xFF1e7e4f);

  static ThemeData get light {
    final base = ThemeData(
      useMaterial3: true,
      fontFamily: 'Cairo',
      colorScheme: ColorScheme.fromSeed(
        seedColor: primary,
        primary: primary,
        secondary: gold,
        surface: surface,
        error: danger,
      ),
      scaffoldBackgroundColor: bg,
    );
    return base.copyWith(
      appBarTheme: AppBarTheme(
        backgroundColor: primaryDark,
        foregroundColor: Colors.white,
        elevation: 0,
        centerTitle: true,
        titleTextStyle: const TextStyle(
          fontFamily: 'Cairo',
          fontSize: 18,
          fontWeight: FontWeight.w700,
          color: Colors.white,
        ),
      ),
      cardTheme: CardThemeData(
        color: surface,
        elevation: 0,
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(16))),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primary,
          foregroundColor: Colors.white,
          minimumSize: const Size.fromHeight(48),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: const TextStyle(fontFamily: 'Cairo', fontSize: 15, fontWeight: FontWeight.w600),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: primary,
          side: const BorderSide(color: primary),
          minimumSize: const Size.fromHeight(48),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: const TextStyle(fontFamily: 'Cairo', fontSize: 15, fontWeight: FontWeight.w600),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFdde5e3))),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFdde5e3))),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: primary, width: 1.5)),
        labelStyle: const TextStyle(color: textMuted, fontFamily: 'Cairo'),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: Colors.white,
        indicatorColor: primary.withValues(alpha: 0.12),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          return TextStyle(
            fontFamily: 'Cairo',
            fontSize: 11,
            fontWeight: states.contains(WidgetState.selected) ? FontWeight.w700 : FontWeight.w400,
            color: states.contains(WidgetState.selected) ? primary : textMuted,
          );
        }),
      ),
      dividerTheme: const DividerThemeData(color: Color(0xFFe3e9e8)),
      chipTheme: ChipThemeData(
        backgroundColor: const Color(0xFFeef3f1),
        selectedColor: primary.withValues(alpha: 0.15),
        labelStyle: const TextStyle(fontFamily: 'Cairo', color: textDark),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
      dialogTheme: DialogThemeData(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        backgroundColor: Colors.white,
        titleTextStyle: const TextStyle(fontFamily: 'Cairo', fontSize: 17, fontWeight: FontWeight.w700, color: textDark),
      ),
      textTheme: base.textTheme.apply(fontFamily: 'Cairo', bodyColor: textDark, displayColor: textDark),
    );
  }
}
