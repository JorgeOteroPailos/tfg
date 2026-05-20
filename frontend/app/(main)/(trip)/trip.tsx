import React, { useState } from 'react';
import { StyleSheet, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import ThemedText from '../../../components/ThemedText';
import TripExpenses from '../../../components/TripExpenses';
import { useAppTheme } from '../../../src/theme';
import { Colors } from '../../../constants/Colors';
import { useTrip } from '../../../src/trips';

type TabKey = 'expenses' | 'events' | 'chat';

const TripDetailScreen = () => {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const { trip, loading } = useTrip();
  const [activeTab, setActiveTab] = useState<TabKey>('expenses');

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
          onPress={() => router.push('/members')}
        >
          <ThemedText style={styles.actionText}>👥 {t('trip.members')}</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionButton,
            { backgroundColor: theme.tabBackground },
            (trip.pendingRequests?.length ?? 0) === 0 && { opacity: 0.4 },
          ]}
          onPress={() => {/* TODO: modal requests */}}
          disabled={(trip.pendingRequests?.length ?? 0) === 0}
        >
          <ThemedText style={styles.actionText}>
            📩 {t('trip.requests')}{(trip.pendingRequests?.length ?? 0) > 0 && ` (${trip.pendingRequests?.length})`}
          </ThemedText>
        </TouchableOpacity>
      </View>

      {/* Pestañas */}
      <View style={styles.tabs}>
        {(['expenses', 'events', 'chat'] as TabKey[]).map(key => (
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
              {t(`trip.${key}`)}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </View>

      {/* Contenido pestaña */}
      <View style={styles.tabContent}>
        {activeTab === 'expenses' && <TripExpenses tripId={trip.id ?? ''} />}
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
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
});