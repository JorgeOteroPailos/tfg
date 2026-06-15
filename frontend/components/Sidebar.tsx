import { View, Pressable, StyleSheet, Text, Modal } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSidebar } from '../src/sidebar';
import { useAuth } from '../src/auth';
import { useAppTheme } from '../src/theme';
import { Colors } from '../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { useFriendRequestsQuery } from '../src/friends';

const Sidebar = () => {
  const { open, setOpen } = useSidebar();
  const { logout } = useAuth();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const { t } = useTranslation();
  const friendRequestsQuery = useFriendRequestsQuery();
  const pendingFriendRequests = friendRequestsQuery.data?.length ?? 0;

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    router.replace('/login');
  };

  const items = [
    { icon: 'person-circle-outline' as const, label: t('nav.profile'), href: '/profile' as const, badge: 0 },
    { icon: 'settings-outline' as const, label: t('settings.title'), href: '/settings' as const, badge: 0 },
    { icon: 'mail-outline' as const, label: t('nav.invitations'), href: '/invitations' as const, badge: 0 },
    { icon: 'people-outline' as const, label: t('nav.friends'), href: '/friends' as const, badge: pendingFriendRequests },
  ] as const;

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
      <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
        <Pressable onPress={() => {}} style={[styles.sheet, { backgroundColor: theme.tabBackground, borderColor: theme.border }]}>
          <View style={[styles.sheetHandle, { backgroundColor: theme.tint, boxShadow: `0 0 8px ${theme.tint}` }]} />

          {items.map(item => (
            <Pressable
              key={item.label}
              style={({ pressed }) => [styles.sheetRow, { borderBottomColor: theme.border }, pressed && styles.pressed]}
              onPress={() => { setOpen(false); router.push(item.href); }}
            >
              <View style={[styles.sheetIcon, { backgroundColor: `${theme.tint}18` }]}>
                <Ionicons name={item.icon} size={20} color={theme.tint} />
              </View>
              <Text style={[styles.sheetLabel, { color: theme.title }]}>{item.label}</Text>
              {item.badge > 0 && (
                <View style={[styles.badge, { backgroundColor: Colors.warning }]}>
                  <Text style={styles.badgeText}>{item.badge}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={15} color={theme.icon} style={{ opacity: 0.4 }} />
            </Pressable>
          ))}

          <Pressable
            style={({ pressed }) => [styles.sheetRow, { borderBottomWidth: 0 }, pressed && styles.pressed]}
            onPress={handleLogout}
          >
            <View style={[styles.sheetIcon, { backgroundColor: 'rgba(239,68,68,0.14)' }]}>
              <Ionicons name="log-out-outline" size={20} color={Colors.warning} />
            </View>
            <Text style={[styles.sheetLabel, { color: Colors.warning }]}>{t('profile.logout')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

export default Sidebar;

const styles = StyleSheet.create({
  pressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingBottom: 40,
    borderWidth: 1,
    borderBottomWidth: 0,
    boxShadow: '0 -8px 40px rgba(0,0,0,0.4)',
  },
  sheetHandle: {
    width: 40,
    height: 3,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 0.5,
  },
  sheetIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetLabel: { flex: 1, fontSize: 15, fontWeight: '700' },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    marginRight: 6,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
});
