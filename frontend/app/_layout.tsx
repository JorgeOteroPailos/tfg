import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import '../i18n';

import { Colors } from '../constants/Colors';
import { AuthProvider } from '../src/auth';
import { ThemeProvider, useAppTheme } from '../src/theme';
import { applySavedLanguage } from '../src/preferences';

const RootNavigator = () => {
  const { t, ready } = useTranslation();
  const { themeName, isLoading } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;

  useEffect(() => {
    applySavedLanguage();
  }, []);

  if (!ready || isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: theme.background,
        }}
      >
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <AuthProvider>
      <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.navBackground },
          headerTintColor: theme.title,
          contentStyle: { backgroundColor: theme.background },
          animation: 'slide_from_right', // o 'slide_from_right' — prueba cuál va mejor
          animationDuration: 200,
          presentation: 'card',
          freezeOnBlur: false, // que no congele la pantalla al perder foco
        }}
      >
        <Stack.Screen name="index" options={{ title: t('home') }} />
        <Stack.Screen name="main" options={{ title: t('home') }} />
        <Stack.Screen name="calendar" options={{ title: t('calendar') }} />
        <Stack.Screen name="profile" options={{ title: t('profile') }} />
        <Stack.Screen name="settings" options={{ title: t('settings') }} />
        <Stack.Screen name="(auth)/login" options={{ title: t('login') }} />
        <Stack.Screen name="(auth)/register" options={{ title: t('register') }} />
      </Stack>
      </View>
    </AuthProvider>
  );
};

const RootLayout = () => {
  return (
    <ThemeProvider>
      <RootNavigator />
    </ThemeProvider>
  );
};

export default RootLayout;