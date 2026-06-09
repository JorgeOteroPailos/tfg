import React, { useCallback, useEffect, useReducer } from 'react';
import { StyleSheet, View, FlatList, ActivityIndicator, Pressable, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router, useLocalSearchParams } from 'expo-router';
import { useAppTheme } from '../../../src/theme';
import { Colors } from '../../../constants/Colors';
import { useExpenses, type PastSettlement } from '../../../src/expenses';
import { useTrip } from '../../../src/trips';
import { useAuth } from '../../../src/auth';
import { Ionicons } from '@expo/vector-icons';

type State = { data: PastSettlement[] | null; loading: boolean; error: string | null };
type Action = { type: 'loading' } | { type: 'loaded'; data: PastSettlement[] } | { type: 'error'; error: string };
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'loading': return { ...state, loading: true, error: null };
    case 'loaded': return { data: action.data, loading: false, error: null };
    case 'error': return { ...state, loading: false, error: action.error };
    default: return state;
  }
}

const PastSettlementsScreen = () => {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { trip } = useTrip();
  const { userId: currentUserId } = useAuth();
  const { getPastSettlements } = useExpenses();

  const [state, dispatch] = useReducer(reducer, { data: null, loading: false, error: null });

  const usernameFor = useCallback(
    (id: string) => trip?.members?.find(m => m.id === id)?.username ?? '?',
    [trip?.members],
  );

  useEffect(() => {
    if (!tripId) return;
    dispatch({ type: 'loading' });
    getPastSettlements(tripId)
      .then(data => {
        const sorted = [...data].sort((a, b) => {
          if (!a.timestamp && !b.timestamp) return 0;
          if (!a.timestamp) return 1;
          if (!b.timestamp) return -1;
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        });
        dispatch({ type: 'loaded', data: sorted });
      })
      .catch(() => dispatch({ type: 'error', error: t('trip.unableLoadPastSettlements') }));
  }, [tripId, getPastSettlements, t]);

  const renderItem = useCallback(({ item }: { item: PastSettlement }) => {
    const fromMe = item.fromId === currentUserId;
    const toMe = item.toId === currentUserId;
    const dateStr = item.timestamp
      ? new Date(item.timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
      : null;

    return (
      <View style={[styles.card, { backgroundColor: theme.tabBackground }]}>
        <View style={styles.row}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: theme.text }, fromMe && styles.meText]} numberOfLines={1}>
              {usernameFor(item.fromId)}
            </Text>
            {fromMe && (
              <View style={[styles.meTag, { backgroundColor: `${theme.tint}20`, borderColor: `${theme.tint}40` }]}>
                <Text style={[styles.meTagText, { color: theme.tint }]}>{t('common.you').toUpperCase()}</Text>
              </View>
            )}
          </View>

          <View style={[styles.arrow, { backgroundColor: `${theme.tint}18` }]}>
            <Ionicons name="arrow-forward" size={12} color={theme.tint} />
          </View>

          <View style={[styles.nameRow, { flex: 1 }]}>
            <Text style={[styles.name, { color: theme.text }, toMe && styles.meText]} numberOfLines={1}>
              {usernameFor(item.toId)}
            </Text>
            {toMe && (
              <View style={[styles.meTag, { backgroundColor: `${theme.tint}20`, borderColor: `${theme.tint}40` }]}>
                <Text style={[styles.meTagText, { color: theme.tint }]}>{t('common.you').toUpperCase()}</Text>
              </View>
            )}
          </View>

          <Text style={[styles.amount, { color: theme.tint }]}>{item.amount.toFixed(2)}€</Text>
        </View>

        {dateStr && (
          <View style={styles.dateRow}>
            <Ionicons name="time-outline" size={11} color={theme.icon} style={{ opacity: 0.55 }} />
            <Text style={[styles.dateText, { color: theme.icon }]}>{dateStr}</Text>
          </View>
        )}
      </View>
    );
  }, [theme, usernameFor, currentUserId, t]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Pressable
        style={({ pressed }) => [styles.backRow, { borderBottomColor: theme.border }, pressed && styles.pressed]}
        onPress={() => router.back()}
      >
        <View style={[styles.backIconBox, { backgroundColor: `${theme.tint}18` }]}>
          <Ionicons name="receipt-outline" size={18} color={theme.tint} />
        </View>
        <Text style={[styles.backLabel, { color: theme.tint }]}>{t('trip.balances')}</Text>
        <Ionicons name="chevron-back" size={16} color={theme.tint} style={{ position: 'absolute', left: 12 }} />
      </Pressable>

      {state.loading && <ActivityIndicator size="large" color={theme.tint} style={styles.centered} />}
      {state.error && <Text style={[styles.emptyText, { color: theme.icon }]}>{state.error}</Text>}

      {!state.loading && !state.error && (
        <FlatList
          data={state.data ?? []}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<Text style={[styles.emptyText, { color: theme.icon }]}>{t('trip.noPastSettlements')}</Text>}
          renderItem={renderItem}
        />
      )}
    </View>
  );
};

export default PastSettlementsScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1 },
  pressed: { opacity: 0.65 },

  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  backIconBox: {
    width: 32,
    height: 32,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backLabel: {
    fontSize: 14,
    fontWeight: '700',
  },

  list: { padding: 16, gap: 12, paddingBottom: 28 },
  emptyText: { textAlign: 'center', marginTop: 28, fontSize: 14, fontWeight: '600', opacity: 0.6 },

  card: {
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },

  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  name: { fontSize: 16, fontWeight: '600', flexShrink: 1 },
  amount: { fontSize: 16, fontWeight: '600', marginLeft: 4 },
  arrow: { width: 24, height: 24, borderRadius: 7, justifyContent: 'center', alignItems: 'center' },

  dateText: { fontSize: 12, fontWeight: '500', opacity: 0.6 },

  meText: { fontWeight: '800' },
  meTag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, borderWidth: 1 },
  meTagText: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
});
