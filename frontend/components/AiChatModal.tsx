import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Modal, Pressable, TextInput, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
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
};

type AiChatModalProps = {
  visible: boolean;
  onClose: () => void;
  tripId: string;
};

const AiChatModal = ({ visible, onClose, tripId }: AiChatModalProps) => {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const { getHistory, streamMessage } = useAiChat();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');

  const scrollRef = useRef<ScrollView>(null);
  const abortRef = useRef<(() => void) | null>(null);
  const streamingContentRef = useRef('');

  useEffect(() => {
    if (visible) {
      loadHistory();
    } else {
      abortRef.current?.();
      abortRef.current = null;
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
      return () => clearTimeout(timer);
    }
  }, [messages, streamingContent, visible]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const history = await getHistory(tripId);
      setMessages(history.map(m => ({ id: m.id, role: m.role, content: m.content })));
    } catch {
      // silent — empty chat is a valid state
    } finally {
      setLoading(false);
    }
  };

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || streaming) return;

    const userMessage: Message = { id: `u-${Date.now()}`, role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setStreaming(true);
    setStreamingContent('');
    streamingContentRef.current = '';

    const abort = streamMessage(
      tripId,
      text,
      (token) => {
        streamingContentRef.current += token;
        setStreamingContent(streamingContentRef.current);
      },
      async () => {
        // SSE strips the leading space from tokens like " este" → "este",
        // so we reload from the server to get the correctly-spaced full text.
        streamingContentRef.current = '';
        setStreaming(false);
        setStreamingContent('');
        try {
          const history = await getHistory(tripId);
          setMessages(history.map(m => ({ id: m.id, role: m.role, content: m.content })));
        } catch {
          // keep whatever messages we have
        }
      },
      () => {
        streamingContentRef.current = '';
        setStreaming(false);
        setStreamingContent('');
      }
    );

    abortRef.current = abort;
  }, [input, streaming, tripId, streamMessage, getHistory]);

  const handleClose = () => {
    abortRef.current?.();
    abortRef.current = null;
    setStreaming(false);
    setStreamingContent('');
    streamingContentRef.current = '';
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Ionicons name="sparkles-outline" size={20} color={Colors.primary} />
          <ThemedText style={styles.headerTitle}>{t('trip.chat')}</ThemedText>
          <Pressable onPress={handleClose} style={styles.closeButton} hitSlop={8}>
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
            <ScrollView
              ref={scrollRef}
              style={styles.messageList}
              contentContainerStyle={styles.messageListContent}
              keyboardShouldPersistTaps="handled"
            >
              {messages.map(msg => {
                const isUser = msg.role === 'user';
                return (
                  <View
                    key={msg.id}
                    style={[styles.messageRow, isUser ? styles.rowUser : styles.rowAssistant]}
                  >
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
              })}

              {streaming && (
                <View style={[styles.messageRow, styles.rowAssistant]}>
                  <View style={[styles.bubble, styles.bubbleAssistant, { backgroundColor: theme.uiBackground }]}>
                    {streamingContent ? (
                      <ThemedText style={styles.bubbleText}>{streamingContent}</ThemedText>
                    ) : (
                      <ActivityIndicator size="small" color={Colors.primary} />
                    )}
                  </View>
                </View>
              )}
            </ScrollView>
          )}

          <View style={[styles.inputRow, { borderTopColor: theme.border, backgroundColor: theme.navBackground }]}>
            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.uiBackground }]}
              value={input}
              onChangeText={setInput}
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
            >
              <Ionicons name="send" size={17} color="#fff" />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

export const AiChatButton = ({ tripId }: { tripId: string }) => {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <Pressable
        style={[styles.fab, { backgroundColor: Colors.primary }]}
        onPress={() => setVisible(true)}
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

export default AiChatButton;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 52,
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
  bubbleText: { fontSize: 15, lineHeight: 22 },
  bubbleTextUser: { color: '#fff' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 60,
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
  fab: {
    position: 'absolute',
    left: 20,
    bottom: 125,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
