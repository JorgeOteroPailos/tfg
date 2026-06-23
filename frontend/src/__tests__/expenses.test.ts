import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useExpenses,
  useExpensesQuery,
  useBalancesQuery,
  useExpenseDetailQuery,
  useAddExpenseMutation,
  useDeleteExpenseMutation,
  usePaySettlementMutation,
} from '../expenses';
import { expenseKeys } from '../queryKeys';

const mockCallAuthenticated = jest.fn();

jest.mock('../auth', () => ({
  useAuth: () => ({ callAuthenticated: mockCallAuthenticated }),
}));

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

const okResponse = (data: unknown = {}) => ({
  ok: true,
  json: () => Promise.resolve(data),
});

const errorResponse = (status = 404) => ({ ok: false, status });

const sampleExpense = {
  name: 'Dinner',
  amount: 42.5,
  payerId: 'user-1',
  category: 'food' as const,
  splits: [{ userId: 'user-2', amount: 21.25 }],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCallAuthenticated.mockResolvedValue(okResponse());
});

// ── useExpenses — getExpenses ─────────────────────────────────────────────────

describe('useExpenses — getExpenses', () => {
  it('calls GET /trips/<id>/expenses', async () => {
    const { result } = renderHook(() => useExpenses(), { wrapper: makeWrapper() });
    await result.current.getExpenses('trip-1');
    expect(mockCallAuthenticated).toHaveBeenCalledWith('/trips/trip-1/expenses');
  });

  it('returns parsed JSON on success', async () => {
    const data = [{ id: 'e1', name: 'Hotel' }];
    mockCallAuthenticated.mockResolvedValue(okResponse(data));
    const { result } = renderHook(() => useExpenses(), { wrapper: makeWrapper() });
    const res = await result.current.getExpenses('trip-1');
    expect(res).toEqual(data);
  });

  it('throws AppError on non-ok response', async () => {
    mockCallAuthenticated.mockResolvedValue(errorResponse(403));
    const { result } = renderHook(() => useExpenses(), { wrapper: makeWrapper() });
    await expect(result.current.getExpenses('trip-1')).rejects.toThrow();
  });
});

// ── useExpenses — addExpense ──────────────────────────────────────────────────

describe('useExpenses — addExpense', () => {
  it('calls POST /trips/<id>/expenses with body', async () => {
    mockCallAuthenticated.mockResolvedValue(okResponse({ id: 'e-new' }));
    const { result } = renderHook(() => useExpenses(), { wrapper: makeWrapper() });
    await result.current.addExpense('trip-1', sampleExpense);
    expect(mockCallAuthenticated).toHaveBeenCalledWith('/trips/trip-1/expenses', {
      method: 'POST',
      body: JSON.stringify(sampleExpense),
    });
  });

  it('constructs response from request data and server id', async () => {
    mockCallAuthenticated.mockResolvedValue(okResponse({ id: 'e-new' }));
    const { result } = renderHook(() => useExpenses(), { wrapper: makeWrapper() });
    const res = await result.current.addExpense('trip-1', sampleExpense);
    expect(res.id).toBe('e-new');
    expect(res.name).toBe(sampleExpense.name);
    expect(res.amount).toBe(sampleExpense.amount);
    expect(res.payerId).toBe(sampleExpense.payerId);
    expect(typeof res.datetime).toBe('string');
  });

  it('throws AppError on non-ok response', async () => {
    mockCallAuthenticated.mockResolvedValue(errorResponse(422));
    const { result } = renderHook(() => useExpenses(), { wrapper: makeWrapper() });
    await expect(result.current.addExpense('trip-1', sampleExpense)).rejects.toThrow();
  });
});

// ── useExpenses — getExpenseDetail ────────────────────────────────────────────

describe('useExpenses — getExpenseDetail', () => {
  it('calls GET /trips/<id>/expenses/<expenseId>', async () => {
    mockCallAuthenticated.mockResolvedValue(okResponse({ id: 'e1' }));
    const { result } = renderHook(() => useExpenses(), { wrapper: makeWrapper() });
    await result.current.getExpenseDetail('trip-1', 'e1');
    expect(mockCallAuthenticated).toHaveBeenCalledWith('/trips/trip-1/expenses/e1');
  });

  it('returns object directly when response is not an array', async () => {
    const detail = { id: 'e1', name: 'Hotel', splits: [] };
    mockCallAuthenticated.mockResolvedValue(okResponse(detail));
    const { result } = renderHook(() => useExpenses(), { wrapper: makeWrapper() });
    const res = await result.current.getExpenseDetail('trip-1', 'e1');
    expect(res).toEqual(detail);
  });

  it('returns first element when response is an array', async () => {
    const detail = { id: 'e1', name: 'Hotel', splits: [] };
    mockCallAuthenticated.mockResolvedValue(okResponse([detail]));
    const { result } = renderHook(() => useExpenses(), { wrapper: makeWrapper() });
    const res = await result.current.getExpenseDetail('trip-1', 'e1');
    expect(res).toEqual(detail);
  });

  it('throws AppError on non-ok response', async () => {
    mockCallAuthenticated.mockResolvedValue(errorResponse(404));
    const { result } = renderHook(() => useExpenses(), { wrapper: makeWrapper() });
    await expect(result.current.getExpenseDetail('trip-1', 'e1')).rejects.toThrow();
  });
});

