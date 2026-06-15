import React, { useReducer } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../src/theme';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../src/auth';
import { useFriends } from '../../src/friends';
import { AppError, ErrorCode } from '../../src/AppError';
import ThemedText from '../../components/ThemedText';
import ThemedInput from '../../components/ThemedInput';

type State = { userId: string; sending: boolean; success: boolean; error: string | null };
type Action =
  | { type: 'set'; value: string }
  | { type: 'start' }
  | { type: 'done' }
  | { type: 'fail'; error: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'set': return { ...state, userId: action.value, success: false, error: null };
    case 'start': return { ...state, sending: true, success: false, error: null };
    case 'done': return { ...state, sending: false, success: true, userId: '' };
    case 'fail': return { ...state, sending: false, error: action.error };
    default: return state;
  }
}

const AddFriendScreen = () => {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const { userId: myId } = useAuth();
  const { sendFriendRequestById } = useFriends();

  const [state, dispatch] = useReducer(reducer, { userId: '', sending: false, success: false, error: null });

  const handleSend = async () => {
    const target = state.userId.trim();
    if (!target) return;

    if (target === myId) {
      dispatch({ type: 'fail', error: t('friends.requestErrorSelf') });
      return;
    }

    dispatch({ type: 'start' });
    try {
      await sendFriendRequestById(target);
      dispatch({ type: 'done' });
    } catch (e) {
      if (e instanceof AppError && e.code === ErrorCode.CONFLICT) {
        dispatch({ type: 'fail', error: t('friends.requestErrorConflict') });
      } else {
        dispatch({ type: 'fail', error: t('friends.requestError') });
      }
    }
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.card, { backgroundColor: theme.uiBackground, borderColor: theme.border }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconBadge, { backgroundColor: `${theme.tint}18` }]}>
            <Ionicons name="person-add-outline" size={20} color={theme.tint} />
          </View>
          <ThemedText style={styles.cardTitle}>{t('friends.addFriend')}</ThemedText>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <View style={styles.cardBody}>
          <ThemedText style={[styles.hint, { color: theme.icon }]}>{t('friends.addHint')}</ThemedText>

          <ThemedInput
            placeholder={t('friends.addPlaceholder')}
            placeholderTextColor={theme.icon}
            value={state.userId}
            onChangeText={value => dispatch({ type: 'set', value })}
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={handleSend}
          />

          {state.success && (
            <ThemedText style={styles.successText}>{t('friends.requestSent')}</ThemedText>
          )}
          {state.error && (
            <ThemedText style={styles.errorText}>{state.error}</ThemedText>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.sendBtn,
              {
                backgroundColor: (state.sending || !state.userId.trim())
                  ? `${theme.tint}70`
                  : theme.tint,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            onPress={handleSend}
            disabled={state.sending || !state.userId.trim()}
          >
            {state.sending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.sendBtnContent}>
                <Ionicons name="send-outline" size={16} color="#fff" />
                <ThemedText style={styles.sendBtnText}>{t('friends.sendRequest')}</ThemedText>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.qrBtn,
          { borderColor: theme.tint, opacity: pressed ? 0.8 : 1 },
        ]}
        onPress={() => router.push({ pathname: '/scan-qr', params: { mode: 'add-friend' } })}
      >
        <Ionicons name="qr-code-outline" size={20} color={theme.tint} />
        <ThemedText style={[styles.qrBtnText, { color: theme.tint }]}>{t('friends.scanQr')}</ThemedText>
      </Pressable>
    </ScrollView>
  );
};

export default AddFriendScreen;

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, paddingBottom: 32 },

  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  divider: { height: 1, marginHorizontal: 16 },
  cardBody: { padding: 16, gap: 12 },

  hint: { fontSize: 13, lineHeight: 19 },

  successText: { color: '#4caf50', textAlign: 'center', fontSize: 14 },
  errorText: { color: '#d9534f', textAlign: 'center', fontSize: 14 },

  sendBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  sendBtnContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sendBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },

  qrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    marginTop: 4,
  },
  qrBtnText: { fontWeight: '600', fontSize: 16 },
});
