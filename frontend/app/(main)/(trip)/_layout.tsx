import { useState } from 'react';
import { View, Pressable, StyleSheet, Modal } from 'react-native';
import { router, useLocalSearchParams, useSegments, Slot } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../../src/theme';
import { Colors } from '../../../constants/Colors';
import { TripProvider } from '../../../src/trips';
import { Ionicons } from '@expo/vector-icons';
import ThemedText from '../../../components/ThemedText';
import { AiChatButton } from '../../../components/AiChatModal';

const TripLayout = () => {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const { t } = useTranslation();
  const [moreVisible, setMoreVisible] = useState(false);
  const segments = useSegments();
  const activeTab = segments[segments.length - 1];

  const tabs = [
    { name: 'expenses', icon: 'receipt-outline', label: t('trip.expenses') },
    { name: 'events', icon: 'calendar-outline', label: t('trip.events') },
    { name: 'documents', icon: 'document-outline', label: t('trip.documents') },
    { name: 'members', icon: 'people-outline', label: t('trip.members') },
  ] as const;

  return (
    <TripProvider tripId={tripId}>
      <View style={styles.container}>

        {/* Contenido */}
        <View style={styles.content}>
          <Slot />
        </View>

        {/* AI Chat FAB */}
        <AiChatButton tripId={tripId} />

        {/* Tab bar */}
        <View style={[styles.tabBar, { backgroundColor: theme.navBackground }]}>
          {tabs.map(tab => {
            const isActive = tab.name === activeTab;
            return (
              <Pressable
                key={tab.name}
                style={styles.tab}
                onPress={() => router.replace({ pathname: `/${tab.name}`, params: { tripId } })}
              >
                <Ionicons
                  name={tab.icon}
                  size={isActive ? 28 : 24}
                  color={isActive ? theme.tint : theme.icon}
                />
                <ThemedText style={[styles.tabLabel, { color: isActive ? theme.tint : theme.icon, fontWeight: isActive ? '600' : 'normal' }]}>
                  {tab.label}
                </ThemedText>
              </Pressable>
            );
          })}

          {/* Más */}
          <Pressable style={styles.tab} onPress={() => setMoreVisible(true)}>
            <Ionicons name="menu-outline" size={24} color={theme.icon} />
            <ThemedText style={styles.tabLabel}>{t('trip.more')}</ThemedText>
          </Pressable>
        </View>

        {/* Modal más */}
        <Modal
          visible={moreVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setMoreVisible(false)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setMoreVisible(false)}
          >
            <Pressable
              onPress={() => {}}
              style={[styles.bottomSheet, { backgroundColor: theme.tabBackground }]}
            >
              <Pressable
                style={styles.sheetItem}
                onPress={() => {
                  setMoreVisible(false);
                  router.push('/profile');
                }}
              >
                <Ionicons name="person-outline" size={22} color={theme.text} />
                <ThemedText style={styles.sheetItemText}>{t('nav.profile')}</ThemedText>
              </Pressable>

              <Pressable
                style={styles.sheetItem}
                onPress={() => {
                  setMoreVisible(false);
                  router.push('/settings');
                }}
              >
                <Ionicons name="settings-outline" size={22} color={theme.text} />
                <ThemedText style={styles.sheetItemText}>{t('nav.settings')}</ThemedText>
              </Pressable>

              <Pressable
                style={styles.sheetItem}
                onPress={() => {
                  setMoreVisible(false);
                  router.push({ pathname: '/join-requests', params: { tripId } });
                }}
              >
                <Ionicons name="mail-outline" size={22} color={theme.text} />
                <ThemedText style={styles.sheetItemText}>{t('trip.requests')}</ThemedText>
              </Pressable>

              <Pressable
                style={[styles.sheetItem, { borderBottomWidth: 0 }]}
                onPress={() => {
                  setMoreVisible(false);
                  router.replace('/main');
                }}
              >
                <Ionicons name="arrow-back-outline" size={22} color="#cc475a" />
                <ThemedText style={[styles.sheetItemText, { color: '#cc475a' }]}>{t('trip.leave')}</ThemedText>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </TripProvider>
  );
};

export default TripLayout;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: 15
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e0e0e0',
  },
  headerButton: {
    padding: 4,
  },
  headerCenter: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 0.5,
    borderTopColor: '#e0e0e0',
    paddingBottom: 40,
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  tabLabel: {
    fontSize: 10,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  bottomSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingBottom: 32,
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e0e0e0',
  },
  sheetItemText: {
    fontSize: 16,
  },
});