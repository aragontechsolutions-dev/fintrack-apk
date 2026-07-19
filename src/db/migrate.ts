/**
 * Runs schema migrations and seeds reference/default data. Called once right
 * after the encrypted database is opened for a session.
 */

import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { eq } from 'drizzle-orm';

import { CURRENCY_LIST } from '../money/currency';
import { randomId } from '../crypto/random';
import { Database } from './client';
import migrations from './migrations/migrations';
import { categories, currencies } from './schema';

/** Default expense/income categories seeded for a brand-new user. */
const DEFAULT_CATEGORIES: { name: string; kind: 'income' | 'expense'; icon: string }[] = [
  { name: 'Sueldo', kind: 'income', icon: 'cash' },
  { name: 'Otros ingresos', kind: 'income', icon: 'plus-circle' },
  { name: 'Supermercado', kind: 'expense', icon: 'cart' },
  { name: 'Comida', kind: 'expense', icon: 'food' },
  { name: 'Transporte', kind: 'expense', icon: 'bus' },
  { name: 'Servicios', kind: 'expense', icon: 'flash' },
  { name: 'Salud', kind: 'expense', icon: 'medical-bag' },
  { name: 'Ocio', kind: 'expense', icon: 'gamepad' },
  { name: 'Hogar', kind: 'expense', icon: 'home' },
  { name: 'Otros gastos', kind: 'expense', icon: 'dots-horizontal' },
];

export async function runMigrations(db: Database): Promise<void> {
  await migrate(db, migrations);
}

/** Seed the shared currency catalogue (idempotent). */
export async function seedCurrencies(db: Database): Promise<void> {
  for (const c of CURRENCY_LIST) {
    await db
      .insert(currencies)
      .values({
        code: c.code,
        name: c.name,
        symbol: c.symbol,
        minorUnit: c.minorUnit,
      })
      .onConflictDoNothing();
  }
}

/** Seed default categories for a user if they have none yet. */
export async function seedDefaultCategories(
  db: Database,
  userId: string,
): Promise<void> {
  const existing = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.userId, userId))
    .limit(1);
  if (existing.length > 0) return;

  for (const c of DEFAULT_CATEGORIES) {
    await db.insert(categories).values({
      id: randomId(),
      userId,
      name: c.name,
      kind: c.kind,
      icon: c.icon,
    });
  }
}
