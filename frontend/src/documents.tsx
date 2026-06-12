import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './auth';
import type { components } from './generated/types';
import { AppError, ErrorCode } from './AppError';
import { documentKeys } from './queryKeys';

type DocumentResponse = components['schemas']['DocumentResponse'];
type DocumentUploadRequest = components['schemas']['DocumentUploadRequest'];
type DocumentUploadResponse = components['schemas']['DocumentUploadResponse'];
type DocumentDownloadResponse = components['schemas']['DocumentDownloadResponse'];

export function useDocuments() {
  const { callAuthenticated } = useAuth();

  const listDocuments = useCallback(async (tripId: string): Promise<DocumentResponse[]> => {
    const response = await callAuthenticated(`/trips/${tripId}/documents`);
    if (!response.ok) throw new AppError(response.status as ErrorCode);
    return response.json();
  }, [callAuthenticated]);

  const initDocumentUpload = useCallback(async (
    tripId: string,
    request: DocumentUploadRequest,
  ): Promise<DocumentUploadResponse> => {
    const response = await callAuthenticated(`/trips/${tripId}/documents`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
    if (!response.ok) throw new AppError(response.status as ErrorCode);
    return response.json();
  }, [callAuthenticated]);

  const confirmDocumentUpload = useCallback(async (tripId: string, documentId: string): Promise<void> => {
    const response = await callAuthenticated(
      `/trips/${tripId}/documents/${documentId}/confirm`,
      { method: 'POST' },
    );
    if (!response.ok) throw new AppError(response.status as ErrorCode);
  }, [callAuthenticated]);

  const getDocumentDownloadUrl = useCallback(async (tripId: string, documentId: string): Promise<string> => {
    const response = await callAuthenticated(`/trips/${tripId}/documents/${documentId}`);
    if (!response.ok) throw new AppError(response.status as ErrorCode);
    const data: DocumentDownloadResponse = await response.json();
    return data.downloadUrl;
  }, [callAuthenticated]);

  const deleteDocument = useCallback(async (tripId: string, documentId: string): Promise<void> => {
    const response = await callAuthenticated(`/trips/${tripId}/documents/${documentId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new AppError(response.status as ErrorCode);
  }, [callAuthenticated]);

  return { listDocuments, initDocumentUpload, confirmDocumentUpload, getDocumentDownloadUrl, deleteDocument };
}

export function useDocumentsQuery(tripId: string) {
  const { callAuthenticated } = useAuth();
  return useQuery({
    queryKey: documentKeys.list(tripId),
    queryFn: async (): Promise<DocumentResponse[]> => {
      const response = await callAuthenticated(`/trips/${tripId}/documents`);
      if (!response.ok) throw new AppError(response.status as ErrorCode);
      return response.json();
    },
    enabled: !!tripId,
  });
}

export function useDocumentDownloadQuery(tripId: string, documentId: string, options?: { enabled?: boolean }) {
  const { callAuthenticated } = useAuth();
  return useQuery({
    queryKey: documentKeys.downloadUrl(tripId, documentId),
    queryFn: async (): Promise<string> => {
      const response = await callAuthenticated(`/trips/${tripId}/documents/${documentId}`);
      if (!response.ok) throw new AppError(response.status as ErrorCode);
      const data: DocumentDownloadResponse = await response.json();
      return data.downloadUrl;
    },
    enabled: !!tripId && !!documentId && (options?.enabled ?? true),
    staleTime: 10 * 60 * 1000,
  });
}

type UploadDocumentParams = {
  request: DocumentUploadRequest;
  fileUri: string;
  contentType: string;
  uploadToUrl: (url: string, fileUri: string, contentType: string) => Promise<void>;
};

export function useUploadDocumentMutation(tripId: string) {
  const { callAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ request, fileUri, contentType, uploadToUrl }: UploadDocumentParams): Promise<DocumentResponse> => {
      const initResponse = await callAuthenticated(`/trips/${tripId}/documents`, {
        method: 'POST',
        body: JSON.stringify(request),
      });
      if (!initResponse.ok) throw new AppError(initResponse.status as ErrorCode);
      const { documentId, uploadUrl }: DocumentUploadResponse = await initResponse.json();

      const confirmResponse = await uploadToUrl(uploadUrl, fileUri, contentType)
        .then(() => callAuthenticated(
          `/trips/${tripId}/documents/${documentId}/confirm`,
          { method: 'POST' },
        ));
      if (!confirmResponse.ok) throw new AppError(confirmResponse.status as ErrorCode);

      return { id: documentId, name: request.name, uploadedAt: new Date().toISOString(), uploaderId: '' };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: documentKeys.list(tripId) }),
  });
}

export function useDeleteDocumentMutation(tripId: string) {
  const { callAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (documentId: string): Promise<void> => {
      const response = await callAuthenticated(`/trips/${tripId}/documents/${documentId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new AppError(response.status as ErrorCode);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: documentKeys.list(tripId) }),
  });
}

export type { DocumentResponse };
