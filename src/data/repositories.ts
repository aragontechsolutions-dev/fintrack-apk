/**
 * Data-access layer. Every repository is bound to a single `userId` and applies
 * `where(eq(table.userId, userId))` on EVERY read and write. UI code must go
 * through these repositories and never issue raw cross-user queries — this is
 * the enforcement point for multi-user isolation inside the shared DB.
 */

import { and, asc, desc, eq, gte, lt, sql } from 'drizzle-orm';

import { randomId } from '../crypto/random';
import { Database } from '../db/client';
import {
  Account,
  Budget,
  Category,
  SavingsContribution,
  SavingsPlan,
  Transaction,
  TransactionItem,
  accounts,
  budgets,
  categories,
  exchangeRates,
  savingsContributions,
  savingsPlans,
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

    /** Income/expense (base minor) in the half-open range [fromISO, toISO). */
    async totalsBetween(
      fromISO: string,
      toISO: string,
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
            gte(transactions.date, fromISO),
            lt(transactions.date, toISO),
          ),
        );
      return {
        incomeBaseMinor: rows[0]?.income ?? 0,
        expenseBaseMinor: rows[0]?.expense ?? 0,
      };
    },

    /** Expense totals (base minor) grouped by category, in [fromISO, toISO). */
    async categorySpendingBetween(
      fromISO: string,
      toISO: string,
    ): Promise<{ categoryId: string | null; totalBaseMinor: number }[]> {
      return db
        .select({
          categoryId: transactions.categoryId,
          totalBaseMinor: sql<number>`coalesce(sum(${transactions.amountBaseMinor}), 0)`,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            eq(transactions.type, 'expense'),
            gte(transactions.date, fromISO),
            lt(transactions.date, toISO),
          ),
        )
        .groupBy(transactions.categoryId)
        .orderBy(desc(sql`coalesce(sum(${transactions.amountBaseMinor}), 0)`));
    },

    /** Total expense (base minor) for one category in [fromISO, toISO). */
    async categoryExpenseBetween(
      categoryId: string,
      fromISO: string,
      toISO: string,
    ): Promise<number> {
      const rows = await db
        .select({
          total: sql<number>`coalesce(sum(${transactions.amountBaseMinor}), 0)`,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            eq(transactions.type, 'expense'),
            eq(transactions.categoryId, categoryId),
            gte(transactions.date, fromISO),
            lt(transactions.date, toISO),
          ),
        );
      return rows[0]?.total ?? 0;
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

    async listItems(transactionId: string): Promise<TransactionItem[]> {
      return db
        .select()
        .from(transactionItems)
        .where(
          and(
            eq(transactionItems.userId, userId),
            eq(transactionItems.transactionId, transactionId),
          ),
        )
        .orderBy(asc(transactionItems.createdAt));
    },

    /**
     * Replace all line items of a transaction (delete + insert) and update its
     * `hasLineItems` flag. Pass an empty array to clear the detail.
     */
    async replaceItems(
      transactionId: string,
      items: {
        description: string;
        quantity: number;
        unitPriceMinor: number;
        lineTotalMinor: number;
        categoryId?: string | null;
        ocrConfidence?: number | null;
      }[],
    ): Promise<void> {
      await db
        .delete(transactionItems)
        .where(
          and(
            eq(transactionItems.userId, userId),
            eq(transactionItems.transactionId, transactionId),
          ),
        );
      if (items.length > 0) {
        await db.insert(transactionItems).values(
          items.map((it) => ({
            id: randomId(),
            userId,
            transactionId,
            description: it.description,
            quantity: it.quantity,
            unitPriceMinor: it.unitPriceMinor,
            lineTotalMinor: it.lineTotalMinor,
            categoryId: it.categoryId ?? null,
            ocrConfidence: it.ocrConfidence ?? null,
          })),
        );
      }
      await db
        .update(transactions)
        .set({ hasLineItems: items.length > 0, updatedAt: now() })
        .where(
          and(eq(transactions.userId, userId), eq(transactions.id, transactionId)),
        );
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

  /* ---------------------------- Savings --------------------------------- */
  const savingsRepo = {
    async listPlans(includeArchived = false): Promise<SavingsPlan[]> {
      const where = includeArchived
        ? eq(savingsPlans.userId, userId)
        : and(eq(savingsPlans.userId, userId), eq(savingsPlans.archived, false));
      return db
        .select()
        .from(savingsPlans)
        .where(where)
        .orderBy(asc(savingsPlans.name));
    },

    async getPlan(id: string): Promise<SavingsPlan | undefined> {
      const rows = await db
        .select()
        .from(savingsPlans)
        .where(and(eq(savingsPlans.userId, userId), eq(savingsPlans.id, id)))
        .limit(1);
      return rows[0];
    },

    async createPlan(input: {
      name: string;
      targetMinor: number;
      currency: string;
      targetDate?: string | null;
      kind: 'goal' | 'envelope';
      accountId?: string | null;
    }): Promise<string> {
      const id = randomId();
      await db.insert(savingsPlans).values({
        id,
        userId,
        name: input.name,
        targetMinor: input.targetMinor,
        currency: input.currency,
        targetDate: input.targetDate ?? null,
        kind: input.kind,
        accountId: input.accountId ?? null,
      });
      return id;
    },

    async updatePlan(
      id: string,
      input: Partial<{
        name: string;
        targetMinor: number;
        currency: string;
        targetDate: string | null;
        kind: 'goal' | 'envelope';
      }>,
    ): Promise<void> {
      await db
        .update(savingsPlans)
        .set(input)
        .where(and(eq(savingsPlans.userId, userId), eq(savingsPlans.id, id)));
    },

    async archivePlan(id: string): Promise<void> {
      await db
        .update(savingsPlans)
        .set({ archived: true })
        .where(and(eq(savingsPlans.userId, userId), eq(savingsPlans.id, id)));
    },

    async savedMinor(planId: string): Promise<number> {
      const rows = await db
        .select({
          total: sql<number>`coalesce(sum(${savingsContributions.amountMinor}), 0)`,
        })
        .from(savingsContributions)
        .where(
          and(
            eq(savingsContributions.userId, userId),
            eq(savingsContributions.planId, planId),
          ),
        );
      return rows[0]?.total ?? 0;
    },

    async listContributions(planId: string): Promise<SavingsContribution[]> {
      return db
        .select()
        .from(savingsContributions)
        .where(
          and(
            eq(savingsContributions.userId, userId),
            eq(savingsContributions.planId, planId),
          ),
        )
        .orderBy(desc(savingsContributions.date));
    },

    async addContribution(input: {
      planId: string;
      date: string;
      amountMinor: number;
      transactionId?: string | null;
    }): Promise<string> {
      const id = randomId();
      await db.insert(savingsContributions).values({
        id,
        userId,
        planId: input.planId,
        date: input.date,
        amountMinor: input.amountMinor,
        transactionId: input.transactionId ?? null,
      });
      return id;
    },

    async removeContribution(id: string): Promise<void> {
      await db
        .delete(savingsContributions)
        .where(
          and(
            eq(savingsContributions.userId, userId),
            eq(savingsContributions.id, id),
          ),
        );
    },
  };

  /* ---------------------------- Budgets --------------------------------- */
  const budgetsRepo = {
    async list(): Promise<Budget[]> {
      return db.select().from(budgets).where(eq(budgets.userId, userId));
    },

    async get(id: string): Promise<Budget | undefined> {
      const rows = await db
        .select()
        .from(budgets)
        .where(and(eq(budgets.userId, userId), eq(budgets.id, id)))
        .limit(1);
      return rows[0];
    },

    async forCategory(categoryId: string): Promise<Budget | undefined> {
      const rows = await db
        .select()
        .from(budgets)
        .where(
          and(eq(budgets.userId, userId), eq(budgets.categoryId, categoryId)),
        )
        .limit(1);
      return rows[0];
    },

    async upsert(input: {
      categoryId: string;
      period: 'monthly' | 'weekly';
      limitMinor: number;
      currency: string;
    }): Promise<void> {
      const existing = await this.forCategory(input.categoryId);
      if (existing) {
        await db
          .update(budgets)
          .set({ limitMinor: input.limitMinor, period: input.period })
          .where(and(eq(budgets.userId, userId), eq(budgets.id, existing.id)));
      } else {
        await db.insert(budgets).values({
          id: randomId(),
          userId,
          categoryId: input.categoryId,
          period: input.period,
          limitMinor: input.limitMinor,
          currency: input.currency,
        });
      }
    },

    async remove(id: string): Promise<void> {
      await db
        .delete(budgets)
        .where(and(eq(budgets.userId, userId), eq(budgets.id, id)));
    },
  };

  return {
    accounts: accountsRepo,
    categories: categoriesRepo,
    transactions: transactionsRepo,
    rates: ratesRepo,
    savings: savingsRepo,
    budgets: budgetsRepo,
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
