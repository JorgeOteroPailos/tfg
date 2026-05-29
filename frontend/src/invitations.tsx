import { useCallback } from 'react';
import { useAuth } from './auth';
import { AppError, ErrorCode } from './AppError';
import type { components } from './generated/types';

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

  return { getMyInvitations, inviteUser, createJoinRequest, resolveInvitation };
}
