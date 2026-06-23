import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useDocuments,
  useDocumentsQuery,
  useDocumentsByDateQuery,
  useDocumentDownloadQuery,
  useUploadDocumentMutation,
  useDeleteDocumentMutation,
} from '../documents';

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

const sampleRequest = { name: 'contract.pdf', date: '2025-07-01' };

beforeEach(() => {
  jest.clearAllMocks();
  mockCallAuthenticated.mockResolvedValue(okResponse([]));
});

// ── useDocuments — listDocuments ──────────────────────────────────────────────

describe('useDocuments — listDocuments', () => {
  it('calls GET /trips/<id>/documents and returns data', async () => {
    const data = [{ id: 'd1', name: 'ticket.pdf' }];
    mockCallAuthenticated.mockResolvedValue(okResponse(data));
    const { result } = renderHook(() => useDocuments(), { wrapper: makeWrapper() });
    const res = await result.current.listDocuments('trip-1');
    expect(mockCallAuthenticated).toHaveBeenCalledWith('/trips/trip-1/documents');
    expect(res).toEqual(data);
  });

  it('throws AppError on non-ok response', async () => {
    mockCallAuthenticated.mockResolvedValue(errorResponse(403));
    const { result } = renderHook(() => useDocuments(), { wrapper: makeWrapper() });
    await expect(result.current.listDocuments('trip-1')).rejects.toThrow();
  });
});

// ── useDocuments — initDocumentUpload ─────────────────────────────────────────

describe('useDocuments — initDocumentUpload', () => {
  it('calls POST /trips/<id>/documents with request body', async () => {
    const uploadResponse = { documentId: 'd-new', uploadUrl: 'https://s3.example.com/upload' };
    mockCallAuthenticated.mockResolvedValue(okResponse(uploadResponse));
    const { result } = renderHook(() => useDocuments(), { wrapper: makeWrapper() });
    const res = await result.current.initDocumentUpload('trip-1', sampleRequest);
    expect(mockCallAuthenticated).toHaveBeenCalledWith('/trips/trip-1/documents', {
      method: 'POST',
      body: JSON.stringify(sampleRequest),
    });
    expect(res).toEqual(uploadResponse);
  });

  it('throws AppError on non-ok response', async () => {
    mockCallAuthenticated.mockResolvedValue(errorResponse(422));
    const { result } = renderHook(() => useDocuments(), { wrapper: makeWrapper() });
    await expect(result.current.initDocumentUpload('trip-1', sampleRequest)).rejects.toThrow();
  });
});

// ── useDocuments — confirmDocumentUpload ──────────────────────────────────────

describe('useDocuments — confirmDocumentUpload', () => {
  it('calls POST /trips/<id>/documents/<docId>/confirm', async () => {
    const { result } = renderHook(() => useDocuments(), { wrapper: makeWrapper() });
    await result.current.confirmDocumentUpload('trip-1', 'd1');
    expect(mockCallAuthenticated).toHaveBeenCalledWith(
      '/trips/trip-1/documents/d1/confirm',
      { method: 'POST' },
    );
  });

  it('throws AppError on non-ok response', async () => {
    mockCallAuthenticated.mockResolvedValue(errorResponse(404));
    const { result } = renderHook(() => useDocuments(), { wrapper: makeWrapper() });
    await expect(result.current.confirmDocumentUpload('trip-1', 'd1')).rejects.toThrow();
  });
});

// ── useDocuments — getDocumentDownloadUrl ─────────────────────────────────────

describe('useDocuments — getDocumentDownloadUrl', () => {
  it('calls GET /trips/<id>/documents/<docId> and returns downloadUrl', async () => {
    mockCallAuthenticated.mockResolvedValue(okResponse({ downloadUrl: 'https://cdn.example.com/file.pdf' }));
    const { result } = renderHook(() => useDocuments(), { wrapper: makeWrapper() });
    const url = await result.current.getDocumentDownloadUrl('trip-1', 'd1');
    expect(mockCallAuthenticated).toHaveBeenCalledWith('/trips/trip-1/documents/d1');
    expect(url).toBe('https://cdn.example.com/file.pdf');
  });

  it('throws AppError on non-ok response', async () => {
    mockCallAuthenticated.mockResolvedValue(errorResponse(403));
    const { result } = renderHook(() => useDocuments(), { wrapper: makeWrapper() });
    await expect(result.current.getDocumentDownloadUrl('trip-1', 'd1')).rejects.toThrow();
  });
});

// ── useDocuments — deleteDocument ─────────────────────────────────────────────

describe('useDocuments — deleteDocument', () => {
  it('calls DELETE /trips/<id>/documents/<docId>', async () => {
    const { result } = renderHook(() => useDocuments(), { wrapper: makeWrapper() });
    await result.current.deleteDocument('trip-1', 'd1');
    expect(mockCallAuthenticated).toHaveBeenCalledWith('/trips/trip-1/documents/d1', {
      method: 'DELETE',
    });
  });

  it('throws AppError on non-ok response', async () => {
    mockCallAuthenticated.mockResolvedValue(errorResponse(404));
    const { result } = renderHook(() => useDocuments(), { wrapper: makeWrapper() });
    await expect(result.current.deleteDocument('trip-1', 'd1')).rejects.toThrow();
  });
});

