import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../src/theme';
import { Colors } from '../../constants/Colors';
import { useInvitations } from '../../src/invitations';
import ThemedText from '../../components/ThemedText';
import { components } from '../../src/generated/types';

type InvitationSummary = components['schemas']['InvitationSummary'];

interface InvitationCardProps {
  item: InvitationSummary;
  resolving: string | null;
  cardBackground: string;
  tint: string;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}
const InvitationCard = React.memo(function InvitationCard({
  item, resolving, cardBackground, tint, onAccept, onReject,
}: InvitationCardProps) {
  const { t } = useTranslation();
  const isResolving = resolving === item.id;
  return (
    <View style={[styles.card, { backgroundColor: cardBackground }]}>
      <ThemedText style={styles.tripName}>{item.tripName}</ThemedText>
      <View style={styles.actions}>
        <Pressable
          style={[styles.button, { backgroundColor: tint }, isResolving && styles.disabled]}
          onPress={() => onAccept(item.id)}
          disabled={resolving !== null}
        >
          {isResolving ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <ThemedText style={styles.buttonText}>{t('invitations.accept')}</ThemedText>
          )}
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

type InvState = { invitations: InvitationSummary[]; loading: boolean; error: string | null };
type InvAction =
  | { type: 'loading' }
  | { type: 'loaded'; data: InvitationSummary[] }
  | { type: 'error'; message: string }
  | { type: 'remove'; id: string };

function invReducer(state: InvState, action: InvAction): InvState {
  switch (action.type) {
    case 'loading': return { ...state, loading: true, error: null };
    case 'loaded': return { invitations: action.data, loading: false, error: null };
    case 'error': return { ...state, loading: false, error: action.message };
    case 'remove': return { ...state, invitations: state.invitations.filter(inv => inv.id !== action.id) };
    default: return state;
  }
}

const INV_INITIAL: InvState = { invitations: [], loading: true, error: null };

const InvitationsScreen = () => {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const { getMyInvitations, resolveInvitation } = useInvitations();

  const [{ invitations, loading, error }, dispatch] = useReducer(invReducer, INV_INITIAL);
  const [resolving, setResolving] = useState<string | null>(null);

  const load = useCallback(async () => {
    dispatch({ type: 'loading' });
    try {
      const data = await getMyInvitations();
      dispatch({ type: 'loaded', data });
    } catch {
      dispatch({ type: 'error', message: t('invitations.loadError') });
    }
  }, [getMyInvitations, t]);

  useEffect(() => { load(); }, [load]);

  const handleResolve = useCallback(async (id: string, accepted: boolean) => {
    setResolving(id);
    try {
      await resolveInvitation(id, accepted);
      dispatch({ type: 'remove', id });
    } catch {
      dispatch({ type: 'error', message: accepted ? t('invitations.acceptError') : t('invitations.rejectError') });
    } finally {
      setResolving(null);
    }
  }, [resolveInvitation, t]);

  const handleAccept = useCallback((id: string) => handleResolve(id, true), [handleResolve]);
  const handleReject = useCallback((id: string) => handleResolve(id, false), [handleResolve]);
  const renderInvitationItem = useCallback(({ item }: { item: InvitationSummary }) => (
    <InvitationCard
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
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.tint} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {error && (
        <View style={[styles.errorBanner, { backgroundColor: Colors.warning }]}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </View>
      )}
      <FlatList
        data={invitations}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={renderInvitationItem}
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
  container: {
    flex: 1,
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
  tripName: {
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
