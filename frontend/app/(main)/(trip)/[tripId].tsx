import React, { useEffect, useState } from 'react';
import { StyleSheet, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import ThemedText from '../../../components/ThemedText';
import { useAppTheme } from '../../../src/theme';
import { Colors } from '../../../constants/Colors';
import { useTrips } from '../../../src/trips';
import { components } from '../../../src/generated/types';

type TripDetail = components['schemas']['TripDetail'];

type TabKey = 'expenses' | 'events' | 'chat';

const TripDetailScreen = () => {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;

  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { getTrip } = useTrips();

  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('expenses');
  const [joinRequestsCount, setJoinRequestsCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getTrip(tripId);
        setTrip(data);
        setJoinRequestsCount(data.joinRequestsCount || 0);
      } catch (e) {
        console.error('Error cargando viaje:', e);
        router.back();
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tripId]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.tint} />
      </View>
    );
  }

  if (!trip) return null;

  return (
    <View style={styles.container}>
      {/* Título */}
      <ThemedText style={styles.title}>{trip.name}</ThemedText>

      {/* Botones de acción */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.tabBackground }]}
          onPress={() => {/* TODO: ir a miembros */}}
        >
          <ThemedText style={styles.actionText}>👥 {t('trip.members')}</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.tabBackground, opacity: joinRequestsCount === 0 ? 0.5 : 1 }]}
          disabled={joinRequestsCount === 0}
          onPress={() => {/* TODO: abrir modal de solicitudes */}}
        >
          <ThemedText style={styles.actionText}>📩 {t('trip.requests')} ({joinRequestsCount})</ThemedText>
        </TouchableOpacity>
      </View>

      {/* Pestañas */}
      <View style={styles.tabs}>
        {(['expenses', 'events', 'chat'] as TabKey[]).map(key => {
          const keyMap: Record<TabKey, string> = {
            expenses: 'trip.expenses',
            events: 'trip.events',
            chat: 'trip.chat',
          };
          return (
            <TouchableOpacity
              key={key}
              style={[
                styles.tab,
                activeTab === key && { borderBottomColor: theme.tint, borderBottomWidth: 2 },
              ]}
              onPress={() => setActiveTab(key)}
            >
              <ThemedText
                style={[
                  styles.tabText,
                  activeTab === key && { color: theme.tint, fontWeight: '600' },
                ]}
              >
                {t(keyMap[key])}
              </ThemedText>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Contenido de la pestaña */}
      <View style={styles.tabContent}>
        {activeTab === 'expenses' && <ThemedText>{t('trip.expenses')} (TODO)</ThemedText>}
        {activeTab === 'events' && <ThemedText>{t('trip.events')} (TODO)</ThemedText>}
        {activeTab === 'chat' && <ThemedText>{t('trip.chat')} (TODO)</ThemedText>}
      </View>
    </View>
  );
};

export default TripDetailScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionText: {
    fontSize: 13,
    fontWeight: '500',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 15,
  },
  tabContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});