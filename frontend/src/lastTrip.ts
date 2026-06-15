import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_TRIP_KEY = 'lastTripId';

export async function saveLastTripId(tripId: string) {
  await AsyncStorage.setItem(LAST_TRIP_KEY, tripId);
}

export async function getLastTripId() {
  return await AsyncStorage.getItem(LAST_TRIP_KEY);
}

export async function clearLastTripId() {
  await AsyncStorage.removeItem(LAST_TRIP_KEY);
}
