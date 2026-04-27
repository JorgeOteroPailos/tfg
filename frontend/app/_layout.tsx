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
  const { ready } = useTranslation();
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
      <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.navBackground },
        headerTintColor: theme.title,
        contentStyle: { backgroundColor: theme.background },
        animation: 'slide_from_right',
        animationDuration: 200,
        presentation: 'card',
        freezeOnBlur: false,
        headerShown: false,
      }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(main)" options={{ headerShown: false }} />
      </Stack>
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