import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './auth';
import type { components } from './generated/types';
import { AppError, ErrorCode } from './AppError';
import { userKeys } from './queryKeys';
import { uploadToUrl } from './upload';

type UserProfile = components['schemas']['UserProfile'];
type OwnProfile = components['schemas']['OwnProfile'];
type UpdateProfileRequest = components['schemas']['UpdateProfileRequest'];
type ChangePasswordRequest = components['schemas']['ChangePasswordRequest'];
type LoginResponse = components['schemas']['LoginResponse'];
type AvatarUploadResponse = components['schemas']['AvatarUploadResponse'];
type AvatarDownloadResponse = components['schemas']['AvatarDownloadResponse'];

export function useMyProfileQuery() {
  const { callAuthenticated, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: userKeys.me(),
    queryFn: async (): Promise<OwnProfile> => {
      const response = await callAuthenticated('/users/me');
      if (!response.ok) throw new AppError(response.status as ErrorCode);
      return response.json();
    },
    enabled: isAuthenticated,
  });
}

export function useAvatarQuery(userId: string | null | undefined, options?: { enabled?: boolean }) {
  const { callAuthenticated } = useAuth();
  return useQuery({
    queryKey: userKeys.avatar(userId ?? ''),
    queryFn: async (): Promise<string | null> => {
      const response = await callAuthenticated(`/users/${userId}/avatar`);
      if (response.status === 404) return null;
      if (!response.ok) throw new AppError(response.status as ErrorCode);
      const data: AvatarDownloadResponse = await response.json();
      return data.downloadUrl;
    },
    enabled: !!userId && (options?.enabled ?? true),
    staleTime: 10 * 60 * 1000,
  });
}

export function useUpdateProfileMutation() {
  const { callAuthenticated, updateStoredUsername, updateStoredEmail } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: UpdateProfileRequest): Promise<OwnProfile> => {
      const response = await callAuthenticated('/users/me', {
        method: 'PATCH',
        body: JSON.stringify(request),
      });
      if (!response.ok) throw new AppError(response.status as ErrorCode);
      return response.json();
    },
    onSuccess: async (profile) => {
      await Promise.all([
        updateStoredUsername(profile.username),
        updateStoredEmail(profile.email),
      ]);
      queryClient.setQueryData(userKeys.me(), profile);
      // member lists and chat messages embed the username
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
  });
}

export function useChangePasswordMutation() {
  const { callAuthenticated, applyTokens } = useAuth();
  return useMutation({
    mutationFn: async (request: ChangePasswordRequest): Promise<LoginResponse> => {
      const response = await callAuthenticated('/users/me/password', {
        method: 'PUT',
        body: JSON.stringify(request),
      });
      if (!response.ok) throw new AppError(response.status as ErrorCode);
      return response.json();
    },
    onSuccess: async ({ accessToken, refreshToken }) => {
      // the backend revoked every refresh token; keep this device logged in
      await applyTokens(accessToken, refreshToken);
    },
  });
}

type UploadAvatarParams = {
  fileUri: string;
  contentType: string;
};

export function useUploadAvatarMutation(userId: string | null) {
  const { callAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ fileUri, contentType }: UploadAvatarParams): Promise<void> => {
      const initResponse = await callAuthenticated('/users/me/avatar', {
        method: 'POST',
        body: JSON.stringify({ contentType }),
      });
      if (!initResponse.ok) throw new AppError(initResponse.status as ErrorCode);
      const { uploadUrl }: AvatarUploadResponse = await initResponse.json();

      await uploadToUrl(uploadUrl, fileUri, contentType);

      const confirmResponse = await callAuthenticated('/users/me/avatar/confirm', { method: 'POST' });
      if (!confirmResponse.ok) throw new AppError(confirmResponse.status as ErrorCode);
    },
    onSuccess: () => {
      if (userId) queryClient.invalidateQueries({ queryKey: userKeys.avatar(userId) });
      queryClient.invalidateQueries({ queryKey: userKeys.me() });
      // hasAvatar travels inside trip member profiles
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
  });
}

export type { UserProfile, OwnProfile };
