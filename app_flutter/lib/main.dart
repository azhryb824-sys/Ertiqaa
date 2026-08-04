import 'package:flutter/material.dart';
import 'app_localizations.dart';
import 'core/storage_service.dart';
import 'state/app_state.dart';
import 'theme.dart';
import 'widgets/app_shell.dart';
import 'screens/login_screen.dart';
import 'screens/splash_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  final app = AppState.instance;
  runApp(App(app: app));
}

class App extends StatelessWidget {
  final AppState app;
  const App({super.key, required this.app});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: app,
      builder: (context, _) {
        return MaterialApp(
          title: 'شموس للمصاعد',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.light,
          locale: const Locale('ar'),
          supportedLocales: AppLocalizations.supportedLocales,
          localizationsDelegates: AppLocalizations.delegates,
          home: _home(),
        );
      },
    );
  }

  Widget _home() {
    if (!app.isReady) return const SplashScreen();
    if (app.session == null) return const LoginScreen();
    return const AppShell();
  }
}
