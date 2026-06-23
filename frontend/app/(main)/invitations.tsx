import React, { useCallback, useEffect, useReducer, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useAppTheme } from '../../src/theme';
import { Colors } from '../../constants/Colors';
import { useInvitations } from '../../src/invitations';
import { useFriends } from '../../src/friends';
import { friendKeys } from '../../src/queryKeys';
import UserAvatar from '../../components/UserAvatar';
import ThemedText from '../../components/ThemedText';
import { components } from '../../src/generated/types';

type InvitationSummary = components['schemas']['InvitationSummary'];
type FriendRequestSummary = components['schemas']['FriendRequestSummary'];

type Row =
  | { _kind: 'section'; label: string }
  | { _kind: 'invitation'; item: InvitationSummary }
  | { _kind: 'friend-request'; item: FriendRequestSummary };

// ── Mailbox header ────────────────────────────────────────────────────────────
const MailboxHeader = React.memo(function MailboxHeader({ subtitle, tint, textColor }: { subtitle: string; tint: string; textColor: string }) {
  return (
    <View style={[styles.mailboxHeader, { backgroundColor: `${tint}0d`, borderColor: `${tint}25` }]}>
      <View style={[styles.mailboxIconWrap, { backgroundColor: `${tint}20` }]}>
        <Ionicons name="mail-outline" size={20} color={tint} />
      </View>
      <ThemedText style={[styles.mailboxSubtitle, { color: textColor }]}>{subtitle}</ThemedText>
    </View>
  );
});

// ── Invitation card ───────────────────────────────────────────────────────────
interface InvitationCardProps {
  item: InvitationSummary;
  resolving: string | null;
  tint: string; bg: string; border: string;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}
const InvitationCard = React.memo(function InvitationCard({ item, resolving, tint, bg, border, onAccept, onReject }: InvitationCardProps) {
  const { t } = useTranslation();
  const isResolving = resolving === item.id;
  return (
    <View style={[styles.card, { backgroundColor: bg, borderColor: border }]}>
      <View style={styles.cardTop}>
        <View style={[styles.cardIconWrap, { backgroundColor: `${tint}15` }]}>
          <Ionicons name="airplane-outline" size={18} color={tint} />
        </View>
        <ThemedText style={[styles.cardTitle, { flex: 1 }]}>{item.tripName}</ThemedText>
      </View>
      <View style={styles.cardActions}>
        <Pressable style={[styles.acceptBtn, { backgroundColor: tint }, isResolving && styles.disabled]} onPress={() => onAccept(item.id)} disabled={resolving !== null}>
          {isResolving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnText}>{t('invitations.accept')}</Text>}
        </Pressable>
        <Pressable style={[styles.rejectBtn, { borderColor: Colors.warning }, isResolving && styles.disabled]} onPress={() => onReject(item.id)} disabled={resolving !== null}>
          <Text style={[styles.btnText, { color: Colors.warning }]}>{t('invitations.reject')}</Text>
        </Pressable>
      </View>
    </View>
  );
});

// ── Friend request card ───────────────────────────────────────────────────────
interface FriendRequestCardProps {
  item: FriendRequestSummary;
  resolving: string | null;
  tint: string; bg: string; border: string;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}
const FriendRequestCard = React.memo(function FriendRequestCard({ item, resolving, tint, bg, border, onAccept, onReject }: FriendRequestCardProps) {
  const { t } = useTranslation();
  const isResolving = resolving === item.id;
  return (
    <View style={[styles.card, { backgroundColor: bg, borderColor: border }]}>
      <View style={styles.cardTop}>
        <UserAvatar userId={item.sender.id} initials={item.sender.username.slice(0, 2).toUpperCase()} size={38} hasAvatar={item.sender.hasAvatar} style={{ backgroundColor: `${tint}30` }} textStyle={{ color: tint }} />
        <ThemedText style={[styles.cardTitle, { flex: 1 }]}>{item.sender.username}</ThemedText>
      </View>
      <View style={styles.cardActions}>
        <Pressable style={[styles.acceptBtn, { backgroundColor: tint }, isResolving && styles.disabled]} onPress={() => onAccept(item.id)} disabled={resolving !== null}>
          {isResolving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnText}>{t('friends.accept')}</Text>}
        </Pressable>
        <Pressable style={[styles.rejectBtn, { borderColor: Colors.warning }, isResolving && styles.disabled]} onPress={() => onReject(item.id)} disabled={resolving !== null}>
          <Text style={[styles.btnText, { color: Colors.warning }]}>{t('friends.reject')}</Text>
        </Pressable>
      </View>
    </View>
  );
});

