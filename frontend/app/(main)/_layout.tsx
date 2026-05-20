import { Stack } from 'expo-router';
import { TouchableOpacity, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../src/theme';
import { Colors } from '../../constants/Colors';
import { useSidebar } from '../../src/sidebar';
import Sidebar from '../../components/Sidebar';

export default function MainLayout() {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const { setOpen } = useSidebar();

  return (
    <View style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.navBackground },
          headerTintColor: theme.title,
          contentStyle: { backgroundColor: theme.background },
          animation: 'slide_from_right',
          headerRight: () => (
            <TouchableOpacity onPress={() => setOpen(true)} style={{ paddingHorizontal: 8 }}>
              <Text style={{ fontSize: 22, color: theme.title }}>☰</Text>
            </TouchableOpacity>
          ),
        }}
      >
        <Stack.Screen name="main" options={{ title: t('nav.home') }} />
        <Stack.Screen name="calendar" options={{ title: t('nav.calendar') }} />
        <Stack.Screen name="settings" options={{ title: t('settings.title') }} />
        <Stack.Screen name="(profile)/profile" options={{ title: t('nav.profile') }} />
        <Stack.Screen name="(profile)/qr" options={{ title: t('nav.yourQR') }} />
        <Stack.Screen name="(trip)" options={{ headerShown: false }} />
      </Stack>
      <Sidebar />
    </View>
  );
}