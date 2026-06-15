import React, { useState, useReducer, useCallback } from 'react';
import { StyleSheet, View, Pressable, ActivityIndicator, ScrollView, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import QRCode from 'react-native-qrcode-svg';
import { useAppTheme } from '../../../src/theme';
import { Colors } from '../../../constants/Colors';
import { useInvitations } from '../../../src/invitations';
import { useFriendsQuery, useInviteFriendToTrip } from '../../../src/friends';
import { Ionicons } from '@expo/vector-icons';
import ThemedText from '../../../components/ThemedText';
import ThemedInput from '../../../components/ThemedInput';
import UserAvatar from '../../../components/UserAvatar';
import * as Clipboard from 'expo-clipboard';
import type { components } from '../../../src/generated/types';

type UserProfile = components['schemas']['UserProfile'];

type InviteState = { userId: string; sending: boolean; success: boolean; error: string | null };
type InviteAction =
  | { type: 'set_user_id'; value: string }
  | { type: 'start' }
  | { type: 'done' }
  | { type: 'fail'; error: string };
function inviteReducer(state: InviteState, action: InviteAction): InviteState {
  switch (action.type) {
    case 'set_user_id': return { ...state, userId: action.value, success: false, error: null };
    case 'start': return { ...state, sending: true, success: false, error: null };
    case 'done': return { ...state, sending: false, success: true, userId: '' };
    case 'fail': return { ...state, sending: false, error: action.error };
    default: return state;
  }
}

const AddMemberScreen = () => {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { inviteUser } = useInvitations();

  const friendsQuery = useFriendsQuery();
  const inviteFriendToTrip = useInviteFriendToTrip();
  const [invitingFriend, setInvitingFriend] = useState<string | null>(null);
  const [friendInviteStatus, setFriendInviteStatus] = useState<Record<string, 'sent' | 'error'>>({});

  const handleInviteFriend = useCallback(async (friend: UserProfile) => {
    setInvitingFriend(friend.id);
    try {
      await inviteFriendToTrip(friend.id, tripId);
      setFriendInviteStatus(prev => ({ ...prev, [friend.id]: 'sent' }));
    } catch {
      setFriendInviteStatus(prev => ({ ...prev, [friend.id]: 'error' }));
    } finally {
      setInvitingFriend(null);
    }
  }, [inviteFriendToTrip, tripId]);

  const [invite, inviteDispatch] = useReducer(inviteReducer, { userId: '', sending: false, success: false, error: null });
  const [copied, setCopied] = useState(false);

  const handleCopyTripId = async () => {
    if (!tripId) return;
    await Clipboard.setStringAsync(tripId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInvite = async () => {
    if (!invite.userId.trim()) return;
    inviteDispatch({ type: 'start' });
    try {
      await inviteUser(invite.userId.trim(), tripId);
      inviteDispatch({ type: 'done' });
    } catch {
      inviteDispatch({ type: 'fail', error: t('trip.inviteError') });
    }
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Trip ID card */}
      <View style={[styles.infoCard, { backgroundColor: theme.uiBackground, borderColor: theme.border }]}>
        <View style={styles.infoRow}>
          <View style={[styles.iconBadge, { backgroundColor: theme.background }]}>
            <Ionicons name="finger-print-outline" size={18} color={Colors.primary} />
          </View>
          <View style={styles.infoText}>
            <ThemedText style={styles.infoLabel}>{t('trip.tripId')}</ThemedText>
            <ThemedText style={styles.infoValue} numberOfLines={1} ellipsizeMode="middle">
              {tripId ?? t('common.notAvailable')}
            </ThemedText>
          </View>
          {tripId && (
            <Pressable
              onPress={handleCopyTripId}
              style={({ pressed }) => [
                styles.copyButton,
                { backgroundColor: copied ? Colors.primary : theme.background, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Ionicons
                name={copied ? 'checkmark-outline' : 'copy-outline'}
                size={16}
                color={copied ? '#ffffff' : Colors.primary}
              />
            </Pressable>
          )}
        </View>
      </View>

      {/* QR card */}
      <View style={[styles.qrCard, { backgroundColor: theme.uiBackground, borderColor: theme.border }]}>
        <ThemedText title style={styles.qrTitle}>{t('trip.tripQrCode')}</ThemedText>
        <View style={styles.qrBox}>
          <QRCode value={tripId} size={180} backgroundColor="white" color="black" />
        </View>
        <ThemedText style={[styles.qrHint, { color: theme.text }]}>{t('trip.tripQrHint')}</ThemedText>
      </View>

      {/* Invite by user ID */}
      <View style={[styles.infoCard, { backgroundColor: theme.uiBackground, borderColor: theme.border }]}>
        <View style={styles.infoRow}>
          <View style={[styles.iconBadge, { backgroundColor: theme.background }]}>
            <Ionicons name="person-add-outline" size={18} color={Colors.primary} />
          </View>
          <View style={styles.infoText}>
            <ThemedText style={styles.infoLabel}>{t('trip.inviteByUserId')}</ThemedText>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <View style={styles.inviteBody}>
          <ThemedInput
            placeholder={t('trip.enterUserId')}
            placeholderTextColor={theme.icon}
            value={invite.userId}
            onChangeText={value => inviteDispatch({ type: 'set_user_id', value })}
            autoCapitalize="none"
          />

          {invite.success && (
            <ThemedText style={styles.successText}>{t('trip.inviteSent')}</ThemedText>
          )}
          {invite.error && (
            <ThemedText style={styles.errorText}>{invite.error}</ThemedText>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: (invite.sending || !invite.userId.trim()) ? `${theme.tint}70` : theme.tint, opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={handleInvite}
            disabled={invite.sending || !invite.userId.trim()}
          >
            {invite.sending ? (
              <ActivityIndicator color="white" />
            ) : (
              <View style={styles.primaryButtonContent}>
                <Ionicons name="send-outline" size={16} color="white" />
                <ThemedText style={styles.primaryButtonText}>{t('trip.sendInvite')}</ThemedText>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* Friends quick-invite */}
      {(friendsQuery.data?.length ?? 0) > 0 && (
        <View style={[styles.infoCard, { backgroundColor: theme.uiBackground, borderColor: theme.border }]}>
          <View style={styles.infoRow}>
            <View style={[styles.iconBadge, { backgroundColor: theme.background }]}>
              <Ionicons name="people-outline" size={18} color={Colors.primary} />
            </View>
            <View style={styles.infoText}>
              <ThemedText style={styles.infoLabel}>{t('friends.inviteFromFriends')}</ThemedText>
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.inviteBody}>
            {friendsQuery.data!.map(friend => {
              const status = friendInviteStatus[friend.id];
              const isSending = invitingFriend === friend.id;
              return (
                <View key={friend.id} style={styles.friendRow}>
                  <UserAvatar
                    userId={friend.id}
                    initials={friend.username.slice(0, 2).toUpperCase()}
                    size={36}
                    hasAvatar={friend.hasAvatar}
                    style={{ backgroundColor: `${theme.tint}30` }}
                    textStyle={{ color: theme.tint }}
                  />
                  <Text style={[styles.friendName, { color: theme.title }]} numberOfLines={1}>{friend.username}</Text>
                  {status === 'sent' ? (
                    <View style={[styles.sentBadge, { backgroundColor: '#4caf5022', borderColor: '#4caf50' }]}>
                      <Ionicons name="checkmark-outline" size={14} color="#4caf50" />
                      <Text style={[styles.sentText, { color: '#4caf50' }]}>{t('trip.inviteSent')}</Text>
                    </View>
                  ) : status === 'error' ? (
                    <Text style={styles.friendErrorText}>{t('trip.inviteError')}</Text>
                  ) : (
                    <Pressable
                      style={({ pressed }) => [
                        styles.friendInviteBtn,
                        { backgroundColor: theme.tint, opacity: (pressed || isSending) ? 0.7 : 1 },
                      ]}
                      onPress={() => handleInviteFriend(friend)}
                      disabled={isSending || invitingFriend !== null}
                    >
                      {isSending
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Ionicons name="send-outline" size={14} color="#fff" />
                      }
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Scan QR button */}
      <Pressable
        style={({ pressed }) => [
          styles.secondaryButton,
          { borderColor: theme.tint, opacity: pressed ? 0.8 : 1 },
        ]}
        onPress={() => router.push({ pathname: '/scan-qr', params: { mode: 'invite', tripId } })}
      >
        <Ionicons name="qr-code-outline" size={20} color={theme.tint} />
        <ThemedText style={[styles.secondaryButtonText, { color: theme.tint }]}>
          {t('trip.scanQr')}
        </ThemedText>
      </Pressable>
    </ScrollView>
  );
};

export default AddMemberScreen;

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 32,
    gap: 16,
  },
  infoCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  copyButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
  },
  inviteBody: {
    padding: 16,
    gap: 10,
  },
  successText: {
    color: '#4caf50',
    textAlign: 'center',
    fontSize: 14,
  },
  errorText: {
    color: '#d9534f',
    textAlign: 'center',
    fontSize: 14,
  },
  primaryButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  secondaryButtonText: {
    fontWeight: '600',
    fontSize: 16,
  },
  qrCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    gap: 16,
  },
  qrTitle: {
    fontSize: 16,
  },
  qrBox: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
  },
  qrHint: {
    textAlign: 'center',
    fontSize: 13,
    opacity: 0.6,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  friendName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  friendInviteBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  sentText: {
    fontSize: 12,
    fontWeight: '600',
  },
  friendErrorText: {
    color: '#d9534f',
    fontSize: 12,
  },
});
