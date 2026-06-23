import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../auth';

// ── SecureStore mock ──────────────────────────────────────────────────────────
// Stateful: setItemAsync writes to mockSecureStorage so getItemAsync reads it back.

const mockGetItemAsync = jest.fn();
const mockSetItemAsync = jest.fn();
const mockDeleteItemAsync = jest.fn();

jest.mock('expo-secure-store', () => ({
  getItemAsync: (...args: unknown[]) => mockGetItemAsync(...args),
  setItemAsync: (...args: unknown[]) => mockSetItemAsync(...args),
  deleteItemAsync: (...args: unknown[]) => mockDeleteItemAsync(...args),
}));

const mockClearLastTripId = jest.fn();
const mockClearLastTripTab = jest.fn();

jest.mock('../lastTrip', () => ({
  clearLastTripId: (...args: unknown[]) => mockClearLastTripId(...args),
  clearLastTripTab: (...args: unknown[]) => mockClearLastTripTab(...args),
}));

jest.mock('../../constants/constants', () => ({
  BASE_URL: 'http://localhost:8082',
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeJwt(userId: string): string {
  const payload = Buffer.from(JSON.stringify({ sub: userId })).toString('base64');
  return `header.${payload}.signature`;
}

const fetchOk = (data: unknown) =>
  Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) } as Response);

const fetchError = (status: number) =>
  Promise.resolve({ ok: false, status, json: () => Promise.resolve({}) } as Response);

function makeWrapper() {
  return ({ children }: { children: React.ReactNode }) =>
    <AuthProvider>{children}</AuthProvider>;
}

// ── Setup ─────────────────────────────────────────────────────────────────────

let mockSecureStorage: Record<string, string> = {};

beforeEach(() => {
  jest.clearAllMocks();
  mockSecureStorage = {};

  mockGetItemAsync.mockImplementation((key: string) =>
    Promise.resolve(mockSecureStorage[key] ?? null),
  );
  mockSetItemAsync.mockImplementation((key: string, value: string) => {
    mockSecureStorage[key] = value;
    return Promise.resolve();
  });
  mockDeleteItemAsync.mockImplementation((key: string) => {
    delete mockSecureStorage[key];
    return Promise.resolve();
  });

  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
  mockClearLastTripId.mockResolvedValue(undefined);
  mockClearLastTripTab.mockResolvedValue(undefined);
});

// Renders AuthProvider with a pre-established authenticated session.
async function renderWithAuth(jwt = makeJwt('user-1')) {
  mockSecureStorage['refreshToken'] = 'stored-refresh';
  (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
    if (key === 'userEmail') return Promise.resolve('test@example.com');
    if (key === 'username') return Promise.resolve('testuser');
    return Promise.resolve(null);
  });
  jest.spyOn(global, 'fetch').mockResolvedValueOnce(
    fetchOk({ accessToken: jwt, refreshToken: 'new-refresh' }) as any,
  );
  const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  return { result };
}

// ── Group 1: Session restoration on mount ────────────────────────────────────

describe('session restoration — no stored token', () => {
  it('settles to isLoading: false, isAuthenticated: false', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.accessToken).toBeNull();
    expect(result.current.userId).toBeNull();
  });
});

describe('session restoration — valid refresh token', () => {
  it('calls refresh endpoint, sets isAuthenticated: true and userId from JWT', async () => {
    const jwt = makeJwt('user-42');
    const { result } = await renderWithAuth(jwt);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.accessToken).toBe(jwt);
    expect(result.current.userId).toBe('user-42');
  });

  it('populates userEmail and username from AsyncStorage', async () => {
    const { result } = await renderWithAuth();
    expect(result.current.userEmail).toBe('test@example.com');
    expect(result.current.username).toBe('testuser');
  });
});

describe('session restoration — refresh endpoint fails', () => {
  it('non-ok refresh response → isAuthenticated: false', async () => {
    mockSecureStorage['refreshToken'] = 'expired-refresh';
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(fetchError(401) as any);
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('SecureStore throws → isAuthenticated: false', async () => {
    mockGetItemAsync.mockRejectedValue(new Error('SecureStore unavailable'));
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
  });
});

// ── Group 2: login() ──────────────────────────────────────────────────────────

describe('login()', () => {
  it('success → isAuthenticated: true, tokens written to SecureStore', async () => {
    const jwt = makeJwt('user-1');
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      fetchOk({ accessToken: jwt, refreshToken: 'refresh-1', username: 'jorge' }) as any,
    );

    await act(async () => { await result.current.login('jorge@example.com', 'pass'); });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.accessToken).toBe(jwt);
    expect(mockSecureStorage['accessToken']).toBe(jwt);
    expect(mockSecureStorage['refreshToken']).toBe('refresh-1');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('userEmail', 'jorge@example.com');
  });

  it('401 from server → throws AppError, isAuthenticated stays false', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    jest.spyOn(global, 'fetch').mockResolvedValueOnce(fetchError(401) as any);

    await expect(result.current.login('bad@example.com', 'wrong')).rejects.toThrow();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('storage write failure → throws AppError, isAuthenticated stays false', async () => {
    const jwt = makeJwt('user-1');
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      fetchOk({ accessToken: jwt, refreshToken: 'r', username: 'u' }) as any,
    );
    mockSetItemAsync.mockRejectedValue(new Error('disk full'));

    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(result.current.login('j@example.com', 'pw')).rejects.toThrow();
    expect(result.current.isAuthenticated).toBe(false);
  });
});

// ── Group 3: register() ───────────────────────────────────────────────────────

