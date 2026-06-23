import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { GroupChatProvider, useTripChat } from '../groupChat';

const mockCallAuthenticated = jest.fn();

jest.mock('../auth', () => ({
  useAuth: () => ({
    callAuthenticated: mockCallAuthenticated,
    accessToken: 'test-token',
    userId: 'user-me',
  }),
}));

const mockT = jest.fn((key: string) => key);
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT }),
}));

jest.mock('../../constants/constants', () => ({
  BASE_URL: 'http://localhost:8082',
}));

// ── Fake EventSource ──────────────────────────────────────────────────────────

type Listener = (event: any) => void;

interface FakeInstance {
  url: string;
  options: any;
  listeners: Record<string, Listener[]>;
  close: jest.Mock;
  addEventListener: (type: string, fn: Listener) => void;
}

let mockFakeInstance: FakeInstance;

jest.mock('react-native-sse', () => {
  return jest.fn().mockImplementation((url: string, options: any) => {
    mockFakeInstance = {
      url,
      options,
      listeners: {},
      close: jest.fn(),
      addEventListener(type: string, fn: Listener) {
        (this.listeners[type] ??= []).push(fn);
      },
    };
    return mockFakeInstance;
  });
});

function emit(type: string, payload?: Record<string, unknown>) {
  mockFakeInstance.listeners[type]?.forEach(fn => fn(payload ?? {}));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const sampleMessages = [
  { id: 'm1', content: 'Hello', senderId: 'user-other', sentAt: '2025-01-01T10:00:00Z' },
];

const okResponse = (data: unknown = []) => ({
  ok: true,
  json: () => Promise.resolve(data),
});

const errorResponse = (status = 500) => ({ ok: false, status });

function makeWrapper(tripId = 'trip-1') {
  return ({ children }: { children: React.ReactNode }) => (
    <GroupChatProvider tripId={tripId}>{children}</GroupChatProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCallAuthenticated.mockResolvedValue(okResponse([]));
});

// ── Initial state ─────────────────────────────────────────────────────────────

describe('GroupChatProvider — initial state', () => {
  it('starts with loading: true and empty messages', () => {
    mockCallAuthenticated.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useTripChat(), { wrapper: makeWrapper() });
    expect(result.current.loading).toBe(true);
    expect(result.current.messages).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
  });
});

// ── History loading ───────────────────────────────────────────────────────────

