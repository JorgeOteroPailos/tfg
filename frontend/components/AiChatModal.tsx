import React, { useState, useReducer, useCallback, useRef, useEffect } from 'react';
import {
  View, Modal, Pressable, TextInput, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Text,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { useAppTheme } from '../src/theme';
import ThemedText from './ThemedText';
import { useAiChat } from '../src/aiChat';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string; // ISO 8601 — present for server messages, absent for optimistic ones
};

type AiChatModalProps = {
  visible: boolean;
  onClose: () => void;
  tripId: string;
};

function toMessage(m: { id: string; role: string; content: string; timestamp: string }): Message {
  return { id: m.id, role: m.role as Message['role'], content: m.content, timestamp: m.timestamp };
}

type ChatState = {
  messages: Message[];
  input: string;
  loading: boolean;
  streaming: boolean;
  streamingContent: string;
  hasMore: boolean;
  loadingMore: boolean;
  error: boolean; // the last stream failed (e.g. AI backend unreachable)
};

type ChatAction =
  | { type: 'load_start' }
  | { type: 'load_done'; messages: Message[]; hasMore: boolean }
  | { type: 'load_error' }
  | { type: 'load_more_start' }
  | { type: 'load_more_done'; olderMessages: Message[]; hasMore: boolean }
  | { type: 'load_more_error' }
  | { type: 'send'; userMessage: Message }
  | { type: 'stream_token'; content: string }
  | { type: 'stream_done'; messages: Message[] }
  | { type: 'stream_done_local'; assistantMessage: Message }
  | { type: 'stream_abort' }
  | { type: 'stream_error' }
  | { type: 'set_input'; input: string }
  | { type: 'close' };

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'load_start':
      return { ...state, loading: true, error: false };
    case 'load_done':
      return { ...state, loading: false, messages: action.messages, hasMore: action.hasMore };
    case 'load_error':
      return { ...state, loading: false };
    case 'load_more_start':
      return { ...state, loadingMore: true };
    case 'load_more_done':
      return { ...state, loadingMore: false, hasMore: action.hasMore, messages: [...action.olderMessages, ...state.messages] };
    case 'load_more_error':
      return { ...state, loadingMore: false };
    case 'send':
      return { ...state, messages: [...state.messages, action.userMessage], input: '', streaming: true, streamingContent: '', error: false };
    case 'stream_token':
      return { ...state, streamingContent: action.content };
    case 'stream_done':
      return { ...state, streaming: false, streamingContent: '', messages: action.messages };
    case 'stream_done_local':
      return { ...state, streaming: false, streamingContent: '', messages: [...state.messages, action.assistantMessage] };
    case 'stream_abort':
      return { ...state, streaming: false, streamingContent: '' };
    case 'stream_error':
      return { ...state, streaming: false, streamingContent: '', error: true };
    case 'set_input':
      return { ...state, input: action.input };
    case 'close':
      return { ...state, streaming: false, streamingContent: '', error: false };
    default:
      return state;
  }
}

