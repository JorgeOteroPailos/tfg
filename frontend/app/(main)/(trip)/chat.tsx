import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
import { useTripChat } from '../../../src/groupChat';
import UserAvatar from '../../../components/UserAvatar';
import type { components } from '../../../src/generated/types';

type TripChatMessage = components['schemas']['TripChatMessage'];

const ChatScreen = () => {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const { trip } = useTrip();
  const { userId } = useAuth();
  const { messages, loading, error, sending, send, setViewing } = useTripChat();
  const [input, setInput] = useState('');
  const flatListRef = useRef<FlatList<TripChatMessage>>(null);

  const memberHasAvatar = React.useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const m of trip?.members ?? []) {
      if (m.id) map[m.id] = m.hasAvatar ?? false;
    }
    return map;
  }, [trip?.members]);

  // Mark the chat as actively viewed while this screen is mounted, so incoming
  // messages don't accumulate as unread and the tab badge clears on entry.
  useEffect(() => {
    setViewing(true);
    return () => setViewing(false);
  }, [setViewing]);

  useEffect(() => {
    if (messages.length === 0) return;
    const timer = setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(timer);
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || sending) return;
    const content = input.trim();
    setInput('');
    try {
      await send(content);
    } catch {
      // restore the draft so the user can retry
      setInput(content);
    }
  }, [input, sending, send]);

  const renderItem = useCallback(({ item, index }: { item: TripChatMessage; index: number }) => {
    const isMe = item.senderId === userId;
    const prev = messages[index - 1];
    const sameMinute = (a: string, b: string) => {
      const da = new Date(a), db = new Date(b);
      return da.getFullYear() === db.getFullYear() &&
        da.getMonth() === db.getMonth() &&
        da.getDate() === db.getDate() &&
        da.getHours() === db.getHours() &&
        da.getMinutes() === db.getMinutes();
    };
    const isGrouped = !!prev && prev.senderId === item.senderId && sameMinute(prev.timestamp, item.timestamp);
    const next = messages[index + 1];
    const isLastInGroup = !next || next.senderId !== item.senderId || !sameMinute(item.timestamp, next.timestamp);

    const CUT = 3;
    const groupCornerStyle = (() => {
      if (!isGrouped && isLastInGroup) return {}; // standalone — keep bubbleMe/bubbleOther defaults
      if (isMe) {
        if (!isGrouped)    return { borderBottomRightRadius: CUT };                               // first
        if (!isLastInGroup) return { borderTopRightRadius: CUT, borderBottomRightRadius: CUT };   // middle
        return { borderTopRightRadius: CUT, borderBottomRightRadius: 18 };                        // last
      } else {
        if (!isGrouped)    return { borderBottomLeftRadius: CUT };                                // first
        if (!isLastInGroup) return { borderTopLeftRadius: CUT, borderBottomLeftRadius: CUT };     // middle
        return { borderTopLeftRadius: CUT, borderBottomLeftRadius: 18 };                          // last
      }
    })();

    return (
      <View style={[styles.row, isMe ? styles.rowMe : styles.rowOther, isGrouped ? styles.rowGrouped : styles.rowFirst]}>
        {!isMe && !isGrouped && (
          <View style={styles.senderRow}>
            <UserAvatar
              userId={item.senderId}
              initials={item.senderUsername.charAt(0).toUpperCase()}
              size={20}
              hasAvatar={memberHasAvatar[item.senderId]}
              style={{ backgroundColor: `${theme.tint}28` }}
              textStyle={{ color: theme.tint }}
            />
            <Text style={[styles.senderName, { color: theme.icon }]}>{item.senderUsername}</Text>
          </View>
        )}
        <View style={[
          styles.bubble,
          isMe ? { backgroundColor: Colors.primary } : { backgroundColor: theme.uiBackground },
          isMe ? styles.bubbleMe : styles.bubbleOther,
          groupCornerStyle,
        ]}>
          <Text style={[styles.bubbleText, { color: isMe ? '#fff' : theme.text }]}>
            {item.content}
          </Text>
        </View>
        {isLastInGroup && (
          <Text style={[styles.timestamp, { color: theme.icon }]}>
            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}
      </View>
    );
  }, [userId, theme, messages, memberHasAvatar]);

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
            extraData={messages}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        )}

        <View style={[styles.inputRow, { backgroundColor: theme.navBackground, borderTopColor: theme.border }]}>
          <TextInput
            style={[styles.input, { color: theme.text, backgroundColor: theme.uiBackground, borderColor: theme.border }]}
            value={input}
            onChangeText={setInput}
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
    </View>
  );
};

export default ChatScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 14, fontWeight: '500', opacity: 0.6, textAlign: 'center', paddingHorizontal: 24 },

  list: { paddingHorizontal: 16, paddingVertical: 12 },

  row: { maxWidth: '80%' },
  rowMe: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  rowOther: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  rowFirst: { marginTop: 10 },
  rowGrouped: { marginTop: 3 },

  senderRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
  senderName: { fontSize: 11, fontWeight: '600' },

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
