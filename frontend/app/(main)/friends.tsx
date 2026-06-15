import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../src/theme';
import { Colors } from '../../constants/Colors';
import { useFriendsQuery, useFriendRequestsQuery, useRemoveFriend } from '../../src/friends';
import UserAvatar from '../../components/UserAvatar';
import ThemedText from '../../components/ThemedText';
import type { components } from '../../src/generated/types';

type UserProfile = components['schemas']['UserProfile'];

// ── Confirm remove modal ───────────────────────────────────────────────────────

interface ConfirmRemoveModalProps {
  friend: UserProfile | null;
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmRemoveModal = React.memo(function ConfirmRemoveModal({
  friend, deleting, onConfirm, onCancel,
}: ConfirmRemoveModalProps) {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;

  return (
    <Modal visible={!!friend} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable onPress={() => {}} style={[styles.modalBox, { backgroundColor: theme.tabBackground, borderColor: theme.border }]}>
          <Text style={[styles.modalTitle, { color: theme.title }]}>{t('friends.removeConfirmTitle')}</Text>

          {friend && (
            <View style={styles.friendPreview}>
              <UserAvatar
                userId={friend.id}
                initials={friend.username.slice(0, 2).toUpperCase()}
                size={56}
                hasAvatar={friend.hasAvatar}
                style={{ backgroundColor: `${theme.tint}28` }}
                textStyle={{ color: theme.tint, fontSize: 20, fontWeight: '800' }}
              />
              <Text style={[styles.friendName, { color: theme.title }]}>{friend.username}</Text>
            </View>
          )}

          <Text style={[styles.confirmText, { color: Colors.warning }]}>
            {t('friends.removeConfirmMessage', { username: friend?.username }).toUpperCase()}
          </Text>

          <View style={styles.modalBtns}>
            <Pressable
              style={[styles.modalBtn, { borderColor: theme.border, borderWidth: 1 }]}
              onPress={onCancel}
              disabled={deleting}
            >
              <Text style={{ color: theme.text, fontWeight: '700' }}>{t('friends.removeCancel')}</Text>
            </Pressable>
            <Pressable
              style={[styles.modalBtn, { backgroundColor: Colors.warning, boxShadow: `0 0 20px ${Colors.warning}55` }]}
              onPress={onConfirm}
              disabled={deleting}
            >
              {deleting
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={{ color: '#fff', fontWeight: '800', letterSpacing: 1 }}>{t('friends.removeConfirm').toUpperCase()}</Text>
              }
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
});

// ── Friend row ─────────────────────────────────────────────────────────────────

interface FriendRowProps {
  item: UserProfile;
  tint: string;
  border: string;
  uiBackground: string;
  onRemove: (item: UserProfile) => void;
  removing: string | null;
}

const FriendRow = React.memo(function FriendRow({ item, tint, border, uiBackground, onRemove, removing }: FriendRowProps) {
  const isRemoving = removing === item.id;
  return (
    <View style={[styles.row, { backgroundColor: uiBackground, borderColor: border }]}>
      <UserAvatar
        userId={item.id}
        initials={item.username.slice(0, 2).toUpperCase()}
        size={40}
        hasAvatar={item.hasAvatar}
        style={{ backgroundColor: `${tint}30` }}
        textStyle={{ color: tint }}
      />
      <Text style={[styles.username, { color: tint }]}>{item.username}</Text>
      <Pressable
        onPress={() => onRemove(item)}
        disabled={isRemoving}
        style={({ pressed }) => [styles.removeBtn, { opacity: pressed || isRemoving ? 0.5 : 1 }]}
      >
        {isRemoving
          ? <ActivityIndicator size="small" color={Colors.warning} />
          : <Ionicons name="person-remove-outline" size={18} color={Colors.warning} />
        }
      </Pressable>
    </View>
  );
});

// ── Screen ─────────────────────────────────────────────────────────────────────

const FriendsScreen = () => {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;

  const friendsQuery = useFriendsQuery();
  const requestsQuery = useFriendRequestsQuery();
  const removeFriend = useRemoveFriend();
  const [removing, setRemoving] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<UserProfile | null>(null);

  useFocusEffect(useCallback(() => {
    friendsQuery.refetch();
    requestsQuery.refetch();
  }, [friendsQuery.refetch, requestsQuery.refetch]));

  const handleRemove = useCallback((item: UserProfile) => {
    setConfirmTarget(item);
  }, []);

  const handleConfirmRemove = useCallback(async () => {
    if (!confirmTarget) return;
    const id = confirmTarget.id;
    setRemoving(id);
    try {
      await removeFriend(id);
      setConfirmTarget(null);
    } finally {
      setRemoving(null);
    }
  }, [confirmTarget, removeFriend]);

  const handleCancelRemove = useCallback(() => {
    setConfirmTarget(null);
  }, []);

  const pendingCount = requestsQuery.data?.length ?? 0;
  const friends = friendsQuery.data ?? [];

  const renderFriend = useCallback(({ item }: { item: UserProfile }) => (
    <FriendRow
      item={item}
      tint={theme.tint}
      border={theme.border}
      uiBackground={theme.uiBackground}
      onRemove={handleRemove}
      removing={removing}
    />
  ), [theme, handleRemove, removing]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Pending requests banner */}
      <Pressable
        style={[styles.requestsBanner, { backgroundColor: theme.uiBackground, borderColor: theme.border }]}
        onPress={() => router.push('/friend-requests')}
      >
        <View style={[styles.requestsIconWrap, { backgroundColor: `${theme.tint}18` }]}>
          <Ionicons name="mail-outline" size={20} color={theme.tint} />
        </View>
        <ThemedText style={styles.requestsLabel}>{t('friends.pendingRequests')}</ThemedText>
        {pendingCount > 0 && (
          <View style={[styles.badge, { backgroundColor: Colors.warning }]}>
            <Text style={styles.badgeText}>{pendingCount}</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={16} color={theme.icon} style={{ opacity: 0.4 }} />
      </Pressable>

      {/* Add friend button */}
      <Pressable
        style={({ pressed }) => [styles.addBtn, { backgroundColor: theme.tint, opacity: pressed ? 0.85 : 1 }]}
        onPress={() => router.push('/add-friend')}
      >
        <Ionicons name="person-add-outline" size={18} color="#fff" />
        <Text style={styles.addBtnText}>{t('friends.addFriend')}</Text>
      </Pressable>

      {/* Friends list */}
      {friendsQuery.isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.tint} />
        </View>
      ) : (
        <FlatList
          data={friends}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          renderItem={renderFriend}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Ionicons name="people-outline" size={40} color={theme.tint} style={{ opacity: 0.3 }} />
              <ThemedText style={styles.emptyText}>{t('friends.noFriends')}</ThemedText>
            </View>
          }
        />
      )}

      <ConfirmRemoveModal
        friend={confirmTarget}
        deleting={removing !== null}
        onConfirm={handleConfirmRemove}
        onCancel={handleCancelRemove}
      />
    </View>
  );
};

export default FriendsScreen;

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 48, gap: 12 },
  emptyText: { fontSize: 15, opacity: 0.55 },

  requestsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  requestsIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestsLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  list: { gap: 10, paddingBottom: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  username: { flex: 1, fontSize: 15, fontWeight: '600' },
  removeBtn: { padding: 6 },

  // ── Confirm modal ────────────────────────────────────────────────────────────
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalBox: {
    width: '100%',
    borderRadius: 24,
    padding: 24,
    gap: 12,
    borderWidth: 1,
    boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
  },
  modalTitle: { fontSize: 20, fontWeight: '800', letterSpacing: 0.3, marginBottom: 4 },
  friendPreview: { alignItems: 'center', gap: 10, paddingVertical: 8 },
  friendName: { fontSize: 18, fontWeight: '700' },
  confirmText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textAlign: 'center', marginVertical: 4 },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalBtn: { flex: 1, paddingVertical: 15, borderRadius: 14, alignItems: 'center' },
});
