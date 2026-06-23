import { renderHook } from '@testing-library/react-native';
import { useAiChat } from '../aiChat';

const mockCallAuthenticated = jest.fn();

jest.mock('../auth', () => ({
  useAuth: () => ({
    callAuthenticated: mockCallAuthenticated,
    accessToken: 'test-token',
  }),
}));

jest.mock('../../constants/constants', () => ({
  BASE_URL: 'http://localhost:8082',
}));

// ── Fake EventSource ──────────────────────────────────────────────────────────

type Listener = (event: any) => void;

interface FakeInstance {
  listeners: Record<string, Listener[]>;
  close: jest.Mock;
  addEventListener: (type: string, fn: Listener) => void;
  options: any;
  url: string;
}

// Prefixed with "mock" so Jest's factory hoisting allows referencing it.
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

const okResponse = (data: unknown = {}) => ({
  ok: true,
  json: () => Promise.resolve(data),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockCallAuthenticated.mockResolvedValue(okResponse());
});

// ── getHistory ────────────────────────────────────────────────────────────────

describe('getHistory', () => {
  it('calls the correct URL without a before param', async () => {
    const { result } = renderHook(() => useAiChat());
    await result.current.getHistory('trip-1');
    expect(mockCallAuthenticated).toHaveBeenCalledWith('/trips/trip-1/ai-chat');
  });

  it('appends ?before= when a timestamp is provided', async () => {
    const { result } = renderHook(() => useAiChat());
    await result.current.getHistory('trip-1', '2025-01-15T10:30:00Z');
    expect(mockCallAuthenticated).toHaveBeenCalledWith(
      '/trips/trip-1/ai-chat?before=2025-01-15T10%3A30%3A00Z'
    );
  });

  it('returns parsed JSON on success', async () => {
    const page = { messages: [], hasMore: false };
    mockCallAuthenticated.mockResolvedValue(okResponse(page));
    const { result } = renderHook(() => useAiChat());
    const res = await result.current.getHistory('trip-1');
    expect(res).toEqual(page);
  });

  it('throws AppError on non-ok response', async () => {
    mockCallAuthenticated.mockResolvedValue({ ok: false, status: 403 });
    const { result } = renderHook(() => useAiChat());
    await expect(result.current.getHistory('trip-1')).rejects.toThrow();
  });
});

// ── streamMessage ─────────────────────────────────────────────────────────────

describe('streamMessage', () => {
  it('creates EventSource with correct URL, method, and headers', () => {
    const { result } = renderHook(() => useAiChat());
    result.current.streamMessage('trip-7', 'hello', jest.fn(), jest.fn(), jest.fn());

    expect(mockFakeInstance.url).toBe('http://localhost:8082/trips/trip-7/ai-chat');
    expect(mockFakeInstance.options.method).toBe('POST');
    expect(mockFakeInstance.options.headers['Authorization']).toBe('Bearer test-token');
    expect(mockFakeInstance.options.headers['Content-Type']).toBe('application/json');
    expect(mockFakeInstance.options.body).toBe(JSON.stringify({ content: 'hello' }));
  });

  it('calls onToken for each message event', () => {
    const onToken = jest.fn();
    const { result } = renderHook(() => useAiChat());
    result.current.streamMessage('trip-7', 'hi', onToken, jest.fn(), jest.fn());

    emit('message', { data: 'Hola' });
    emit('message', { data: ' mundo' });

    expect(onToken).toHaveBeenCalledTimes(2);
    expect(onToken).toHaveBeenNthCalledWith(1, 'Hola');
    expect(onToken).toHaveBeenNthCalledWith(2, ' mundo');
  });

  it('calls onDone when the close event fires', () => {
    const onDone = jest.fn();
    const { result } = renderHook(() => useAiChat());
    result.current.streamMessage('trip-7', 'hi', jest.fn(), onDone, jest.fn());

    emit('close');

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('calls onError when the error event fires', () => {
    const onError = jest.fn();
    const { result } = renderHook(() => useAiChat());
    result.current.streamMessage('trip-7', 'hi', jest.fn(), jest.fn(), onError);

    emit('error', { type: 'error', message: 'network fail' });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
  });

  it('abort function closes the stream and suppresses onDone', () => {
    const onDone = jest.fn();
    const { result } = renderHook(() => useAiChat());
    const abort = result.current.streamMessage('trip-7', 'hi', jest.fn(), onDone, jest.fn());

    abort();
    emit('close');

    expect(mockFakeInstance.close).toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('abort function suppresses onError', () => {
    const onError = jest.fn();
    const { result } = renderHook(() => useAiChat());
    const abort = result.current.streamMessage('trip-7', 'hi', jest.fn(), jest.fn(), onError);

    abort();
    emit('error', { type: 'error' });

    expect(onError).not.toHaveBeenCalled();
  });
});
