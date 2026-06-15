import { Stack } from 'expo-router';
import { Suspense, useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../i18n';

import { Colors } from '../constants/Colors';
import { AuthProvider, useAuth } from '../src/auth';
import { ThemeProvider, useAppTheme } from '../src/theme';
import { DataSaverProvider } from '../src/dataSaver';
import { applySavedLanguage } from '../src/preferences';
import { SidebarProvider } from '../src/sidebar';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60 * 1000, retry: 1 } },
});

const RootNavigator = () => {
  const { ready } = useTranslation();
  const { themeName } = useAppTheme();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const theme = Colors[themeName] ?? Colors.light;

  useEffect(() => {
    applySavedLanguage();
  }, []);

  if (!ready || authLoading) {
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
        animation: 'fade',
        animationDuration: 200,
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
    <Suspense fallback={<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator /></View>}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <DataSaverProvider>
            <AuthProvider>
              <SidebarProvider>
                <RootNavigator />
              </SidebarProvider>
            </AuthProvider>
          </DataSaverProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </Suspense>
  );
};

export default RootLayout;