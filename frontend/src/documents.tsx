import { useCallback } from 'react';
import { useAuth } from './auth';
import type { components } from './generated/types';
import { AppError, ErrorCode } from './AppError';

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

export type { DocumentResponse };