// ── useDocumentsQuery ─────────────────────────────────────────────────────────

describe('useDocumentsQuery', () => {
  it('fetches /trips/<id>/documents and returns data', async () => {
    const data = [{ id: 'd1', name: 'ticket.pdf' }];
    mockCallAuthenticated.mockResolvedValue(okResponse(data));
    const { result } = renderHook(() => useDocumentsQuery('trip-1'), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(data);
  });

  it('does not fetch when tripId is empty', async () => {
    const { result } = renderHook(() => useDocumentsQuery(''), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(mockCallAuthenticated).not.toHaveBeenCalled();
  });

  it('sets isError on non-ok response', async () => {
    mockCallAuthenticated.mockResolvedValue(errorResponse(403));
    const { result } = renderHook(() => useDocumentsQuery('trip-1'), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ── useDocumentsByDateQuery ───────────────────────────────────────────────────

describe('useDocumentsByDateQuery', () => {
  it('includes date and tzOffsetMinutes in query URL', async () => {
    const data = [{ id: 'd1' }];
    mockCallAuthenticated.mockResolvedValue(okResponse(data));
    const { result } = renderHook(
      () => useDocumentsByDateQuery('trip-1', '2025-07-01'),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const calledUrl = mockCallAuthenticated.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/trips/trip-1/documents?');
    expect(calledUrl).toContain('date=2025-07-01');
    expect(calledUrl).toContain('tzOffsetMinutes=');
  });

  it('does not fetch when date is null', async () => {
    const { result } = renderHook(
      () => useDocumentsByDateQuery('trip-1', null),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(mockCallAuthenticated).not.toHaveBeenCalled();
  });
});

// ── useDocumentDownloadQuery ──────────────────────────────────────────────────

describe('useDocumentDownloadQuery', () => {
  it('fetches download URL and returns it', async () => {
    mockCallAuthenticated.mockResolvedValue(okResponse({ downloadUrl: 'https://cdn.example.com/f.pdf' }));
    const { result } = renderHook(
      () => useDocumentDownloadQuery('trip-1', 'd1'),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe('https://cdn.example.com/f.pdf');
  });

  it('does not fetch when documentId is empty', async () => {
    const { result } = renderHook(
      () => useDocumentDownloadQuery('trip-1', ''),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(mockCallAuthenticated).not.toHaveBeenCalled();
  });
});

// ── useUploadDocumentMutation ─────────────────────────────────────────────────

describe('useUploadDocumentMutation', () => {
  it('runs init → external upload → confirm in order', async () => {
    const initData = { documentId: 'd-new', uploadUrl: 'https://s3.example.com/upload' };
    mockCallAuthenticated
      .mockResolvedValueOnce(okResponse(initData))
      .mockResolvedValueOnce(okResponse({}));

    const mockUploadToUrl = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(
      () => useUploadDocumentMutation('trip-1'),
      { wrapper: makeWrapper() },
    );

    const doc = await result.current.mutateAsync({
      request: sampleRequest,
      fileUri: 'file://local/contract.pdf',
      contentType: 'application/pdf',
      uploadToUrl: mockUploadToUrl,
    });

    expect(mockCallAuthenticated).toHaveBeenNthCalledWith(1, '/trips/trip-1/documents', {
      method: 'POST',
      body: JSON.stringify(sampleRequest),
    });
    expect(mockUploadToUrl).toHaveBeenCalledWith(
      initData.uploadUrl,
      'file://local/contract.pdf',
      'application/pdf',
    );
    expect(mockCallAuthenticated).toHaveBeenNthCalledWith(2,
      '/trips/trip-1/documents/d-new/confirm',
      { method: 'POST' },
    );
    expect(doc.id).toBe('d-new');
    expect(doc.name).toBe(sampleRequest.name);
  });

  it('throws AppError when init call fails', async () => {
    mockCallAuthenticated.mockResolvedValue(errorResponse(422));
    const { result } = renderHook(
      () => useUploadDocumentMutation('trip-1'),
      { wrapper: makeWrapper() },
    );
    await expect(result.current.mutateAsync({
      request: sampleRequest,
      fileUri: 'file://x',
      contentType: 'application/pdf',
      uploadToUrl: jest.fn(),
    })).rejects.toThrow();
  });
});

// ── useDeleteDocumentMutation ─────────────────────────────────────────────────

describe('useDeleteDocumentMutation', () => {
  it('calls DELETE /trips/<id>/documents/<docId>', async () => {
    const { result } = renderHook(
      () => useDeleteDocumentMutation('trip-1'),
      { wrapper: makeWrapper() },
    );
    await result.current.mutateAsync('d1');
    expect(mockCallAuthenticated).toHaveBeenCalledWith('/trips/trip-1/documents/d1', {
      method: 'DELETE',
    });
  });

  it('throws AppError on non-ok response', async () => {
    mockCallAuthenticated.mockResolvedValue(errorResponse(404));
    const { result } = renderHook(
      () => useDeleteDocumentMutation('trip-1'),
      { wrapper: makeWrapper() },
    );
    await expect(result.current.mutateAsync('d1')).rejects.toThrow();
  });
});
