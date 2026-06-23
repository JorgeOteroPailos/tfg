import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useFriends,
  useFriendsQuery,
  useFriendRequestsQuery,
  useRemoveFriend,
  useInviteFriendToTrip,
} from '../friends';
import { friendKeys, invitationKeys } from '../queryKeys';

const mockCallAuthenticated = jest.fn();

jest.mock('../auth', () => ({
  useAuth: () => ({ callAuthenticated: mockCallAuthenticated }),
}));

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

const okResponse = (data: unknown = []) => ({
  ok: true,
  json: () => Promise.resolve(data),
});

const errorResponse = (status = 404) => ({ ok: false, status });

beforeEach(() => {
  jest.clearAllMocks();
  mockCallAuthenticated.mockResolvedValue(okResponse());
});

// ── useFriends ────────────────────────────────────────────────────────────────

describe('useFriends — sendFriendRequestById', () => {
  it('calls the correct endpoint', async () => {
    const { result } = renderHook(() => useFriends(), { wrapper: makeWrapper() });
    await result.current.sendFriendRequestById('user-42');
    expect(mockCallAuthenticated).toHaveBeenCalledWith('/users/user-42/friend-requests', {
      method: 'POST',
    });
  });

  it('throws AppError on non-ok response', async () => {
    mockCallAuthenticated.mockResolvedValue(errorResponse(409));
    const { result } = renderHook(() => useFriends(), { wrapper: makeWrapper() });
    await expect(result.current.sendFriendRequestById('user-42')).rejects.toThrow();
  });
});

describe('useFriends — resolveFriendRequest', () => {
  it('calls DELETE with accepted: true', async () => {
    const { result } = renderHook(() => useFriends(), { wrapper: makeWrapper() });
    await result.current.resolveFriendRequest('req-1', true);
    expect(mockCallAuthenticated).toHaveBeenCalledWith('/users/me/friend-requests/req-1', {
      method: 'DELETE',
      body: JSON.stringify({ accepted: true }),
    });
  });

  it('calls DELETE with accepted: false', async () => {
    const { result } = renderHook(() => useFriends(), { wrapper: makeWrapper() });
    await result.current.resolveFriendRequest('req-1', false);
    expect(mockCallAuthenticated).toHaveBeenCalledWith('/users/me/friend-requests/req-1', {
      method: 'DELETE',
      body: JSON.stringify({ accepted: false }),
    });
  });

  it('throws AppError on non-ok response', async () => {
    mockCallAuthenticated.mockResolvedValue(errorResponse(403));
    const { result } = renderHook(() => useFriends(), { wrapper: makeWrapper() });
    await expect(result.current.resolveFriendRequest('req-1', true)).rejects.toThrow();
  });
});

describe('useFriends — getMyFriendRequests', () => {
  it('calls GET /users/me/friend-requests and returns data', async () => {
    const data = [{ id: 'r1' }];
    mockCallAuthenticated.mockResolvedValue(okResponse(data));
    const { result } = renderHook(() => useFriends(), { wrapper: makeWrapper() });
    const res = await result.current.getMyFriendRequests();
    expect(mockCallAuthenticated).toHaveBeenCalledWith('/users/me/friend-requests');
    expect(res).toEqual(data);
  });

  it('throws AppError on non-ok response', async () => {
    mockCallAuthenticated.mockResolvedValue(errorResponse(500));
    const { result } = renderHook(() => useFriends(), { wrapper: makeWrapper() });
    await expect(result.current.getMyFriendRequests()).rejects.toThrow();
  });
});

// ── useFriendsQuery ──────────────────────────────────────────────────────────

describe('useFriendsQuery', () => {
  it('fetches /users/me/friends and returns data', async () => {
    const friends = [{ id: 'u1', username: 'alice' }];
    mockCallAuthenticated.mockResolvedValue(okResponse(friends));

    const { result } = renderHook(() => useFriendsQuery(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockCallAuthenticated).toHaveBeenCalledWith('/users/me/friends');
    expect(result.current.data).toEqual(friends);
  });

  it('sets isError on non-ok response', async () => {
    mockCallAuthenticated.mockResolvedValue(errorResponse(401));

    const { result } = renderHook(() => useFriendsQuery(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ── useFriendRequestsQuery ───────────────────────────────────────────────────

describe('useFriendRequestsQuery', () => {
  it('fetches /users/me/friend-requests and returns data', async () => {
    const requests = [{ id: 'r1' }];
    mockCallAuthenticated.mockResolvedValue(okResponse(requests));

    const { result } = renderHook(() => useFriendRequestsQuery(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockCallAuthenticated).toHaveBeenCalledWith('/users/me/friend-requests');
    expect(result.current.data).toEqual(requests);
  });

  it('sets isError on non-ok response', async () => {
    mockCallAuthenticated.mockResolvedValue(errorResponse(403));

    const { result } = renderHook(() => useFriendRequestsQuery(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ── useRemoveFriend ──────────────────────────────────────────────────────────

describe('useRemoveFriend', () => {
  it('calls DELETE /users/me/friends/<id>', async () => {
    const { result } = renderHook(() => useRemoveFriend(), { wrapper: makeWrapper() });
    await result.current('friend-99');
    expect(mockCallAuthenticated).toHaveBeenCalledWith('/users/me/friends/friend-99', {
      method: 'DELETE',
    });
  });

  it('throws AppError on non-ok response', async () => {
    mockCallAuthenticated.mockResolvedValue(errorResponse(404));
    const { result } = renderHook(() => useRemoveFriend(), { wrapper: makeWrapper() });
    await expect(result.current('friend-99')).rejects.toThrow();
  });
});

// ── useInviteFriendToTrip ────────────────────────────────────────────────────

describe('useInviteFriendToTrip', () => {
  it('calls POST /users/<friendId>/invitations with correct body', async () => {
    const { result } = renderHook(() => useInviteFriendToTrip(), { wrapper: makeWrapper() });
    await result.current('friend-1', 'trip-5');
    expect(mockCallAuthenticated).toHaveBeenCalledWith('/users/friend-1/invitations', {
      method: 'POST',
      body: JSON.stringify({ tripId: 'trip-5' }),
    });
  });

  it('throws AppError on non-ok response', async () => {
    mockCallAuthenticated.mockResolvedValue(errorResponse(409));
    const { result } = renderHook(() => useInviteFriendToTrip(), { wrapper: makeWrapper() });
    await expect(result.current('friend-1', 'trip-5')).rejects.toThrow();
  });
});
