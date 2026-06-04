import { View, Pressable, StyleSheet, Text, Platform } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSidebar } from '../src/sidebar';
import { useAuth } from '../src/auth';
import { useAppTheme } from '../src/theme';
import { Colors } from '../constants/Colors';
import { Ionicons } from '@expo/vector-icons';

const TOOLBAR_HEIGHT = Platform.OS === 'ios' ? 44 : 56;

const Sidebar = () => {
  const { open, setOpen } = useSidebar();
  const { logout } = useAuth();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const { t } = useTranslation();
  const { top: safeTop } = useSafeAreaInsets();

  if (!open) return null;

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    router.replace('/login');
  };

  const items = [
    { icon: 'person-circle-outline' as const, label: t('nav.profile'), href: '/profile' as const },
    { icon: 'settings-outline' as const, label: t('settings.title'), href: '/settings' as const },
    { icon: 'mail-outline' as const, label: t('nav.invitations'), href: '/invitations' as const },
  ] as const;

  const panelTop = safeTop + TOOLBAR_HEIGHT;

  return (
    <>
      <Pressable style={styles.overlay} onPress={() => setOpen(false)} />

      <View style={[styles.panel, { top: panelTop, backgroundColor: theme.tabBackground, borderColor: theme.border }]}>
        <View style={[styles.handle, { backgroundColor: theme.tint, boxShadow: `0 0 6px ${theme.tint}` }]} />

        {items.map(item => (
          <Pressable
            key={item.label}
            style={({ pressed }) => [styles.row, { borderBottomColor: theme.border }, pressed && styles.pressed]}
            onPress={() => { setOpen(false); router.push(item.href); }}
          >
            <View style={[styles.iconBox, { backgroundColor: `${theme.tint}18` }]}>
              <Ionicons name={item.icon} size={19} color={theme.tint} />
            </View>
            <Text style={[styles.label, { color: theme.title }]}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={14} color={theme.icon} style={{ opacity: 0.35 }} />
          </Pressable>
        ))}

        <Pressable
          style={({ pressed }) => [styles.row, { borderBottomWidth: 0 }, pressed && styles.pressed]}
          onPress={handleLogout}
        >
          <View style={[styles.iconBox, { backgroundColor: 'rgba(239,68,68,0.14)' }]}>
            <Ionicons name="log-out-outline" size={19} color={Colors.warning} />
          </View>
          <Text style={[styles.label, { color: Colors.warning }]}>{t('profile.logout')}</Text>
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
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  panel: {
    position: 'absolute',
    right: 0,
    width: 235,
    zIndex: 100,
    borderRadius: 20,
    margin: 10,
    overflow: 'hidden',
    borderWidth: 1,
    boxShadow: '0 0 40px rgba(0,0,0,0.4), 0 0 20px rgba(168,85,247,0.1)',
  },
  handle: {
    width: 36,
    height: 3,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
    opacity: 0.7,
  },
  pressed: { opacity: 0.65 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
});
