import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './auth';
import type { components } from './generated/types';
import { AppError, ErrorCode } from './AppError';
import { eventKeys } from './queryKeys';

type EventSummary = components['schemas']['EventSummary'];
type CreateEventRequest = components['schemas']['CreateEventRequest'];

function useEvents() {
  const { callAuthenticated } = useAuth();

  const getEvents = useCallback(async (tripId: string): Promise<EventSummary[]> => {
    const response = await callAuthenticated(`/trips/${tripId}/events`);
    if (!response.ok) throw new AppError(response.status as ErrorCode);
    return response.json();
  }, [callAuthenticated]);

  const addEvent = useCallback(async (tripId: string, event: CreateEventRequest): Promise<EventSummary> => {
    const response = await callAuthenticated(`/trips/${tripId}/events`, {
      method: 'POST',
      body: JSON.stringify(event),
    });
    if (!response.ok) throw new AppError(response.status as ErrorCode);
    const { id } = await response.json() as components['schemas']['IdResponse'];
    return {
      id,
      name: event.name,
      startTime: event.startTime ?? new Date().toISOString(),
      duration: event.duration ?? 0,
      location: event.location,
    };
  }, [callAuthenticated]);

  const deleteEvent = useCallback(async (tripId: string, eventId: string): Promise<void> => {
    const response = await callAuthenticated(`/trips/${tripId}/events/${eventId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new AppError(response.status as ErrorCode);
  }, [callAuthenticated]);

  return { getEvents, addEvent, deleteEvent };
}

export function useEventsQuery(tripId: string) {
  const { callAuthenticated } = useAuth();
  return useQuery({
    queryKey: eventKeys.list(tripId),
    queryFn: async (): Promise<EventSummary[]> => {
      const response = await callAuthenticated(`/trips/${tripId}/events`);
      if (!response.ok) throw new AppError(response.status as ErrorCode);
      return response.json();
    },
    enabled: !!tripId,
  });
}

export function useAddEventMutation(tripId: string) {
  const { callAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (event: CreateEventRequest): Promise<EventSummary> => {
      const response = await callAuthenticated(`/trips/${tripId}/events`, {
        method: 'POST',
        body: JSON.stringify(event),
      });
      if (!response.ok) throw new AppError(response.status as ErrorCode);
      const { id } = await response.json() as components['schemas']['IdResponse'];
      return {
        id,
        name: event.name,
        startTime: event.startTime ?? new Date().toISOString(),
        duration: event.duration ?? 0,
        location: event.location,
      };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: eventKeys.list(tripId) }),
  });
}

export function useDeleteEventMutation(tripId: string) {
  const { callAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (eventId: string): Promise<void> => {
      const response = await callAuthenticated(`/trips/${tripId}/events/${eventId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new AppError(response.status as ErrorCode);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: eventKeys.list(tripId) }),
  });
}

export type { EventSummary, CreateEventRequest };
