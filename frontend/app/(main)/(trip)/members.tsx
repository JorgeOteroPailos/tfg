import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../../../src/theme';
import { Colors } from '../../../constants/Colors';
import { useTrip } from '../../../src/trips';
import { useAuth } from '../../../src/auth';
import { useFriends } from '../../../src/friends';
import { AppError, ErrorCode } from '../../../src/AppError';
import UserAvatar from '../../../components/UserAvatar';

type Member = { id?: string; username: string; hasAvatar?: boolean };
type ReqStatus = 'idle' | 'sending' | 'sent' | 'conflict';

// ── Member popup ──────────────────────────────────────────────────────────────

interface MemberPopupProps {
  member: Member;
  isMe: boolean;
  reqStatus: ReqStatus;
  onClose: () => void;
  onAddFriend: () => void;
}

const MemberPopup = React.memo(function MemberPopup({ member, isMe, reqStatus, onClose, onAddFriend }: MemberPopupProps) {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const initial = member.username.charAt(0).toUpperCase();

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable onPress={() => {}} style={[styles.popup, { backgroundColor: theme.tabBackground, borderColor: theme.border }]}>

          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={20} color={theme.icon} />
          </Pressable>

          <View style={styles.popupAvatar}>
            <UserAvatar
              userId={member.id}
              initials={initial}
              size={80}
              hasAvatar={member.hasAvatar}
              forceShow
              style={{ backgroundColor: `${theme.tint}28` }}
              textStyle={{ color: theme.tint, fontSize: 32, fontWeight: '800' }}
            />
          </View>

          <Text style={[styles.popupName, { color: theme.title }]} numberOfLines={1}>{member.username}</Text>

          {isMe ? (
            <View style={[styles.meTag, { backgroundColor: `${theme.tint}18`, borderColor: `${theme.tint}35` }]}>
              <Text style={[styles.meTagText, { color: theme.tint }]}>{t('common.you').toUpperCase()}</Text>
            </View>
          ) : (
            <View style={styles.popupActions}>
              {reqStatus === 'sent' ? (
                <View style={[styles.sentRow, { backgroundColor: `${theme.tint}15`, borderColor: `${theme.tint}35` }]}>
                  <Ionicons name="checkmark-circle-outline" size={18} color={theme.tint} />
                  <Text style={[styles.sentText, { color: theme.tint }]}>{t('friends.requestSent')}</Text>
                </View>
              ) : reqStatus === 'conflict' ? (
                <View style={[styles.sentRow, { backgroundColor: `${theme.tint}15`, borderColor: `${theme.tint}35` }]}>
                  <Ionicons name="people-outline" size={18} color={theme.tint} />
                  <Text style={[styles.sentText, { color: theme.tint }]}>{t('friends.requestErrorConflict')}</Text>
                </View>
              ) : (
                <Pressable
                  style={({ pressed }) => [
                    styles.addFriendBtn,
                    { backgroundColor: theme.tint, opacity: pressed || reqStatus === 'sending' ? 0.8 : 1 },
                  ]}
                  onPress={onAddFriend}
                  disabled={reqStatus === 'sending'}
                >
                  {reqStatus === 'sending' ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="account-multiple-plus-outline" size={20} color="#fff" />
                      <Text style={styles.addFriendText}>{t('friends.inviteFriends')}</Text>
                    </>
                  )}
                </Pressable>
              )}
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
});

// ── Screen ────────────────────────────────────────────────────────────────────

const MembersScreen = () => {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { trip, loading } = useTrip();
  const { userId: currentUserId } = useAuth();
  const { sendFriendRequestById } = useFriends();
  const requestCount = trip?.pendingRequests?.length ?? 0;

  const [popup, setPopup] = useState<Member | null>(null);
  const [reqStatus, setReqStatus] = useState<ReqStatus>('idle');

  const openPopup = useCallback((member: Member) => {
    setPopup(member);
    setReqStatus('idle');
  }, []);

  const closePopup = useCallback(() => {
    setPopup(null);
    setReqStatus('idle');
  }, []);

  const handleAddFriend = useCallback(async () => {
    if (!popup?.id) return;
    setReqStatus('sending');
    try {
      await sendFriendRequestById(popup.id);
      setReqStatus('sent');
    } catch (e) {
      setReqStatus(e instanceof AppError && e.code === ErrorCode.CONFLICT ? 'conflict' : 'idle');
    }
  }, [popup, sendFriendRequestById]);

  const renderMemberItem = useCallback(
    ({ item }: { item: Member }) => {
      const initial = item.username.charAt(0).toUpperCase();
      const isMe = item.id === currentUserId;
      return (
        <Pressable
          style={({ pressed }) => [
            styles.card,
            { backgroundColor: theme.tabBackground, borderColor: theme.border },
            pressed && { opacity: 0.82, transform: [{ scale: 0.985 }] },
          ]}
          onPress={() => openPopup(item)}
        >
          <View style={[styles.stripe, { backgroundColor: theme.tint, opacity: isMe ? 1 : 0.4, boxShadow: isMe ? `0 0 8px ${theme.tint}` : undefined }]} />
          <UserAvatar
            userId={item.id}
            initials={initial}
            size={42}
            hasAvatar={item.hasAvatar}
            style={{ backgroundColor: `${theme.tint}${isMe ? '28' : '12'}` }}
            textStyle={[styles.initial, { color: theme.tint, opacity: isMe ? 1 : 0.7 }]}
          />
          <Text style={[styles.memberName, { color: theme.title }]} numberOfLines={1}>{item.username}</Text>
          {isMe ? (
            <View style={[styles.meTag, { backgroundColor: `${theme.tint}20`, borderColor: `${theme.tint}40` }]}>
              <Text style={[styles.meTagText, { color: theme.tint }]}>{t('common.you').toUpperCase()}</Text>
            </View>
          ) : (
            <Ionicons name="chevron-forward" size={14} color={theme.icon} style={{ opacity: 0.3 }} />
          )}
        </Pressable>
      );
    },
    [theme, currentUserId, t, openPopup]
  );

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.tint} />
      </View>
    );
  }

  if (!trip) return null;

  const isPopupMe = popup?.id === currentUserId;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList
        data={trip.members ?? []}
        keyExtractor={item => item.id ?? ''}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <Pressable
            style={({ pressed }) => [
              styles.requestsBtn,
              { backgroundColor: theme.tabBackground, borderColor: theme.border },
              pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] },
            ]}
            onPress={() => router.push({ pathname: '/join-requests', params: { tripId } })}
          >
            <View style={[styles.reqIcon, { backgroundColor: `${theme.tint}18` }]}>
              <Ionicons name="person-add-outline" size={20} color={theme.tint} />
            </View>
            <Text style={[styles.reqLabel, { color: theme.title }]}>{t('trip.requests')}</Text>
            {requestCount > 0 && (
              <View style={[styles.badge, { backgroundColor: Colors.warning, boxShadow: `0 0 10px ${Colors.warning}` }]}>
                <Text style={styles.badgeText}>{requestCount}</Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={16} color={theme.icon} style={{ opacity: 0.4 }} />
          </Pressable>
        }
        renderItem={renderMemberItem}
        ListFooterComponent={
          <Pressable
            style={({ pressed }) => [
              styles.addBtn,
              { backgroundColor: theme.tint, boxShadow: `0 0 28px ${theme.tint}55` },
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => router.push({ pathname: '/add-member', params: { tripId: trip.id } })}
          >
            <Ionicons name="person-add-outline" size={20} color="#fff" />
            <Text style={styles.addBtnText}>{t('trip.addMember').toUpperCase()}</Text>
          </Pressable>
        }
      />

      {popup && (
        <MemberPopup
          member={popup}
          isMe={isPopupMe}
          reqStatus={reqStatus}
          onClose={closePopup}
          onAddFriend={handleAddFriend}
        />
      )}
    </View>
  );
};

