import React, { useCallback, useEffect, useReducer } from 'react';
import { StyleSheet, View, Pressable, FlatList, Modal, ActivityIndicator, Text } from 'react-native';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../src/theme';
import { Colors } from '../../constants/Colors';
import { useCreateTripMutation, useTripsQuery } from '../../src/trips';
import { useInvitationsQuery } from '../../src/invitations';
import { components } from '../../src/generated/types';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ThemedInput from '../../components/ThemedInput';
import { AmbientBlobs, DotGrid } from '../../components/BackgroundTexture';

type TripSummary = components['schemas']['TripSummary'];

function nameToHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

function tripGradient(name: string): [string, string] {
  const hue = 200 + (nameToHue(name) % 110);
  return [`hsl(${hue}, 72%, 58%)`, `hsl(${hue + 20}, 85%, 38%)`];
}

function tripInitials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

type ModalState = { visible: boolean; name: string };
type ModalAction =
  | { type: 'open' }
  | { type: 'close' }
  | { type: 'set_name'; name: string };

const MODAL_INITIAL: ModalState = { visible: false, name: '' };

function modalReducer(state: ModalState, action: ModalAction): ModalState {
  switch (action.type) {
    case 'open': return { ...state, visible: true };
    case 'close': return MODAL_INITIAL;
    case 'set_name': return { ...state, name: action.name };
    default: return state;
  }
}

