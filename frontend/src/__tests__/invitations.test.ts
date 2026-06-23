import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useInvitations, useInvitationsQuery } from '../invitations';

const mockCallAuthenticated = jest.fn();

jest.mock('../auth', () => ({
  useAuth: () => ({ callAuthenticated: mockCallAuthenticated }),
}));

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

const okResponse = (data: unknown = null) => ({
  ok: true,
  json: () => Promise.resolve(data),
});

const errorResponse = (status = 404) => ({ ok: false, status });

beforeEach(() => {
  jest.clearAllMocks();
  mockCallAuthenticated.mockResolvedValue(okResponse([]));
});

// ── useInvitations — getMyInvitations ─────────────────────────────────────────

describe('useInvitations — getMyInvitations', () => {
  it('calls GET /users/me/invitations and returns data', async () => {
    const data = [{ id: 'inv-1' }];
    mockCallAuthenticated.mockResolvedValue(okResponse(data));
    const { result } = renderHook(() => useInvitations(), { wrapper: makeWrapper() });
    const res = await result.current.getMyInvitations();
    expect(mockCallAuthenticated).toHaveBeenCalledWith('/users/me/invitations');
    expect(res).toEqual(data);
  });

  it('throws AppError on non-ok response', async () => {
    mockCallAuthenticated.mockResolvedValue(errorResponse(401));
    const { result } = renderHook(() => useInvitations(), { wrapper: makeWrapper() });
    await expect(result.current.getMyInvitations()).rejects.toThrow();
  });
});

// ── useInvitations — inviteUser ───────────────────────────────────────────────

describe('useInvitations — inviteUser', () => {
  it('calls POST /users/<userId>/invitations with tripId body', async () => {
    const { result } = renderHook(() => useInvitations(), { wrapper: makeWrapper() });
    await result.current.inviteUser('user-5', 'trip-1');
    expect(mockCallAuthenticated).toHaveBeenCalledWith('/users/user-5/invitations', {
      method: 'POST',
      body: JSON.stringify({ tripId: 'trip-1' }),
    });
  });

  it('throws AppError on non-ok response', async () => {
    mockCallAuthenticated.mockResolvedValue(errorResponse(409));
    const { result } = renderHook(() => useInvitations(), { wrapper: makeWrapper() });
    await expect(result.current.inviteUser('user-5', 'trip-1')).rejects.toThrow();
  });
});

// ── useInvitations — createJoinRequest ───────────────────────────────────────

describe('useInvitations — createJoinRequest', () => {
  it('calls POST /trips/<tripId>/join-requests', async () => {
    const { result } = renderHook(() => useInvitations(), { wrapper: makeWrapper() });
    await result.current.createJoinRequest('trip-1');
    expect(mockCallAuthenticated).toHaveBeenCalledWith('/trips/trip-1/join-requests', {
      method: 'POST',
    });
  });

  it('throws AppError on non-ok response', async () => {
    mockCallAuthenticated.mockResolvedValue(errorResponse(403));
    const { result } = renderHook(() => useInvitations(), { wrapper: makeWrapper() });
    await expect(result.current.createJoinRequest('trip-1')).rejects.toThrow();
  });
});

// ── useInvitations — resolveInvitation ───────────────────────────────────────

describe('useInvitations — resolveInvitation', () => {
  it('calls DELETE with accepted: true', async () => {
    const { result } = renderHook(() => useInvitations(), { wrapper: makeWrapper() });
    await result.current.resolveInvitation('inv-1', true);
    expect(mockCallAuthenticated).toHaveBeenCalledWith('/users/me/invitations/inv-1', {
      method: 'DELETE',
      body: JSON.stringify({ accepted: true }),
    });
  });

  it('calls DELETE with accepted: false', async () => {
    const { result } = renderHook(() => useInvitations(), { wrapper: makeWrapper() });
    await result.current.resolveInvitation('inv-1', false);
    expect(mockCallAuthenticated).toHaveBeenCalledWith('/users/me/invitations/inv-1', {
      method: 'DELETE',
      body: JSON.stringify({ accepted: false }),
    });
  });

  it('throws AppError on non-ok response', async () => {
    mockCallAuthenticated.mockResolvedValue(errorResponse(404));
    const { result } = renderHook(() => useInvitations(), { wrapper: makeWrapper() });
    await expect(result.current.resolveInvitation('inv-1', true)).rejects.toThrow();
  });
});

// ── useInvitations — resolveJoinRequest ──────────────────────────────────────

describe('useInvitations — resolveJoinRequest', () => {
  it('calls DELETE /trips/<tripId>/join-requests/<requestId> with body', async () => {
    const { result } = renderHook(() => useInvitations(), { wrapper: makeWrapper() });
    await result.current.resolveJoinRequest('trip-1', 'req-7', true);
    expect(mockCallAuthenticated).toHaveBeenCalledWith('/trips/trip-1/join-requests/req-7', {
      method: 'DELETE',
      body: JSON.stringify({ accepted: true }),
    });
  });

  it('throws AppError on non-ok response', async () => {
    mockCallAuthenticated.mockResolvedValue(errorResponse(403));
    const { result } = renderHook(() => useInvitations(), { wrapper: makeWrapper() });
    await expect(result.current.resolveJoinRequest('trip-1', 'req-7', false)).rejects.toThrow();
  });
});

// ── useInvitationsQuery ───────────────────────────────────────────────────────

describe('useInvitationsQuery', () => {
  it('fetches /users/me/invitations and returns data', async () => {
    const data = [{ id: 'inv-1' }, { id: 'inv-2' }];
    mockCallAuthenticated.mockResolvedValue(okResponse(data));
    const { result } = renderHook(() => useInvitationsQuery(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockCallAuthenticated).toHaveBeenCalledWith('/users/me/invitations');
    expect(result.current.data).toEqual(data);
  });

  it('sets isError on non-ok response', async () => {
    mockCallAuthenticated.mockResolvedValue(errorResponse(401));
    const { result } = renderHook(() => useInvitationsQuery(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