export default MembersScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, gap: 10, paddingBottom: 28 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    paddingVertical: 15,
    paddingRight: 16,
    gap: 12,
    boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
  },
  stripe: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  initial: { fontSize: 18, fontWeight: '800' },
  memberName: { flex: 1, fontSize: 15, fontWeight: '700' },
  meTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  meTagText: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },

  requestsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    marginBottom: 4,
    boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
  },
  reqIcon: { width: 38, height: 38, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  reqLabel: { flex: 1, fontSize: 15, fontWeight: '700' },

  badge: { minWidth: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '900' },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 17,
    borderRadius: 18,
    marginTop: 8,
  },
  addBtnText: { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 2 },

  // ── Popup ──────────────────────────────────────────────────────────────────
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  popup: {
    width: '100%',
    borderRadius: 24,
    borderWidth: 1,
    padding: 28,
    alignItems: 'center',
    gap: 14,
    boxShadow: '0 16px 48px rgba(0,0,0,0.35)',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  popupAvatar: { marginTop: 8 },
  popupName: { fontSize: 22, fontWeight: '800', letterSpacing: 0.2, textAlign: 'center' },
  popupActions: { width: '100%', marginTop: 4 },

  addFriendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  addFriendText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  sentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  sentText: { fontSize: 14, fontWeight: '600' },
});
