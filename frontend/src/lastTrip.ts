import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_TRIP_KEY = 'lastTripId';
const LAST_TRIP_TAB_KEY = 'lastTripTab';

export const TRIP_TAB_NAMES = ['expenses', 'events', 'documents', 'members', 'chat'] as const;
type TripTab = typeof TRIP_TAB_NAMES[number];

export async function saveLastTripId(tripId: string) {
  await AsyncStorage.setItem(LAST_TRIP_KEY, tripId);
}

export async function getLastTripId() {
  return await AsyncStorage.getItem(LAST_TRIP_KEY);
}

export async function clearLastTripId() {
  await AsyncStorage.removeItem(LAST_TRIP_KEY);
}

export async function saveLastTripTab(tab: string) {
  if (!(TRIP_TAB_NAMES as readonly string[]).includes(tab)) return; // ignore non-tab sub-screens
  await AsyncStorage.setItem(LAST_TRIP_TAB_KEY, tab);
}

export async function getLastTripTab(): Promise<TripTab | null> {
  const tab = await AsyncStorage.getItem(LAST_TRIP_TAB_KEY);
  return tab && (TRIP_TAB_NAMES as readonly string[]).includes(tab) ? (tab as TripTab) : null;
}

export async function clearLastTripTab() {
  await AsyncStorage.removeItem(LAST_TRIP_TAB_KEY);
}
