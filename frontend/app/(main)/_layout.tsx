import { Stack } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { useAppTheme } from '../../src/theme';
import { useTranslation } from 'react-i18next';

export default function MainLayout() {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;

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
      <Stack.Screen name={t('home')} />
      <Stack.Screen name={t('calendar')} />
      <Stack.Screen name={t('profile')} />
      <Stack.Screen name={t('settings')} />
    </Stack>
  );
}