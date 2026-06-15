import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './auth';
import { AppError, ErrorCode } from './AppError';
import type { components } from './generated/types';
import { friendKeys, invitationKeys } from './queryKeys';

type UserProfile = components['schemas']['UserProfile'];
type FriendRequestSummary = components['schemas']['FriendRequestSummary'];

export function useFriends() {
  const { callAuthenticated } = useAuth();

  const resolveFriendRequest = useCallback(async (requestId: string, accepted: boolean): Promise<void> => {
    const response = await callAuthenticated(`/users/me/friend-requests/${requestId}`, {
      method: 'DELETE',
      body: JSON.stringify({ accepted }),
    });
    if (!response.ok) throw new AppError(response.status as ErrorCode);
  }, [callAuthenticated]);

  const sendFriendRequestById = useCallback(async (userId: string): Promise<void> => {
    const response = await callAuthenticated(`/users/${userId}/friend-requests`, {
      method: 'POST',
    });
    if (!response.ok) throw new AppError(response.status as ErrorCode);
  }, [callAuthenticated]);

  const getMyFriendRequests = useCallback(async (): Promise<FriendRequestSummary[]> => {
    const response = await callAuthenticated('/users/me/friend-requests');
    if (!response.ok) throw new AppError(response.status as ErrorCode);
    return response.json();
  }, [callAuthenticated]);

  return { sendFriendRequestById, resolveFriendRequest, getMyFriendRequests };
}

export function useFriendsQuery() {
  const { callAuthenticated } = useAuth();
  return useQuery({
    queryKey: friendKeys.list(),
    queryFn: async (): Promise<UserProfile[]> => {
      const response = await callAuthenticated('/users/me/friends');
      if (!response.ok) throw new AppError(response.status as ErrorCode);
      return response.json();
    },
  });
}

export function useFriendRequestsQuery() {
  const { callAuthenticated } = useAuth();
  return useQuery({
    queryKey: friendKeys.requests(),
    queryFn: async (): Promise<FriendRequestSummary[]> => {
      const response = await callAuthenticated('/users/me/friend-requests');
      if (!response.ok) throw new AppError(response.status as ErrorCode);
      return response.json();
    },
  });
}

export function useRemoveFriend() {
  const { callAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  return useCallback(async (friendId: string): Promise<void> => {
    const response = await callAuthenticated(`/users/me/friends/${friendId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new AppError(response.status as ErrorCode);
    queryClient.invalidateQueries({ queryKey: friendKeys.list() });
  }, [callAuthenticated, queryClient]);
}

export function useInviteFriendToTrip() {
  const { callAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  return useCallback(async (friendId: string, tripId: string): Promise<void> => {
    const response = await callAuthenticated(`/users/${friendId}/invitations`, {
      method: 'POST',
      body: JSON.stringify({ tripId }),
    });
    if (!response.ok) throw new AppError(response.status as ErrorCode);
    queryClient.invalidateQueries({ queryKey: invitationKeys.list() });
  }, [callAuthenticated, queryClient]);
}
