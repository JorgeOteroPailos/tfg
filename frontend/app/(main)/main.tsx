import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { StyleSheet, View, Pressable, FlatList } from 'react-native';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import ThemedText from '../../components/ThemedText';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../src/theme';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../src/auth';
import { useTrips } from '../../src/trips';
import { useInvitations } from '../../src/invitations';
import { components } from '../../src/generated/types';
import { Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ThemedInput from '../../components/ThemedInput';

type TripSummary = components['schemas']['TripSummary'];

// --- Data loaded together from API ---
type DataState = { trips: TripSummary[]; invitationCount: number };
type DataAction =
  | { type: 'loaded'; trips: TripSummary[]; invitationCount: number }
  | { type: 'trip_added'; trip: TripSummary };

const DATA_INITIAL: DataState = { trips: [], invitationCount: 0 };

function dataReducer(state: DataState, action: DataAction): DataState {
  switch (action.type) {
    case 'loaded': return { trips: action.trips, invitationCount: action.invitationCount };
    case 'trip_added': return { ...state, trips: [...state.trips, action.trip] };
    default: return state;
  }
}

// --- Create-trip modal (all fields updated together) ---
type ModalState = { visible: boolean; name: string; creating: boolean };
type ModalAction =
  | { type: 'open' }
  | { type: 'close' }
  | { type: 'set_name'; name: string }
  | { type: 'start_creating' }
  | { type: 'done_creating' };

const MODAL_INITIAL: ModalState = { visible: false, name: '', creating: false };

function modalReducer(state: ModalState, action: ModalAction): ModalState {
  switch (action.type) {
    case 'open': return { ...state, visible: true };
    case 'close': return MODAL_INITIAL;
    case 'set_name': return { ...state, name: action.name };
    case 'start_creating': return { ...state, creating: true };
    case 'done_creating': return { ...state, creating: false };
    default: return state;
  }
}

const Main = () => {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const { logout } = useAuth();
  const navigation = useNavigation();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [data, dataDispatch] = useReducer(dataReducer, DATA_INITIAL);
  const [modal, modalDispatch] = useReducer(modalReducer, MODAL_INITIAL);

  const { listTrips, createTrip } = useTrips();
  const { getMyInvitations } = useInvitations();
  const initialLoadDone = useRef(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [tripsData, invitationsData] = await Promise.all([
          listTrips(),
          getMyInvitations(),
        ]);
        dataDispatch({ type: 'loaded', trips: tripsData, invitationCount: invitationsData.length });
      } catch (e) {
        router.replace('/login');
      }
    };

    load();
    initialLoadDone.current = true;
  }, [listTrips, getMyInvitations]);

  useFocusEffect(
    useCallback(() => {
      if (!initialLoadDone.current) return;
      Promise.all([listTrips(), getMyInvitations()])
        .then(([tripsData, invitationsData]) => {
          dataDispatch({ type: 'loaded', trips: tripsData, invitationCount: invitationsData.length });
        })
        .catch(() => {});
    }, [listTrips, getMyInvitations])
  );

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <Pressable style={styles.invitationsButton} onPress={() => router.push('/invitations')}>
          <Ionicons name="mail-outline" size={24} color={theme.title} />
          {data.invitationCount > 0 && (
            <View style={styles.badge}>
              <ThemedText style={styles.badgeText}>{data.invitationCount}</ThemedText>
            </View>
          )}
        </Pressable>
      ),
    });
  }, [data.invitationCount, theme, navigation]);

  const handleCreateTrip = async () => {
    if (!modal.name.trim()) return;
    try {
      modalDispatch({ type: 'start_creating' });
      const { id } = await createTrip({ name: modal.name.trim() });
      dataDispatch({ type: 'trip_added', trip: { id, name: modal.name.trim() } });
      modalDispatch({ type: 'close' });
    } catch (e) {
      console.error('Error creando viaje:', e);
    } finally {
      modalDispatch({ type: 'done_creating' });
    }
  };

  //TODO  ver pq no se usa
  const handleLogout = async () => {
    try {
      await logout();
      router.replace('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const tripCardStyle = useMemo(
    () => [styles.tripCard, { backgroundColor: theme.tabBackground }] as const,
    [theme.tabBackground]
  );
  const renderTripItem = useCallback(
    ({ item }: { item: TripSummary }) => (
      <Pressable
        style={tripCardStyle}
        onPress={() => router.push({ pathname: '/expenses', params: { tripId: item.id } })}
      >
        <View style={styles.tripContent}>
          <ThemedText style={styles.tripName}>{item.name}</ThemedText>
        </View>
        <ThemedText style={styles.tripArrow}>→</ThemedText>
      </Pressable>
    ),
    [tripCardStyle]
  );

  return (
    <View style={styles.container}>
      {/* Main Content */}
      <View style={styles.content}>
        {/* Action Cards Row */}
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.actionCard, { backgroundColor: theme.tint }]}
            onPress={() => modalDispatch({ type: 'open' })}
          >
            <ThemedText style={styles.actionCardTitle}>{t('trip.new')}</ThemedText>
            <View style={styles.actionCardIcon}>
              <ThemedText style={styles.actionCardIconText}>+</ThemedText>
            </View>
          </Pressable>

          <Pressable
            style={[styles.actionCard, { backgroundColor: theme.tabBackground }]}
            onPress={() => router.push('/join-trip')}
          >
            <ThemedText style={styles.actionCardTitleSecondary}>{t('trip.join')}</ThemedText>
            <View style={[styles.actionCardIcon, { backgroundColor: 'rgba(0,0,0,0.08)' }]}>
              <Ionicons name="enter-outline" size={20} color={theme.tint} />
            </View>
          </Pressable>
        </View>

        {/* Trips List */}
        <FlatList
          data={data.trips}
          keyExtractor={item => item.id ?? ''}
          scrollEnabled={true}
          contentContainerStyle={styles.tripsList}
          renderItem={renderTripItem}
        />
      </View>

      {/* Overlay to close the sidebar when clicking outside */}
      {sidebarOpen && (
        <Pressable
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setSidebarOpen(false)}
        />
      )}
      <Modal
        visible={modal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => modalDispatch({ type: 'close' })}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => modalDispatch({ type: 'close' })}
        >
          <Pressable onPress={() => {}} style={[styles.modalBox, { backgroundColor: theme.tabBackground }]}>
            <ThemedText style={styles.modalTitle}>{t('trip.new')}</ThemedText>

            <ThemedInput
              style={[styles.modalInput, { color: theme.text, borderColor: theme.tint }]}
              placeholder={t('trip.tripName')}
              placeholderTextColor={theme.icon}
              value={modal.name}
              onChangeText={(name) => modalDispatch({ type: 'set_name', name })}
              autoFocus
              onSubmitEditing={handleCreateTrip}
            />

            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => modalDispatch({ type: 'close' })}
              >
                <ThemedText>{t('common.cancel')}</ThemedText>
              </Pressable>

              <Pressable
                style={[styles.modalButton, { backgroundColor: theme.tint }]}
                onPress={handleCreateTrip}
                disabled={modal.creating || !modal.name.trim()}
              >
                {modal.creating
                  ? <ActivityIndicator color="white" />
                  : <ThemedText style={{ color: 'white', fontWeight: '600' }}>{t('common.create')}</ThemedText>
                }
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

    </View>
  );
};

