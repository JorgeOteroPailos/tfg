import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import '../i18n';

import { Colors } from '../constants/Colors';
import { AuthProvider, useAuth } from '../src/auth';
import { ThemeProvider, useAppTheme } from '../src/theme';
import { applySavedLanguage } from '../src/preferences';
import { SidebarProvider } from '../src/sidebar';

const RootNavigator = () => {
  const { ready } = useTranslation();
  const { themeName, isLoading: themeLoading } = useAppTheme();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const theme = Colors[themeName] ?? Colors.light;

  useEffect(() => {
    applySavedLanguage();
  }, []);

  if (!ready || themeLoading || authLoading) {
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
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
      }}
    >
      {isAuthenticated ? (
        <Stack.Screen name="(main)" />
      ) : (
        <Stack.Screen name="(auth)" />
      )}
    </Stack>
  );
};

const RootLayout = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SidebarProvider>
          <RootNavigator />
        </SidebarProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default RootLayout;