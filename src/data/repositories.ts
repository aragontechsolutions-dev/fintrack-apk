/**
 * Data-access layer. Every repository is bound to a single `userId` and applies
 * `where(eq(table.userId, userId))` on EVERY read and write. UI code must go
 * through these repositories and never issue raw cross-user queries — this is
 * the enforcement point for multi-user isolation inside the shared DB.
 */

import { and, desc, eq, gte, sql } from 'drizzle-orm';

import { randomId } from '../crypto/random';
import { Database } from '../db/client';
import {
  Account,
  Category,
  Transaction,
  accounts,
  categories,
  exchangeRates,
  transactionItems,
  transactions,
} from '../db/schema';
import { RATE_ONE } from '../money/fx';
import { convertMinor } from '../money/money';
import { RATE_SCALE } from '../money/fx';
import {
  AccountType,
  CategoryKind,
  TransactionType,
  balanceSign,
} from './types';

export interface AccountInput {
  name: string;
  type: AccountType;
  currency: string;
  openingBalanceMinor: number;
  color?: string | null;
  icon?: string | null;
}

export interface CategoryInput {
  name: string;
  kind: CategoryKind;
  parentId?: string | null;
  color?: string | null;
  icon?: string | null;
}

export interface TransactionInput {
  accountId: string;
  categoryId?: string | null;
  type: TransactionType;
  date: string; // YYYY-MM-DD
  payee?: string | null;
  notes?: string | null;
  amountMinor: number;
  currency: string;
  fxRateToBaseScaled: number;
  amountBaseMinor: number;
  source?: 'manual' | 'ocr';
  transferGroupId?: string | null;
  receiptImagePath?: string | null;
}

export interface TransferInput {
  fromAccountId: string;
  toAccountId: string;
  date: string;
  amountMinor: number; // in source account currency
  currency: string;
  fxRateToBaseScaled: number;
  amountBaseMinor: number;
  notes?: string | null;
}

