import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  saveLastTripId,
  getLastTripId,
  clearLastTripId,
  saveLastTripTab,
  getLastTripTab,
  clearLastTripTab,
  TRIP_TAB_NAMES,
} from '../lastTrip';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('lastTripId', () => {
  it('returns null when nothing is stored', async () => {
    expect(await getLastTripId()).toBeNull();
  });

  it('saves and retrieves a trip id', async () => {
    await saveLastTripId('trip-42');
    expect(await getLastTripId()).toBe('trip-42');
  });

  it('overwrites a previously saved trip id', async () => {
    await saveLastTripId('old-id');
    await saveLastTripId('new-id');
    expect(await getLastTripId()).toBe('new-id');
  });

  it('returns null after clearing', async () => {
    await saveLastTripId('trip-42');
    await clearLastTripId();
    expect(await getLastTripId()).toBeNull();
  });
});

describe('lastTripTab', () => {
  it('returns null when nothing is stored', async () => {
    expect(await getLastTripTab()).toBeNull();
  });

  it.each(TRIP_TAB_NAMES)('saves and retrieves valid tab "%s"', async (tab) => {
    await saveLastTripTab(tab);
    expect(await getLastTripTab()).toBe(tab);
  });

  it('silently ignores an invalid tab name', async () => {
    await saveLastTripTab('not-a-real-tab');
    expect(await getLastTripTab()).toBeNull();
  });

  it('does not overwrite a valid tab with an invalid one', async () => {
    await saveLastTripTab('expenses');
    await saveLastTripTab('invalid-tab');
    expect(await getLastTripTab()).toBe('expenses');
  });

  it('returns null after clearing', async () => {
    await saveLastTripTab('events');
    await clearLastTripTab();
    expect(await getLastTripTab()).toBeNull();
  });

  it('returns null if the stored value is no longer a valid tab name', async () => {
    // Simulate storage containing a stale/unknown value written directly
    await AsyncStorage.setItem('lastTripTab', 'some-old-screen');
    expect(await getLastTripTab()).toBeNull();
  });
});
