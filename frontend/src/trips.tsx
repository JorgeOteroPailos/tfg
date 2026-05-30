import { useAuth } from './auth';
import type { components } from './generated/types';
import { AppError, ErrorCode } from './AppError';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

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

  return { listTrips, getTrip, createTrip };
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
  const { getTrip } = useTrips();
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const data = await getTrip(tripId);
      setTrip(data);
    } catch (e) {
      console.error('Error cargando viaje:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [tripId]);

  return (
    <TripContext.Provider value={{ trip, loading, reload: load }}>
      {children}
    </TripContext.Provider>
  );
};

export const useTrip = () => useContext(TripContext);