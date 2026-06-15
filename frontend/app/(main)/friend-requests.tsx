import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../src/theme';
import { Colors } from '../../constants/Colors';
import { useFriends, useFriendRequestsQuery } from '../../src/friends';
import UserAvatar from '../../components/UserAvatar';
import ThemedText from '../../components/ThemedText';
import type { components } from '../../src/generated/types';
import { friendKeys } from '../../src/queryKeys';
import { useQueryClient } from '@tanstack/react-query';

type FriendRequestSummary = components['schemas']['FriendRequestSummary'];

interface RequestCardProps {
  item: FriendRequestSummary;
  resolving: string | null;
  tint: string;
  cardBackground: string;
  border: string;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}

const RequestCard = React.memo(function RequestCard({
  item, resolving, tint, cardBackground, border, onAccept, onReject,
}: RequestCardProps) {
  const { t } = useTranslation();
  const isResolving = resolving === item.id;
  return (
    <View style={[styles.card, { backgroundColor: cardBackground, borderColor: border }]}>
      <View style={styles.cardTop}>
        <UserAvatar
          userId={item.sender.id}
          initials={item.sender.username.slice(0, 2).toUpperCase()}
          size={42}
          hasAvatar={item.sender.hasAvatar}
          style={{ backgroundColor: `${tint}30` }}
          textStyle={{ color: tint }}
        />
        <ThemedText style={styles.cardUsername}>{item.sender.username}</ThemedText>
      </View>
      <View style={styles.cardActions}>
        <Pressable
          style={[styles.acceptBtn, { backgroundColor: tint }, isResolving && styles.disabled]}
          onPress={() => onAccept(item.id)}
          disabled={resolving !== null}
        >
          {isResolving
            ? <ActivityIndicator size="small" color="#fff" />
            : <ThemedText style={styles.btnText}>{t('friends.accept')}</ThemedText>
          }
        </Pressable>
        <Pressable
          style={[styles.rejectBtn, { borderColor: Colors.warning }, isResolving && styles.disabled]}
          onPress={() => onReject(item.id)}
          disabled={resolving !== null}
        >
          <ThemedText style={[styles.btnText, { color: Colors.warning }]}>{t('friends.reject')}</ThemedText>
        </Pressable>
      </View>
    </View>
  );
});

const FriendRequestsScreen = () => {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const { resolveFriendRequest } = useFriends();
  const requestsQuery = useFriendRequestsQuery();
  const queryClient = useQueryClient();

  const [resolving, setResolving] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const handleResolve = useCallback(async (id: string, accepted: boolean) => {
    setResolving(id);
    setResolveError(null);
    try {
      await resolveFriendRequest(id, accepted);
      queryClient.setQueryData<FriendRequestSummary[]>(
        friendKeys.requests(),
        prev => prev?.filter(r => r.id !== id) ?? [],
      );
      if (accepted) queryClient.invalidateQueries({ queryKey: friendKeys.list() });
    } catch {
      setResolveError(t('friends.resolveError'));
    } finally {
      setResolving(null);
    }
  }, [resolveFriendRequest, queryClient, t]);

  const handleAccept = useCallback((id: string) => handleResolve(id, true), [handleResolve]);
  const handleReject = useCallback((id: string) => handleResolve(id, false), [handleResolve]);

  const renderItem = useCallback(({ item }: { item: FriendRequestSummary }) => (
    <RequestCard
      item={item}
      resolving={resolving}
      tint={theme.tint}
      cardBackground={theme.uiBackground}
      border={theme.border}
      onAccept={handleAccept}
      onReject={handleReject}
    />
  ), [resolving, theme, handleAccept, handleReject]);

  if (requestsQuery.isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.tint} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {resolveError && (
        <View style={[styles.errorBanner, { backgroundColor: Colors.warning }]}>
          <ThemedText style={styles.errorText}>{resolveError}</ThemedText>
        </View>
      )}
      <FlatList
        data={requestsQuery.data ?? []}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.centered}>
            <ThemedText style={styles.emptyText}>{t('friends.noRequests')}</ThemedText>
          </View>
        }
      />
    </View>
  );
};

export default FriendRequestsScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyText: { fontSize: 15, opacity: 0.6 },
  list: { padding: 16, gap: 12, paddingBottom: 20 },

  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardUsername: { fontSize: 16, fontWeight: '700', flex: 1 },
  cardActions: { flexDirection: 'row', gap: 10 },

  acceptBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  rejectBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  disabled: { opacity: 0.5 },

  errorBanner: {
    margin: 16,
    padding: 12,
    borderRadius: 8,
  },
  errorText: { color: '#fff', fontWeight: '600', textAlign: 'center' },
});
