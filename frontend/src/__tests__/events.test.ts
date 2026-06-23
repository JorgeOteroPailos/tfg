import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEventsQuery, useAddEventMutation, useDeleteEventMutation } from '../events';

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

const sampleEvent = {
  name: 'Team dinner',
  datetime: '2025-07-01T20:00:00Z',
  location: 'Restaurant',
  latitude: 42.0,
  longitude: -8.0,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCallAuthenticated.mockResolvedValue(okResponse([]));
});

// ── useEventsQuery ────────────────────────────────────────────────────────────

describe('useEventsQuery', () => {
  it('fetches /trips/<id>/events and returns data', async () => {
    const data = [{ id: 'ev-1', name: 'Dinner' }];
    mockCallAuthenticated.mockResolvedValue(okResponse(data));
    const { result } = renderHook(() => useEventsQuery('trip-1'), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockCallAuthenticated).toHaveBeenCalledWith('/trips/trip-1/events');
    expect(result.current.data).toEqual(data);
  });

  it('does not fetch when tripId is empty', async () => {
    const { result } = renderHook(() => useEventsQuery(''), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(mockCallAuthenticated).not.toHaveBeenCalled();
  });

  it('sets isError on non-ok response', async () => {
    mockCallAuthenticated.mockResolvedValue(errorResponse(403));
    const { result } = renderHook(() => useEventsQuery('trip-1'), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ── useAddEventMutation ───────────────────────────────────────────────────────

describe('useAddEventMutation', () => {
  it('calls POST /trips/<id>/events with event body', async () => {
    mockCallAuthenticated.mockResolvedValue(okResponse({ id: 'ev-new' }));
    const { result } = renderHook(() => useAddEventMutation('trip-1'), { wrapper: makeWrapper() });
    await result.current.mutateAsync(sampleEvent);
    expect(mockCallAuthenticated).toHaveBeenCalledWith('/trips/trip-1/events', {
      method: 'POST',
      body: JSON.stringify(sampleEvent),
    });
  });

  it('returns the server-assigned id', async () => {
    mockCallAuthenticated.mockResolvedValue(okResponse({ id: 'ev-new' }));
    const { result } = renderHook(() => useAddEventMutation('trip-1'), { wrapper: makeWrapper() });
    const id = await result.current.mutateAsync(sampleEvent);
    expect(id).toBe('ev-new');
  });

  it('throws AppError on non-ok response', async () => {
    mockCallAuthenticated.mockResolvedValue(errorResponse(422));
    const { result } = renderHook(() => useAddEventMutation('trip-1'), { wrapper: makeWrapper() });
    await expect(result.current.mutateAsync(sampleEvent)).rejects.toThrow();
  });
});

// ── useDeleteEventMutation ────────────────────────────────────────────────────

describe('useDeleteEventMutation', () => {
  it('calls DELETE /trips/<id>/events/<eventId>', async () => {
    const { result } = renderHook(() => useDeleteEventMutation('trip-1'), { wrapper: makeWrapper() });
    await result.current.mutateAsync('ev-1');
    expect(mockCallAuthenticated).toHaveBeenCalledWith('/trips/trip-1/events/ev-1', {
      method: 'DELETE',
    });
  });

  it('throws AppError on non-ok response', async () => {
    mockCallAuthenticated.mockResolvedValue(errorResponse(404));
    const { result } = renderHook(() => useDeleteEventMutation('trip-1'), { wrapper: makeWrapper() });
    await expect(result.current.mutateAsync('ev-1')).rejects.toThrow();
  });
});
