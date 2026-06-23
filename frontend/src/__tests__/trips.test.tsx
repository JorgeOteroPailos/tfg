import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTrips, useTripsQuery, useCreateTripMutation, TripProvider, useTrip } from '../trips';

const mockCallAuthenticated = jest.fn();

jest.mock('../auth', () => ({
  useAuth: () => ({ callAuthenticated: mockCallAuthenticated }),
}));

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function makeTripWrapper(tripId: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>
      <TripProvider tripId={tripId}>{children}</TripProvider>
    </QueryClientProvider>
  );
}

const okResponse = (data: unknown = null) => ({
  ok: true,
  json: () => Promise.resolve(data),
});

const errorResponse = (status = 404) => ({ ok: false, status });

const sampleTrip = { id: 'trip-1', name: 'Summer trip' };

beforeEach(() => {
  jest.clearAllMocks();
  mockCallAuthenticated.mockResolvedValue(okResponse([]));
});

// ── useTrips — listTrips ──────────────────────────────────────────────────────

describe('useTrips — listTrips', () => {
  it('calls GET /trips and returns data', async () => {
    const data = [sampleTrip];
    mockCallAuthenticated.mockResolvedValue(okResponse(data));
    const { result } = renderHook(() => useTrips(), { wrapper: makeWrapper() });
    const res = await result.current.listTrips();
    expect(mockCallAuthenticated).toHaveBeenCalledWith('/trips');
    expect(res).toEqual(data);
  });

  it('throws AppError on non-ok response', async () => {
    mockCallAuthenticated.mockResolvedValue(errorResponse(401));
    const { result } = renderHook(() => useTrips(), { wrapper: makeWrapper() });
    await expect(result.current.listTrips()).rejects.toThrow();
  });
});

// ── useTrips — getTrip ────────────────────────────────────────────────────────

describe('useTrips — getTrip', () => {
  it('calls GET /trips/<id> and returns data', async () => {
    mockCallAuthenticated.mockResolvedValue(okResponse(sampleTrip));
    const { result } = renderHook(() => useTrips(), { wrapper: makeWrapper() });
    const res = await result.current.getTrip('trip-1');
    expect(mockCallAuthenticated).toHaveBeenCalledWith('/trips/trip-1');
    expect(res).toEqual(sampleTrip);
  });

  it('throws AppError on non-ok response', async () => {
    mockCallAuthenticated.mockResolvedValue(errorResponse(404));
    const { result } = renderHook(() => useTrips(), { wrapper: makeWrapper() });
    await expect(result.current.getTrip('trip-1')).rejects.toThrow();
  });
});

// ── useTrips — createTrip ─────────────────────────────────────────────────────

describe('useTrips — createTrip', () => {
  it('calls POST /trips with name body and returns trip', async () => {
    mockCallAuthenticated.mockResolvedValue(okResponse(sampleTrip));
    const { result } = renderHook(() => useTrips(), { wrapper: makeWrapper() });
    const res = await result.current.createTrip({ name: 'Summer trip' });
    expect(mockCallAuthenticated).toHaveBeenCalledWith('/trips', {
      method: 'POST',
      body: JSON.stringify({ name: 'Summer trip' }),
    });
    expect(res).toEqual(sampleTrip);
  });

  it('throws AppError on non-ok response', async () => {
    mockCallAuthenticated.mockResolvedValue(errorResponse(422));
    const { result } = renderHook(() => useTrips(), { wrapper: makeWrapper() });
    await expect(result.current.createTrip({ name: 'Bad trip' })).rejects.toThrow();
  });
});

// ── useTrips — leaveTrip ──────────────────────────────────────────────────────

describe('useTrips — leaveTrip', () => {
  it('calls DELETE /trips/<id>/members/me', async () => {
    const { result } = renderHook(() => useTrips(), { wrapper: makeWrapper() });
    await result.current.leaveTrip('trip-1');
    expect(mockCallAuthenticated).toHaveBeenCalledWith('/trips/trip-1/members/me', {
      method: 'DELETE',
    });
  });

  it('throws AppError on non-ok response', async () => {
    mockCallAuthenticated.mockResolvedValue(errorResponse(403));
    const { result } = renderHook(() => useTrips(), { wrapper: makeWrapper() });
    await expect(result.current.leaveTrip('trip-1')).rejects.toThrow();
  });
});

// ── useTripsQuery ─────────────────────────────────────────────────────────────

describe('useTripsQuery', () => {
  it('fetches /trips and returns data', async () => {
    const data = [sampleTrip];
    mockCallAuthenticated.mockResolvedValue(okResponse(data));
    const { result } = renderHook(() => useTripsQuery(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockCallAuthenticated).toHaveBeenCalledWith('/trips');
    expect(result.current.data).toEqual(data);
  });

  it('sets isError on non-ok response', async () => {
    mockCallAuthenticated.mockResolvedValue(errorResponse(401));
    const { result } = renderHook(() => useTripsQuery(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ── useCreateTripMutation ─────────────────────────────────────────────────────

describe('useCreateTripMutation', () => {
  it('calls POST /trips with name and returns trip', async () => {
    mockCallAuthenticated.mockResolvedValue(okResponse(sampleTrip));
    const { result } = renderHook(() => useCreateTripMutation(), { wrapper: makeWrapper() });
    const res = await result.current.mutateAsync({ name: 'Summer trip' });
    expect(mockCallAuthenticated).toHaveBeenCalledWith('/trips', {
      method: 'POST',
      body: JSON.stringify({ name: 'Summer trip' }),
    });
    expect(res).toEqual(sampleTrip);
  });

  it('throws AppError on non-ok response', async () => {
    mockCallAuthenticated.mockResolvedValue(errorResponse(422));
    const { result } = renderHook(() => useCreateTripMutation(), { wrapper: makeWrapper() });
    await expect(result.current.mutateAsync({ name: 'Bad' })).rejects.toThrow();
  });
});

// ── TripProvider + useTrip ────────────────────────────────────────────────────

describe('TripProvider + useTrip', () => {
  it('exposes null trip and loading: true before data arrives', () => {
    mockCallAuthenticated.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useTrip(), { wrapper: makeTripWrapper('trip-1') });
    expect(result.current.trip).toBeNull();
    expect(result.current.loading).toBe(true);
  });

  it('exposes loaded trip once query resolves', async () => {
    const tripDetail = { id: 'trip-1', name: 'Summer trip', members: [] };
    mockCallAuthenticated.mockResolvedValue(okResponse(tripDetail));
    const { result } = renderHook(() => useTrip(), { wrapper: makeTripWrapper('trip-1') });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.trip).toEqual(tripDetail);
  });

  it('useTrip outside provider returns context default (trip: null, loading: true)', () => {
    const { result } = renderHook(() => useTrip());
    expect(result.current.trip).toBeNull();
    expect(result.current.loading).toBe(true);
  });
});
