import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../../src/theme';
import { Colors } from '../../../constants/Colors';
import { useTrip } from '../../../src/trips';
import { useInvitations } from '../../../src/invitations';
import { Ionicons } from '@expo/vector-icons';
import ThemedText from '../../../components/ThemedText';
import { components } from '../../../src/generated/types';

type JoinRequestSummary = components['schemas']['JoinRequestSummary'];

interface JoinRequestCardProps {
  item: JoinRequestSummary;
  resolving: string | null;
  cardBackground: string;
  tint: string;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}
const JoinRequestCard = React.memo(function JoinRequestCard({
  item, resolving, cardBackground, tint, onAccept, onReject,
}: JoinRequestCardProps) {
  const { t } = useTranslation();
  const isResolving = resolving === item.id;
  return (
    <View style={[styles.card, { backgroundColor: cardBackground }]}>
      <ThemedText style={styles.username}>{item.requester.username}</ThemedText>
      <View style={styles.actions}>
        <Pressable
          style={[styles.button, { backgroundColor: tint }, isResolving && styles.disabled]}
          onPress={() => onAccept(item.id)}
          disabled={resolving !== null}
        >
          {isResolving
            ? <ActivityIndicator size="small" color="white" />
            : <ThemedText style={styles.buttonText}>{t('invitations.accept')}</ThemedText>}
        </Pressable>
        <Pressable
          style={[styles.button, styles.rejectButton, { borderColor: Colors.warning }, isResolving && styles.disabled]}
          onPress={() => onReject(item.id)}
          disabled={resolving !== null}
        >
          <ThemedText style={[styles.buttonText, { color: Colors.warning }]}>{t('invitations.reject')}</ThemedText>
        </Pressable>
      </View>
    </View>
  );
});

const JoinRequestsScreen = () => {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const { trip, loading, reload } = useTrip();
  const { resolveJoinRequest } = useInvitations();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();

  const [resolving, setResolving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleResolve = useCallback(async (requestId: string, accepted: boolean) => {
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
  }, [resolveJoinRequest, reload, t, trip]);

  const handleAccept = useCallback((id: string) => handleResolve(id, true), [handleResolve]);
  const handleReject = useCallback((id: string) => handleResolve(id, false), [handleResolve]);
  const renderRequestItem = useCallback(({ item }: { item: JoinRequestSummary }) => (
    <JoinRequestCard
      item={item}
      resolving={resolving}
      cardBackground={theme.tabBackground}
      tint={theme.tint}
      onAccept={handleAccept}
      onReject={handleReject}
    />
  ), [resolving, theme.tabBackground, theme.tint, handleAccept, handleReject]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.tint} />
        </View>
      </View>
    );
  }

  const requests: JoinRequestSummary[] = trip?.pendingRequests ?? [];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>

      {/* Back to members */}
      <Pressable
        style={({ pressed }) => [styles.backRow, { borderBottomColor: theme.border }, pressed && styles.pressed]}
        onPress={() => router.replace({ pathname: '/members', params: { tripId } })}
      >
        <View style={[styles.backIconBox, { backgroundColor: `${theme.tint}18` }]}>
          <Ionicons name="people-outline" size={18} color={theme.tint} />
        </View>
        <ThemedText style={[styles.backLabel, { color: theme.tint }]}>{t('trip.members')}</ThemedText>
        <Ionicons name="chevron-back" size={16} color={theme.tint} style={{ position: 'absolute', left: 12 }} />
      </Pressable>

      {error && (
        <View style={[styles.errorBanner, { backgroundColor: Colors.warning }]}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </View>
      )}

      <FlatList
        data={requests}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={renderRequestItem}
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
  pressed: { opacity: 0.65 },
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
