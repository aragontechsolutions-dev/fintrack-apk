/**
 * Per-user data dump and restore.
 *
 * A backup contains only the current user's rows (privacy: other local profiles
 * are never exported). On restore, every row's `userId` is remapped to the
 * importing user so a backup can be moved to a fresh profile/device. Primary
 * keys and cross-references (accountId, categoryId, transactionId, planId) are
 * preserved so relationships stay intact within the imported set.
 */

import { eq } from 'drizzle-orm';

import { Database } from '../db/client';
import { SCHEMA_VERSION } from '../config/version';
import {
  accounts,
  budgets,
  categories,
  exchangeRates,
  savingsContributions,
  savingsPlans,
  transactionItems,
  transactions,
  users,
} from '../db/schema';

export interface UserDump {
  schemaVersion: number;
  exportedAt: number;
  profile: Record<string, unknown> | null;
  tables: {
    accounts: Record<string, unknown>[];
    categories: Record<string, unknown>[];
    transactions: Record<string, unknown>[];
    transactionItems: Record<string, unknown>[];
    savingsPlans: Record<string, unknown>[];
    savingsContributions: Record<string, unknown>[];
    budgets: Record<string, unknown>[];
    exchangeRates: Record<string, unknown>[];
  };
}

export async function dumpUserData(
  db: Database,
  userId: string,
): Promise<UserDump> {
  const [
    profileRows,
    accountRows,
    categoryRows,
    txnRows,
    itemRows,
    planRows,
    contribRows,
    budgetRows,
    rateRows,
  ] = await Promise.all([
    db.select().from(users).where(eq(users.id, userId)),
    db.select().from(accounts).where(eq(accounts.userId, userId)),
    db.select().from(categories).where(eq(categories.userId, userId)),
    db.select().from(transactions).where(eq(transactions.userId, userId)),
    db.select().from(transactionItems).where(eq(transactionItems.userId, userId)),
    db.select().from(savingsPlans).where(eq(savingsPlans.userId, userId)),
    db
      .select()
      .from(savingsContributions)
      .where(eq(savingsContributions.userId, userId)),
    db.select().from(budgets).where(eq(budgets.userId, userId)),
    db.select().from(exchangeRates).where(eq(exchangeRates.userId, userId)),
  ]);

  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: Date.now(),
    profile: profileRows[0] ?? null,
    tables: {
      accounts: accountRows,
      categories: categoryRows,
      transactions: txnRows,
      transactionItems: itemRows,
      savingsPlans: planRows,
      savingsContributions: contribRows,
      budgets: budgetRows,
      exchangeRates: rateRows,
    },
  };
}

export interface RestoreCounts {
  accounts: number;
  categories: number;
  transactions: number;
  transactionItems: number;
  savingsPlans: number;
  savingsContributions: number;
  budgets: number;
  exchangeRates: number;
}

/**
 * Replace the importing user's data with the dump's data. Deletes existing
 * rows for `userId`, then inserts the backup rows with `userId` remapped.
 *
 * NOTE: not wrapped in a single transaction because the expo driver's
 * transaction callback is synchronous; callers MUST take a safety snapshot
 * before invoking restore so a partial failure is recoverable.
 */
export async function restoreUserData(
  db: Database,
  userId: string,
  dump: UserDump,
): Promise<RestoreCounts> {
  const remap = <T extends Record<string, unknown>>(rows: T[]): T[] =>
    rows.map((r) => ({ ...r, userId }));

  // Delete existing rows (children first for clarity; no FK cascade assumed).
  await db.delete(transactionItems).where(eq(transactionItems.userId, userId));
  await db
    .delete(savingsContributions)
    .where(eq(savingsContributions.userId, userId));
  await db.delete(savingsPlans).where(eq(savingsPlans.userId, userId));
  await db.delete(transactions).where(eq(transactions.userId, userId));
  await db.delete(budgets).where(eq(budgets.userId, userId));
  await db.delete(exchangeRates).where(eq(exchangeRates.userId, userId));
  await db.delete(categories).where(eq(categories.userId, userId));
  await db.delete(accounts).where(eq(accounts.userId, userId));

  const t = dump.tables;
  const insertMany = async (table: any, rows: Record<string, unknown>[]) => {
    // Insert in chunks to avoid SQLite variable limits on large datasets.
    const chunkSize = 200;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      if (chunk.length > 0) await db.insert(table).values(chunk);
    }
  };

  if (t.accounts.length) await insertMany(accounts, remap(t.accounts));
  if (t.categories.length) await insertMany(categories, remap(t.categories));
  if (t.transactions.length) await insertMany(transactions, remap(t.transactions));
  if (t.transactionItems.length)
    await insertMany(transactionItems, remap(t.transactionItems));
  if (t.savingsPlans.length) await insertMany(savingsPlans, remap(t.savingsPlans));
  if (t.savingsContributions.length)
    await insertMany(savingsContributions, remap(t.savingsContributions));
  if (t.budgets.length) await insertMany(budgets, remap(t.budgets));
  if (t.exchangeRates.length)
    await insertMany(exchangeRates, remap(t.exchangeRates));

  return {
    accounts: t.accounts.length,
    categories: t.categories.length,
    transactions: t.transactions.length,
    transactionItems: t.transactionItems.length,
    savingsPlans: t.savingsPlans.length,
    savingsContributions: t.savingsContributions.length,
    budgets: t.budgets.length,
    exchangeRates: t.exchangeRates.length,
  };
}
