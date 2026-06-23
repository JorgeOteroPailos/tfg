import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useMyProfileQuery,
  useAvatarQuery,
  useUpdateProfileMutation,
  useChangePasswordMutation,
  useDeleteAccountMutation,
  useUploadAvatarMutation,
} from '../users';

const mockCallAuthenticated = jest.fn();
const mockUpdateStoredUsername = jest.fn().mockResolvedValue(undefined);
const mockUpdateStoredEmail = jest.fn().mockResolvedValue(undefined);
const mockApplyTokens = jest.fn().mockResolvedValue(undefined);

jest.mock('../auth', () => ({
  useAuth: () => ({
    callAuthenticated: mockCallAuthenticated,
    isAuthenticated: true,
    updateStoredUsername: mockUpdateStoredUsername,
    updateStoredEmail: mockUpdateStoredEmail,
    applyTokens: mockApplyTokens,
    userId: 'user-me',
  }),
}));

const mockUploadToUrl = jest.fn().mockResolvedValue(undefined);
jest.mock('../upload', () => ({
  uploadToUrl: (...args: unknown[]) => mockUploadToUrl(...args),
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

const sampleProfile = { id: 'user-me', username: 'jorge', email: 'j@example.com' };

beforeEach(() => {
  jest.clearAllMocks();
  mockCallAuthenticated.mockResolvedValue(okResponse(null));
  mockUploadToUrl.mockResolvedValue(undefined);
});

// ── useMyProfileQuery ─────────────────────────────────────────────────────────

describe('useMyProfileQuery', () => {
  it('fetches /users/me and returns profile', async () => {
    mockCallAuthenticated.mockResolvedValue(okResponse(sampleProfile));
    const { result } = renderHook(() => useMyProfileQuery(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockCallAuthenticated).toHaveBeenCalledWith('/users/me');
    expect(result.current.data).toEqual(sampleProfile);
  });

  it('sets isError on non-ok response', async () => {
    mockCallAuthenticated.mockResolvedValue(errorResponse(401));
    const { result } = renderHook(() => useMyProfileQuery(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ── useAvatarQuery ────────────────────────────────────────────────────────────

describe('useAvatarQuery', () => {
  it('fetches /users/<id>/avatar and returns downloadUrl', async () => {
    mockCallAuthenticated.mockResolvedValue(okResponse({ downloadUrl: 'https://cdn.example.com/avatar.jpg' }));
    const { result } = renderHook(() => useAvatarQuery('user-1'), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockCallAuthenticated).toHaveBeenCalledWith('/users/user-1/avatar');
    expect(result.current.data).toBe('https://cdn.example.com/avatar.jpg');
  });

  it('returns null when avatar is not found (404)', async () => {
    mockCallAuthenticated.mockResolvedValue({ ok: false, status: 404 });
    const { result } = renderHook(() => useAvatarQuery('user-1'), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it('does not fetch when userId is null', async () => {
    const { result } = renderHook(() => useAvatarQuery(null), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(mockCallAuthenticated).not.toHaveBeenCalled();
  });

  it('does not fetch when options.enabled is false', async () => {
    const { result } = renderHook(
      () => useAvatarQuery('user-1', { enabled: false }),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(mockCallAuthenticated).not.toHaveBeenCalled();
  });

  it('sets isError on non-404 errors', async () => {
    mockCallAuthenticated.mockResolvedValue(errorResponse(500));
    const { result } = renderHook(() => useAvatarQuery('user-1'), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ── useUpdateProfileMutation ──────────────────────────────────────────────────

describe('useUpdateProfileMutation', () => {
  it('calls PATCH /users/me with request body', async () => {
    mockCallAuthenticated.mockResolvedValue(okResponse(sampleProfile));
    const { result } = renderHook(() => useUpdateProfileMutation(), { wrapper: makeWrapper() });
    await result.current.mutateAsync({ username: 'new_jorge' });
    expect(mockCallAuthenticated).toHaveBeenCalledWith('/users/me', {
      method: 'PATCH',
      body: JSON.stringify({ username: 'new_jorge' }),
    });
  });

  it('calls updateStoredUsername and updateStoredEmail on success', async () => {
    mockCallAuthenticated.mockResolvedValue(okResponse(sampleProfile));
    const { result } = renderHook(() => useUpdateProfileMutation(), { wrapper: makeWrapper() });
    await result.current.mutateAsync({ username: 'new_jorge' });
    expect(mockUpdateStoredUsername).toHaveBeenCalledWith(sampleProfile.username);
    expect(mockUpdateStoredEmail).toHaveBeenCalledWith(sampleProfile.email);
  });

  it('throws AppError on non-ok response', async () => {
    mockCallAuthenticated.mockResolvedValue(errorResponse(422));
    const { result } = renderHook(() => useUpdateProfileMutation(), { wrapper: makeWrapper() });
    await expect(result.current.mutateAsync({ username: 'bad' })).rejects.toThrow();
  });
});

// ── useChangePasswordMutation ─────────────────────────────────────────────────

describe('useChangePasswordMutation', () => {
  it('calls PUT /users/me/password with request body', async () => {
    const tokens = { accessToken: 'new-access', refreshToken: 'new-refresh' };
    mockCallAuthenticated.mockResolvedValue(okResponse(tokens));
    const { result } = renderHook(() => useChangePasswordMutation(), { wrapper: makeWrapper() });
    await result.current.mutateAsync({ currentPassword: 'old', newPassword: 'new' });
    expect(mockCallAuthenticated).toHaveBeenCalledWith('/users/me/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword: 'old', newPassword: 'new' }),
    });
  });

  it('calls applyTokens with the new tokens on success', async () => {
    const tokens = { accessToken: 'new-access', refreshToken: 'new-refresh' };
    mockCallAuthenticated.mockResolvedValue(okResponse(tokens));
    const { result } = renderHook(() => useChangePasswordMutation(), { wrapper: makeWrapper() });
    await result.current.mutateAsync({ currentPassword: 'old', newPassword: 'new' });
    expect(mockApplyTokens).toHaveBeenCalledWith('new-access', 'new-refresh');
  });

  it('throws AppError on non-ok response', async () => {
    mockCallAuthenticated.mockResolvedValue(errorResponse(403));
    const { result } = renderHook(() => useChangePasswordMutation(), { wrapper: makeWrapper() });
    await expect(result.current.mutateAsync({ currentPassword: 'x', newPassword: 'y' })).rejects.toThrow();
  });
});

// ── useDeleteAccountMutation ──────────────────────────────────────────────────

describe('useDeleteAccountMutation', () => {
  it('calls DELETE /users/me with password body', async () => {
    const { result } = renderHook(() => useDeleteAccountMutation(), { wrapper: makeWrapper() });
    await result.current.mutateAsync({ password: 'my-password' });
    expect(mockCallAuthenticated).toHaveBeenCalledWith('/users/me', {
      method: 'DELETE',
      body: JSON.stringify({ password: 'my-password' }),
    });
  });

  it('throws AppError on non-ok response', async () => {
    mockCallAuthenticated.mockResolvedValue(errorResponse(403));
    const { result } = renderHook(() => useDeleteAccountMutation(), { wrapper: makeWrapper() });
    await expect(result.current.mutateAsync({ password: 'wrong' })).rejects.toThrow();
  });
});

// ── useUploadAvatarMutation ───────────────────────────────────────────────────

describe('useUploadAvatarMutation', () => {
  it('runs init → uploadToUrl → confirm in order', async () => {
    const initData = { uploadUrl: 'https://s3.example.com/avatar' };
    mockCallAuthenticated
      .mockResolvedValueOnce(okResponse(initData))
      .mockResolvedValueOnce(okResponse({}));

    const { result } = renderHook(
      () => useUploadAvatarMutation('user-me'),
      { wrapper: makeWrapper() },
    );

    await result.current.mutateAsync({ fileUri: 'file://avatar.jpg', contentType: 'image/jpeg' });

    expect(mockCallAuthenticated).toHaveBeenNthCalledWith(1, '/users/me/avatar', {
      method: 'POST',
      body: JSON.stringify({ contentType: 'image/jpeg' }),
    });
    expect(mockUploadToUrl).toHaveBeenCalledWith(
      initData.uploadUrl,
      'file://avatar.jpg',
      'image/jpeg',
    );
    expect(mockCallAuthenticated).toHaveBeenNthCalledWith(2,
      '/users/me/avatar/confirm',
      { method: 'POST' },
    );
  });

  it('throws AppError when init call fails', async () => {
    mockCallAuthenticated.mockResolvedValue(errorResponse(422));
    const { result } = renderHook(
      () => useUploadAvatarMutation('user-me'),
      { wrapper: makeWrapper() },
    );
    await expect(result.current.mutateAsync({ fileUri: 'file://x.jpg', contentType: 'image/jpeg' })).rejects.toThrow();
  });
});