export function createRepositories(db: Database, userId: string) {
  const now = () => Date.now();

  /* ----------------------------- Accounts ------------------------------- */
  const accountsRepo = {
    async list(includeArchived = false): Promise<Account[]> {
      const where = includeArchived
        ? eq(accounts.userId, userId)
        : and(eq(accounts.userId, userId), eq(accounts.archived, false));
      return db.select().from(accounts).where(where).orderBy(accounts.name);
    },

    async get(id: string): Promise<Account | undefined> {
      const rows = await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.userId, userId), eq(accounts.id, id)))
        .limit(1);
      return rows[0];
    },

    async create(input: AccountInput): Promise<string> {
      const id = randomId();
      await db.insert(accounts).values({
        id,
        userId,
        name: input.name,
        type: input.type,
        currency: input.currency,
        openingBalanceMinor: input.openingBalanceMinor,
        color: input.color ?? null,
        icon: input.icon ?? null,
      });
      return id;
    },

    async update(id: string, input: Partial<AccountInput>): Promise<void> {
      await db
        .update(accounts)
        .set({ ...input, updatedAt: now() })
        .where(and(eq(accounts.userId, userId), eq(accounts.id, id)));
    },

    async archive(id: string): Promise<void> {
      await db
        .update(accounts)
        .set({ archived: true, updatedAt: now() })
        .where(and(eq(accounts.userId, userId), eq(accounts.id, id)));
    },

    /** Current balance (minor units) = opening + signed sum of its txns. */
    async balanceMinor(id: string): Promise<number> {
      const acc = await this.get(id);
      if (!acc) return 0;
      const rows = await db
        .select({
          delta: sql<number>`
            coalesce(sum(
              case
                when ${transactions.type} in ('income','transfer_in')
                  then ${transactions.amountMinor}
                else -${transactions.amountMinor}
              end
            ), 0)`,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            eq(transactions.accountId, id),
          ),
        );
      return acc.openingBalanceMinor + (rows[0]?.delta ?? 0);
    },
  };

  /* ---------------------------- Categories ------------------------------ */
  const categoriesRepo = {
    async list(kind?: CategoryKind): Promise<Category[]> {
      const conds = [eq(categories.userId, userId), eq(categories.archived, false)];
      if (kind) conds.push(eq(categories.kind, kind));
      return db
        .select()
        .from(categories)
        .where(and(...conds))
        .orderBy(categories.name);
    },

    async get(id: string): Promise<Category | undefined> {
      const rows = await db
        .select()
        .from(categories)
        .where(and(eq(categories.userId, userId), eq(categories.id, id)))
        .limit(1);
      return rows[0];
    },

    async create(input: CategoryInput): Promise<string> {
      const id = randomId();
      await db.insert(categories).values({
        id,
        userId,
        name: input.name,
        kind: input.kind,
        parentId: input.parentId ?? null,
        color: input.color ?? null,
        icon: input.icon ?? null,
      });
      return id;
    },

    async update(id: string, input: Partial<CategoryInput>): Promise<void> {
      await db
        .update(categories)
        .set(input)
        .where(and(eq(categories.userId, userId), eq(categories.id, id)));
    },

    async archive(id: string): Promise<void> {
      await db
        .update(categories)
        .set({ archived: true })
        .where(and(eq(categories.userId, userId), eq(categories.id, id)));
    },
  };

  /* --------------------------- Transactions ----------------------------- */
  const transactionsRepo = {
    async listRecent(limit = 50): Promise<Transaction[]> {
      return db
        .select()
        .from(transactions)
        .where(eq(transactions.userId, userId))
        .orderBy(desc(transactions.date), desc(transactions.createdAt))
        .limit(limit);
    },

    async listByAccount(accountId: string, limit = 100): Promise<Transaction[]> {
      return db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            eq(transactions.accountId, accountId),
          ),
        )
        .orderBy(desc(transactions.date), desc(transactions.createdAt))
        .limit(limit);
    },

    async get(id: string): Promise<Transaction | undefined> {
      const rows = await db
        .select()
        .from(transactions)
        .where(and(eq(transactions.userId, userId), eq(transactions.id, id)))
        .limit(1);
      return rows[0];
    },

    async listSince(dateISO: string, limit = 500): Promise<Transaction[]> {
      return db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            gte(transactions.date, dateISO),
          ),
        )
        .orderBy(desc(transactions.date), desc(transactions.createdAt))
        .limit(limit);
    },

    /**
     * Sum income and expense (in BASE currency minor units) since `dateISO`.
     * Transfers are excluded — they are not income or expense.
     */
    async totalsSince(
      dateISO: string,
    ): Promise<{ incomeBaseMinor: number; expenseBaseMinor: number }> {
      const rows = await db
        .select({
          income: sql<number>`coalesce(sum(case when ${transactions.type} = 'income' then ${transactions.amountBaseMinor} else 0 end), 0)`,
          expense: sql<number>`coalesce(sum(case when ${transactions.type} = 'expense' then ${transactions.amountBaseMinor} else 0 end), 0)`,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            gte(transactions.date, dateISO),
          ),
        );
      return {
        incomeBaseMinor: rows[0]?.income ?? 0,
        expenseBaseMinor: rows[0]?.expense ?? 0,
      };
    },

    async create(input: TransactionInput): Promise<string> {
      const id = randomId();
      await db.insert(transactions).values({
        id,
        userId,
        accountId: input.accountId,
        categoryId: input.categoryId ?? null,
        type: input.type,
        date: input.date,
        payee: input.payee ?? null,
        notes: input.notes ?? null,
        amountMinor: input.amountMinor,
        currency: input.currency,
        fxRateToBaseScaled: input.fxRateToBaseScaled,
        amountBaseMinor: input.amountBaseMinor,
        source: input.source ?? 'manual',
        transferGroupId: input.transferGroupId ?? null,
        receiptImagePath: input.receiptImagePath ?? null,
      });
      return id;
    },

    async update(id: string, input: Partial<TransactionInput>): Promise<void> {
      await db
        .update(transactions)
        .set({ ...input, updatedAt: now() })
        .where(and(eq(transactions.userId, userId), eq(transactions.id, id)));
    },

    /** Delete a transaction and its line items (and paired transfer leg). */
    async remove(id: string): Promise<void> {
      const txn = await this.get(id);
      if (!txn) return;
      await db
        .delete(transactionItems)
        .where(
          and(
            eq(transactionItems.userId, userId),
            eq(transactionItems.transactionId, id),
          ),
        );
      await db
        .delete(transactions)
        .where(and(eq(transactions.userId, userId), eq(transactions.id, id)));
      // Remove the other leg of a transfer, if any.
      if (txn.transferGroupId) {
        await db
          .delete(transactions)
          .where(
            and(
              eq(transactions.userId, userId),
              eq(transactions.transferGroupId, txn.transferGroupId),
            ),
          );
      }
    },

    /** Create a transfer as two linked legs sharing a transferGroupId. */
    async createTransfer(input: TransferInput): Promise<string> {
      const groupId = randomId();
      await this.create({
        accountId: input.fromAccountId,
        type: 'transfer_out',
        date: input.date,
        amountMinor: input.amountMinor,
        currency: input.currency,
        fxRateToBaseScaled: input.fxRateToBaseScaled,
        amountBaseMinor: input.amountBaseMinor,
        notes: input.notes ?? null,
        transferGroupId: groupId,
      });
      await this.create({
        accountId: input.toAccountId,
        type: 'transfer_in',
        date: input.date,
        amountMinor: input.amountMinor,
        currency: input.currency,
        fxRateToBaseScaled: input.fxRateToBaseScaled,
        amountBaseMinor: input.amountBaseMinor,
        notes: input.notes ?? null,
        transferGroupId: groupId,
      });
      return groupId;
    },
  };

  /* --------------------------- Exchange rates --------------------------- */
  const ratesRepo = {
    /** Latest known scaled rate for base->quote, or null. */
    async latest(base: string, quote: string): Promise<number | null> {
      const rows = await db
        .select({ rateScaled: exchangeRates.rateScaled })
        .from(exchangeRates)
        .where(
          and(
            eq(exchangeRates.userId, userId),
            eq(exchangeRates.base, base),
            eq(exchangeRates.quote, quote),
          ),
        )
        .orderBy(desc(exchangeRates.date))
        .limit(1);
      return rows[0]?.rateScaled ?? null;
    },

    async save(
      base: string,
      quote: string,
      rateScaled: number,
      date: string,
      source: string,
    ): Promise<void> {
      await db.insert(exchangeRates).values({
        id: randomId(),
        userId,
        base,
        quote,
        rateScaled,
        date,
        source,
      });
    },
  };

  return {
    accounts: accountsRepo,
    categories: categoriesRepo,
    transactions: transactionsRepo,
    rates: ratesRepo,
  };
}

export type Repositories = ReturnType<typeof createRepositories>;

/**
 * Compute the amount in base currency for a transaction, given a scaled rate.
 * Kept here so entry screens share one implementation.
 */
export function toBaseMinor(
  amountMinor: number,
  rateToBaseScaled: number,
): number {
  if (rateToBaseScaled === RATE_ONE) return amountMinor;
  return convertMinor(amountMinor, rateToBaseScaled, RATE_SCALE);
}

export { balanceSign };