// ── Section separator: matches expenses.tsx dateSeparator ───────────────────
const SectionSeparator = React.memo(function SectionSeparator({ label, borderColor, textColor }: { label: string; borderColor: string; textColor: string }) {
  return (
    <View style={styles.separator}>
      <View style={[styles.separatorLine, { backgroundColor: borderColor }]} />
      <Text style={[styles.separatorLabel, { color: textColor }]}>{label}</Text>
      <View style={[styles.separatorLine, { backgroundColor: borderColor }]} />
    </View>
  );
});

// ── State ─────────────────────────────────────────────────────────────────────
type State = {
  invitations: InvitationSummary[];
  friendRequests: FriendRequestSummary[];
  loading: boolean;
  error: string | null;
};
type Action =
  | { type: 'loading' }
  | { type: 'loaded'; invitations: InvitationSummary[]; friendRequests: FriendRequestSummary[] }
  | { type: 'error'; message: string }
  | { type: 'remove-invitation'; id: string }
  | { type: 'remove-friend-request'; id: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'loading': return { ...state, loading: true, error: null };
    case 'loaded': return { invitations: action.invitations, friendRequests: action.friendRequests, loading: false, error: null };
    case 'error': return { ...state, loading: false, error: action.message };
    case 'remove-invitation': return { ...state, invitations: state.invitations.filter(i => i.id !== action.id) };
    case 'remove-friend-request': return { ...state, friendRequests: state.friendRequests.filter(r => r.id !== action.id) };
    default: return state;
  }
}