describe('register()', () => {
  it('success → isAuthenticated: true', async () => {
    const jwt = makeJwt('user-1');
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      fetchOk({ accessToken: jwt, refreshToken: 'r', username: 'newuser' }) as any,
    );

    await act(async () => {
      await result.current.register('newuser', 'new@example.com', 'password');
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.accessToken).toBe(jwt);
  });

  it('409 conflict → throws AppError', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    jest.spyOn(global, 'fetch').mockResolvedValueOnce(fetchError(409) as any);

    await expect(
      result.current.register('taken', 'taken@example.com', 'pw'),
    ).rejects.toThrow();
  });
});

// ── Group 4: logout() ─────────────────────────────────────────────────────────

describe('logout()', () => {
  it('success → isAuthenticated: false, tokens deleted from SecureStore', async () => {
    const { result } = await renderWithAuth();

    jest.spyOn(global, 'fetch').mockResolvedValueOnce(fetchOk({}) as any);

    await act(async () => { await result.current.logout(); });

    expect(result.current.isAuthenticated).toBe(false);
    expect(mockSecureStorage['refreshToken']).toBeUndefined();
    expect(mockSecureStorage['accessToken']).toBeUndefined();
    expect(AsyncStorage.removeItem).toHaveBeenCalled();
  });

  it('logout endpoint fails → local session still cleared', async () => {
    const { result } = await renderWithAuth();

    jest.spyOn(global, 'fetch').mockResolvedValueOnce(fetchError(500) as any);

    await act(async () => { await result.current.logout(); });

    expect(result.current.isAuthenticated).toBe(false);
  });
});

// ── Group 5: callAuthenticated() ─────────────────────────────────────────────

describe('callAuthenticated()', () => {
  it('sends Authorization: Bearer header with current access token', async () => {
    const jwt = makeJwt('user-1');
    const { result } = await renderWithAuth(jwt);

    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce(fetchOk({ ok: true }) as any);

    await result.current.callAuthenticated('/some/endpoint');

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:8082/some/endpoint',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${jwt}` }),
      }),
    );
  });

  it('401 response → refreshes token, retries with new token', async () => {
    const oldJwt = makeJwt('user-1');
    const newJwt = `header.${Buffer.from(JSON.stringify({ sub: 'user-1' })).toString('base64')}.new`;

    const { result } = await renderWithAuth(oldJwt);

    const fetchSpy = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(fetchError(401) as any)
      .mockResolvedValueOnce(fetchOk({ accessToken: newJwt, refreshToken: 'new-r' }) as any)
      .mockResolvedValueOnce(fetchOk({ data: 'ok' }) as any);

    const response = await result.current.callAuthenticated('/secure/data');

    expect(response.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:8082/auth/refresh',
      expect.objectContaining({ method: 'POST' }),
    );
    const retryCalls = fetchSpy.mock.calls.filter(
      c => String(c[0]).includes('/secure/data'),
    );
    expect(retryCalls).toHaveLength(2);
    const retryHeaders = retryCalls[1][1]?.headers as Record<string, string>;
    expect(retryHeaders?.Authorization).toBe(`Bearer ${newJwt}`);
  });

  it('concurrent 401s → refresh endpoint called exactly once', async () => {
    const oldJwt = makeJwt('user-1');
    const newJwt = `header.${Buffer.from(JSON.stringify({ sub: 'user-1' })).toString('base64')}.new`;

    const { result } = await renderWithAuth(oldJwt);

    let refreshCount = 0;
    jest.spyOn(global, 'fetch').mockImplementation((url: any, opts: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/auth/refresh')) {
        refreshCount++;
        return fetchOk({ accessToken: newJwt, refreshToken: 'new-r' });
      }
      const auth = (opts?.headers as Record<string, string>)?.Authorization ?? '';
      if (auth.includes(newJwt)) return fetchOk({ data: 'ok' });
      return Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({}) } as Response);
    });

    const [r1, r2] = await Promise.all([
      result.current.callAuthenticated('/data'),
      result.current.callAuthenticated('/data'),
    ]);

    expect(refreshCount).toBe(1);
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
  });

  it('refresh fails during 401 retry → throws, session cleared', async () => {
    const { result } = await renderWithAuth();

    jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(fetchError(401) as any)
      .mockResolvedValueOnce(fetchError(401) as any);

    await expect(result.current.callAuthenticated('/secure')).rejects.toThrow();
    await waitFor(() => expect(result.current.isAuthenticated).toBe(false));
  });
});

// ── Group 6: profile update helpers ──────────────────────────────────────────

describe('updateStoredUsername()', () => {
  it('writes to AsyncStorage and updates context state', async () => {
    const { result } = await renderWithAuth();

    await act(async () => { await result.current.updateStoredUsername('new_jorge'); });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith('username', 'new_jorge');
    expect(result.current.username).toBe('new_jorge');
  });
});

describe('updateStoredEmail()', () => {
  it('writes to AsyncStorage and updates context state', async () => {
    const { result } = await renderWithAuth();

    await act(async () => { await result.current.updateStoredEmail('new@example.com'); });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith('userEmail', 'new@example.com');
    expect(result.current.userEmail).toBe('new@example.com');
  });
});

describe('applyTokens()', () => {
  it('writes both tokens to SecureStore and updates accessToken in state', async () => {
    const { result } = await renderWithAuth();

    const newAccess = makeJwt('user-1');
    await act(async () => { await result.current.applyTokens(newAccess, 'new-refresh'); });

    expect(mockSecureStorage['accessToken']).toBe(newAccess);
    expect(mockSecureStorage['refreshToken']).toBe('new-refresh');
    expect(result.current.accessToken).toBe(newAccess);
  });
});

// ── useAuth outside provider ──────────────────────────────────────────────────

describe('useAuth outside AuthProvider', () => {
  it('throws the expected error message', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useAuth())).toThrow('useAuth debe usarse dentro de AuthProvider');
    spy.mockRestore();
  });
});