export default Main;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  menuButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  menuIcon: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 40,
  },
  sidebar: {
    position: 'absolute',
    top: 60,
    left: 0,
    width: 220,
    zIndex: 100,
    borderRadius: 8,
    marginHorizontal: 12,
    marginTop: 4,
    overflow: 'hidden',
    boxShadow: '2px 4px 4px rgba(0, 0, 0, 0.15)',
  },
  sidebarItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sidebarItemText: {
    fontSize: 14,
    fontWeight: '500',
  },
  logoutItem: {
    borderBottomWidth: 0,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99,
  },
  content: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  tripCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    borderRadius: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  actionCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    minHeight: 60,
  },
  actionCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: 'white',
    flexShrink: 1,
  },
  actionCardTitleSecondary: {
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
  actionCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionCardIconText: {
    fontSize: 22,
    color: 'white',
    fontWeight: 'bold',
  },
  tripsList: {
    paddingBottom: 20,
  },
  tripContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  tripIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  tripName: {
    fontSize: 16,
    fontWeight: '500',
  },
  tripArrow: {
    fontSize: 20,
    marginLeft: 12,
    opacity: 0.6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    width: '80%',
    borderRadius: 16,
    padding: 24,
    gap: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalInput: {
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  cancelButton: {
    backgroundColor: 'transparent',
  },
  invitationsButton: {
    paddingHorizontal: 8,
    paddingTop: 6,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#d9534f',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
});
