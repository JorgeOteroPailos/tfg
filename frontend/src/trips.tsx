import { useAuth } from './auth';
import type { components } from './generated/types';
import { AppError, ErrorCode } from './AppError';

type TripSummary = components['schemas']['TripSummary'];
type TripDetail = components['schemas']['TripDetail'];

export function useTrips() {
  const { callAuthenticated } = useAuth();

  const listTrips = async (): Promise<TripSummary[]> => {
    const response = await callAuthenticated(`/trips`);
    if (!response.ok) throw new AppError(response.status as ErrorCode);
    return response.json();
  };

  const getTrip = async (id: string): Promise<TripDetail> => {
    const response = await callAuthenticated(`/trips/${id}`);
    if (!response.ok) throw new AppError(response.status as ErrorCode);
    return response.json();
  };

  const createTrip = async (request: { name: string }): Promise<TripSummary> => {
    const response = await callAuthenticated(`/trips`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
    if (!response.ok) throw new AppError(response.status as ErrorCode);
    return response.json();
  };

  return { listTrips, getTrip, createTrip };
}