describe('GroupChatProvider — history loading', () => {
  it('sets loading: false and populates messages after history resolves', async () => {
    mockCallAuthenticated.mockResolvedValue(okResponse(sampleMessages));
    const { result } = renderHook(() => useTripChat(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.messages).toEqual(sampleMessages);
    expect(result.current.error).toBeNull();
  });

  it('sets error when history fetch fails', async () => {
    mockCallAuthenticated.mockResolvedValue(errorResponse(500));
    const { result } = renderHook(() => useTripChat(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('trip.unableLoadChat');
  });

  it('opens SSE stream with correct URL and auth header', async () => {
    mockCallAuthenticated.mockResolvedValue(okResponse([]));
    renderHook(() => useTripChat(), { wrapper: makeWrapper('trip-7') });
    await waitFor(() => expect(mockFakeInstance).toBeDefined());
    expect(mockFakeInstance.url).toBe('http://localhost:8082/trips/trip-7/group-chat/stream');
    expect(mockFakeInstance.options.headers['Authorization']).toBe('Bearer test-token');
  });
});

// ── SSE events ────────────────────────────────────────────────────────────────

describe('GroupChatProvider — SSE events', () => {
  it('appends received message and increments unreadCount when not viewing', async () => {
    mockCallAuthenticated.mockResolvedValue(okResponse([]));
    const { result } = renderHook(() => useTripChat(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const newMsg = { id: 'm2', content: 'Hi', senderId: 'user-other', sentAt: '2025-01-01T11:00:00Z' };
    act(() => emit('message', { data: JSON.stringify(newMsg) }));

    expect(result.current.messages).toContainEqual(newMsg);
    expect(result.current.unreadCount).toBe(1);
  });

  it('does not increment unreadCount for own messages', async () => {
    mockCallAuthenticated.mockResolvedValue(okResponse([]));
    const { result } = renderHook(() => useTripChat(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const ownMsg = { id: 'm3', content: 'Mine', senderId: 'user-me', sentAt: '2025-01-01T11:00:00Z' };
    act(() => emit('message', { data: JSON.stringify(ownMsg) }));

    expect(result.current.messages).toContainEqual(ownMsg);
    expect(result.current.unreadCount).toBe(0);
  });

  it('does not add duplicate messages', async () => {
    mockCallAuthenticated.mockResolvedValue(okResponse([]));
    const { result } = renderHook(() => useTripChat(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const msg = { id: 'm-dup', content: 'dup', senderId: 'user-other', sentAt: '' };
    act(() => emit('message', { data: JSON.stringify(msg) }));
    act(() => emit('message', { data: JSON.stringify(msg) }));

    expect(result.current.messages.filter(m => m.id === 'm-dup')).toHaveLength(1);
  });

  it('ignores malformed SSE data', async () => {
    mockCallAuthenticated.mockResolvedValue(okResponse([]));
    const { result } = renderHook(() => useTripChat(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => emit('message', { data: 'not-json' }));

    expect(result.current.messages).toHaveLength(0);
  });
});

// ── send ──────────────────────────────────────────────────────────────────────

describe('GroupChatProvider — send', () => {
  it('calls POST /trips/<id>/group-chat and appends the returned message', async () => {
    mockCallAuthenticated.mockResolvedValue(okResponse([]));
    const { result } = renderHook(() => useTripChat(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const sentMsg = { id: 'm-sent', content: 'Hello!', senderId: 'user-me', sentAt: '' };
    mockCallAuthenticated.mockResolvedValue(okResponse(sentMsg));

    await act(async () => { await result.current.send('Hello!'); });

    expect(mockCallAuthenticated).toHaveBeenCalledWith('/trips/trip-1/group-chat', {
      method: 'POST',
      body: JSON.stringify({ content: 'Hello!' }),
    });
    expect(result.current.messages).toContainEqual(sentMsg);
    expect(result.current.sending).toBe(false);
  });

  it('resets sending and rethrows on send failure', async () => {
    mockCallAuthenticated.mockResolvedValue(okResponse([]));
    const { result } = renderHook(() => useTripChat(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    mockCallAuthenticated.mockResolvedValue(errorResponse(500));

    await expect(
      act(async () => { await result.current.send('oops'); }),
    ).rejects.toThrow();

    expect(result.current.sending).toBe(false);
  });
});

// ── markRead / setViewing ─────────────────────────────────────────────────────

describe('GroupChatProvider — markRead and setViewing', () => {
  it('markRead resets unreadCount to 0', async () => {
    mockCallAuthenticated.mockResolvedValue(okResponse([]));
    const { result } = renderHook(() => useTripChat(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const msg = { id: 'm-u', content: 'hi', senderId: 'user-other', sentAt: '' };
    act(() => emit('message', { data: JSON.stringify(msg) }));
    expect(result.current.unreadCount).toBe(1);

    act(() => result.current.markRead());
    expect(result.current.unreadCount).toBe(0);
  });

  it('setViewing(true) clears unreadCount and suppresses future unread increments', async () => {
    mockCallAuthenticated.mockResolvedValue(okResponse([]));
    const { result } = renderHook(() => useTripChat(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setViewing(true));

    const msg = { id: 'm-v', content: 'hi', senderId: 'user-other', sentAt: '' };
    act(() => emit('message', { data: JSON.stringify(msg) }));

    expect(result.current.unreadCount).toBe(0);
    expect(result.current.messages).toContainEqual(msg);
  });
});

// ── useTripChat outside provider ──────────────────────────────────────────────

describe('useTripChat outside provider', () => {
  it('returns context defaults (loading: true, messages: [])', () => {
    const { result } = renderHook(() => useTripChat());
    expect(result.current.loading).toBe(true);
    expect(result.current.messages).toEqual([]);
  });
});