// ── Screen ────────────────────────────────────────────────────────────────────
const InvitationsScreen = () => {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const { getMyInvitations, resolveInvitation } = useInvitations();
  const { getMyFriendRequests, resolveFriendRequest } = useFriends();
  const queryClient = useQueryClient();

  const [state, dispatch] = useReducer(reducer, { invitations: [], friendRequests: [], loading: true, error: null });
  const [resolving, setResolving] = useState<string | null>(null);

  const load = useCallback(async () => {
    dispatch({ type: 'loading' });
    try {
      const [invitations, friendRequests] = await Promise.all([getMyInvitations(), getMyFriendRequests()]);
      dispatch({ type: 'loaded', invitations, friendRequests });
    } catch {
      dispatch({ type: 'error', message: t('invitations.loadError') });
    }
  }, [getMyInvitations, getMyFriendRequests, t]);

  useEffect(() => { load(); }, [load]);

  const handleResolveInvitation = useCallback(async (id: string, accepted: boolean) => {
    setResolving(id);
    try {
      await resolveInvitation(id, accepted);
      dispatch({ type: 'remove-invitation', id });
    } catch {
      dispatch({ type: 'error', message: accepted ? t('invitations.acceptError') : t('invitations.rejectError') });
    } finally {
      setResolving(null);
    }
  }, [resolveInvitation, t]);

  const handleResolveFriendRequest = useCallback(async (id: string, accepted: boolean) => {
    setResolving(id);
    try {
      await resolveFriendRequest(id, accepted);
      dispatch({ type: 'remove-friend-request', id });
      queryClient.invalidateQueries({ queryKey: friendKeys.requests() });
      if (accepted) {
        queryClient.invalidateQueries({ queryKey: friendKeys.list() });
      }
    } catch {
      dispatch({ type: 'error', message: t('friends.resolveError') });
    } finally {
      setResolving(null);
    }
  }, [resolveFriendRequest, t, queryClient]);

  const handleAcceptInvitation = useCallback((id: string) => handleResolveInvitation(id, true), [handleResolveInvitation]);
  const handleRejectInvitation = useCallback((id: string) => handleResolveInvitation(id, false), [handleResolveInvitation]);
  const handleAcceptFriend = useCallback((id: string) => handleResolveFriendRequest(id, true), [handleResolveFriendRequest]);
  const handleRejectFriend = useCallback((id: string) => handleResolveFriendRequest(id, false), [handleResolveFriendRequest]);

  const rows: Row[] = React.useMemo(() => {
    const result: Row[] = [];
    const hasInv = state.invitations.length > 0;
    const hasReq = state.friendRequests.length > 0;
    if (!hasInv && !hasReq) return [];
    if (hasInv) {
      result.push({ _kind: 'section', label: t('invitations.sectionTrips') });
      state.invitations.forEach(item => result.push({ _kind: 'invitation', item }));
    }
    if (hasReq) {
      result.push({ _kind: 'section', label: t('invitations.sectionFriends') });
      state.friendRequests.forEach(item => result.push({ _kind: 'friend-request', item }));
    }
    return result;
  }, [state.invitations, state.friendRequests, t]);

  const renderRow = useCallback(({ item: row }: { item: Row }) => {
    if (row._kind === 'section') {
      return <SectionSeparator label={row.label.toUpperCase()} borderColor={theme.border} textColor={theme.icon} />;
    }
    if (row._kind === 'invitation') {
      return (
        <InvitationCard
          item={row.item} resolving={resolving}
          tint={theme.tint} bg={theme.tabBackground} border={theme.border}
          onAccept={handleAcceptInvitation} onReject={handleRejectInvitation}
        />
      );
    }
    return (
      <FriendRequestCard
        item={row.item} resolving={resolving}
        tint={theme.tint} bg={theme.tabBackground} border={theme.border}
        onAccept={handleAcceptFriend} onReject={handleRejectFriend}
      />
    );
  }, [resolving, theme, handleAcceptInvitation, handleRejectInvitation, handleAcceptFriend, handleRejectFriend]);

  if (state.loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={theme.tint} /></View>;
  }

  return (
    <View style={styles.container}>
      {state.error && (
        <View style={[styles.errorBanner, { backgroundColor: Colors.warning }]}>
          <ThemedText style={styles.errorText}>{state.error}</ThemedText>
        </View>
      )}
      <FlatList
        data={rows}
        keyExtractor={(row, i) => row._kind === 'section' ? `section-${i}` : row.item.id}
        contentContainerStyle={styles.list}
        renderItem={renderRow}
        ListHeaderComponent={
          <MailboxHeader subtitle={t('invitations.inboxSubtitle')} tint={theme.tint} textColor={theme.icon} />
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <ThemedText style={styles.emptyText}>{t('invitations.empty')}</ThemedText>
          </View>
        }
      />
    </View>
  );
};

export default InvitationsScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 15, opacity: 0.6 },
  list: { padding: 16, gap: 10, paddingBottom: 20 },
  errorBanner: { padding: 12, marginHorizontal: 16, marginTop: 12, borderRadius: 8 },
  errorText: { color: 'white', fontWeight: '600', textAlign: 'center' },

  mailboxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 6,
  },
  mailboxIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mailboxSubtitle: { flex: 1, fontSize: 13, lineHeight: 18 },

  separator: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 6 },
  separatorLine: { flex: 1, height: StyleSheet.hairlineWidth },
  separatorLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8 },

  card: { padding: 16, borderRadius: 12, gap: 12, borderWidth: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardIconWrap: { width: 34, height: 34, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardActions: { flexDirection: 'row', gap: 10 },

  acceptBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rejectBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', borderWidth: 1.5 },
  btnText: { color: 'white', fontWeight: '600', fontSize: 14 },
  disabled: { opacity: 0.5 },
});