// ── useExpenses — getBalances ─────────────────────────────────────────────────

describe('useExpenses — getBalances', () => {
  it('calls GET /trips/<id>/balances and returns data', async () => {
    const balances = { balances: [], totalSpent: 0 };
    mockCallAuthenticated.mockResolvedValue(okResponse(balances));
    const { result } = renderHook(() => useExpenses(), { wrapper: makeWrapper() });
    const res = await result.current.getBalances('trip-1');
    expect(mockCallAuthenticated).toHaveBeenCalledWith('/trips/trip-1/balances');
    expect(res).toEqual(balances);
  });

  it('throws AppError on non-ok response', async () => {
    mockCallAuthenticated.mockResolvedValue(errorResponse(403));
    const { result } = renderHook(() => useExpenses(), { wrapper: makeWrapper() });
    await expect(result.current.getBalances('trip-1')).rejects.toThrow();
  });
});

// ── useExpenses — paySettlement ───────────────────────────────────────────────

describe('useExpenses — paySettlement', () => {
  it('calls POST /trips/<id>/settlements with body', async () => {
    const { result } = renderHook(() => useExpenses(), { wrapper: makeWrapper() });
    await result.current.paySettlement('trip-1', 'user-2', 15.0);
    expect(mockCallAuthenticated).toHaveBeenCalledWith('/trips/trip-1/settlements', {
      method: 'POST',
      body: JSON.stringify({ toId: 'user-2', amount: 15.0 }),
    });
  });

  it('throws AppError on non-ok response', async () => {
    mockCallAuthenticated.mockResolvedValue(errorResponse(400));
    const { result } = renderHook(() => useExpenses(), { wrapper: makeWrapper() });
    await expect(result.current.paySettlement('trip-1', 'user-2', 15.0)).rejects.toThrow();
  });
});

// ── useExpenses — deleteExpense ───────────────────────────────────────────────

describe('useExpenses — deleteExpense', () => {
  it('calls DELETE /trips/<id>/expenses/<expenseId>', async () => {
    const { result } = renderHook(() => useExpenses(), { wrapper: makeWrapper() });
    await result.current.deleteExpense('trip-1', 'e1');
    expect(mockCallAuthenticated).toHaveBeenCalledWith('/trips/trip-1/expenses/e1', {
      method: 'DELETE',
    });
  });

  it('throws AppError on non-ok response', async () => {
    mockCallAuthenticated.mockResolvedValue(errorResponse(404));
    const { result } = renderHook(() => useExpenses(), { wrapper: makeWrapper() });
    await expect(result.current.deleteExpense('trip-1', 'e1')).rejects.toThrow();
  });
});

// ── useExpenses — getPastSettlements ─────────────────────────────────────────

describe('useExpenses — getPastSettlements', () => {
  it('calls GET /trips/<id>/settlements and returns data', async () => {
    const data = [{ id: 's1', amount: 10 }];
    mockCallAuthenticated.mockResolvedValue(okResponse(data));
    const { result } = renderHook(() => useExpenses(), { wrapper: makeWrapper() });
    const res = await result.current.getPastSettlements('trip-1');
    expect(mockCallAuthenticated).toHaveBeenCalledWith('/trips/trip-1/settlements');
    expect(res).toEqual(data);
  });

  it('throws AppError on non-ok response', async () => {
    mockCallAuthenticated.mockResolvedValue(errorResponse(500));
    const { result } = renderHook(() => useExpenses(), { wrapper: makeWrapper() });
    await expect(result.current.getPastSettlements('trip-1')).rejects.toThrow();
  });
});

// ── useExpensesQuery ──────────────────────────────────────────────────────────

