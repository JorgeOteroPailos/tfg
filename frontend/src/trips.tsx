import { useAuth } from './auth';
import type { components } from './generated/types';
import { AppError, ErrorCode } from './AppError';
import { createContext, use, useCallback, useEffect, useMemo, useReducer } from 'react';

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

type TripState = { trip: TripDetail | null; loading: boolean };
type TripAction =
  | { type: 'loading' }
  | { type: 'loaded'; data: TripDetail }
  | { type: 'error' };

function tripReducer(state: TripState, action: TripAction): TripState {
  switch (action.type) {
    case 'loading': return { ...state, loading: true };
    case 'loaded': return { trip: action.data, loading: false };
    case 'error': return { ...state, loading: false };
    default: return state;
  }
}

export const TripProvider = ({ tripId, children }: { tripId: string; children: React.ReactNode }) => {
  const { getTrip } = useTrips();
  const [{ trip, loading }, dispatch] = useReducer(tripReducer, { trip: null, loading: true });

  const load = useCallback(async () => {
    dispatch({ type: 'loading' });
    try {
      const data = await getTrip(tripId);
      dispatch({ type: 'loaded', data });
    } catch (e) {
      console.error('Error cargando viaje:', e);
      dispatch({ type: 'error' });
    }
  }, [getTrip, tripId]);

  useEffect(() => {
    load();
  }, [load]);

  const value = useMemo(() => ({ trip, loading, reload: load }), [trip, loading, load]);
  return (
    <TripContext.Provider value={value}>
      {children}
    </TripContext.Provider>
  );
};

export const useTrip = () => use(TripContext);