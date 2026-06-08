import EventSource from 'react-native-sse';
import { useCallback } from 'react';
import { useAuth } from './auth';
import { AppError } from './AppError';
import { BASE_URL } from '../constants/constants';
import type { components } from './generated/types';

type TripChatMessage = components['schemas']['TripChatMessage'];
type SendTripChatMessageRequest = components['schemas']['SendTripChatMessageRequest'];

export function useGroupChat() {
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