const Main = () => {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const isDark = themeName === 'dark';
  const navigation = useNavigation();

  const [modal, modalDispatch] = useReducer(modalReducer, MODAL_INITIAL);

  const tripsQuery = useTripsQuery();
  const invitationsQuery = useInvitationsQuery();
  const createTripMutation = useCreateTripMutation();

  const trips = tripsQuery.data ?? [];
  const invitationCount = invitationsQuery.data?.length ?? 0;

  useFocusEffect(
    useCallback(() => {
      tripsQuery.refetch();
      invitationsQuery.refetch();
    }, [tripsQuery.refetch, invitationsQuery.refetch])
  );

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <Pressable
          onPress={() => router.push('/invitations')}
          style={({ pressed }) => [
            styles.invBtn,
            { backgroundColor: theme.uiBackground, borderColor: theme.border },
            pressed && { opacity: 0.6 },
          ]}
        >
          <Ionicons name="mail-outline" size={20} color={theme.icon} />
          {invitationCount > 0 && (
            <View style={[styles.badge, { backgroundColor: Colors.warning }]}>
              <Text style={styles.badgeText}>{invitationCount}</Text>
            </View>
          )}
        </Pressable>
      ),
    });
  }, [invitationCount, theme, navigation]);

  const handleCreateTrip = async () => {
    if (!modal.name.trim()) return;
    try {
      await createTripMutation.mutateAsync({ name: modal.name.trim() });
      modalDispatch({ type: 'close' });
    } catch {
      /* ignore */
    }
  };

  const renderTripItem = useCallback(
    ({ item }: { item: TripSummary }) => (
      <Pressable
        style={({ pressed }) => [styles.tripCard, { backgroundColor: theme.tabBackground, borderColor: theme.border }, pressed && styles.pressed]}
        onPress={() => router.push({ pathname: '/expenses', params: { tripId: item.id } })}
      >
        {/* left glow stripe */}
        <View style={[styles.tripStripe, { backgroundColor: theme.tint, boxShadow: `0 0 10px ${theme.tint}` }]} />

        <LinearGradient colors={tripGradient(item.name)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tripIconWrap}>
          <Text style={styles.tripInitials}>{tripInitials(item.name)}</Text>
        </LinearGradient>

        <View style={styles.tripInfo}>
          <Text style={[styles.tripName, { color: theme.title }]} numberOfLines={1}>{item.name}</Text>
          <View style={styles.tripStats}>
            <View style={styles.tripStatLeft}>
              <Ionicons name="people-outline" size={11} color={theme.text} style={{ opacity: 0.5 }} />
              <Text style={[styles.tripStat, { color: theme.text }]}>{item.memberCount}</Text>
            </View>
            <Text style={[styles.tripStat, { color: theme.text }]}>{t('trip.totalSpent')}: {item.totalSpent.toFixed(2)}€</Text>
          </View>
        </View>

        <View style={[styles.tripChevron, { backgroundColor: theme.uiBackground }]}>
          <Ionicons name="chevron-forward" size={14} color={theme.tint} />
        </View>
      </Pressable>
    ),
    [theme, t]
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {isDark && <DotGrid color="rgba(168,85,247,0.055)" />}
      <AmbientBlobs tint={theme.tint} secondary={Colors.secondary} />

      <View style={styles.content}>
        {/* Action row */}
        <View style={styles.actionRow}>
          <Pressable
            style={({ pressed }) => [
              styles.actionCard, styles.actionCardCreate,
              { backgroundColor: theme.tint, boxShadow: `0 0 28px ${theme.tint}55` },
              pressed && styles.pressed,
            ]}
            onPress={() => modalDispatch({ type: 'open' })}
          >
            <View style={styles.actionIconRing}>
              <Ionicons name="add" size={24} color="#fff" />
            </View>
            <Text style={styles.actionLabel}>{t('trip.new').toUpperCase()}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.actionCard,
              { backgroundColor: theme.tabBackground, borderColor: theme.border, borderWidth: 1 },
              pressed && styles.pressed,
            ]}
            onPress={() => router.push('/join-trip')}
          >
            <View style={[styles.actionIconRing, { backgroundColor: `${theme.tint}22` }]}>
              <Ionicons name="enter-outline" size={24} color={theme.tint} />
            </View>
            <Text style={[styles.actionLabel, { color: theme.tint }]}>{t('trip.join').toUpperCase()}</Text>
          </Pressable>
        </View>

        {trips.length > 0 && (
          <Text style={[styles.sectionLabel, { color: theme.icon }]}>
            {t('nav.trips', 'TRIPS')}
          </Text>
        )}

        <FlatList
          data={trips}
          keyExtractor={item => item.id ?? ''}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={renderTripItem}
          ListEmptyComponent={
            tripsQuery.isLoading ? (
              <View style={styles.empty}>
                <ActivityIndicator color={theme.tint} />
              </View>
            ) : (
              <View style={styles.empty}>
                <View style={[styles.emptyIcon, { borderColor: `${theme.tint}30`, backgroundColor: `${theme.tint}0a` }]}>
                  <Ionicons name="map-outline" size={36} color={theme.tint} style={{ opacity: 0.5 }} />
                </View>
                <Text style={[styles.emptyText, { color: theme.icon }]}>
                  {t('trip.noTrips', 'No trips yet')}
                </Text>
                <Text style={[styles.emptyHint, { color: theme.icon }]}>
                  Create one to get started
                </Text>
              </View>
            )
          }
        />
      </View>

      {/* Create trip modal */}
      <Modal visible={modal.visible} transparent animationType="fade" onRequestClose={() => modalDispatch({ type: 'close' })}>
        <Pressable style={styles.overlay} onPress={() => modalDispatch({ type: 'close' })}>
          <Pressable onPress={() => {}} style={[styles.modalBox, { backgroundColor: theme.tabBackground, borderColor: theme.border }]}>
            <View style={styles.modalTop}>
              <View style={[styles.modalIcon, { backgroundColor: `${theme.tint}20`, borderColor: `${theme.tint}40` }]}>
                <Ionicons name="airplane-outline" size={24} color={theme.tint} />
              </View>
              <Text style={[styles.modalTitle, { color: theme.title }]}>{t('trip.new')}</Text>
            </View>

            <ThemedInput
              style={{ borderColor: theme.tint, borderWidth: 1.5 }}
              placeholder={t('trip.tripName')}
              value={modal.name}
              onChangeText={name => modalDispatch({ type: 'set_name', name })}
              autoFocus
              onSubmitEditing={handleCreateTrip}
            />

            <View style={styles.modalBtns}>
              <Pressable
                style={[styles.modalBtn, { borderColor: theme.border, borderWidth: 1 }]}
                onPress={() => modalDispatch({ type: 'close' })}
              >
                <Text style={[styles.modalBtnText, { color: theme.text }]}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: theme.tint, boxShadow: `0 0 20px ${theme.tint}55` }]}
                onPress={handleCreateTrip}
                disabled={createTripMutation.isPending || !modal.name.trim()}
              >
                {createTripMutation.isPending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={[styles.modalBtnText, { color: '#fff', fontWeight: '800', letterSpacing: 1 }]}>{t('common.create').toUpperCase()}</Text>
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
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },

  actionRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  actionCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 18,
    borderRadius: 18,
  },
  actionCardCreate: { borderRadius: 18 },
  actionIconRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 1.5,
  },

  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.5,
    marginBottom: 12,
    marginLeft: 4,
  },
  list: { gap: 10, paddingBottom: 28 },

  tripCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    paddingVertical: 16,
    paddingRight: 14,
    gap: 14,
    boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
  },
  tripStripe: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
  },
  tripIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  tripInitials: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  tripInfo: { flex: 1 },
  tripName: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  tripStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 },
  tripStatLeft: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tripStat: { fontSize: 12, fontWeight: '500', opacity: 0.55 },
  tripChevron: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  empty: { alignItems: 'center', paddingTop: 64, gap: 14 },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: { fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  emptyHint: { fontSize: 13, fontWeight: '500', opacity: 0.5 },

  invBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 0.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    width: '100%',
    borderRadius: 24,
    padding: 24,
    gap: 16,
    borderWidth: 1,
    boxShadow: '0 0 60px rgba(168,85,247,0.2), 0 16px 40px rgba(0,0,0,0.4)',
  },
  modalTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  modalIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: { fontSize: 22, fontWeight: '800', letterSpacing: 0.3 },
  modalBtns: { flexDirection: 'row', gap: 10 },
  modalBtn: { flex: 1, paddingVertical: 15, borderRadius: 14, alignItems: 'center' },
  modalBtnText: { fontSize: 14, fontWeight: '700' },
});
