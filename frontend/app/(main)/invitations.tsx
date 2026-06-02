import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../src/theme';
import { Colors } from '../../constants/Colors';
import { useInvitations } from '../../src/invitations';
import ThemedText from '../../components/ThemedText';
import { components } from '../../src/generated/types';

type InvitationSummary = components['schemas']['InvitationSummary'];

const InvitationsScreen = () => {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const { getMyInvitations, resolveInvitation } = useInvitations();

  const [invitations, setInvitations] = useState<InvitationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await getMyInvitations();
      setInvitations(data);
    } catch {
      setError(t('invitations.loadError'));
    } finally {
      setLoading(false);
    }
  }, [getMyInvitations, t]);

  useEffect(() => { load(); }, [load]);

  const handleResolve = async (id: string, accepted: boolean) => {
    setResolving(id);
    try {
      await resolveInvitation(id, accepted);
      setInvitations(prev => prev.filter(inv => inv.id !== id));
    } catch {
      setError(accepted ? t('invitations.acceptError') : t('invitations.rejectError'));
    } finally {
      setResolving(null);
    }
  };

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
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: theme.tabBackground }]}>
            <ThemedText style={styles.tripName}>{item.tripName}</ThemedText>
            <View style={styles.actions}>
              <Pressable
                style={[styles.button, { backgroundColor: theme.tint }, resolving === item.id && styles.disabled]}
                onPress={() => handleResolve(item.id, true)}
                disabled={resolving !== null}
              >
                {resolving === item.id ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <ThemedText style={styles.buttonText}>{t('invitations.accept')}</ThemedText>
                )}
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
