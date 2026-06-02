import React, { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../../src/theme';
import { Colors } from '../../../constants/Colors';
import { useTrip } from '../../../src/trips';
import { useInvitations } from '../../../src/invitations';
import { Ionicons } from '@expo/vector-icons';
import { useSidebar } from '../../../src/sidebar';
import ThemedText from '../../../components/ThemedText';
import { components } from '../../../src/generated/types';

type JoinRequestSummary = components['schemas']['JoinRequestSummary'];

const JoinRequestsScreen = () => {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const { trip, loading, reload } = useTrip();
  const { resolveJoinRequest } = useInvitations();
  const { setOpen } = useSidebar();

  const [resolving, setResolving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleResolve = async (requestId: string, accepted: boolean) => {
    if (!trip) return;
    setResolving(requestId);
    setError(null);
    try {
      await resolveJoinRequest(trip.id, requestId, accepted);
      await reload();
    } catch {
      setError(t('trip.resolveRequestError'));
    } finally {
      setResolving(null);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.navBackground, borderBottomColor: theme.border }]}>
          <Pressable onPress={() => router.back()} style={styles.headerButton}>
            <Ionicons name="chevron-back" size={26} color={theme.title} />
          </Pressable>
          <ThemedText style={[styles.headerTitle, { color: theme.title }]}>{t('trip.requests')}</ThemedText>
          <View style={styles.headerButton} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.tint} />
        </View>
      </View>
    );
  }

  const requests: JoinRequestSummary[] = trip?.pendingRequests ?? [];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.navBackground, borderBottomColor: theme.border }]}>
        <Pressable onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="chevron-back" size={26} color={theme.title} />
        </Pressable>
        <ThemedText style={[styles.headerTitle, { color: theme.title }]}>{t('trip.requests')}</ThemedText>
        <Pressable onPress={() => setOpen(true)} style={styles.headerButton}>
          <ThemedText style={[styles.hamburger, { color: theme.title }]}>☰</ThemedText>
        </Pressable>
      </View>

      {error && (
        <View style={[styles.errorBanner, { backgroundColor: Colors.warning }]}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </View>
      )}

      <FlatList
        data={requests}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: theme.tabBackground }]}>
            <ThemedText style={styles.username}>{item.requester.username}</ThemedText>
            <View style={styles.actions}>
              <Pressable
                style={[styles.button, { backgroundColor: theme.tint }, resolving === item.id && styles.disabled]}
                onPress={() => handleResolve(item.id, true)}
                disabled={resolving !== null}
              >
                {resolving === item.id
                  ? <ActivityIndicator size="small" color="white" />
                  : <ThemedText style={styles.buttonText}>{t('invitations.accept')}</ThemedText>}
              </Pressable>
              <Pressable
                style={[styles.button, styles.rejectButton, { borderColor: Colors.warning }, resolving === item.id && styles.disabled]}
                onPress={() => handleResolve(item.id, false)}
                disabled={resolving !== null}
              >
                <ThemedText style={[styles.buttonText, { color: Colors.warning }]}>{t('invitations.reject')}</ThemedText>
              </Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.centered}>
            <ThemedText style={styles.emptyText}>{t('trip.noRequests')}</ThemedText>
          </View>
        }
      />
    </View>
  );
};

export default JoinRequestsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
  },
  headerButton: {
    width: 40,
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
  },
  hamburger: {
    fontSize: 22,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  errorBanner: {
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
  },
  errorText: {
    color: 'white',
    fontWeight: '600',
    textAlign: 'center',
  },
  list: {
    padding: 16,
    gap: 12,
    paddingBottom: 20,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  disabled: {
    opacity: 0.5,
  },
  emptyText: {
    fontSize: 15,
    opacity: 0.6,
  },
});
