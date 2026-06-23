import React, { Suspense } from 'react';
import { View } from 'react-native';
import { act, renderHook, renderHookAsync } from '@testing-library/react-native';

const mockGetSavedDataSaver = jest.fn().mockResolvedValue(false);
const mockSaveDataSaver = jest.fn().mockResolvedValue(undefined);

// Mock preferences before dataSaver is imported so the module-level
// _savedDataSaverProm = getSavedDataSaver().catch(...) picks up the mock.
jest.mock('../preferences', () => ({
  getSavedDataSaver: () => mockGetSavedDataSaver(),
  saveDataSaver: (v: boolean) => mockSaveDataSaver(v),
}));

const { DataSaverProvider, useDataSaver } = require('../dataSaver') as typeof import('../dataSaver');

// DataSaverProvider uses React 19's use(promise) on a module-level promise.
// On first render it always suspends; renderHookAsync uses an async act() for
// the initial mount so the pending promise resolves before assertions run.
// The fallback must be a non-null element so react-test-renderer's .root
// getter finds at least one child while the boundary is suspended.
function Provider({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<View />}>
      <DataSaverProvider>{children}</DataSaverProvider>
    </Suspense>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSavedDataSaver.mockResolvedValue(false);
  mockSaveDataSaver.mockResolvedValue(undefined);
});

// ── DataSaverProvider + useDataSaver ─────────────────────────────────────────

describe('DataSaverProvider + useDataSaver', () => {
  it('exposes dataSaver: false (the mocked initial value from storage)', async () => {
    const { result } = await renderHookAsync(() => useDataSaver(), { wrapper: Provider });
    expect(result.current.dataSaver).toBe(false);
  });

  it('setDataSaver(true) calls saveDataSaver and updates state', async () => {
    const { result } = await renderHookAsync(() => useDataSaver(), { wrapper: Provider });
    expect(result.current.dataSaver).toBe(false);

    await act(async () => {
      await result.current.setDataSaver(true);
    });

    expect(mockSaveDataSaver).toHaveBeenCalledWith(true);
    expect(result.current.dataSaver).toBe(true);
  });

  it('setDataSaver(false) after true restores false', async () => {
    const { result } = await renderHookAsync(() => useDataSaver(), { wrapper: Provider });

    await act(async () => { await result.current.setDataSaver(true); });
    expect(result.current.dataSaver).toBe(true);

    await act(async () => { await result.current.setDataSaver(false); });
    expect(mockSaveDataSaver).toHaveBeenLastCalledWith(false);
    expect(result.current.dataSaver).toBe(false);
  });
});

// ── useDataSaver outside provider ────────────────────────────────────────────

describe('useDataSaver outside provider', () => {
  it('throws when used without DataSaverProvider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useDataSaver())).toThrow();
    spy.mockRestore();
  });
});
