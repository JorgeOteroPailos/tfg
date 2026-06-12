import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './auth';
import type { components } from './generated/types';
import { AppError, ErrorCode } from './AppError';
import { expenseKeys } from './queryKeys';

type ExpenseSummary = components['schemas']['ExpenseSummary'];
type ExpenseDetail = components['schemas']['ExpenseDetail'];
type BalancesInfo = components['schemas']['BalancesInfo'];
type PastSettlement = components['schemas']['PastSettlement'];

export function useExpenses() {
  const { callAuthenticated } = useAuth();

  const getExpenses = useCallback(async (tripId: string): Promise<ExpenseSummary[]> => {
    const response = await callAuthenticated(`/trips/${tripId}/expenses`);
    if (!response.ok) throw new AppError(response.status as ErrorCode);
    return response.json();
  }, [callAuthenticated]);

  const addExpense = useCallback(async (tripId: string, expense: components['schemas']['CreateExpenseRequest']): Promise<ExpenseSummary> => {
    const response = await callAuthenticated(`/trips/${tripId}/expenses`, {
      method: 'POST',
      body: JSON.stringify(expense),
    });
    if (!response.ok) throw new AppError(response.status as ErrorCode);
    const { id } = await response.json() as components['schemas']['IdResponse'];
    return {
      id,
      name: expense.name,
      amount: expense.amount,
      payerId: expense.payerId,
      datetime: new Date().toISOString(),
      category: expense.category,
    };
  }, [callAuthenticated]);

  const getExpenseDetail = useCallback(async (tripId: string, expenseId: string): Promise<ExpenseDetail> => {
    const response = await callAuthenticated(`/trips/${tripId}/expenses/${expenseId}`);
    if (!response.ok) throw new AppError(response.status as ErrorCode);
    const data = await response.json();
    return Array.isArray(data) ? data[0] : data;
  }, [callAuthenticated]);

  const getBalances = useCallback(async (tripId: string): Promise<BalancesInfo> => {
    const response = await callAuthenticated(`/trips/${tripId}/balances`);
    if (!response.ok) throw new AppError(response.status as ErrorCode);
    return response.json();
  }, [callAuthenticated]);

  const paySettlement = useCallback(async (tripId: string, fromId: string, toId: string, amount: number): Promise<void> => {
    const response = await callAuthenticated(`/trips/${tripId}/settlements`, {
      method: 'POST',
      body: JSON.stringify({ fromId, toId, amount }),
    });
    if (!response.ok) throw new AppError(response.status as ErrorCode);
  }, [callAuthenticated]);

  const deleteExpense = useCallback(async (tripId: string, expenseId: string): Promise<void> => {
    const response = await callAuthenticated(`/trips/${tripId}/expenses/${expenseId}`, { method: 'DELETE' });
    if (!response.ok) throw new AppError(response.status as ErrorCode);
  }, [callAuthenticated]);

  const getPastSettlements = useCallback(async (tripId: string): Promise<PastSettlement[]> => {
    const response = await callAuthenticated(`/trips/${tripId}/settlements`);
    if (!response.ok) throw new AppError(response.status as ErrorCode);
    return response.json();
  }, [callAuthenticated]);

  return { getExpenses, addExpense, getExpenseDetail, getBalances, paySettlement, deleteExpense, getPastSettlements };
}

export function useExpensesQuery(tripId: string) {
  const { callAuthenticated } = useAuth();
  return useQuery({
    queryKey: expenseKeys.list(tripId),
    queryFn: async (): Promise<ExpenseSummary[]> => {
      const response = await callAuthenticated(`/trips/${tripId}/expenses`);
      if (!response.ok) throw new AppError(response.status as ErrorCode);
      return response.json();
    },
    enabled: !!tripId,
  });
}

export function useBalancesQuery(tripId: string, options?: { enabled?: boolean }) {
  const { callAuthenticated } = useAuth();
  return useQuery({
    queryKey: expenseKeys.balances(tripId),
    queryFn: async (): Promise<BalancesInfo> => {
      const response = await callAuthenticated(`/trips/${tripId}/balances`);
      if (!response.ok) throw new AppError(response.status as ErrorCode);
      return response.json();
    },
    enabled: !!tripId && (options?.enabled ?? true),
  });
}

export function useExpenseDetailQuery(tripId: string, expenseId: string, options?: { enabled?: boolean }) {
  const { callAuthenticated } = useAuth();
  return useQuery({
    queryKey: expenseKeys.detail(tripId, expenseId),
    queryFn: async (): Promise<ExpenseDetail> => {
      const response = await callAuthenticated(`/trips/${tripId}/expenses/${expenseId}`);
      if (!response.ok) throw new AppError(response.status as ErrorCode);
      const data = await response.json();
      return Array.isArray(data) ? data[0] : data;
    },
    enabled: !!tripId && !!expenseId && (options?.enabled ?? true),
  });
}

function usePastSettlementsQuery(tripId: string) {
  const { callAuthenticated } = useAuth();
  return useQuery({
    queryKey: expenseKeys.settlements(tripId),
    queryFn: async (): Promise<PastSettlement[]> => {
      const response = await callAuthenticated(`/trips/${tripId}/settlements`);
      if (!response.ok) throw new AppError(response.status as ErrorCode);
      return response.json();
    },
    enabled: !!tripId,
  });
}

export function useAddExpenseMutation(tripId: string) {
  const { callAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (expense: components['schemas']['CreateExpenseRequest']): Promise<ExpenseSummary> => {
      const response = await callAuthenticated(`/trips/${tripId}/expenses`, {
        method: 'POST',
        body: JSON.stringify(expense),
      });
      if (!response.ok) throw new AppError(response.status as ErrorCode);
      const { id } = await response.json() as components['schemas']['IdResponse'];
      return {
        id,
        name: expense.name,
        amount: expense.amount,
        payerId: expense.payerId,
        datetime: new Date().toISOString(),
        category: expense.category,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.list(tripId) });
      queryClient.invalidateQueries({ queryKey: expenseKeys.balances(tripId) });
    },
  });
}

export function useDeleteExpenseMutation(tripId: string) {
  const { callAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (expenseId: string): Promise<void> => {
      const response = await callAuthenticated(`/trips/${tripId}/expenses/${expenseId}`, { method: 'DELETE' });
      if (!response.ok) throw new AppError(response.status as ErrorCode);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.list(tripId) });
      queryClient.invalidateQueries({ queryKey: expenseKeys.balances(tripId) });
    },
  });
}

export function usePaySettlementMutation(tripId: string) {
  const { callAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ fromId, toId, amount }: { fromId: string; toId: string; amount: number }): Promise<void> => {
      const response = await callAuthenticated(`/trips/${tripId}/settlements`, {
        method: 'POST',
        body: JSON.stringify({ fromId, toId, amount }),
      });
      if (!response.ok) throw new AppError(response.status as ErrorCode);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.balances(tripId) });
      queryClient.invalidateQueries({ queryKey: expenseKeys.settlements(tripId) });
    },
  });
}

export type { ExpenseSummary, ExpenseDetail, BalancesInfo, PastSettlement };
