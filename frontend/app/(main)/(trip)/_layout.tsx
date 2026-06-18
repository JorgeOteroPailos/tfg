import { useState, useEffect, useRef } from 'react';
import { Animated, Keyboard, View, Pressable, StyleSheet, Modal, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useSegments, Slot } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../../src/theme';
import { Colors } from '../../../constants/Colors';
import { TripProvider, useTrip, useTrips } from '../../../src/trips';
import { saveLastTripId, saveLastTripTab, clearLastTripId } from '../../../src/lastTrip';
import { GroupChatProvider, useTripChat } from '../../../src/groupChat';
import { Ionicons } from '@expo/vector-icons';
import { AiChatButton } from '../../../components/AiChatModal';


const TripContent = () => {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const { t } = useTranslation();
  const [moreVisible, setMoreVisible] = useState(false);
  const [backConfirmVisible, setBackConfirmVisible] = useState(false);
  const [leaveConfirmVisible, setLeaveConfirmVisible] = useState(false);
  const [leaveLastMemberConfirmVisible, setLeaveLastMemberConfirmVisible] = useState(false);
  const segments = useSegments();
  const activeTab = segments[segments.length - 1];
  const { trip } = useTrip();
  const pendingRequestCount = trip?.pendingRequests?.length ?? 0;
  const { unreadCount } = useTripChat();
  const { leaveTrip } = useTrips();
  const { bottom: safeBottom } = useSafeAreaInsets();

  const keyboardHeightRef = useRef<Animated.Value | null>(null);
  if (keyboardHeightRef.current === null) keyboardHeightRef.current = new Animated.Value(0);
  const keyboardHeight = keyboardHeightRef.current;
  const tabBarHeightRef = useRef(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', e => {
      // endCoordinates.height = keyboard only (no gesture bar).
      // Keyboard visual top = endCoordinates.height + safeBottom from screen bottom.
      // Content area ends tabBarHeight above screen bottom (tabBarHeight includes safeBottom padding).
      // Net overlap = endCoordinates.height + safeBottom - tabBarHeight.
      const target = Math.max(0, e.endCoordinates.height + safeBottom - tabBarHeightRef.current);
      Animated.timing(keyboardHeight, { toValue: target, duration: 200, useNativeDriver: false }).start();
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      Animated.timing(keyboardHeight, { toValue: 0, duration: 150, useNativeDriver: false }).start();
    });
    return () => { show.remove(); hide.remove(); };
  }, [keyboardHeight, safeBottom]);

  useEffect(() => {
    if (tripId) saveLastTripId(tripId);
  }, [tripId]);

  useEffect(() => {
    saveLastTripTab(activeTab);
  }, [activeTab]);

  const tabs = [
    { name: 'expenses', icon: 'receipt-outline', label: t('trip.expenses') },
    { name: 'events', icon: 'calendar-outline', label: t('trip.events') },
    { name: 'documents', icon: 'document-outline', label: t('trip.documents') },
    { name: 'members', icon: 'people-outline', label: t('trip.members') },
    { name: 'chat', icon: 'chatbubbles-outline', label: t('trip.chat') },
  ] as const;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>

      {/* ── Header ────────────────────────────────────────── */}
      <View style={[styles.header, { backgroundColor: theme.navBackground, borderBottomColor: theme.border }]}>
        <Pressable
          style={({ pressed }) => [styles.headerBtn, { backgroundColor: theme.uiBackground, borderColor: theme.border }, pressed && styles.pressed]}
          onPress={() => setBackConfirmVisible(true)}
        >
          <Ionicons name="home-outline" size={18} color={theme.icon} />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.title }]} numberOfLines={1}>
            {trip?.name ?? t('trip.noName')}
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.headerBtn, { backgroundColor: theme.uiBackground, borderColor: theme.border }, pressed && styles.pressed]}
          onPress={() => setMoreVisible(true)}
        >
          <Ionicons name="menu-outline" size={18} color={theme.icon} />
        </Pressable>
      </View>

      {/* ── Screen content ──────────────────────────────── */}
      <Animated.View style={[styles.content, { paddingBottom: keyboardHeight }]}>
        <Slot />
      </Animated.View>

      <AiChatButton tripId={tripId} isChatTab={activeTab === 'chat'} />

      {/* ── Tab bar ─────────────────────────────────────── */}
      <View onLayout={e => { tabBarHeightRef.current = e.nativeEvent.layout.height; }} style={[styles.tabBar, { backgroundColor: theme.navBackground }]}>
        {tabs.map(tab => {
          const isActive = tab.name === activeTab;
          const showChatBadge = tab.name === 'chat' && !isActive && unreadCount > 0;
          const showMembersBadge = tab.name === 'members' && !isActive && pendingRequestCount > 0;
          const showBadge = showChatBadge || showMembersBadge;
          const badgeCount = showChatBadge ? unreadCount : pendingRequestCount;
          const badgeColor = showChatBadge ? Colors.primary : Colors.warning;
          return (
            <Pressable
              key={tab.name}
              style={styles.tab}
              onPress={() => router.replace({ pathname: `/${tab.name}`, params: { tripId } })}
            >
              {isActive && (
                <View style={[
                  styles.tabGlow,
                  { backgroundColor: `${theme.tint}18`, boxShadow: `0 0 12px ${theme.tint}50` },
                ]} />
              )}
              <View>
                <Ionicons
                  name={tab.icon}
                  size={isActive ? 26 : 22}
                  color={isActive ? theme.tint : theme.icon}
                />
                {showBadge && (
                  <View style={[styles.badge, { backgroundColor: badgeColor, borderColor: theme.navBackground }]}>
                    <Text style={styles.badgeText} numberOfLines={1}>
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[
                styles.tabLabel,
                { color: isActive ? theme.tint : theme.icon },
                isActive && styles.tabLabelActive,
              ]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ── Back-home confirm ─────────────────────────────── */}
      <Modal visible={backConfirmVisible} transparent animationType="fade" onRequestClose={() => setBackConfirmVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setBackConfirmVisible(false)}>
          <Pressable onPress={() => {}} style={[styles.confirmBox, { backgroundColor: theme.tabBackground, borderColor: theme.border }]}>
            <View style={[styles.confirmIcon, { backgroundColor: `${theme.tint}18`, borderColor: `${theme.tint}35` }]}>
              <Ionicons name="home-outline" size={30} color={theme.tint} />
            </View>
            <Text style={[styles.confirmTitle, { color: theme.title }]}>{t('trip.backHomeTitle')}</Text>
            <Text style={[styles.confirmMsg, { color: theme.icon }]}>{t('trip.backHomeMessage')}</Text>
            <View style={styles.confirmBtns}>
              <Pressable
                style={[styles.confirmBtn, { borderColor: theme.border, borderWidth: 1 }]}
                onPress={() => setBackConfirmVisible(false)}
              >
                <Text style={[styles.confirmBtnText, { color: theme.text }]}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmBtn, { backgroundColor: theme.tint, boxShadow: `0 0 20px ${theme.tint}60` }]}
                onPress={() => { setBackConfirmVisible(false); router.replace('/main'); }}
              >
                <Ionicons name="home-outline" size={15} color="#fff" />
                <Text style={[styles.confirmBtnText, { color: '#fff', letterSpacing: 1 }]}>
                  {t('trip.backHomeConfirm').toUpperCase()}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Leave-trip confirm ───────────────────────────── */}
      <Modal visible={leaveConfirmVisible} transparent animationType="fade" onRequestClose={() => setLeaveConfirmVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setLeaveConfirmVisible(false)}>
          <Pressable onPress={() => {}} style={[styles.confirmBox, { backgroundColor: theme.tabBackground, borderColor: theme.border }]}>
            <View style={[styles.confirmIcon, { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.25)' }]}>
              <Ionicons name="exit-outline" size={30} color={Colors.warning} />
            </View>
            <Text style={[styles.confirmTitle, { color: theme.title }]}>{t('trip.leaveTitle')}</Text>
            <Text style={[styles.confirmMsg, { color: theme.icon }]}>{t('trip.leaveMessage')}</Text>
            <View style={styles.confirmBtns}>
              <Pressable
                style={[styles.confirmBtn, { borderColor: theme.border, borderWidth: 1 }]}
                onPress={() => setLeaveConfirmVisible(false)}
              >
                <Text style={[styles.confirmBtnText, { color: theme.text }]}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmBtn, { backgroundColor: Colors.warning, boxShadow: `0 0 20px rgba(239,68,68,0.5)` }]}
                onPress={async () => {
                  setLeaveConfirmVisible(false);
                  try {
                    await leaveTrip(tripId);
                  } catch { /* best-effort */ }
                  await clearLastTripId();
                  router.replace('/main');
                }}
              >
                <Ionicons name="exit-outline" size={15} color="#fff" />
                <Text style={[styles.confirmBtnText, { color: '#fff', letterSpacing: 1 }]}>
                  {t('trip.leaveConfirm').toUpperCase()}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Leave-trip last-member confirm ───────────────── */}
      <Modal visible={leaveLastMemberConfirmVisible} transparent animationType="fade" onRequestClose={() => setLeaveLastMemberConfirmVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setLeaveLastMemberConfirmVisible(false)}>
          <Pressable onPress={() => {}} style={[styles.confirmBox, { backgroundColor: theme.tabBackground, borderColor: theme.border }]}>
            <View style={[styles.confirmIcon, { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.35)' }]}>
              <Ionicons name="trash-outline" size={30} color={Colors.warning} />
            </View>
            <Text style={[styles.confirmTitle, { color: theme.title }]}>{t('trip.leaveLastMemberTitle')}</Text>
            <Text style={[styles.confirmMsg, { color: theme.icon }]}>{t('trip.leaveLastMemberMessage')}</Text>
            <View style={styles.confirmBtns}>
              <Pressable
                style={[styles.confirmBtn, { borderColor: theme.border, borderWidth: 1 }]}
                onPress={() => setLeaveLastMemberConfirmVisible(false)}
              >
                <Text style={[styles.confirmBtnText, { color: theme.text }]}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmBtn, { backgroundColor: Colors.warning, boxShadow: `0 0 20px rgba(239,68,68,0.5)` }]}
                onPress={async () => {
                  setLeaveLastMemberConfirmVisible(false);
                  try {
                    await leaveTrip(tripId);
                  } catch { /* best-effort */ }
                  await clearLastTripId();
                  router.replace('/main');
                }}
              >
                <Ionicons name="trash-outline" size={15} color="#fff" />
                <Text style={[styles.confirmBtnText, { color: '#fff', letterSpacing: 1 }]}>
                  {t('trip.leaveLastMemberConfirm').toUpperCase()}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── More bottom sheet ─────────────────────────────── */}
      <Modal visible={moreVisible} transparent animationType="slide" onRequestClose={() => setMoreVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setMoreVisible(false)}>
          <Pressable onPress={() => {}} style={[styles.sheet, { backgroundColor: theme.tabBackground, borderColor: theme.border }]}>
            <View style={[styles.sheetHandle, { backgroundColor: theme.tint, boxShadow: `0 0 8px ${theme.tint}` }]} />

            {[
              { icon: 'person-circle-outline' as const, label: t('nav.profile'), action: () => { setMoreVisible(false); router.push('/profile'); } },
              { icon: 'settings-outline' as const, label: t('nav.settings'), action: () => { setMoreVisible(false); router.push('/settings'); } },
            ].map(item => (
              <Pressable
                key={item.label}
                style={({ pressed }) => [styles.sheetRow, { borderBottomColor: theme.border }, pressed && styles.pressed]}
                onPress={item.action}
              >
                <View style={[styles.sheetIcon, { backgroundColor: `${theme.tint}18` }]}>
                  <Ionicons name={item.icon} size={20} color={theme.tint} />
                </View>
                <Text style={[styles.sheetLabel, { color: theme.title }]}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={15} color={theme.icon} style={{ opacity: 0.4 }} />
              </Pressable>
            ))}

            <Pressable
              style={({ pressed }) => [styles.sheetRow, { borderBottomWidth: 0 }, pressed && styles.pressed]}
              onPress={() => {
                setMoreVisible(false);
                if (trip?.members.length === 1) {
                  setLeaveLastMemberConfirmVisible(true);
                } else {
                  setLeaveConfirmVisible(true);
                }
              }}
            >
              <View style={[styles.sheetIcon, { backgroundColor: 'rgba(239,68,68,0.14)' }]}>
                <Ionicons name="exit-outline" size={20} color={Colors.warning} />
              </View>
              <Text style={[styles.sheetLabel, { color: Colors.warning }]}>{t('trip.leave')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const TripLayout = () => {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  return (
    <TripProvider tripId={tripId}>
      <GroupChatProvider tripId={tripId}>
        <TripContent />
      </GroupChatProvider>
    </TripProvider>
  );
};

export default TripLayout;

const styles = StyleSheet.create({
  container: { flex: 1 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 14,
    borderBottomWidth: 0.5,
    gap: 12,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    borderWidth: 0.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  content: { flex: 1 },

  tabBar: {
    flexDirection: 'row',
    paddingBottom: 50,
    paddingTop: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 4,
    gap: 3,
    position: 'relative',
  },
  tabGlow: {
    position: 'absolute',
    top: 4,
    width: 44,
    height: 44,
    borderRadius: 14,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  tabLabelActive: {
    fontWeight: '800',
  },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },

  confirmBox: {
    margin: 18,
    marginBottom: 40,
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    boxShadow: '0 0 60px rgba(168,85,247,0.2), 0 16px 40px rgba(0,0,0,0.5)',
  },
  confirmIcon: {
    width: 66,
    height: 66,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  confirmTitle: { fontSize: 20, fontWeight: '800', letterSpacing: 0.3 },
  confirmMsg: { fontSize: 14, fontWeight: '500', textAlign: 'center', lineHeight: 20, marginBottom: 6 },
  confirmBtns: { flexDirection: 'row', gap: 10, width: '100%' },
  confirmBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 15,
    borderRadius: 16,
  },
  confirmBtnText: { fontSize: 13, fontWeight: '800' },

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
});
