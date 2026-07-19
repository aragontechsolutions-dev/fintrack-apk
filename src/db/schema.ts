/**
 * FinTrack database schema (Drizzle ORM / SQLite + SQLCipher).
 *
 * Conventions:
 *  - Money is stored in MINOR units (cents) as INTEGER. Column names carry the
 *    `Minor` suffix so the unit is never ambiguous.
 *  - Every user-owned table has `userId` for logical isolation. The data-access
 *    layer ALWAYS filters by the active session's userId.
 *  - Timestamps (`createdAt`, `updatedAt`) are Unix epoch milliseconds (INTEGER).
 *  - Calendar dates (`date`) are ISO `YYYY-MM-DD` TEXT (local day).
 *  - FX rates are stored scaled by 6 decimals (see fx.ts RATE_SCALE).
 */

import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

const now = sql`(cast(strftime('%s','now') as integer) * 1000)`;

/* -------------------------------------------------------------------------- */
/* Users (profile + preferences). Auth secrets live OUTSIDE the DB.           */
/* -------------------------------------------------------------------------- */

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  baseCurrency: text('base_currency').notNull().default('UYU'),
  biometricEnabled: integer('biometric_enabled', { mode: 'boolean' })
    .notNull()
    .default(false),
  autoLogoutSeconds: integer('auto_logout_seconds').notNull().default(120),
  createdAt: integer('created_at').notNull().default(now),
  updatedAt: integer('updated_at').notNull().default(now),
});

/* -------------------------------------------------------------------------- */
/* Currencies + exchange rates (shared reference data).                       */
/* -------------------------------------------------------------------------- */

export const currencies = sqliteTable('currencies', {
  code: text('code').primaryKey(), // 'UYU' | 'USD'
  name: text('name').notNull(),
  symbol: text('symbol').notNull(),
  minorUnit: integer('minor_unit').notNull().default(2),
});

export const exchangeRates = sqliteTable(
  'exchange_rates',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    base: text('base').notNull(), // e.g. 'USD'
    quote: text('quote').notNull(), // e.g. 'UYU'
    /** 1 base = rateScaled / 10^6 quote. */
    rateScaled: integer('rate_scaled').notNull(),
    date: text('date').notNull(), // YYYY-MM-DD
    source: text('source').notNull().default('manual'), // manual | bcu | dolarapi
    createdAt: integer('created_at').notNull().default(now),
  },
  (t) => ({
    byPair: index('idx_rates_user_pair_date').on(
      t.userId,
      t.base,
      t.quote,
      t.date,
    ),
  }),
);

/* -------------------------------------------------------------------------- */
/* Accounts / wallets.                                                        */
/* -------------------------------------------------------------------------- */

export const accounts = sqliteTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    type: text('type').notNull().default('cash'), // cash | bank | card
    currency: text('currency').notNull().default('UYU'),
    /** Opening balance in minor units. Current balance is derived from txns. */
    openingBalanceMinor: integer('opening_balance_minor').notNull().default(0),
    color: text('color'),
    icon: text('icon'),
    archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at').notNull().default(now),
    updatedAt: integer('updated_at').notNull().default(now),
  },
  (t) => ({
    byUser: index('idx_accounts_user').on(t.userId),
  }),
);

/* -------------------------------------------------------------------------- */
/* Categories (hierarchical, per user).                                       */
/* -------------------------------------------------------------------------- */

export const categories = sqliteTable(
  'categories',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    kind: text('kind').notNull(), // income | expense
    parentId: text('parent_id'),
    color: text('color'),
    icon: text('icon'),
    archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at').notNull().default(now),
  },
  (t) => ({
    byUser: index('idx_categories_user_kind').on(t.userId, t.kind),
  }),
);

/* -------------------------------------------------------------------------- */
/* Transactions (header) + line items.                                        */
/* -------------------------------------------------------------------------- */

