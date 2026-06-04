import EventSource from 'react-native-sse';
import { useAuth } from './auth';
import { useCallback } from 'react';
import type { components } from './generated/types';
import { AppError, ErrorCode } from './AppError';
import { BASE_URL } from '../constants/constants';

type AiChatMessage = components['schemas']['AiChatMessage'];

// react-native-sse never fires 'close' on natural stream end — only when close() is called.
// This subclass fixes two things:
//   1. Intercepts readyState === 4 on the XHR and calls close() so 'close' event fires.
//   2. Overrides _handleEvent to preserve leading spaces in token data.
//      The library strips ALL whitespace after 'data:' (e.g. "data: este" → "este"),
//      but that leading space is the LLM's word-boundary character, not an SSE separator.
//      Using slice(5) keeps it: "data: este" → " este", "data:En" → "En".
class OneShotEventSource extends EventSource {
  open(): void {
    super.open();
    const xhr = (this as any)._xhr as XMLHttpRequest | null;
    if (!xhr) return;
    const originalHandler = xhr.onreadystatechange as (() => void) | null;
    xhr.onreadystatechange = () => {
      if (originalHandler) originalHandler();
      if (xhr.readyState === 4 && xhr.status >= 200 && xhr.status < 400) {
        this.close();
      }
    };
  }

  _handleEvent(response: string): void {
    const s = this as any;

    if (s.lineEndingCharacter === null) {
      const detected = s._detectNewlineChar(response);
      if (detected !== null) s.lineEndingCharacter = detected;
      else return;
    }

    const doubleEnd = s._getLastDoubleNewlineIndex(response);
    if (doubleEnd <= s._lastIndexProcessed) return;

    const parts: string[] = response
      .substring(s._lastIndexProcessed, doubleEnd)
      .split(s.lineEndingCharacter);
    s._lastIndexProcessed = doubleEnd;

    let type: string | undefined;
    let data: string[] = [];

    for (const raw of parts) {
      const line: string = raw.trim();
      if (line.startsWith('event')) {
        type = line.replace(/event:?\s*/, '');
      } else if (line.startsWith('retry')) {
        const retry = parseInt(line.replace(/retry:?\s*/, ''), 10);
        if (!isNaN(retry)) s.interval = retry;
      } else if (line.startsWith('data:')) {
        data.push(line.slice(5)); // slice(5) keeps the leading space when present
      } else if (line.startsWith('id')) {
        const id = line.replace(/id:?\s*/, '');
        s.lastEventId = id !== '' ? id : null;
      } else if (line === '' && data.length > 0) {
        const eventType = type ?? 'message';
        s.dispatch(eventType, { type: eventType, data: data.join('\n'), url: s.url, lastEventId: s.lastEventId });
        data = [];
        type = undefined;
      }
    }
  }
}

export function useAiChat() {
  const { callAuthenticated, accessToken } = useAuth();

  const getHistory = useCallback(async (tripId: string): Promise<AiChatMessage[]> => {
    const response = await callAuthenticated(`/trips/${tripId}/ai-chat`);
    if (!response.ok) throw new AppError(response.status as ErrorCode);
    return response.json();
  }, [callAuthenticated]);

  const streamMessage = useCallback((
    tripId: string,
    content: string,
    onToken: (token: string) => void,
    onDone: () => void,
    onError: (err: Error) => void
  ): (() => void) => {
    const es = new OneShotEventSource(`${BASE_URL}/trips/${tripId}/ai-chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content }),
      pollingInterval: 0,
      timeoutBeforeConnection: 0,
    });

    let aborted = false;
    let finished = false;

    const finish = (err?: Error) => {
      if (finished) return;
      finished = true;
      es.close(); // idempotent — guards internally with status !== CLOSED
      if (aborted) return;
      if (err) onError(err);
      else onDone();
    };

    es.addEventListener('message', (event) => {
      if (event.data) onToken(event.data);
    });

    es.addEventListener('close', () => finish());

    es.addEventListener('error', (event: any) => {
      console.error('[aiChat] SSE error:', event.type, event.message ?? '');
      finish(new Error(event.message ?? event.type ?? 'SSE error'));
    });

    return () => {
      aborted = true;
      finish();
    };
  }, [accessToken]);

  return { getHistory, streamMessage };
}
