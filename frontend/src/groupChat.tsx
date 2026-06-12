import EventSource from 'react-native-sse';
import React, { createContext, use, useCallback, useEffect, useReducer, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from './auth';
import { AppError } from './AppError';
import { BASE_URL } from '../constants/constants';
import type { components } from './generated/types';

type TripChatMessage = components['schemas']['TripChatMessage'];
type SendTripChatMessageRequest = components['schemas']['SendTripChatMessageRequest'];

function useGroupChat() {
  const { callAuthenticated, accessToken } = useAuth();

  const getHistory = useCallback(async (tripId: string): Promise<TripChatMessage[]> => {
    const response = await callAuthenticated(`/trips/${tripId}/group-chat`);
    if (!response.ok) throw new AppError(response.status);
    return response.json();
  }, [callAuthenticated]);

  const sendMessage = useCallback(async (tripId: string, content: string): Promise<TripChatMessage> => {
    const response = await callAuthenticated(`/trips/${tripId}/group-chat`, {
      method: 'POST',
      body: JSON.stringify({ content } satisfies SendTripChatMessageRequest),
    });
    if (!response.ok) throw new AppError(response.status);
    return response.json();
  }, [callAuthenticated]);

  const openStream = useCallback((
    tripId: string,
    onMessage: (msg: TripChatMessage) => void,
    onError: (err: Error) => void,
  ): (() => void) => {
    const es = new EventSource(`${BASE_URL}/trips/${tripId}/group-chat/stream`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
      pollingInterval: 0,
      timeoutBeforeConnection: 0,
    });

    es.addEventListener('message', (event) => {
      if (!event.data) return;
      try {
        onMessage(JSON.parse(event.data) as TripChatMessage);
      } catch {
        // ignore malformed event
      }
    });

    es.addEventListener('error', (event: any) => {
      onError(new Error(event.message ?? event.type ?? 'SSE error'));
    });

    return () => es.close();
  }, [accessToken]);

  return { getHistory, sendMessage, openStream };
}

/* ── Durable trip-chat state (lives at the trip-layout level) ───────────────── */

type State = {
  messages: TripChatMessage[];
  loading: boolean;
  error: string | null;
  sending: boolean;
  unreadCount: number;
};

type Action =
  | { type: 'loading' }
  | { type: 'loaded'; messages: TripChatMessage[] }
  | { type: 'error'; error: string }
  | { type: 'sending' }
  | { type: 'sent'; message: TripChatMessage }
  | { type: 'send_error' }
  | { type: 'received'; message: TripChatMessage; countsAsUnread: boolean }
  | { type: 'mark_read' };

const initialState: State = { messages: [], loading: true, error: null, sending: false, unreadCount: 0 };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'loading':
      return { ...state, loading: true, error: null };
    case 'loaded':
      return { ...state, loading: false, messages: action.messages };
    case 'error':
      return { ...state, loading: false, error: action.error };
    case 'sending':
      return { ...state, sending: true };
    case 'sent':
      return { ...state, sending: false, messages: [...state.messages, action.message] };
    case 'send_error':
      return { ...state, sending: false };
    case 'received':
      if (state.messages.some(m => m.id === action.message.id)) return state;
      return {
        ...state,
        messages: [...state.messages, action.message],
        unreadCount: action.countsAsUnread ? state.unreadCount + 1 : state.unreadCount,
      };
    case 'mark_read':
      return state.unreadCount === 0 ? state : { ...state, unreadCount: 0 };
    default:
      return state;
  }
}

type GroupChatContextType = {
  messages: TripChatMessage[];
  loading: boolean;
  error: string | null;
  sending: boolean;
  unreadCount: number;
  send: (content: string) => Promise<void>;
  markRead: () => void;
  setViewing: (active: boolean) => void;
};

const GroupChatContext = createContext<GroupChatContextType>({
  messages: [],
  loading: true,
  error: null,
  sending: false,
  unreadCount: 0,
  send: async () => {},
  markRead: () => {},
  setViewing: () => {},
});

export const GroupChatProvider = ({ tripId, children }: { tripId: string; children: React.ReactNode }) => {
  const { t } = useTranslation();
  const { userId } = useAuth();
  const { getHistory, sendMessage, openStream } = useGroupChat();
  const [state, dispatch] = useReducer(reducer, initialState);
  const viewingRef = useRef(false);

  useEffect(() => {
    if (!tripId) return;

    dispatch({ type: 'loading' });
    getHistory(tripId)
      .then(msgs => dispatch({ type: 'loaded', messages: msgs }))
      .catch(() => dispatch({ type: 'error', error: t('trip.unableLoadChat') }));

    const closeStream = openStream(
      tripId,
      (msg) => dispatch({
        type: 'received',
        message: msg,
        countsAsUnread: !viewingRef.current && msg.senderId !== userId,
      }),
      (err) => console.warn('[groupChat] SSE error:', err),
    );

    return closeStream;
  }, [tripId, getHistory, openStream, t, userId]);

  const send = useCallback(async (content: string) => {
    dispatch({ type: 'sending' });
    try {
      const msg = await sendMessage(tripId, content);
      dispatch({ type: 'sent', message: msg });
    } catch {
      dispatch({ type: 'send_error' });
      throw new Error('send failed');
    }
  }, [tripId, sendMessage]);

  const markRead = useCallback(() => dispatch({ type: 'mark_read' }), []);

  const setViewing = useCallback((active: boolean) => {
    viewingRef.current = active;
    if (active) dispatch({ type: 'mark_read' });
  }, []);

  const value: GroupChatContextType = {
    messages: state.messages,
    loading: state.loading,
    error: state.error,
    sending: state.sending,
    unreadCount: state.unreadCount,
    send,
    markRead,
    setViewing,
  };

  return (
    <GroupChatContext.Provider value={value}>
      {children}
    </GroupChatContext.Provider>
  );
};

export const useTripChat = () => use(GroupChatContext);
