import React from 'react';
import { StyleSheet, View, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../../src/theme';
import { Colors } from '../../../constants/Colors';
import { useTrip } from '../../../src/trips';
import ThemedText from '../../../components/ThemedText';

const MembersScreen = () => {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { trip, loading } = useTrip();
  const requestCount = trip?.pendingRequests?.length ?? 0;

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
      <FlatList
        data={trip.members ?? []}
        keyExtractor={item => item.id ?? ''}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Pressable
            style={[styles.requestsButton, { backgroundColor: theme.tabBackground }]}
            onPress={() => router.push({ pathname: '/join-requests', params: { tripId } })}
          >
            <Ionicons name="person-add-outline" size={20} color={theme.tint} />
            <ThemedText style={styles.requestsLabel}>{t('trip.requests')}</ThemedText>
            {requestCount > 0 && (
              <View style={[styles.badge, { backgroundColor: Colors.warning }]}>
                <ThemedText style={styles.badgeText}>{requestCount}</ThemedText>
              </View>
            )}
            <Ionicons name="chevron-forward" size={18} color={theme.icon} style={styles.chevron} />
          </Pressable>
        }
        renderItem={({ item }) => (
          <View style={[styles.memberCard, { backgroundColor: theme.tabBackground }]}>
            <ThemedText style={styles.memberName}>{item.username}</ThemedText>
          </View>
        )}
        ListFooterComponent={
          <Pressable
            style={[styles.addButton, { backgroundColor: theme.tint }]}
            onPress={() => router.push({ pathname: '/add-member', params: { tripId: trip.id } })}
          >
            <ThemedText style={styles.addButtonText}>+ {t('trip.addMember')}</ThemedText>
          </Pressable>
        }
      />
    </View>
  );
};

export default MembersScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    marginTop: 15
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    gap: 10,
    paddingBottom: 20,
  },
  memberCard: {
    padding: 16,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberName: {
    fontSize: 16,
    fontWeight: '500',
  },
  addButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  addButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  requestsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    gap: 10,
    marginBottom: 10,
  },
  requestsLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '700',
  },
  chevron: {
    marginLeft: 2,
  },
});