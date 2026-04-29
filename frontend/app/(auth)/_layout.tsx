// app/(auth)/_layout.tsx
import { Stack } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { useAppTheme } from '../../src/theme';
import { useTranslation } from 'react-i18next';

export default function AuthLayout() {
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const { t } = useTranslation();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.navBackground },
        headerTintColor: theme.title,
        contentStyle: { backgroundColor: theme.background },
        animation: 'slide_from_right',
        animationDuration: 200,
        presentation: 'card',
        freezeOnBlur: false,
      }}>
      <Stack.Screen name="login" options={{ gestureEnabled: false, title: t('login') }} />
      <Stack.Screen name="register" options={{ gestureEnabled: false, title: t('register') }} />
    </Stack>
  );
}