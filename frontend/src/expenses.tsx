import { useCallback } from 'react';
import { useAuth } from './auth';
import type { components } from './generated/types';
import { AppError, ErrorCode } from './AppError';

type ExpenseSummary = components['schemas']['ExpenseSummary'];
type BalancesInfo = components['schemas']['BalancesInfo'];

export function useExpenses() {
  const { callAuthenticated } = useAuth();

  const getExpenses = useCallback(async (tripId: string): Promise<ExpenseSummary[]> => {
    const response = await callAuthenticated(`/trips/${tripId}/expenses`);

    if (!response.ok) {
      throw new AppError(response.status as ErrorCode);
    }

    return response.json();
  }, [callAuthenticated]);

  const addExpense = useCallback(async (tripId: string, expense: components['schemas']['CreateExpenseRequest']): Promise<ExpenseSummary> => {
    const response = await callAuthenticated(`/trips/${tripId}/expenses`, {
      method: 'POST',
      body: JSON.stringify(expense),
    });

    if (!response.ok) {
      throw new AppError(response.status as ErrorCode);
    }

    const { id } = await response.json() as components['schemas']['IdResponse'];
    return {
      id,
      name: expense.description,
      amount: expense.amount,
      payerId: expense.payerId,
      datetime: new Date().toISOString(),
    };
  }, [callAuthenticated]);

  const getBalances = useCallback(async (tripId: string): Promise<BalancesInfo> => {
    const response = await callAuthenticated(`/trips/${tripId}/balances`);
    if (!response.ok) throw new AppError(response.status as ErrorCode);
    return response.json();
  }, [callAuthenticated]);

  return { getExpenses, addExpense, getBalances };
}

export type { ExpenseSummary, BalancesInfo };