import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './auth';
import { AppError, ErrorCode } from './AppError';
import type { components } from './generated/types';
import { invitationKeys, tripKeys } from './queryKeys';

type InvitationSummary = components['schemas']['InvitationSummary'];

export function useInvitations() {
  const { callAuthenticated } = useAuth();

  const getMyInvitations = useCallback(async (): Promise<InvitationSummary[]> => {
    const response = await callAuthenticated('/users/me/invitations');
    if (!response.ok) throw new AppError(response.status as ErrorCode);
    return response.json();
  }, [callAuthenticated]);

  const inviteUser = useCallback(async (userId: string, tripId: string): Promise<void> => {
    const response = await callAuthenticated(`/users/${userId}/invitations`, {
      method: 'POST',
      body: JSON.stringify({ tripId }),
    });
    if (!response.ok) throw new AppError(response.status as ErrorCode);
  }, [callAuthenticated]);

  const createJoinRequest = useCallback(async (tripId: string): Promise<void> => {
    const response = await callAuthenticated(`/trips/${tripId}/join-requests`, {
      method: 'POST',
    });
    if (!response.ok) throw new AppError(response.status as ErrorCode);
  }, [callAuthenticated]);

  const resolveInvitation = useCallback(async (invitationId: string, accepted: boolean): Promise<void> => {
    const response = await callAuthenticated(`/users/me/invitations/${invitationId}`, {
      method: 'DELETE',
      body: JSON.stringify({ accepted }),
    });
    if (!response.ok) throw new AppError(response.status as ErrorCode);
  }, [callAuthenticated]);

  const resolveJoinRequest = useCallback(async (tripId: string, requestId: string, accepted: boolean): Promise<void> => {
    const response = await callAuthenticated(`/trips/${tripId}/join-requests/${requestId}`, {
      method: 'DELETE',
      body: JSON.stringify({ accepted }),
    });
    if (!response.ok) throw new AppError(response.status as ErrorCode);
  }, [callAuthenticated]);

  return { getMyInvitations, inviteUser, createJoinRequest, resolveInvitation, resolveJoinRequest };
}

export function useInvitationsQuery() {
  const { callAuthenticated } = useAuth();
  return useQuery({
    queryKey: invitationKeys.list(),
    queryFn: async (): Promise<InvitationSummary[]> => {
      const response = await callAuthenticated('/users/me/invitations');
      if (!response.ok) throw new AppError(response.status as ErrorCode);
      return response.json();
    },
  });
}

function useResolveInvitationMutation() {
  const { callAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ invitationId, accepted }: { invitationId: string; accepted: boolean }): Promise<void> => {
      const response = await callAuthenticated(`/users/me/invitations/${invitationId}`, {
        method: 'DELETE',
        body: JSON.stringify({ accepted }),
      });
      if (!response.ok) throw new AppError(response.status as ErrorCode);
    },
    onSuccess: (_, { accepted }) => {
      queryClient.invalidateQueries({ queryKey: invitationKeys.list() });
      if (accepted) queryClient.invalidateQueries({ queryKey: tripKeys.lists() });
    },
  });
}
