import React, { createContext, use, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './auth';
import type { components } from './generated/types';
import { AppError, ErrorCode } from './AppError';
import { tripKeys } from './queryKeys';

type TripSummary = components['schemas']['TripSummary'];
type TripDetail = components['schemas']['TripDetail'];

export function useTrips() {
  const { callAuthenticated } = useAuth();

  const listTrips = useCallback(async (): Promise<TripSummary[]> => {
    const response = await callAuthenticated(`/trips`);
    if (!response.ok) throw new AppError(response.status as ErrorCode);
    return response.json();
  }, [callAuthenticated]);

  const getTrip = useCallback(async (id: string): Promise<TripDetail> => {
    const response = await callAuthenticated(`/trips/${id}`);
    if (!response.ok) throw new AppError(response.status as ErrorCode);
    return response.json();
  }, [callAuthenticated]);

  const createTrip = useCallback(async (request: { name: string }): Promise<TripSummary> => {
    const response = await callAuthenticated(`/trips`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
    if (!response.ok) throw new AppError(response.status as ErrorCode);
    return response.json();
  }, [callAuthenticated]);

  const leaveTrip = useCallback(async (tripId: string): Promise<void> => {
    const response = await callAuthenticated(`/trips/${tripId}/members/me`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new AppError(response.status as ErrorCode);
  }, [callAuthenticated]);

  return { listTrips, getTrip, createTrip, leaveTrip };
}

export function useTripsQuery() {
  const { callAuthenticated } = useAuth();
  return useQuery({
    queryKey: tripKeys.lists(),
    queryFn: async (): Promise<TripSummary[]> => {
      const response = await callAuthenticated('/trips');
      if (!response.ok) throw new AppError(response.status as ErrorCode);
      return response.json();
    },
  });
}

function useTripQuery(id: string) {
  const { callAuthenticated } = useAuth();
  return useQuery({
    queryKey: tripKeys.detail(id),
    queryFn: async (): Promise<TripDetail> => {
      const response = await callAuthenticated(`/trips/${id}`);
      if (!response.ok) throw new AppError(response.status as ErrorCode);
      return response.json();
    },
    enabled: !!id,
  });
}

export function useCreateTripMutation() {
  const { callAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: { name: string }): Promise<TripSummary> => {
      const response = await callAuthenticated('/trips', {
        method: 'POST',
        body: JSON.stringify(request),
      });
      if (!response.ok) throw new AppError(response.status as ErrorCode);
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tripKeys.lists() }),
  });
}

function useLeaveTripMutation() {
  const { callAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tripId: string): Promise<void> => {
      const response = await callAuthenticated(`/trips/${tripId}/members/me`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new AppError(response.status as ErrorCode);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tripKeys.lists() }),
  });
}

type TripContextType = {
  trip: TripDetail | null;
  loading: boolean;
  reload: () => Promise<void>;
};

const TripContext = createContext<TripContextType>({
  trip: null,
  loading: true,
  reload: async () => {},
});

export const TripProvider = ({ tripId, children }: { tripId: string; children: React.ReactNode }) => {
  const { data: trip, isLoading, refetch } = useTripQuery(tripId);

  const reload = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const value = useMemo(() => ({
    trip: trip ?? null,
    loading: isLoading,
    reload,
  }), [trip, isLoading, reload]);

  return (
    <TripContext.Provider value={value}>
      {children}
    </TripContext.Provider>
  );
};

export const useTrip = () => use(TripContext);
