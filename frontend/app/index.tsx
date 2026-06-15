import { Redirect } from 'expo-router';
import { useAuth } from '../src/auth';
import { getLastTripId } from '../src/lastTrip';
import { View } from 'react-native';
import { useState, useEffect } from 'react';

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();
  const [lastTripId, setLastTripId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!isAuthenticated) {
      setLastTripId(null);
      return;
    }
    getLastTripId().then(id => setLastTripId(id ?? null));
  }, [isAuthenticated]);

  if (isLoading || lastTripId === undefined) {
    return <View style={{ flex: 1 }} />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  if (lastTripId) {
    return <Redirect href={{ pathname: '/expenses', params: { tripId: lastTripId } }} />;
  }

  return <Redirect href="/main" />;
}
