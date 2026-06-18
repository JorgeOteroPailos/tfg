import { Redirect } from 'expo-router';
import { useState, useEffect } from 'react';
import { View } from 'react-native';
import { getLastTripId, getLastTripTab } from '../../src/lastTrip';

export default function MainIndex() {
  const [dest, setDest] = useState<{ tripId: string; tab: string } | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getLastTripId(), getLastTripTab()]).then(([tripId, tab]) => {
      if (cancelled) return;
      setDest(tripId ? { tripId, tab: tab ?? 'expenses' } : null);
    });
    return () => { cancelled = true; };
  }, []);

  if (dest === undefined) return <View style={{ flex: 1 }} />; // reading storage
  if (dest) return <Redirect href={{ pathname: `/${dest.tab}`, params: { tripId: dest.tripId } }} />;
  return <Redirect href="/main" />;
}
