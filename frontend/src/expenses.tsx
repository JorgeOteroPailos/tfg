import { useCallback } from 'react';
import { useAuth } from './auth';
import type { components } from './generated/types';
import { AppError, ErrorCode } from './AppError';

type ExpenseSummary = components['schemas']['ExpenseSummary'];

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

    return response.json();
  }, [callAuthenticated]);

  return { getExpenses, addExpense };
}

export type { ExpenseSummary };