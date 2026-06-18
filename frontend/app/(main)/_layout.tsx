import { Stack } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../src/theme';
import { Colors } from '../../constants/Colors';
import { useSidebar } from '../../src/sidebar';
import Sidebar from '../../components/Sidebar';
import { Ionicons } from '@expo/vector-icons';

export const unstable_settings = { initialRouteName: 'index' };

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
          headerShadowVisible: false,
          headerRight: () => (
            <Pressable
              onPress={() => setOpen(true)}
              style={({ pressed }) => [
                {
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: theme.uiBackground,
                  borderWidth: 0.5,
                  borderColor: theme.border,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 4,
                  opacity: pressed ? 0.6 : 1,
                },
              ]}
            >
              <Ionicons name="menu-outline" size={20} color={theme.icon} />
            </Pressable>
          ),
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="main" options={{ title: t('nav.home'), headerTitleAlign: 'center' }} />
        <Stack.Screen name="invitations" options={{ title: t('nav.invitations') }} />
        <Stack.Screen name="create-trip" options={{ headerShown: false }} />
        <Stack.Screen name="join-trip" options={{ headerShown: false }} />
        <Stack.Screen name="scan-qr" options={{ title: t('trip.scanQr'), headerRight: () => null }} />
        <Stack.Screen name="settings" options={{ title: t('settings.title') }} />
        <Stack.Screen name="(profile)/profile" options={{ title: t('nav.profile') }} />
        <Stack.Screen name="(trip)" options={{ headerShown: false, animation: 'fade', animationDuration: 200 }} />
        <Stack.Screen name="friends" options={{ title: t('nav.friends') }} />
        <Stack.Screen name="friend-requests" options={{ title: t('friends.requests') }} />
        <Stack.Screen name="add-friend" options={{ title: t('friends.addFriend') }} />
      </Stack>
      <Sidebar />
    </View>
  );
}