describe('useExpensesQuery', () => {
  it('fetches /trips/<id>/expenses and returns data', async () => {
    const data = [{ id: 'e1', name: 'Taxi' }];
    mockCallAuthenticated.mockResolvedValue(okResponse(data));
    const { result } = renderHook(() => useExpensesQuery('trip-1'), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(data);
  });

  it('does not fetch when tripId is empty', async () => {
    const { result } = renderHook(() => useExpensesQuery(''), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(mockCallAuthenticated).not.toHaveBeenCalled();
  });

  it('sets isError on non-ok response', async () => {
    mockCallAuthenticated.mockResolvedValue(errorResponse(401));
    const { result } = renderHook(() => useExpensesQuery('trip-1'), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ── useBalancesQuery ──────────────────────────────────────────────────────────

describe('useBalancesQuery', () => {
  it('fetches /trips/<id>/balances and returns data', async () => {
    const data = { balances: [], totalSpent: 99 };
    mockCallAuthenticated.mockResolvedValue(okResponse(data));
    const { result } = renderHook(() => useBalancesQuery('trip-1'), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(data);
  });

  it('does not fetch when options.enabled is false', async () => {
    const { result } = renderHook(
      () => useBalancesQuery('trip-1', { enabled: false }),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(mockCallAuthenticated).not.toHaveBeenCalled();
  });

  it('sets isError on non-ok response', async () => {
    mockCallAuthenticated.mockResolvedValue(errorResponse(403));
    const { result } = renderHook(() => useBalancesQuery('trip-1'), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ── useExpenseDetailQuery ─────────────────────────────────────────────────────

describe('useExpenseDetailQuery', () => {
  it('fetches /trips/<id>/expenses/<expenseId> and returns data', async () => {
    const detail = { id: 'e1', name: 'Hotel', splits: [] };
    mockCallAuthenticated.mockResolvedValue(okResponse(detail));
    const { result } = renderHook(
      () => useExpenseDetailQuery('trip-1', 'e1'),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(detail);
  });

  it('unwraps array responses', async () => {
    const detail = { id: 'e1', name: 'Hotel', splits: [] };
    mockCallAuthenticated.mockResolvedValue(okResponse([detail]));
    const { result } = renderHook(
      () => useExpenseDetailQuery('trip-1', 'e1'),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(detail);
  });

  it('does not fetch when expenseId is empty', async () => {
    const { result } = renderHook(
      () => useExpenseDetailQuery('trip-1', ''),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(mockCallAuthenticated).not.toHaveBeenCalled();
  });
});

// ── useAddExpenseMutation ─────────────────────────────────────────────────────

describe('useAddExpenseMutation', () => {
  it('calls POST /trips/<id>/expenses with expense body', async () => {
    mockCallAuthenticated.mockResolvedValue(okResponse({ id: 'e-new' }));
    const { result } = renderHook(() => useAddExpenseMutation('trip-1'), { wrapper: makeWrapper() });
    await result.current.mutateAsync(sampleExpense);
    expect(mockCallAuthenticated).toHaveBeenCalledWith('/trips/trip-1/expenses', {
      method: 'POST',
      body: JSON.stringify(sampleExpense),
    });
  });

  it('returns constructed ExpenseSummary on success', async () => {
    mockCallAuthenticated.mockResolvedValue(okResponse({ id: 'e-new' }));
    const { result } = renderHook(() => useAddExpenseMutation('trip-1'), { wrapper: makeWrapper() });
    const res = await result.current.mutateAsync(sampleExpense);
    expect(res.id).toBe('e-new');
    expect(res.name).toBe(sampleExpense.name);
    expect(res.amount).toBe(sampleExpense.amount);
  });

  it('throws AppError on non-ok response', async () => {
    mockCallAuthenticated.mockResolvedValue(errorResponse(422));
    const { result } = renderHook(() => useAddExpenseMutation('trip-1'), { wrapper: makeWrapper() });
    await expect(result.current.mutateAsync(sampleExpense)).rejects.toThrow();
  });
});

// ── useDeleteExpenseMutation ──────────────────────────────────────────────────

describe('useDeleteExpenseMutation', () => {
  it('calls DELETE /trips/<id>/expenses/<expenseId>', async () => {
    const { result } = renderHook(() => useDeleteExpenseMutation('trip-1'), { wrapper: makeWrapper() });
    await result.current.mutateAsync('e1');
    expect(mockCallAuthenticated).toHaveBeenCalledWith('/trips/trip-1/expenses/e1', {
      method: 'DELETE',
    });
  });

  it('throws AppError on non-ok response', async () => {
    mockCallAuthenticated.mockResolvedValue(errorResponse(404));
    const { result } = renderHook(() => useDeleteExpenseMutation('trip-1'), { wrapper: makeWrapper() });
    await expect(result.current.mutateAsync('e1')).rejects.toThrow();
  });
});

// ── usePaySettlementMutation ──────────────────────────────────────────────────

describe('usePaySettlementMutation', () => {
  it('calls POST /trips/<id>/settlements with toId and amount', async () => {
    const { result } = renderHook(() => usePaySettlementMutation('trip-1'), { wrapper: makeWrapper() });
    await result.current.mutateAsync({ toId: 'user-2', amount: 30 });
    expect(mockCallAuthenticated).toHaveBeenCalledWith('/trips/trip-1/settlements', {
      method: 'POST',
      body: JSON.stringify({ toId: 'user-2', amount: 30 }),
    });
  });

  it('throws AppError on non-ok response', async () => {
    mockCallAuthenticated.mockResolvedValue(errorResponse(400));
    const { result } = renderHook(() => usePaySettlementMutation('trip-1'), { wrapper: makeWrapper() });
    await expect(result.current.mutateAsync({ toId: 'user-2', amount: 30 })).rejects.toThrow();
  });
});
