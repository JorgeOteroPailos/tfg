import { View, Pressable, StyleSheet } from 'react-native';
import { Link, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSidebar } from '../src/sidebar';
import { useAuth } from '../src/auth';
import { useAppTheme } from '../src/theme';
import { Colors } from '../constants/Colors';
import ThemedText from './ThemedText';

const Sidebar = () => {
  const { open, setOpen } = useSidebar();
  const { logout } = useAuth();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const { t } = useTranslation();

  if (!open) return null;

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    router.replace('/login');
  };

  return (
    <>
      {/* Overlay */}
      <Pressable
        style={styles.overlay}
        onPress={() => setOpen(false)}
      />

      {/* Panel */}
      <View style={[styles.sidebar, { backgroundColor: theme.tabBackground }]}>
        <Link href="/profile" asChild>
          <Pressable style={styles.item} onPress={() => setOpen(false)}>
            <ThemedText style={styles.itemText}>👤 {t('nav.profile')}</ThemedText>
          </Pressable>
        </Link>

        <Link href="/settings" asChild>
          <Pressable style={styles.item} onPress={() => setOpen(false)}>
            <ThemedText style={styles.itemText}>⚙️ {t('settings.title')}</ThemedText>
          </Pressable>
        </Link>

        <Link href="/calendar" asChild>
          <Pressable style={styles.item} onPress={() => setOpen(false)}>
            <ThemedText style={styles.itemText}>📅 {t('nav.calendar')}</ThemedText>
          </Pressable>
        </Link>

        <Pressable
          style={[styles.item, styles.logoutItem]}
          onPress={handleLogout}
        >
          <ThemedText style={[styles.itemText, { color: '#cc475a' }]}>
            🚪 {t('profile.logout')}
          </ThemedText>
        </Pressable>
      </View>
    </>
  );
};

export default Sidebar;

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 99,
  },
  sidebar: {
    position: 'absolute',
    top: 65,     
    right:0,
    width: 220,
    zIndex: 100,
    borderRadius: 8,
    margin: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
  },
  item: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  itemText: {
    fontSize: 14,
    fontWeight: '500',
  },
  logoutItem: {
    borderBottomWidth: 0,
  },
});