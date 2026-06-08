import React, { useCallback, useEffect, useReducer, useRef } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../../src/theme';
import { Colors } from '../../../constants/Colors';
import { useTrip } from '../../../src/trips';
import { useAuth } from '../../../src/auth';
import { useGroupChat } from '../../../src/groupChat';
import type { components } from '../../../src/generated/types';

type TripChatMessage = components['schemas']['TripChatMessage'];

type State = {
  messages: TripChatMessage[];
  loading: boolean;
  error: string | null;
  input: string;
  sending: boolean;
};

type Action =
  | { type: 'loading' }
  | { type: 'loaded'; messages: TripChatMessage[] }
  | { type: 'error'; error: string }
  | { type: 'set_input'; value: string }
  | { type: 'sending' }
  | { type: 'sent'; message: TripChatMessage }
  | { type: 'send_error' }
  | { type: 'received'; message: TripChatMessage };

const initialState: State = { messages: [], loading: true, error: null, input: '', sending: false };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'loading':
      return { ...state, loading: true, error: null };
    case 'loaded':
      return { ...state, loading: false, messages: action.messages };
    case 'error':
      return { ...state, loading: false, error: action.error };
    case 'set_input':
      return { ...state, input: action.value };
    case 'sending':
      return { ...state, sending: true };
    case 'sent':
      return { ...state, sending: false, input: '', messages: [...state.messages, action.message] };
    case 'send_error':
      return { ...state, sending: false };
    case 'received':
      if (state.messages.some(m => m.id === action.message.id)) return state;
      return { ...state, messages: [...state.messages, action.message] };
    default:
      return state;
  }
}

const ChatScreen = () => {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const { trip } = useTrip();
  const { userId } = useAuth();
  const { getHistory, sendMessage, openStream } = useGroupChat();
  const [{ messages, loading, error, input, sending }, dispatch] = useReducer(reducer, initialState);
  const flatListRef = useRef<FlatList<TripChatMessage>>(null);

  useEffect(() => {
    if (!trip?.id) return;

    dispatch({ type: 'loading' });
    getHistory(trip.id)
      .then(msgs => dispatch({ type: 'loaded', messages: msgs }))
      .catch(() => dispatch({ type: 'error', error: t('trip.unableLoadChat') }));

    const closeStream = openStream(
      trip.id,
      (msg) => dispatch({ type: 'received', message: msg }),
      (err) => console.warn('[groupChat] SSE error:', err),
    );

    return closeStream;
  }, [trip?.id, getHistory, t, openStream]);

  useEffect(() => {
    if (messages.length === 0) return;
    const timer = setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(timer);
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || !trip?.id || sending) return;
    dispatch({ type: 'sending' });
    try {
      const msg = await sendMessage(trip.id, input.trim());
      dispatch({ type: 'sent', message: msg });
    } catch {
      dispatch({ type: 'send_error' });
    }
  }, [input, trip?.id, sending, sendMessage]);

  const renderItem = useCallback(({ item }: { item: TripChatMessage }) => {
    const isMe = item.senderId === userId;
    return (
      <View style={[styles.row, isMe ? styles.rowMe : styles.rowOther]}>
        {!isMe && (
          <Text style={[styles.senderName, { color: theme.icon }]}>{item.senderUsername}</Text>
        )}
        <View style={[
          styles.bubble,
          isMe ? { backgroundColor: Colors.primary } : { backgroundColor: theme.uiBackground },
          isMe ? styles.bubbleMe : styles.bubbleOther,
        ]}>
          <Text style={[styles.bubbleText, { color: isMe ? '#fff' : theme.text }]}>
            {item.content}
          </Text>
        </View>
        <Text style={[styles.timestamp, { color: theme.icon }]}>
          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  }, [userId, theme]);

  const canSend = input.trim().length > 0 && !sending;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.tint} size="large" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={40} color={theme.icon} style={{ opacity: 0.4 }} />
          <Text style={[styles.errorText, { color: theme.icon }]}>{error}</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[styles.inputRow, { backgroundColor: theme.navBackground, borderTopColor: theme.border }]}>
          <TextInput
            style={[styles.input, { color: theme.text, backgroundColor: theme.uiBackground, borderColor: theme.border }]}
            value={input}
            onChangeText={v => dispatch({ type: 'set_input', value: v })}
            placeholder={t('trip.groupChatPlaceholder')}
            placeholderTextColor={theme.icon}
            multiline
            editable={!sending}
          />
          <Pressable
            style={[styles.sendBtn, { backgroundColor: Colors.primary, opacity: canSend ? 1 : 0.4 }]}
            onPress={handleSend}
            disabled={!canSend}
          >
            <Ionicons name="send" size={16} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

export default ChatScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 14, fontWeight: '500', opacity: 0.6, textAlign: 'center', paddingHorizontal: 24 },

  list: { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },

  row: { maxWidth: '80%' },
  rowMe: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  rowOther: { alignSelf: 'flex-start', alignItems: 'flex-start' },

  senderName: { fontSize: 11, fontWeight: '600', marginBottom: 2, paddingHorizontal: 4 },

  bubble: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18 },
  bubbleMe: { borderBottomRightRadius: 4 },
  bubbleOther: { borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, lineHeight: 21 },

  timestamp: { fontSize: 10, opacity: 0.5, marginTop: 3, paddingHorizontal: 4 },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 0.5,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 0.5,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
