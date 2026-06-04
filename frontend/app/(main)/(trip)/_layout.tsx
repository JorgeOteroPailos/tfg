import { useState } from 'react';
import { View, Pressable, StyleSheet, Modal, Text } from 'react-native';
import { router, useLocalSearchParams, useSegments, Slot } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../../src/theme';
import { Colors } from '../../../constants/Colors';
import { TripProvider, useTrip } from '../../../src/trips';
import { Ionicons } from '@expo/vector-icons';
import { AiChatButton } from '../../../components/AiChatModal';

const TripContent = () => {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const { t } = useTranslation();
  const [moreVisible, setMoreVisible] = useState(false);
  const [backConfirmVisible, setBackConfirmVisible] = useState(false);
  const segments = useSegments();
  const activeTab = segments[segments.length - 1];
  const { trip } = useTrip();

  const tabs = [
    { name: 'expenses', icon: 'receipt-outline', label: t('trip.expenses') },
    { name: 'events', icon: 'calendar-outline', label: t('trip.events') },
    { name: 'documents', icon: 'document-outline', label: t('trip.documents') },
    { name: 'members', icon: 'people-outline', label: t('trip.members') },
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

      {/* ── Screen content ────────────────────────────────── */}
      <View style={styles.content}>
        <Slot />
      </View>

      <AiChatButton tripId={tripId} />

      {/* ── Tab bar ───────────────────────────────────────── */}
      <View style={[styles.tabBar, { backgroundColor: theme.navBackground, borderTopColor: theme.border }]}>
        {tabs.map(tab => {
          const isActive = tab.name === activeTab;
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
              <Ionicons
                name={tab.icon}
                size={isActive ? 26 : 22}
                color={isActive ? theme.tint : theme.icon}
              />
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

      {/* ── More bottom sheet ─────────────────────────────── */}
      <Modal visible={moreVisible} transparent animationType="slide" onRequestClose={() => setMoreVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setMoreVisible(false)}>
          <Pressable onPress={() => {}} style={[styles.sheet, { backgroundColor: theme.tabBackground, borderColor: theme.border }]}>
            <View style={[styles.sheetHandle, { backgroundColor: theme.tint, boxShadow: `0 0 8px ${theme.tint}` }]} />

            {[
              { icon: 'person-circle-outline' as const, label: t('nav.profile'), action: () => { setMoreVisible(false); router.push('/profile'); } },
              { icon: 'settings-outline' as const, label: t('nav.settings'), action: () => { setMoreVisible(false); router.push('/settings'); } },
              { icon: 'mail-outline' as const, label: t('trip.requests'), action: () => { setMoreVisible(false); router.push({ pathname: '/join-requests', params: { tripId } }); } },
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
              onPress={() => { setMoreVisible(false); router.replace('/main'); }}
            >
              <View style={[styles.sheetIcon, { backgroundColor: 'rgba(239,68,68,0.14)' }]}>
                <Ionicons name="arrow-back-outline" size={20} color={Colors.warning} />
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
      <TripContent />
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
    borderTopWidth: 0.5,
    paddingBottom: 50,
    paddingTop: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 8,
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