export const transactions = sqliteTable(
  'transactions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    accountId: text('account_id').notNull(),
    categoryId: text('category_id'),
    type: text('type').notNull(), // income | expense | transfer
    date: text('date').notNull(), // YYYY-MM-DD
    payee: text('payee'),
    notes: text('notes'),
    /** Amount in the transaction's own currency, minor units. Always positive. */
    amountMinor: integer('amount_minor').notNull(),
    currency: text('currency').notNull().default('UYU'),
    /** FX rate to the user's base currency, scaled by 10^6. 1_000_000 = same. */
    fxRateToBaseScaled: integer('fx_rate_to_base_scaled').notNull().default(1_000_000),
    /** Equivalent amount in base currency, minor units (snapshot at entry). */
    amountBaseMinor: integer('amount_base_minor').notNull(),
    hasLineItems: integer('has_line_items', { mode: 'boolean' })
      .notNull()
      .default(false),
    source: text('source').notNull().default('manual'), // manual | ocr
    /** Groups the two legs of a transfer together. */
    transferGroupId: text('transfer_group_id'),
    receiptImagePath: text('receipt_image_path'),
    createdAt: integer('created_at').notNull().default(now),
    updatedAt: integer('updated_at').notNull().default(now),
  },
  (t) => ({
    byUserDate: index('idx_txn_user_date').on(t.userId, t.date),
    byAccount: index('idx_txn_account').on(t.userId, t.accountId),
    byCategory: index('idx_txn_category').on(t.userId, t.categoryId),
    byTransfer: index('idx_txn_transfer').on(t.transferGroupId),
  }),
);

export const transactionItems = sqliteTable(
  'transaction_items',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    transactionId: text('transaction_id').notNull(),
    description: text('description').notNull(),
    /** Quantity, allows fractional (e.g. 0.5 kg). */
    quantity: real('quantity').notNull().default(1),
    unitPriceMinor: integer('unit_price_minor').notNull().default(0),
    lineTotalMinor: integer('line_total_minor').notNull().default(0),
    categoryId: text('category_id'),
    ocrConfidence: real('ocr_confidence'),
    createdAt: integer('created_at').notNull().default(now),
  },
  (t) => ({
    byTxn: index('idx_items_txn').on(t.transactionId),
    byUser: index('idx_items_user').on(t.userId),
  }),
);

/* -------------------------------------------------------------------------- */
/* Savings plans + contributions.                                             */
/* -------------------------------------------------------------------------- */

export const savingsPlans = sqliteTable(
  'savings_plans',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    targetMinor: integer('target_minor').notNull(),
    currency: text('currency').notNull().default('UYU'),
    targetDate: text('target_date'), // YYYY-MM-DD | null
    kind: text('kind').notNull().default('goal'), // goal | envelope
    accountId: text('account_id'),
    archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at').notNull().default(now),
  },
  (t) => ({
    byUser: index('idx_plans_user').on(t.userId),
  }),
);

export const savingsContributions = sqliteTable(
  'savings_contributions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    planId: text('plan_id').notNull(),
    date: text('date').notNull(),
    amountMinor: integer('amount_minor').notNull(),
    transactionId: text('transaction_id'),
    createdAt: integer('created_at').notNull().default(now),
  },
  (t) => ({
    byPlan: index('idx_contrib_plan').on(t.planId),
    byUser: index('idx_contrib_user').on(t.userId),
  }),
);

/* -------------------------------------------------------------------------- */
/* Budgets.                                                                    */
/* -------------------------------------------------------------------------- */

export const budgets = sqliteTable(
  'budgets',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    categoryId: text('category_id'),
    period: text('period').notNull().default('monthly'), // monthly | weekly
    limitMinor: integer('limit_minor').notNull(),
    currency: text('currency').notNull().default('UYU'),
    createdAt: integer('created_at').notNull().default(now),
  },
  (t) => ({
    byUser: index('idx_budgets_user').on(t.userId),
  }),
);

/* -------------------------------------------------------------------------- */
/* Types inferred for use across the app.                                     */
/* -------------------------------------------------------------------------- */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type NewTransactionItem = typeof transactionItems.$inferInsert;
export type SavingsPlan = typeof savingsPlans.$inferSelect;
export type SavingsContribution = typeof savingsContributions.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
export type ExchangeRate = typeof exchangeRates.$inferSelect;
