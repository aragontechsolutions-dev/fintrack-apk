/** Shared domain enums/types for the data layer. */

export type TransactionType =
  | 'income'
  | 'expense'
  | 'transfer_out'
  | 'transfer_in';

export type AccountType = 'cash' | 'bank' | 'card';

export type CategoryKind = 'income' | 'expense';

/** Sign a transaction type contributes to an account balance. */
export function balanceSign(type: TransactionType): 1 | -1 {
  return type === 'income' || type === 'transfer_in' ? 1 : -1;
}

/** Whether a transaction type counts toward income/expense reporting. */
export function isReportable(type: TransactionType): boolean {
  return type === 'income' || type === 'expense';
}