const AiChatModal = ({ visible, onClose, tripId }: AiChatModalProps) => {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const { getHistory, streamMessage } = useAiChat();

  const [state, dispatch] = useReducer(chatReducer, {
    messages: [],
    input: '',
    loading: false,
    streaming: false,
    streamingContent: '',
    hasMore: false,
    loadingMore: false,
    error: false,
  });
  const { messages, input, loading, streaming, streamingContent, hasMore, loadingMore, error } = state;

  const scrollRef = useRef<FlatList<Message>>(null);
  const abortRef = useRef<(() => void) | null>(null);
  const streamingContentRef = useRef('');

  const loadHistory = useCallback(async () => {
    dispatch({ type: 'load_start' });
    try {
      const { messages: msgs, hasMore } = await getHistory(tripId);
      dispatch({ type: 'load_done', messages: msgs.map(toMessage), hasMore });
    } catch {
      // silent — empty chat is a valid state
      dispatch({ type: 'load_error' });
    }
  }, [getHistory, tripId]);

  const loadOlder = useCallback(async () => {
    if (!hasMore || loadingMore || messages.length === 0) return;
    const oldest = messages[0];
    if (!oldest.timestamp) return;
    dispatch({ type: 'load_more_start' });
    try {
      const { messages: older, hasMore: more } = await getHistory(tripId, oldest.timestamp);
      dispatch({ type: 'load_more_done', olderMessages: older.map(toMessage), hasMore: more });
    } catch {
      dispatch({ type: 'load_more_error' });
    }
  }, [hasMore, loadingMore, messages, getHistory, tripId]);

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
      return () => clearTimeout(timer);
    }
  }, [messages, streamingContent, visible]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || streaming) return;

    const userMessage: Message = { id: `u-${Date.now()}`, role: 'user', content: text };
    dispatch({ type: 'send', userMessage });
    streamingContentRef.current = '';

    const abort = streamMessage(
      tripId,
      text,
      (token) => {
        streamingContentRef.current += token;
        dispatch({ type: 'stream_token', content: streamingContentRef.current });
      },
      async () => {
        // SSE strips the leading space from tokens like " este" → "este",
        // so we reload from the server to get the correctly-spaced full text.
        const streamed = streamingContentRef.current;
        streamingContentRef.current = '';
        try {
          const { messages: hist } = await getHistory(tripId);
          dispatch({ type: 'stream_done', messages: hist.map(toMessage) });
        } catch {
          // Reload failed — keep the answer we already streamed rather than
          // dropping it, so the user isn't left with a question and no reply.
          if (streamed) {
            dispatch({
              type: 'stream_done_local',
              assistantMessage: { id: `a-${Date.now()}`, role: 'assistant', content: streamed },
            });
          } else {
            dispatch({ type: 'stream_error' });
          }
        }
      },
      () => {
        streamingContentRef.current = '';
        dispatch({ type: 'stream_error' });
      }
    );

    abortRef.current = abort;
  }, [input, streaming, tripId, streamMessage, getHistory]);

  const handleClose = () => {
    abortRef.current?.();
    abortRef.current = null;
    streamingContentRef.current = '';
    dispatch({ type: 'close' });
    onClose();
  };

  const renderMessage = useCallback(({ item: msg }: { item: Message }) => {
    const isUser = msg.role === 'user';
    return (
      <View style={[styles.messageRow, isUser ? styles.rowUser : styles.rowAssistant]}>
        <View style={[
          styles.bubble,
          isUser
            ? [styles.bubbleUser, { backgroundColor: Colors.primary }]
            : [styles.bubbleAssistant, { backgroundColor: theme.uiBackground }],
        ]}>
          <ThemedText style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
            {msg.content}
          </ThemedText>
        </View>
      </View>
    );
  }, [theme.uiBackground]);

  const streamingBubble = streaming ? (
    <View style={[styles.messageRow, styles.rowAssistant]}>
      <View style={[styles.bubble, styles.bubbleAssistant, { backgroundColor: theme.uiBackground }]}>
        {streamingContent ? (
          <ThemedText style={styles.bubbleText}>{streamingContent}</ThemedText>
        ) : (
          <ActivityIndicator size="small" color={Colors.primary} />
        )}
      </View>
    </View>
  ) : null;

  const errorBubble = error ? (
    <View style={[styles.messageRow, styles.rowAssistant]}>
      <View style={[styles.bubble, styles.bubbleAssistant, styles.bubbleError]}>
        <Ionicons name="alert-circle-outline" size={16} color={Colors.warning} />
        <ThemedText style={[styles.bubbleText, styles.bubbleErrorText]}>{t('trip.aiChatError')}</ThemedText>
      </View>
    </View>
  ) : null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose} onShow={loadHistory}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Ionicons name="sparkles-outline" size={20} color={Colors.primary} />
          <ThemedText style={styles.headerTitle}>{t('trip.aiChat')}</ThemedText>
          <Pressable onPress={handleClose} style={styles.closeButton} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('common.close')}>
            <Ionicons name="close-outline" size={28} color={theme.icon} />
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          ) : (
            <FlatList
              ref={scrollRef}
              style={styles.messageList}
              contentContainerStyle={styles.messageListContent}
              keyboardShouldPersistTaps="handled"
              data={messages}
              renderItem={renderMessage}
              keyExtractor={msg => msg.id}
              ListFooterComponent={streamingBubble ?? errorBubble}
              ListHeaderComponent={hasMore ? (
                <Pressable style={styles.loadOlderBtn} onPress={loadOlder} disabled={loadingMore}>
                  {loadingMore
                    ? <ActivityIndicator size="small" color={Colors.primary} />
                    : <Text style={[styles.loadOlderText, { color: Colors.primary }]}>{t('trip.loadOlderMessages')}</Text>
                  }
                </Pressable>
              ) : null}
            />
          )}

          <View style={[styles.inputRow, { borderTopColor: theme.border, backgroundColor: theme.navBackground }]}>
            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.uiBackground }]}
              value={input}
              onChangeText={text => dispatch({ type: 'set_input', input: text })}
              placeholder={t('trip.aiChatPlaceholder')}
              placeholderTextColor={theme.icon}
              multiline
              editable={!streaming}
              onSubmitEditing={handleSend}
            />
            <Pressable
              style={[styles.sendButton, { backgroundColor: Colors.primary, opacity: (!input.trim() || streaming) ? 0.45 : 1 }]}
              onPress={handleSend}
              disabled={!input.trim() || streaming}
              accessibilityRole="button"
              accessibilityLabel={t('a11y.send')}
              hitSlop={8}
            >
              <Ionicons name="send" size={17} color="#fff" />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

export const AiChatButton = ({ tripId, isChatTab }: { tripId: string; isChatTab?: boolean }) => {
  const [visible, setVisible] = useState(false);
  const { t } = useTranslation();

  return (
    <>
      <Pressable
        style={[styles.fab, { backgroundColor: Colors.primary }, isChatTab && styles.fabChatTab]}
        onPress={() => setVisible(true)}
        accessibilityRole="button"
        accessibilityLabel={t('a11y.aiAssistant')}
      >
        <Ionicons name="sparkles-outline" size={24} color="#fff" />
      </Pressable>
      <AiChatModal
        visible={visible}
        onClose={() => setVisible(false)}
        tripId={tripId}
      />
    </>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 0.5,
    gap: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: { padding: 2 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  messageList: { flex: 1 },
  messageListContent: { padding: 16, paddingBottom: 8 },
  messageRow: { flexDirection: 'row', marginBottom: 8 },
  rowUser: { justifyContent: 'flex-end' },
  rowAssistant: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUser: { borderBottomRightRadius: 4 },
  bubbleAssistant: { borderBottomLeftRadius: 4 },
  bubbleError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(220,38,38,0.12)',
  },
  bubbleErrorText: { color: Colors.warning },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  bubbleTextUser: { color: '#fff' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 0.5,
    gap: 10,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 120,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadOlderBtn: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 20,
    marginBottom: 8,
    minHeight: 32,
    justifyContent: 'center',
  },
  loadOlderText: {
    fontSize: 13,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    left: 20,
    bottom: 125,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
  },
  fabChatTab: {
    bottom: 195,
  },
});
