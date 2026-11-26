import * as SQLite from 'expo-sqlite';
import {
  BillingCycleConfig,
  DEFAULT_BILLING_CYCLE,
  normalizeBillingCycleConfig,
} from '../utils/billingCycle';
import {
  deleteReceiptImageIfLocal,
  clearAllReceiptImages,
} from '../utils/receiptStorage';

export type CategoryBudgetsMap = Record<string, number>;

export type CurrencyType = 'IDR' | 'USD';
export type TransactionType = 'expense' | 'income';
export type AccountType =
  | 'Bank'
  | 'E-Wallet'
  | 'Cash'
  | 'Investment'
  | 'Credit Card'
  | 'E-Money'
  | 'bank'
  | 'cash'
  | 'ewallet'
  | 'investment';

export interface Wallet {
  id: string;
  name: string;
  type: AccountType | string;
  balance: number;
  currency: CurrencyType;
  color: string;
  accountNumber?: string;
  sortOrder?: number;
}

export interface Pocket {
  id: string;
  walletId: string;
  name: string;
  balance: number;
  targetAmount: number;
  icon: string;
  color: string;
}

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  icon: string;
  color: string;
  isDefault: boolean;
}

export interface TransactionItem {
  id: string;
  transactionId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  category: string;
}

export type LentStatus = 'unsettled' | 'partial' | 'settled';

export interface Transaction {
  id: string;
  walletId: string;
  pocketId?: string;
  merchantName: string;
  category: string;
  type: TransactionType;
  amount: number;
  currency: CurrencyType;
  taxAmount: number;
  discountAmount: number;
  timestamp: string;
  paymentMethod: string;
  notes?: string;
  imageUri?: string;
  transferPairId?: string;
  exchangeRate?: number;
  isLent?: boolean;
  lentTo?: string;
  lentRepaidAmount?: number;
  lentStatus?: LentStatus;
  lentParentTxId?: string;
  deletedWalletName?: string;
  deletedPocketName?: string;
  pairedDeletedWalletName?: string;
  pairedPocketId?: string;
  pairedDeletedPocketName?: string;
  items?: TransactionItem[];
}

let dbInstance: SQLite.SQLiteDatabase | null = null;
let dbInitPromise: Promise<SQLite.SQLiteDatabase> | null = null;

// Typed domain error so the UI can render a friendly, formatted message
export class InsufficientFundsError extends Error {
  scope: 'account' | 'pocket' | 'allocate' | 'release';
  available: number;

  constructor(scope: 'account' | 'pocket' | 'allocate' | 'release', available: number, message: string) {
    super(message);
    this.name = 'InsufficientFundsError';
    this.scope = scope;
    this.available = available;
  }
}

// Ensure column exists on existing SQLite tables for smooth upgrades
async function ensureColumn(
  db: SQLite.SQLiteDatabase,
  table: string,
  column: string,
  definition: string
): Promise<void> {
  try {
    const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
    if (cols.length > 0 && !cols.some((c) => c.name.toLowerCase() === column.toLowerCase())) {
      await db.runAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  } catch {
    // Column already exists or table not ready, safely ignore
  }
}

const DEFAULT_CATEGORIES: {
  name: string;
  type: TransactionType;
  icon: string;
  color: string;
}[] = [
  // Expense (18 — symmetrical 6x3 grid)
  { name: 'Food & Dining', type: 'expense', icon: 'Utensils', color: '#CC785C' },
  { name: 'Coffee & Snacks', type: 'expense', icon: 'Coffee', color: '#D97706' },
  { name: 'Transport', type: 'expense', icon: 'Car', color: '#0284C7' },
  { name: 'Vehicle & Fuel', type: 'expense', icon: 'Fuel', color: '#EF4444' },
  { name: 'Shopping', type: 'expense', icon: 'ShoppingCart', color: '#EC4899' },
  { name: 'Housing & KPR', type: 'expense', icon: 'mci:home-percent-outline', color: '#0EA5E9' },
  { name: 'Bills & Utilities', type: 'expense', icon: 'Zap', color: '#C64545' },
  { name: 'Subscriptions', type: 'expense', icon: 'Film', color: '#6366F1' },
  { name: 'Health & Medical', type: 'expense', icon: 'HeartPulse', color: '#06B6D4' },
  { name: 'Fitness & Gym', type: 'expense', icon: 'Dumbbell', color: '#F97316' },
  { name: 'Personal', type: 'expense', icon: 'mci:account-heart-outline', color: '#A855F7' },
  { name: 'Family', type: 'expense', icon: 'mci:human-male-female-child', color: '#E11D48' },
  { name: 'Charity & Gifts', type: 'expense', icon: 'mci:hand-heart-outline', color: '#14B8A6' },
  { name: 'Entertainment', type: 'expense', icon: 'Gamepad2', color: '#8B5CF6' },
  { name: 'Travel', type: 'expense', icon: 'Plane', color: '#F59E0B' },
  { name: 'Education', type: 'expense', icon: 'GraduationCap', color: '#3B82F6' },
  { name: 'Insurance & Tax', type: 'expense', icon: 'mci:scale-balance', color: '#10B981' },
  { name: 'Others', type: 'expense', icon: 'CircleEllipsis', color: '#78716C' },

  // Income (8)
  { name: 'Salary', type: 'income', icon: 'DollarSign', color: '#059669' },
  { name: 'Freelance / Business', type: 'income', icon: 'Briefcase', color: '#0EA5E9' },
  { name: 'Bonus', type: 'income', icon: 'Award', color: '#F59E0B' },
  { name: 'Investments', type: 'income', icon: 'TrendingUp', color: '#0284C7' },
  { name: 'Interest', type: 'income', icon: 'Percent', color: '#14B8A6' },
  { name: 'Allowance', type: 'income', icon: 'HandCoins', color: '#10B981' },
  { name: 'Gift', type: 'income', icon: 'Gift', color: '#EC4899' },
  { name: 'Others', type: 'income', icon: 'CircleEllipsis', color: '#059669' },
];

const LEGACY_EXPENSE_CATEGORY_MAP: Record<string, string> = {
  'food & beverages': 'Food & Dining',
  snacks: 'Coffee & Snacks',
  snack: 'Coffee & Snacks',
  'housing / rent': 'Housing & KPR',
  'home services': 'Housing & KPR',
  furnishings: 'Housing & KPR',
  furnisings: 'Housing & KPR',
  fuel: 'Vehicle & Fuel',
  parking: 'Vehicle & Fuel',
  'vehicle services': 'Vehicle & Fuel',
  'internet & phone': 'Bills & Utilities',
  bills: 'Bills & Utilities',
  'cloud & storage': 'Subscriptions',
  insurance: 'Insurance & Tax',
  'public services': 'Insurance & Tax',
  social: 'Entertainment',
};

// Remove legacy system 'Transfer' tag from selectable categories; internal transfers
// use executeTransferFunds() directly and are excluded from transaction categories.
async function removeSystemTransferCategory(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.runAsync(
    "DELETE FROM categories WHERE id = 'cat_t_transfer' OR (is_default = 1 AND LOWER(TRIM(name)) = 'transfer')"
  );
}

export function isReservedTransferCategory(name?: string): boolean {
  return (name || '').trim().toLowerCase() === 'transfer';
}

export function filterSelectableCategories(
  categories: Category[],
  type: TransactionType
): Category[] {
  return categories.filter((c) => c.type === type && !isReservedTransferCategory(c.name));
}

async function migrateCategoryIcons(db: SQLite.SQLiteDatabase): Promise<void> {
  try {
    await db.runAsync(
      `UPDATE categories
       SET icon = 'ShoppingCart'
       WHERE LOWER(TRIM(name)) = 'shopping' AND (icon = 'ShoppingBag' OR icon = 'Gift' OR icon = 'HelpCircle')`
    );
    await db.runAsync(
      `UPDATE categories
       SET icon = 'mci:account-heart-outline'
       WHERE LOWER(TRIM(name)) = 'personal' AND is_default = 1 AND icon = 'User'`
    );
    await db.runAsync(
      `UPDATE categories
       SET icon = 'mci:home-percent-outline'
       WHERE LOWER(TRIM(name)) = 'housing & kpr' AND is_default = 1 AND (icon = 'Home' OR icon = 'HelpCircle')`
    );
    // Repair legacy debt repayments saved under non-existent "Bills" category -> "Bills & Utilities"
    await db.runAsync(
      "UPDATE transactions SET category = 'Bills & Utilities' WHERE lent_parent_tx_id IS NOT NULL AND type = 'expense' AND LOWER(TRIM(category)) = 'bills'"
    );
  } catch {
    // Non-critical migration failure caught safely
  }
}

const NEW_V2_DEFAULT_CATEGORY_KEYS = new Set<string>([
  'expense:transport',
  'expense:family',
  'expense:charity & gifts',
  'income:freelance / business',
]);

/**
 * One-time migration from legacy v1 default categories (22 expense + 7 income)
 * to the streamlined v2 taxonomy (18 expense + 8 income).
 * Preserves all transactions, receipt items, category budgets, user-created custom categories,
 * and respects any v1 defaults the user intentionally deleted.
 */
async function migrateCategoriesV2(db: SQLite.SQLiteDatabase): Promise<void> {
  try {
    const doneRow = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_settings WHERE key = 'categories_v2_migrated'"
    );
    if (doneRow && doneRow.value === '1') return;

    const defaultByKey = new Map<string, (typeof DEFAULT_CATEGORIES)[number]>();
    for (const def of DEFAULT_CATEGORIES) {
      defaultByKey.set(`${def.type}:${def.name.toLowerCase()}`, def);
    }

    const skippedCustomLower = new Set<string>();
    const keysToEnsure = new Set<string>(NEW_V2_DEFAULT_CATEGORY_KEYS);

    // 1. Remap legacy expense category names across transactions, transaction_items, and default categories
    for (const [oldLower, newName] of Object.entries(LEGACY_EXPENSE_CATEGORY_MAP)) {
      // Never strip transactions/budgets from a user-created custom category matching a legacy name
      const customExists = await db.getFirstAsync<{ id: string }>(
        "SELECT id FROM categories WHERE is_default = 0 AND LOWER(TRIM(type)) = 'expense' AND LOWER(TRIM(name)) = ?",
        oldLower
      );
      if (customExists) {
        skippedCustomLower.add(oldLower);
        continue;
      }

      const legacyTxRow = await db.getFirstAsync<{ cnt: number }>(
        "SELECT COUNT(*) AS cnt FROM transactions WHERE type = 'expense' AND LOWER(TRIM(category)) = ?",
        oldLower
      );
      const legacyDefaultRow = await db.getFirstAsync<{ id: string }>(
        "SELECT id FROM categories WHERE is_default = 1 AND LOWER(TRIM(type)) = 'expense' AND LOWER(TRIM(name)) = ?",
        oldLower
      );

      await db.runAsync(
        "UPDATE transactions SET category = ? WHERE type = 'expense' AND LOWER(TRIM(category)) = ?",
        newName,
        oldLower
      );
      await db.runAsync(
        'UPDATE transaction_items SET category = ? WHERE LOWER(TRIM(category)) = ?',
        newName,
        oldLower
      );

      const targetExists = await db.getFirstAsync<{ id: string }>(
        "SELECT id FROM categories WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND LOWER(TRIM(type)) = 'expense'",
        newName
      );
      const def = defaultByKey.get(`expense:${newName.toLowerCase()}`);

      if (targetExists) {
        // Remove merged legacy default row (never delete user-created custom categories)
        await db.runAsync(
          "DELETE FROM categories WHERE is_default = 1 AND LOWER(TRIM(type)) = 'expense' AND LOWER(TRIM(name)) = ?",
          oldLower
        );
      } else if (legacyDefaultRow) {
        // Rename the first matching legacy default row in-place so IDs stay tidy
        await db.runAsync(
          'UPDATE categories SET name = ?, icon = ?, color = ? WHERE id = ?',
          newName,
          def?.icon || 'CircleEllipsis',
          def?.color || '#CC785C',
          legacyDefaultRow.id
        );
      } else if ((Number(legacyTxRow?.cnt) || 0) > 0) {
        // Legacy transactions existed even though the old default row was absent: ensure target exists
        keysToEnsure.add(`expense:${newName.toLowerCase()}`);
      }
    }

    // 2. Insert only newly introduced v2 categories (or targets that received remapped transactions)
    //    so previously deleted v1 defaults (e.g. Education, Travel) are never resurrected.
    for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
      const cat = DEFAULT_CATEGORIES[i];
      const catKey = `${cat.type}:${cat.name.toLowerCase()}`;
      if (!keysToEnsure.has(catKey)) continue;

      const existing = await db.getFirstAsync<{ id: string }>(
        'SELECT id FROM categories WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND LOWER(TRIM(type)) = LOWER(TRIM(?))',
        cat.name,
        cat.type
      );
      if (!existing) {
        const slug = cat.name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 16);
        const catId = `cat_${cat.type[0]}_${slug}_${Date.now().toString(36)}_${i}`;
        await db.runAsync(
          `INSERT OR IGNORE INTO categories (id, name, type, icon, color, is_default)
           VALUES (?, ?, ?, ?, ?, 1)`,
          catId,
          cat.name,
          cat.type,
          cat.icon,
          cat.color
        );
      }
    }

    // 3. Remap and merge any stored category_budgets_* JSON maps in app_settings
    const budgetSettingRows = await db.getAllAsync<{ key: string; value: string }>(
      "SELECT key, value FROM app_settings WHERE key LIKE 'category_budgets_%'"
    );
    for (const row of budgetSettingRows) {
      try {
        const parsed = JSON.parse(row.value) as Record<string, number>;
        if (!parsed || typeof parsed !== 'object') continue;
        const nextMap: Record<string, number> = {};
        let changed = false;
        for (const [catName, rawLimit] of Object.entries(parsed)) {
          const limit = Number(rawLimit) || 0;
          if (limit <= 0) continue;
          const lowerName = catName.trim().toLowerCase();
          const mapped = skippedCustomLower.has(lowerName)
            ? undefined
            : LEGACY_EXPENSE_CATEGORY_MAP[lowerName];
          const finalKey = mapped || catName;
          if (mapped && mapped !== catName) changed = true;
          nextMap[finalKey] = (nextMap[finalKey] || 0) + limit;
        }
        if (changed) {
          await db.runAsync(
            'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
            row.key,
            JSON.stringify(nextMap)
          );
        }
      } catch {
        // Ignore malformed budget JSON
      }
    }

    await db.runAsync(
      "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('categories_v2_migrated', '1')"
    );
  } catch {
    // Non-critical migration failure caught safely
  }
}

function roundForCurrency(amount: number, currency: CurrencyType | string = 'IDR'): number {
  if (!Number.isFinite(amount)) return 0;
  return currency === 'USD' ? Math.round(amount * 100) / 100 : Math.round(amount);
}

interface BalanceDeltaLeg {
  walletId: string;
  pocketId: string;
  delta: number;
}

/**
 * Atomically applies one or more wallet/pocket balance deltas while validating
 * invariants against the FINAL post-batch balances (preventing false rejections
 * during multi-leg edits, transfers, or cascade loan deletions) and rounding
 * stored balances cleanly to currency precision.
 */
async function applyBalanceDeltasBatch(
  db: SQLite.SQLiteDatabase,
  legs: BalanceDeltaLeg[],
  options?: { disallowNegativeWalletIds?: string[] }
): Promise<void> {
  const walletTotals = new Map<string, number>();
  const pocketTotals = new Map<string, { walletId: string; pocketId: string; delta: number }>();
  const walletPocketDeltaSum = new Map<string, number>();

  for (const leg of legs) {
    if (!leg.delta || Math.abs(leg.delta) < 1e-9) continue;
    walletTotals.set(leg.walletId, (walletTotals.get(leg.walletId) || 0) + leg.delta);
    if (leg.pocketId) {
      const key = `${leg.walletId}::${leg.pocketId}`;
      const existing = pocketTotals.get(key);
      if (existing) {
        existing.delta += leg.delta;
      } else {
        pocketTotals.set(key, {
          walletId: leg.walletId,
          pocketId: leg.pocketId,
          delta: leg.delta,
        });
      }
      walletPocketDeltaSum.set(
        leg.walletId,
        (walletPocketDeltaSum.get(leg.walletId) || 0) + leg.delta
      );
    }
  }

  const touchedWalletIds = new Set<string>(walletTotals.keys());
  for (const entry of pocketTotals.values()) {
    touchedWalletIds.add(entry.walletId);
  }
  if (options?.disallowNegativeWalletIds) {
    for (const id of options.disallowNegativeWalletIds) {
      if (id) touchedWalletIds.add(id);
    }
  }
  if (touchedWalletIds.size === 0) return;

  // 1. Load & validate all touched wallets
  const walletMap = new Map<
    string,
    { id: string; name: string; balance: number; currency: CurrencyType }
  >();
  for (const walletId of touchedWalletIds) {
    const wallet = await db.getFirstAsync<{
      id: string;
      name: string;
      balance: number;
      currency: CurrencyType;
    }>(
      'SELECT id, name, balance, currency FROM wallets WHERE id = ? AND COALESCE(is_deleted, 0) = 0',
      walletId
    );
    if (!wallet) {
      throw new Error('Selected account no longer exists.');
    }
    walletMap.set(walletId, wallet);
  }

  // 2. Validate & compute final balances for all touched pockets
  const pocketUpdates: { id: string; nextBalance: number }[] = [];
  for (const entry of pocketTotals.values()) {
    const wallet = walletMap.get(entry.walletId)!;
    const pocket = await db.getFirstAsync<{ id: string; name: string; balance: number }>(
      'SELECT id, name, balance FROM pockets WHERE id = ? AND wallet_id = ?',
      entry.pocketId,
      entry.walletId
    );
    if (!pocket) {
      throw new Error('The selected pocket no longer exists.');
    }
    if (entry.delta < -1e-9 && pocket.balance + entry.delta < -0.005) {
      throw new InsufficientFundsError(
        'pocket',
        Math.max(0, roundForCurrency(pocket.balance, wallet.currency)),
        `This pocket ("${pocket.name}") does not have enough funds for this change.`
      );
    }
    if (Math.abs(entry.delta) > 1e-9) {
      const nextPocketBalance = Math.max(
        0,
        roundForCurrency(pocket.balance + entry.delta, wallet.currency)
      );
      pocketUpdates.push({ id: pocket.id, nextBalance: nextPocketBalance });
    }
  }

  // 3. Validate final unallocated Main Balance reserves & optional non-negative wallet constraints
  const disallowNegativeSet = new Set(options?.disallowNegativeWalletIds || []);
  const walletUpdates: { id: string; nextBalance: number }[] = [];

  for (const [walletId, wallet] of walletMap.entries()) {
    const netWalletDelta = walletTotals.get(walletId) || 0;
    const netPocketDelta = walletPocketDeltaSum.get(walletId) || 0;
    const netMainDelta = netWalletDelta - netPocketDelta;

    const allocatedRow = await db.getFirstAsync<{ total: number }>(
      'SELECT COALESCE(SUM(balance), 0) AS total FROM pockets WHERE wallet_id = ?',
      walletId
    );
    const currentAllocated = Number(allocatedRow?.total) || 0;
    const nextAllocated = currentAllocated + netPocketDelta;
    const nextWalletBalance = roundForCurrency(wallet.balance + netWalletDelta, wallet.currency);

    if (netMainDelta < -1e-9 && nextAllocated > 0.005 && nextWalletBalance < nextAllocated - 0.005) {
      const availableMain = Math.max(
        0,
        roundForCurrency(wallet.balance - currentAllocated, wallet.currency)
      );
      throw new InsufficientFundsError(
        'account',
        availableMain,
        'Insufficient unallocated Main Balance. Funds allocated inside pockets cannot be spent from Main Balance.'
      );
    }

    if (
      disallowNegativeSet.has(walletId) &&
      netWalletDelta < -1e-9 &&
      wallet.balance + netWalletDelta < -0.005
    ) {
      throw new InsufficientFundsError(
        'account',
        Math.max(0, roundForCurrency(wallet.balance, wallet.currency)),
        `Insufficient balance in ${wallet.name}.`
      );
    }

    if (Math.abs(netWalletDelta) > 1e-9) {
      walletUpdates.push({ id: walletId, nextBalance: nextWalletBalance });
    }
  }

  // 4. Commit all rounded balance mutations
  for (const upd of pocketUpdates) {
    await db.runAsync('UPDATE pockets SET balance = ? WHERE id = ?', upd.nextBalance, upd.id);
  }
  for (const upd of walletUpdates) {
    await db.runAsync('UPDATE wallets SET balance = ? WHERE id = ?', upd.nextBalance, upd.id);
  }
}

/**
 * Atomically adjusts wallet and optional pocket balance while preserving two core invariants:
 * 1. Pocket balances can never drop below zero.
 * 2. When a wallet has funds allocated into pockets, spending from Main Balance (`pocketId === ''`)
 *    cannot dip into allocated pocket reserves (`wallet.balance - allocatedSum`).
 */
async function applyTransactionBalanceDelta(
  db: SQLite.SQLiteDatabase,
  walletId: string,
  pocketId: string,
  delta: number
): Promise<void> {
  await applyBalanceDeltasBatch(db, [{ walletId, pocketId, delta }]);
}

// Seeds the factory category list. Runs once per install so a deleted default
// category stays deleted; pass force to restore factory state after a wipe.
export async function seedDefaultCategories(
  db: SQLite.SQLiteDatabase,
  force = false
): Promise<void> {
  if (!force) {
    const seededRow = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_settings WHERE key = 'defaults_seeded_v1'"
    );
    if (seededRow && seededRow.value === '1') return;
  }

  for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
    const cat = DEFAULT_CATEGORIES[i];
    const existing = await db.getFirstAsync<{ id: string; type: string }>(
      'SELECT id, type FROM categories WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND (LOWER(TRIM(type)) = LOWER(TRIM(?)) OR type IS NULL OR type = "")',
      cat.name,
      cat.type
    );
    if (existing) {
      if (!existing.type || existing.type.toLowerCase() !== cat.type.toLowerCase()) {
        await db.runAsync('UPDATE categories SET type = ? WHERE id = ?', cat.type, existing.id);
      }
      if (cat.name === 'Others') {
        await db.runAsync(
          'UPDATE categories SET icon = ?, color = ? WHERE id = ?',
          cat.icon,
          cat.color,
          existing.id
        );
      }
    } else {
      const slug = cat.name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 16);
      const catId = `cat_${cat.type[0]}_${slug}_${Date.now().toString(36)}_${i}`;
      await db.runAsync(
        `INSERT OR IGNORE INTO categories (id, name, type, icon, color, is_default)
         VALUES (?, ?, ?, ?, ?, 1)`,
        catId,
        cat.name,
        cat.type,
        cat.icon,
        cat.color
      );
    }
  }

  await db.runAsync(
    "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('defaults_seeded_v1', '1')"
  );
  await db.runAsync(
    "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('categories_v2_migrated', '1')"
  );
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  if (dbInitPromise) return dbInitPromise;

  dbInitPromise = (async () => {
    try {
      const db = await SQLite.openDatabaseAsync('aes_finance.db');

      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS wallets (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'bank',
          balance REAL NOT NULL DEFAULT 0,
          currency TEXT NOT NULL DEFAULT 'IDR',
          color TEXT NOT NULL DEFAULT '#CC785C',
          account_number TEXT DEFAULT '',
          sort_order INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS pockets (
          id TEXT PRIMARY KEY,
          wallet_id TEXT NOT NULL,
          name TEXT NOT NULL,
          balance REAL NOT NULL DEFAULT 0,
          target_amount REAL NOT NULL DEFAULT 0,
          icon TEXT NOT NULL DEFAULT 'Briefcase',
          color TEXT NOT NULL DEFAULT '#CC785C',
          FOREIGN KEY (wallet_id) REFERENCES wallets (id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'expense',
          icon TEXT NOT NULL DEFAULT 'HelpCircle',
          color TEXT NOT NULL DEFAULT '#CC785C',
          is_default INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS transactions (
          id TEXT PRIMARY KEY,
          wallet_id TEXT NOT NULL,
          pocket_id TEXT DEFAULT '',
          merchant_name TEXT NOT NULL,
          category TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'expense',
          amount REAL NOT NULL DEFAULT 0,
          currency TEXT NOT NULL DEFAULT 'IDR',
          tax_amount REAL DEFAULT 0,
          discount_amount REAL DEFAULT 0,
          timestamp TEXT NOT NULL,
          payment_method TEXT NOT NULL DEFAULT 'QRIS',
          notes TEXT,
          image_uri TEXT,
          transfer_pair_id TEXT DEFAULT NULL,
          exchange_rate REAL DEFAULT 0,
          FOREIGN KEY (wallet_id) REFERENCES wallets (id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS transaction_items (
          id TEXT PRIMARY KEY,
          transaction_id TEXT NOT NULL,
          name TEXT NOT NULL,
          quantity REAL NOT NULL DEFAULT 1,
          unit_price REAL NOT NULL DEFAULT 0,
          total_price REAL NOT NULL DEFAULT 0,
          category TEXT,
          FOREIGN KEY (transaction_id) REFERENCES transactions (id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);

      // Migrate legacy tables missing newer columns safely
      await ensureColumn(db, 'wallets', 'type', "TEXT NOT NULL DEFAULT 'bank'");
      await ensureColumn(db, 'wallets', 'balance', 'REAL NOT NULL DEFAULT 0');
      await ensureColumn(db, 'wallets', 'currency', "TEXT NOT NULL DEFAULT 'IDR'");
      await ensureColumn(db, 'wallets', 'color', "TEXT NOT NULL DEFAULT '#CC785C'");
      await ensureColumn(db, 'wallets', 'account_number', "TEXT DEFAULT ''");
      await ensureColumn(db, 'wallets', 'sort_order', 'INTEGER DEFAULT 0');
      await ensureColumn(db, 'wallets', 'is_deleted', 'INTEGER DEFAULT 0');

      await ensureColumn(db, 'categories', 'type', "TEXT NOT NULL DEFAULT 'expense'");
      await ensureColumn(db, 'categories', 'icon', "TEXT NOT NULL DEFAULT 'HelpCircle'");
      await ensureColumn(db, 'categories', 'color', "TEXT NOT NULL DEFAULT '#CC785C'");
      await ensureColumn(db, 'categories', 'is_default', 'INTEGER DEFAULT 0');

      await ensureColumn(db, 'transactions', 'currency', "TEXT NOT NULL DEFAULT 'IDR'");
      await ensureColumn(db, 'transactions', 'pocket_id', "TEXT DEFAULT ''");
      await ensureColumn(db, 'transactions', 'tax_amount', 'REAL DEFAULT 0');
      await ensureColumn(db, 'transactions', 'discount_amount', 'REAL DEFAULT 0');
      await ensureColumn(db, 'transactions', 'payment_method', "TEXT NOT NULL DEFAULT 'QRIS'");
      await ensureColumn(db, 'transactions', 'notes', "TEXT DEFAULT ''");
      await ensureColumn(db, 'transactions', 'image_uri', "TEXT DEFAULT ''");
      await ensureColumn(db, 'transactions', 'transfer_pair_id', 'TEXT DEFAULT NULL');
      await ensureColumn(db, 'transactions', 'exchange_rate', 'REAL DEFAULT 0');
      await ensureColumn(db, 'transactions', 'is_lent', 'INTEGER DEFAULT 0');
      await ensureColumn(db, 'transactions', 'lent_to', "TEXT DEFAULT ''");
      await ensureColumn(db, 'transactions', 'lent_repaid_amount', 'REAL DEFAULT 0');
      await ensureColumn(db, 'transactions', 'lent_status', "TEXT DEFAULT 'unsettled'");
      await ensureColumn(db, 'transactions', 'lent_parent_tx_id', 'TEXT DEFAULT NULL');
      await ensureColumn(db, 'transactions', 'deleted_wallet_name', "TEXT DEFAULT ''");
      await ensureColumn(db, 'transactions', 'deleted_pocket_name', "TEXT DEFAULT ''");

      await ensureColumn(db, 'pockets', 'target_amount', 'REAL NOT NULL DEFAULT 0');
      await ensureColumn(db, 'pockets', 'icon', "TEXT NOT NULL DEFAULT 'Briefcase'");
      await ensureColumn(db, 'pockets', 'color', "TEXT NOT NULL DEFAULT '#CC785C'");

      // Performance indexes (created after migrations so legacy tables already have every column)
      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_tx_wallet ON transactions (wallet_id);
        CREATE INDEX IF NOT EXISTS idx_tx_timestamp ON transactions (timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_tx_currency ON transactions (currency);
        CREATE INDEX IF NOT EXISTS idx_tx_pocket ON transactions (pocket_id);
        CREATE INDEX IF NOT EXISTS idx_tx_pair ON transactions (transfer_pair_id);
        CREATE INDEX IF NOT EXISTS idx_tx_lent_parent ON transactions (lent_parent_tx_id);
        CREATE INDEX IF NOT EXISTS idx_items_tx ON transaction_items (transaction_id);
        CREATE INDEX IF NOT EXISTS idx_pockets_wallet ON pockets (wallet_id);
      `);

      // Seed factory categories exactly once so a deleted default stays deleted
      await seedDefaultCategories(db);

      await removeSystemTransferCategory(db);
      await migrateCategoriesV2(db);
      await migrateCategoryIcons(db);

      // Auto-repair any wallets with null, empty, or whitespace-only names
      await db.runAsync(`
        UPDATE wallets 
        SET name = CASE 
          WHEN LOWER(TRIM(COALESCE(type, ''))) = 'cash' THEN 'Cash Wallet'
          WHEN LOWER(TRIM(COALESCE(type, ''))) = 'bank' THEN 'Bank Account'
          WHEN LOWER(TRIM(COALESCE(type, ''))) IN ('e-wallet', 'ewallet') THEN 'E-Wallet'
          WHEN LOWER(TRIM(COALESCE(type, ''))) = 'credit card' THEN 'Credit Card'
          WHEN LOWER(TRIM(COALESCE(type, ''))) = 'investment' THEN 'Investment Account'
          WHEN LOWER(TRIM(COALESCE(type, ''))) IN ('e-money', 'emoney') THEN 'E-Money'
          ELSE 'Main Account'
        END
        WHERE name IS NULL OR TRIM(name) = ''
      `);
      await db.runAsync(`UPDATE wallets SET name = TRIM(name) WHERE name != TRIM(name)`);

      // Ensure at least one wallet exists for fresh installation
      const walletCount = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM wallets WHERE COALESCE(is_deleted, 0) = 0'
      );
      if (!walletCount || walletCount.count === 0) {
        await db.runAsync(
          `INSERT OR IGNORE INTO wallets (id, name, type, balance, currency, color, account_number)
           VALUES ('w_primary_default', 'Cash Wallet', 'Cash', 0, 'IDR', '#CC785C', '')`
        );
      }

      // Normalize any legacy transfer titles from "Transfer to X" to "From to To" (e.g. "BCA to GoPay")
      const legacyTransfers = await db.getAllAsync<{ id: string; wallet_id: string; merchant_name: string }>(
        "SELECT id, wallet_id, merchant_name FROM transactions WHERE category = 'Transfer' AND (merchant_name LIKE 'Transfer to %' OR merchant_name LIKE 'Transfer from %')"
      );
      if (legacyTransfers.length > 0) {
        const wRows = await db.getAllAsync<{ id: string; name: string }>('SELECT id, name FROM wallets');
        const wMap = new Map(wRows.map((w) => [w.id, w.name]));
        for (const lt of legacyTransfers) {
          if (lt.merchant_name.toLowerCase().startsWith('transfer to ')) {
            const fromName = wMap.get(lt.wallet_id) || 'Account';
            const toName = lt.merchant_name.replace(/^Transfer to\s+/i, '').trim();
            await db.runAsync(
              'UPDATE transactions SET merchant_name = ? WHERE id = ?',
              `${fromName} to ${toName}`,
              lt.id
            );
          } else if (lt.merchant_name.toLowerCase().startsWith('transfer from ')) {
            const toName = wMap.get(lt.wallet_id) || 'Account';
            const fromName = lt.merchant_name.replace(/^Transfer from\s+/i, '').trim();
            await db.runAsync(
              'UPDATE transactions SET merchant_name = ? WHERE id = ?',
              `${fromName} to ${toName}`,
              lt.id
            );
          }
        }
      }

      // Pair historical transfer legs that predate transfer_pair_id so deleting one leg
      // can never fall back to guessing (and deleting) an unrelated transfer.
      const unpaired = await db.getAllAsync<{
        id: string;
        merchant_name: string;
        type: TransactionType;
        amount: number;
        timestamp: string;
      }>(
        "SELECT id, merchant_name, type, amount, timestamp FROM transactions WHERE category = 'Transfer' AND transfer_pair_id IS NULL ORDER BY timestamp ASC"
      );

      if (unpaired.length > 1) {
        const consumed = new Set<string>();
        for (const out of unpaired) {
          if (consumed.has(out.id) || out.type !== 'expense') continue;
          const outTime = new Date(out.timestamp).getTime();
          const match = unpaired.find(
            (cand) =>
              !consumed.has(cand.id) &&
              cand.id !== out.id &&
              cand.type === 'income' &&
              cand.merchant_name === out.merchant_name &&
              Math.abs(cand.amount - out.amount) < 0.01 &&
              Math.abs(new Date(cand.timestamp).getTime() - outTime) <= 120000
          );
          if (match) {
            consumed.add(out.id);
            consumed.add(match.id);
            await db.runAsync('UPDATE transactions SET transfer_pair_id = ? WHERE id = ?', match.id, out.id);
            await db.runAsync('UPDATE transactions SET transfer_pair_id = ? WHERE id = ?', out.id, match.id);
          }
        }
      }

      // Clean up legacy transfer notes that had "Converted to/from ..." or "Rate: ..." or default "Transfer to/from ..." stuffed into notes
      const legacyNoteTransfers = await db.getAllAsync<{
        id: string;
        notes: string;
        exchange_rate: number;
      }>(
        "SELECT id, notes, COALESCE(exchange_rate, 0) as exchange_rate FROM transactions WHERE category = 'Transfer' AND notes IS NOT NULL AND notes != ''"
      );
      for (const row of legacyNoteTransfers) {
        let extractedRate = row.exchange_rate || 0;
        const rateMatch = row.notes.match(/Rate:\s*1\s*USD\s*=\s*Rp\s*([\d.,]+)/i);
        if (!extractedRate && rateMatch && rateMatch[1]) {
          const digits = Number(rateMatch[1].replace(/\./g, '').replace(',', '.'));
          if (isFinite(digits) && digits > 0) extractedRate = digits;
        }
        const cleanedParts = row.notes
          .split(/\s*•\s*/)
          .map((part) => part.trim())
          .filter(
            (part) =>
              part.length > 0 &&
              !/^Converted\s+(to|from)\s+(USD|IDR)$/i.test(part) &&
              !/^Rate:\s*1\s*USD\s*=/i.test(part) &&
              !/^Transfer\s+(to|from)\s+/i.test(part)
          );
        const cleanedNote = cleanedParts.join(' • ');
        if (cleanedNote !== row.notes || extractedRate !== (row.exchange_rate || 0)) {
          await db.runAsync(
            'UPDATE transactions SET notes = ?, exchange_rate = ? WHERE id = ?',
            cleanedNote,
            extractedRate,
            row.id
          );
        }
      }

      dbInstance = db;
      return db;
    } catch (err) {
      dbInitPromise = null;
      throw err;
    }
  })();

  return dbInitPromise;
}

// Categories Management
export async function getCategories(type?: TransactionType): Promise<Category[]> {
  const db = await getDatabase();
  let query = 'SELECT * FROM categories';
  let params: any[] = [];
  if (type) {
    query += ' WHERE type = ?';
    params.push(type);
  }
  query += ' ORDER BY is_default DESC, name ASC';

  const rows = await db.getAllAsync<any>(query, params);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type as TransactionType,
    icon: r.icon,
    color: r.color,
    isDefault: Boolean(r.is_default),
  }));
}

export async function createCategory(cat: Omit<Category, 'id' | 'isDefault'>): Promise<string> {
  if (isReservedTransferCategory(cat.name)) {
    throw new Error(
      '"Transfer" is reserved for internal account transfers. Please use the Transfer quick action instead.'
    );
  }
  const db = await getDatabase();
  const existing = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM categories WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND LOWER(TRIM(type)) = LOWER(TRIM(?))',
    cat.name,
    cat.type
  );
  if (existing) {
    throw new Error(`A ${cat.type} category named "${cat.name.trim()}" already exists.`);
  }
  const id = `cat_custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  await db.runAsync(
    `INSERT OR IGNORE INTO categories (id, name, type, icon, color, is_default)
     VALUES (?, ?, ?, ?, ?, 0)`,
    id,
    cat.name.trim(),
    cat.type,
    cat.icon || 'HelpCircle',
    cat.color || '#CC785C'
  );
  return id;
}

export async function deleteCategory(id: string): Promise<boolean> {
  const db = await getDatabase();
  const cat = await db.getFirstAsync<{ type: string }>(
    'SELECT type FROM categories WHERE id = ?',
    id
  );
  if (!cat) return false;

  const sameTypeCount = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM categories WHERE type = ?',
    cat.type
  );
  if (sameTypeCount && sameTypeCount.count <= 1) {
    throw new Error(`At least one ${cat.type} category must remain.`);
  }

  await db.runAsync('DELETE FROM categories WHERE id = ?', id);
  return true;
}

// Wallets Management
export async function getWallets(): Promise<Wallet[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM wallets WHERE COALESCE(is_deleted, 0) = 0 ORDER BY sort_order ASC, balance DESC'
  );
  return rows.map((r) => {
    const rawName = typeof r.name === 'string' ? r.name.trim() : '';
    const safeName = rawName || (r.type ? `${r.type} Account` : 'Account');
    return {
      id: r.id,
      name: safeName,
      type: r.type,
      balance: r.balance,
      currency: (r.currency as CurrencyType) || 'IDR',
      color: r.color,
      accountNumber: r.account_number || '',
      sortOrder: r.sort_order ?? 0,
    };
  });
}

export async function createWallet(wallet: Omit<Wallet, 'id'>): Promise<string> {
  const db = await getDatabase();
  const id = 'w_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const safeBal = isNaN(wallet.balance) ? 0 : wallet.balance;

  const maxOrderRow = await db.getFirstAsync<{ max_order: number | null }>(
    'SELECT MAX(sort_order) as max_order FROM wallets'
  );
  const nextOrder = (maxOrderRow?.max_order ?? -1) + 1;

  await db.runAsync(
    `INSERT INTO wallets (id, name, type, balance, currency, color, account_number, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    wallet.name.trim(),
    wallet.type || 'bank',
    safeBal,
    wallet.currency || 'IDR',
    wallet.color || '#CC785C',
    wallet.accountNumber || '',
    wallet.sortOrder ?? nextOrder
  );
  return id;
}

export async function updateWalletsOrder(orderedWalletIds: string[]): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (let index = 0; index < orderedWalletIds.length; index++) {
      await db.runAsync(
        'UPDATE wallets SET sort_order = ? WHERE id = ?',
        index,
        orderedWalletIds[index]
      );
    }
  });
}

export async function updateWalletName(
  id: string,
  newName: string,
  newType?: string,
  newAccountNumber?: string
): Promise<void> {
  const db = await getDatabase();
  const trimmed = newName.trim();
  if (!trimmed) throw new Error('Account name cannot be empty.');
  if (newType !== undefined && newAccountNumber !== undefined) {
    await db.runAsync(
      'UPDATE wallets SET name = ?, type = ?, account_number = ? WHERE id = ?',
      trimmed,
      newType.trim() || 'Bank',
      newAccountNumber.trim(),
      id
    );
  } else if (newType !== undefined) {
    await db.runAsync(
      'UPDATE wallets SET name = ?, type = ? WHERE id = ?',
      trimmed,
      newType.trim() || 'Bank',
      id
    );
  } else if (newAccountNumber !== undefined) {
    await db.runAsync(
      'UPDATE wallets SET name = ?, account_number = ? WHERE id = ?',
      trimmed,
      newAccountNumber.trim(),
      id
    );
  } else {
    await db.runAsync('UPDATE wallets SET name = ? WHERE id = ?', trimmed, id);
  }
}

export async function adjustWalletBalance(id: string, newBalance: number): Promise<void> {
  const db = await getDatabase();
  if (isNaN(newBalance) || newBalance < 0) {
    throw new Error('Balance must be a valid non-negative number.');
  }
  await db.withTransactionAsync(async () => {
    const wallet = await db.getFirstAsync<{ currency: CurrencyType }>(
      'SELECT currency FROM wallets WHERE id = ? AND COALESCE(is_deleted, 0) = 0',
      id
    );
    if (!wallet) throw new Error('Account not found.');

    const allocatedRow = await db.getFirstAsync<{ total: number }>(
      'SELECT COALESCE(SUM(balance), 0) AS total FROM pockets WHERE wallet_id = ?',
      id
    );
    const allocated = Number(allocatedRow?.total) || 0;
    const roundedBalance = roundForCurrency(newBalance, wallet.currency);

    if (allocated > 0.005 && roundedBalance < allocated - 0.005) {
      throw new Error(
        `Balance cannot be lower than allocated pocket funds (${allocated}). Release pocket funds first.`
      );
    }
    await db.runAsync('UPDATE wallets SET balance = ? WHERE id = ?', roundedBalance, id);
  });
}

export async function deleteWallet(id: string): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    const remaining = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM wallets WHERE COALESCE(is_deleted, 0) = 0'
    );
    if (!remaining || remaining.count <= 1) {
      throw new Error(
        'At least one account must remain. Create another account before deleting this one.'
      );
    }

    const wallet = await db.getFirstAsync<{
      id: string;
      name: string;
      balance: number;
    }>(
      'SELECT id, name, balance FROM wallets WHERE id = ? AND COALESCE(is_deleted, 0) = 0',
      id
    );
    if (!wallet) return;

    if (Math.abs(wallet.balance) > 0.005) {
      throw new Error(
        'Cannot delete an account with remaining balance. Please transfer or clear all funds until the balance is 0.'
      );
    }

    const pocketsWithBalance = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM pockets WHERE wallet_id = ? AND ABS(balance) > 0.005',
      id
    );
    if (pocketsWithBalance && pocketsWithBalance.count > 0) {
      throw new Error(
        'Cannot delete an account while its pockets still hold funds. Please release all pocket funds first.'
      );
    }

    const activeLoans = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM transactions WHERE wallet_id = ? AND is_lent = 1 AND COALESCE(lent_status, 'unsettled') != 'settled'",
      id
    );
    if (activeLoans && activeLoans.count > 0) {
      throw new Error(
        'Cannot delete an account with unsettled loans or debts. Please settle them completely first.'
      );
    }

    // 1. Stamp any remaining pocket names onto transactions before deleting pockets
    const walletPockets = await db.getAllAsync<{ id: string; name: string }>(
      'SELECT id, name FROM pockets WHERE wallet_id = ?',
      id
    );
    for (const p of walletPockets) {
      await db.runAsync(
        "UPDATE transactions SET deleted_pocket_name = ?, pocket_id = '' WHERE pocket_id = ? AND (deleted_pocket_name IS NULL OR deleted_pocket_name = '')",
        p.name,
        p.id
      );
    }

    // 2. Stamp the deleted account name onto all historical transactions in this account
    await db.runAsync(
      'UPDATE transactions SET deleted_wallet_name = ? WHERE wallet_id = ?',
      wallet.name,
      id
    );

    // 3. Delete empty pockets in this account and soft-delete the wallet so transactions stay archived
    await db.runAsync('DELETE FROM pockets WHERE wallet_id = ?', id);
    await db.runAsync('UPDATE wallets SET is_deleted = 1, balance = 0 WHERE id = ?', id);
  });
}

// Pockets (Sub-Accounts) Management
export async function getPockets(): Promise<Pocket[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>('SELECT * FROM pockets ORDER BY balance DESC, name ASC');
  return rows.map((r) => ({
    id: r.id,
    walletId: r.wallet_id,
    name: r.name,
    balance: r.balance,
    targetAmount: r.target_amount || 0,
    icon: r.icon || 'Briefcase',
    color: r.color || '#CC785C',
  }));
}

export async function createPocket(pocket: Omit<Pocket, 'id'>): Promise<string> {
  const db = await getDatabase();
  const id = 'p_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  await db.withTransactionAsync(async () => {
    const wallet = await db.getFirstAsync<{ balance: number }>(
      'SELECT balance FROM wallets WHERE id = ?',
      pocket.walletId
    );
    if (!wallet) {
      throw new Error('Main account does not exist. Please select a valid account.');
    }
    const safeBal = isNaN(pocket.balance) ? 0 : pocket.balance;
    const safeTarget = isNaN(pocket.targetAmount) ? 0 : pocket.targetAmount;
    const allocatedRow = await db.getFirstAsync<{ total: number }>(
      'SELECT COALESCE(SUM(balance), 0) as total FROM pockets WHERE wallet_id = ?',
      pocket.walletId
    );
    const currentWalletBal = wallet ? wallet.balance : 0;
    const currentAllocated = allocatedRow ? allocatedRow.total : 0;
    const unallocated = Math.max(currentWalletBal - currentAllocated, 0);

    if (safeBal > unallocated + 0.005) {
      throw new InsufficientFundsError(
        'allocate',
        unallocated,
        'The starting balance exceeds the unallocated funds in this account.'
      );
    }

    await db.runAsync(
      `INSERT INTO pockets (id, wallet_id, name, balance, target_amount, icon, color)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      id,
      pocket.walletId,
      pocket.name.trim(),
      safeBal,
      safeTarget,
      pocket.icon || 'Briefcase',
      pocket.color || '#CC785C'
    );
  });
  return id;
}

export async function adjustPocketBalance(pocketId: string, delta: number): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    const pocket = await db.getFirstAsync<{ wallet_id: string; balance: number }>(
      'SELECT wallet_id, balance FROM pockets WHERE id = ?',
      pocketId
    );
    if (!pocket) throw new Error('Pocket not found.');

    const wallet = await db.getFirstAsync<{ balance: number; currency: CurrencyType }>(
      'SELECT balance, currency FROM wallets WHERE id = ?',
      pocket.wallet_id
    );
    const walletCurrency = wallet?.currency || 'IDR';

    if (delta > 0) {
      const allocatedRow = await db.getFirstAsync<{ total: number }>(
        'SELECT COALESCE(SUM(balance), 0) as total FROM pockets WHERE wallet_id = ?',
        pocket.wallet_id
      );
      const unallocated = Math.max(
        (wallet ? wallet.balance : 0) - (allocatedRow ? allocatedRow.total : 0),
        0
      );
      if (delta > unallocated + 0.005) {
        throw new InsufficientFundsError(
          'allocate',
          roundForCurrency(unallocated, walletCurrency),
          'The amount exceeds the unallocated funds in this account.'
        );
      }
      const nextBalance = roundForCurrency(pocket.balance + delta, walletCurrency);
      await db.runAsync('UPDATE pockets SET balance = ? WHERE id = ?', nextBalance, pocketId);
    } else if (delta < 0) {
      const releaseAmount = Math.abs(delta);
      if (releaseAmount > pocket.balance + 0.005) {
        throw new InsufficientFundsError(
          'release',
          roundForCurrency(pocket.balance, walletCurrency),
          'You cannot release more than the current pocket balance.'
        );
      }
      const nextBalance = Math.max(0, roundForCurrency(pocket.balance - releaseAmount, walletCurrency));
      await db.runAsync('UPDATE pockets SET balance = ? WHERE id = ?', nextBalance, pocketId);
    }
  });
}

/**
 * Direct real-value balance adjustment for a pocket (e.g. investment fluctuations,
 * interest yield, portfolio market value changes).
 *
 * Automatically keeps the unallocated free balance intact by adjusting the
 * parent wallet's total balance by the exact same delta.
 */
export async function setPocketBalanceDirect(
  pocketId: string,
  newBalance: number
): Promise<{ oldBalance: number; newBalance: number; delta: number }> {
  const db = await getDatabase();
  let result = { oldBalance: 0, newBalance: 0, delta: 0 };

  await db.withTransactionAsync(async () => {
    const pocket = await db.getFirstAsync<{ wallet_id: string; balance: number }>(
      'SELECT wallet_id, balance FROM pockets WHERE id = ?',
      pocketId
    );
    if (!pocket) throw new Error('Pocket not found.');

    const wallet = await db.getFirstAsync<{ balance: number; currency: CurrencyType }>(
      'SELECT balance, currency FROM wallets WHERE id = ? AND COALESCE(is_deleted, 0) = 0',
      pocket.wallet_id
    );
    if (!wallet) throw new Error('Parent account not found.');

    const safeNewBalance = roundForCurrency(
      isNaN(newBalance) || newBalance < 0 ? 0 : newBalance,
      wallet.currency
    );
    const oldBalance = Number(pocket.balance) || 0;
    const delta = safeNewBalance - oldBalance;

    if (delta !== 0) {
      const otherPocketsRow = await db.getFirstAsync<{ total: number }>(
        'SELECT COALESCE(SUM(balance), 0) AS total FROM pockets WHERE wallet_id = ? AND id != ?',
        pocket.wallet_id,
        pocketId
      );
      const otherPocketsSum = Number(otherPocketsRow?.total) || 0;
      const nextWalletBalance = roundForCurrency(wallet.balance + delta, wallet.currency);
      if (nextWalletBalance < otherPocketsSum - 0.005) {
        throw new Error(
          'Cannot reduce this pocket because the parent account balance would drop below other allocated pockets.'
        );
      }

      await db.runAsync(
        'UPDATE pockets SET balance = ? WHERE id = ?',
        safeNewBalance,
        pocketId
      );
      await db.runAsync(
        'UPDATE wallets SET balance = ? WHERE id = ?',
        nextWalletBalance,
        pocket.wallet_id
      );
    }

    result = { oldBalance, newBalance: safeNewBalance, delta };
  });

  return result;
}

export async function applyAllocationPlanToWallet(
  walletId: string,
  distributions: { pocketId: string; amount: number }[]
): Promise<void> {
  const validDistributions = distributions.filter((d) => d.amount > 0 && d.pocketId);
  if (validDistributions.length === 0) return;

  const totalToAllocate = validDistributions.reduce((sum, d) => sum + d.amount, 0);

  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    const wallet = await db.getFirstAsync<{ balance: number }>(
      'SELECT balance FROM wallets WHERE id = ?',
      walletId
    );
    if (!wallet) throw new Error('Account not found.');

    const allocatedRow = await db.getFirstAsync<{ total: number }>(
      'SELECT COALESCE(SUM(balance), 0) as total FROM pockets WHERE wallet_id = ?',
      walletId
    );
    const unallocated = Math.max(
      wallet.balance - (allocatedRow ? allocatedRow.total : 0),
      0
    );

    if (totalToAllocate > unallocated + 0.005) {
      throw new InsufficientFundsError(
        'allocate',
        unallocated,
        'The total allocation amount exceeds available unallocated funds.'
      );
    }

    for (const item of validDistributions) {
      await db.runAsync(
        'UPDATE pockets SET balance = balance + ? WHERE id = ? AND wallet_id = ?',
        item.amount,
        item.pocketId,
        walletId
      );
    }
  });
}

export async function updatePocketName(
  id: string,
  newName: string,
  newIcon?: string,
  newTargetAmount?: number
): Promise<void> {
  const db = await getDatabase();
  const trimmed = newName.trim();
  if (!trimmed) throw new Error('Pocket name cannot be empty.');

  const hasIcon = newIcon !== undefined && newIcon.trim().length > 0;
  const hasTarget = newTargetAmount !== undefined;

  if (hasTarget) {
    const pocketRow = await db.getFirstAsync<{ currency: CurrencyType }>(
      `SELECT w.currency
       FROM pockets p
       LEFT JOIN wallets w ON w.id = p.wallet_id
       WHERE p.id = ?`,
      id
    );
    const currency: CurrencyType = pocketRow?.currency === 'USD' ? 'USD' : 'IDR';
    const safeTarget = roundForCurrency(
      isNaN(newTargetAmount) || newTargetAmount < 0 ? 0 : newTargetAmount,
      currency
    );

    if (hasIcon) {
      await db.runAsync(
        'UPDATE pockets SET name = ?, icon = ?, target_amount = ? WHERE id = ?',
        trimmed,
        newIcon!.trim(),
        safeTarget,
        id
      );
    } else {
      await db.runAsync(
        'UPDATE pockets SET name = ?, target_amount = ? WHERE id = ?',
        trimmed,
        safeTarget,
        id
      );
    }
    return;
  }

  if (hasIcon) {
    await db.runAsync(
      'UPDATE pockets SET name = ?, icon = ? WHERE id = ?',
      trimmed,
      newIcon!.trim(),
      id
    );
  } else {
    await db.runAsync('UPDATE pockets SET name = ? WHERE id = ?', trimmed, id);
  }
}

export async function deletePocket(id: string): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    const pocket = await db.getFirstAsync<{
      id: string;
      name: string;
      balance: number;
    }>('SELECT id, name, balance FROM pockets WHERE id = ?', id);
    if (!pocket) return;

    if (Math.abs(pocket.balance) > 0.005) {
      throw new Error(
        'Cannot delete a pocket with remaining balance. Please release or move all funds to the main account first.'
      );
    }

    const activeLoans = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM transactions WHERE pocket_id = ? AND is_lent = 1 AND COALESCE(lent_status, 'unsettled') != 'settled'",
      id
    );
    if (activeLoans && activeLoans.count > 0) {
      throw new Error(
        'Cannot delete a pocket with unsettled loans or debts. Please settle them completely first.'
      );
    }

    await db.runAsync(
      "UPDATE transactions SET deleted_pocket_name = ?, pocket_id = '' WHERE pocket_id = ?",
      pocket.name,
      id
    );
    await db.runAsync('DELETE FROM pockets WHERE id = ?', id);
  });
}

// Transactions Management (line items are fetched on demand via getTransactionItems to keep memory low)
export async function getTransactions(): Promise<Transaction[]> {
  const db = await getDatabase();
  const txRows = await db.getAllAsync<any>(
    'SELECT * FROM transactions ORDER BY timestamp DESC'
  );

  if (txRows.length === 0) return [];

  const walletRows = await db.getAllAsync<{ id: string; name: string }>('SELECT id, name FROM wallets');
  const walletMap = new Map(walletRows.map((w) => [w.id, w.name]));
  const rowById = new Map(txRows.map((r) => [r.id, r]));

  return txRows.map((r) => {
    let merchantName = r.merchant_name;
    if (r.category === 'Transfer') {
      if (merchantName.toLowerCase().startsWith('transfer to ')) {
        const toAcc = merchantName.replace(/^Transfer to\s+/i, '').trim();
        const fromAcc = walletMap.get(r.wallet_id) || 'Account';
        merchantName = `${fromAcc} to ${toAcc}`;
      } else if (merchantName.toLowerCase().startsWith('transfer from ')) {
        const fromAcc = merchantName.replace(/^Transfer from\s+/i, '').trim();
        const toAcc = walletMap.get(r.wallet_id) || 'Account';
        merchantName = `${fromAcc} to ${toAcc}`;
      }
    }

    const pairedRow = r.transfer_pair_id ? rowById.get(r.transfer_pair_id) : undefined;

    return {
      id: r.id,
      walletId: r.wallet_id,
      pocketId: r.pocket_id || '',
      merchantName,
      category: r.category,
      type: r.type as TransactionType,
      amount: r.amount,
      currency: (r.currency as CurrencyType) || 'IDR',
      taxAmount: r.tax_amount,
      discountAmount: r.discount_amount,
      timestamp: r.timestamp,
      paymentMethod: r.payment_method,
      notes: r.notes,
      imageUri: r.image_uri,
      transferPairId: r.transfer_pair_id || undefined,
      exchangeRate: r.exchange_rate ? Number(r.exchange_rate) : undefined,
      isLent: Boolean(r.is_lent),
      lentTo: r.lent_to || '',
      lentRepaidAmount: Number(r.lent_repaid_amount) || 0,
      lentStatus: (r.lent_status || (r.is_lent ? 'unsettled' : 'settled')) as LentStatus,
      lentParentTxId: r.lent_parent_tx_id || undefined,
      deletedWalletName: r.deleted_wallet_name || undefined,
      deletedPocketName: r.deleted_pocket_name || undefined,
      pairedDeletedWalletName: pairedRow?.deleted_wallet_name || undefined,
      pairedPocketId: pairedRow?.pocket_id || undefined,
      pairedDeletedPocketName: pairedRow?.deleted_pocket_name || undefined,
    };
  });
}

export async function getTransactionItems(transactionId: string): Promise<TransactionItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM transaction_items WHERE transaction_id = ?',
    transactionId
  );
  return rows.map((it) => ({
    id: it.id,
    transactionId: it.transaction_id,
    name: it.name,
    quantity: it.quantity,
    unitPrice: it.unit_price,
    totalPrice: it.total_price,
    category: it.category,
  }));
}

export async function insertTransactionWithItems(
  tx: Omit<Transaction, 'id'>,
  items: Omit<TransactionItem, 'id' | 'transactionId'>[] = []
): Promise<string> {
  const db = await getDatabase();
  const txId = 'tx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

  await db.withTransactionAsync(async () => {
    const wallet = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM wallets WHERE id = ?',
      tx.walletId
    );
    if (!wallet) {
      throw new Error('Target account not found. Please select an active account.');
    }

    await db.runAsync(
      `INSERT INTO transactions 
       (id, wallet_id, pocket_id, merchant_name, category, type, amount, currency, tax_amount, discount_amount, timestamp, payment_method, notes, image_uri, is_lent, lent_to, lent_repaid_amount, lent_status, lent_parent_tx_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      txId,
      tx.walletId,
      tx.pocketId || '',
      tx.merchantName,
      tx.category,
      tx.type,
      tx.amount,
      tx.currency || 'IDR',
      tx.taxAmount || 0,
      tx.discountAmount || 0,
      tx.timestamp,
      tx.paymentMethod,
      tx.notes || '',
      tx.imageUri || '',
      tx.isLent ? 1 : 0,
      tx.lentTo || '',
      tx.lentRepaidAmount || 0,
      tx.lentStatus || (tx.isLent ? 'unsettled' : 'settled'),
      tx.lentParentTxId || null
    );

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemId = 'item_' + Date.now() + '_' + i + '_' + Math.random().toString(36).substring(2, 7);
      await db.runAsync(
        `INSERT INTO transaction_items (id, transaction_id, name, quantity, unit_price, total_price, category)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        itemId,
        txId,
        item.name,
        item.quantity,
        item.unitPrice,
        item.totalPrice,
        item.category || tx.category
      );
    }

    // Adjust wallet and optional pocket balance while protecting pocket reserves
    const balanceDelta = tx.type === 'expense' ? -tx.amount : tx.amount;
    await applyTransactionBalanceDelta(db, tx.walletId, tx.pocketId || '', balanceDelta);
  });

  return txId;
}

/**
 * Batch insert multiple transactions extracted from a bank/e-wallet e-Statement
 * inside a single atomic SQLite transaction. Optionally updates the target wallet balance(s).
 */
export async function insertStatementTransactionsBatch(
  txs: Omit<Transaction, 'id'>[],
  options: { updateWalletBalance: boolean } = { updateWalletBalance: true }
): Promise<string[]> {
  if (!txs || txs.length === 0) return [];
  const db = await getDatabase();
  const createdIds: string[] = [];
  const baseNow = Date.now();

  await db.withTransactionAsync(async () => {
    const walletDeltas = new Map<string, number>();

    for (let i = 0; i < txs.length; i++) {
      const tx = txs[i];
      const wallet = await db.getFirstAsync<{ id: string }>(
        'SELECT id FROM wallets WHERE id = ?',
        tx.walletId
      );
      if (!wallet) {
        throw new Error('Target account not found. Please select a valid account.');
      }

      const txId =
        'tx_' + (baseNow + i) + '_' + Math.random().toString(36).substring(2, 7);
      createdIds.push(txId);

      await db.runAsync(
        `INSERT INTO transactions 
         (id, wallet_id, pocket_id, merchant_name, category, type, amount, currency, tax_amount, discount_amount, timestamp, payment_method, notes, image_uri)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        txId,
        tx.walletId,
        tx.pocketId || '',
        tx.merchantName,
        tx.category,
        tx.type,
        tx.amount,
        tx.currency || 'IDR',
        tx.taxAmount || 0,
        tx.discountAmount || 0,
        tx.timestamp,
        tx.paymentMethod || 'Bank Transfer',
        tx.notes || '',
        tx.imageUri || ''
      );

      if (options.updateWalletBalance) {
        const delta = tx.type === 'expense' ? -tx.amount : tx.amount;
        walletDeltas.set(tx.walletId, (walletDeltas.get(tx.walletId) || 0) + delta);
      }
    }

    if (options.updateWalletBalance) {
      for (const [walletId, totalDelta] of walletDeltas.entries()) {
        if (totalDelta !== 0) {
          await applyTransactionBalanceDelta(db, walletId, '', totalDelta);
        }
      }
    }
  });

  return createdIds;
}

export async function deleteTransaction(id: string): Promise<void> {
  const db = await getDatabase();
  const imagesToDelete: string[] = [];
  await db.withTransactionAsync(async () => {
    const tx = await db.getFirstAsync<{
      id: string;
      wallet_id: string;
      pocket_id: string;
      type: TransactionType;
      amount: number;
      category: string;
      payment_method: string;
      merchant_name: string;
      image_uri?: string;
      transfer_pair_id?: string;
      is_lent?: number;
      lent_parent_tx_id?: string;
      deleted_wallet_name?: string;
      deleted_pocket_name?: string;
    }>(
      'SELECT id, wallet_id, pocket_id, type, amount, category, payment_method, merchant_name, image_uri, transfer_pair_id, is_lent, lent_parent_tx_id, deleted_wallet_name, deleted_pocket_name FROM transactions WHERE id = ?',
      id
    );

    if (!tx) return;
    if (tx.deleted_wallet_name || tx.deleted_pocket_name) {
      throw new Error('This archived transaction belongs to a deleted account or pocket and cannot be deleted.');
    }

    // Collect every leg that will be deleted so net balances are validated atomically
    // (prevents false InsufficientFundsError when reverting a Lent loan + its repayments)
    const rowsToDelete: {
      id: string;
      wallet_id: string;
      pocket_id: string;
      type: TransactionType;
      amount: number;
      image_uri?: string;
    }[] = [];
    const seenIds = new Set<string>();
    const addRowToDelete = (row: typeof rowsToDelete[number]) => {
      if (seenIds.has(row.id)) return;
      seenIds.add(row.id);
      rowsToDelete.push(row);
    };

    // If this repayment belongs to an archived loan on a deleted account, keep both immutable
    if (tx.lent_parent_tx_id) {
      const parentLoan = await db.getFirstAsync<{
        deleted_wallet_name?: string;
        deleted_pocket_name?: string;
      }>(
        'SELECT deleted_wallet_name, deleted_pocket_name FROM transactions WHERE id = ?',
        tx.lent_parent_tx_id
      );
      if (parentLoan && (parentLoan.deleted_wallet_name || parentLoan.deleted_pocket_name)) {
        throw new Error('This repayment settles an archived loan on a deleted account and cannot be deleted.');
      }
    }

    // If target transaction is a lent transaction, collect any child repayments linked to it
    if (tx.is_lent) {
      const childRepayments = await db.getAllAsync<{
        id: string;
        wallet_id: string;
        pocket_id: string;
        type: TransactionType;
        amount: number;
        image_uri?: string;
        deleted_wallet_name?: string;
        deleted_pocket_name?: string;
      }>(
        'SELECT id, wallet_id, pocket_id, type, amount, image_uri, deleted_wallet_name, deleted_pocket_name FROM transactions WHERE lent_parent_tx_id = ?',
        tx.id
      );
      const hasArchivedChild = childRepayments.some(
        (c) => Boolean(c.deleted_wallet_name || c.deleted_pocket_name)
      );
      if (hasArchivedChild) {
        throw new Error('This loan has repayments recorded on a deleted account and cannot be deleted.');
      }
      for (const child of childRepayments) {
        addRowToDelete(child);
      }
    }

    // Only an explicit pair id is trusted. Historical legs are paired during DB init,
    // so we never guess (and delete) an unrelated transfer.
    if (tx.transfer_pair_id) {
      const pairedTx = await db.getFirstAsync<typeof tx>(
        'SELECT id, wallet_id, pocket_id, type, amount, category, payment_method, merchant_name, image_uri, transfer_pair_id, is_lent, lent_parent_tx_id, deleted_wallet_name, deleted_pocket_name FROM transactions WHERE id = ?',
        tx.transfer_pair_id
      );
      if (pairedTx && (pairedTx.deleted_wallet_name || pairedTx.deleted_pocket_name)) {
        throw new Error('This transfer involves a deleted account and cannot be deleted.');
      }
      if (pairedTx) {
        addRowToDelete(pairedTx);
      }
    }

    addRowToDelete(tx);

    // Apply all balance reversals together against net post-delete balances
    await applyBalanceDeltasBatch(
      db,
      rowsToDelete.map((targetTx) => ({
        walletId: targetTx.wallet_id,
        pocketId: targetTx.pocket_id || '',
        delta: targetTx.type === 'expense' ? targetTx.amount : -targetTx.amount,
      }))
    );

    for (const targetTx of rowsToDelete) {
      await db.runAsync('DELETE FROM transaction_items WHERE transaction_id = ?', targetTx.id);
      await db.runAsync('DELETE FROM transactions WHERE id = ?', targetTx.id);
      if (targetTx.image_uri) {
        imagesToDelete.push(targetTx.image_uri);
      }
    }

    // If this deleted transaction was a repayment for a lent loan, recalculate parent loan repaid amount & status
    if (tx.lent_parent_tx_id) {
      await syncLentParentLoan(db, tx.lent_parent_tx_id);
    }
  });

  for (const uri of imagesToDelete) {
    await deleteReceiptImageIfLocal(uri);
  }
}

export async function updateTransactionImageUri(
  id: string,
  imageUri: string
): Promise<void> {
  const db = await getDatabase();
  const prev = await db.getFirstAsync<{ image_uri?: string }>(
    'SELECT image_uri FROM transactions WHERE id = ?',
    id
  );
  await db.runAsync('UPDATE transactions SET image_uri = ? WHERE id = ?', imageUri || '', id);
  if (prev?.image_uri && prev.image_uri !== imageUri) {
    await deleteReceiptImageIfLocal(prev.image_uri);
  }
}

export async function deleteTransactionsBatch(ids: string[]): Promise<void> {
  if (!ids || ids.length === 0) return;
  const db = await getDatabase();
  const imagesToDelete: string[] = [];
  await db.withTransactionAsync(async () => {
    const processedIds = new Set<string>();
    const parentsToSync = new Set<string>();

    // Fetch all rows upfront so expenses can revert (+) before incomes (-) on shared pockets
    const candidateRows: {
      id: string;
      wallet_id: string;
      pocket_id: string;
      type: TransactionType;
      amount: number;
      image_uri?: string;
      transfer_pair_id?: string;
      is_lent?: number;
      lent_parent_tx_id?: string;
      deleted_wallet_name?: string;
      deleted_pocket_name?: string;
    }[] = [];

    for (const id of ids) {
      const tx = await db.getFirstAsync<typeof candidateRows[number]>(
        'SELECT id, wallet_id, pocket_id, type, amount, image_uri, transfer_pair_id, is_lent, lent_parent_tx_id, deleted_wallet_name, deleted_pocket_name FROM transactions WHERE id = ?',
        id
      );
      if (tx && !tx.deleted_wallet_name && !tx.deleted_pocket_name) {
        candidateRows.push(tx);
      }
    }

    // Revert expenses first (adding balance back) so deleting matching income + expense in one pocket succeeds
    candidateRows.sort((a, b) => {
      if (a.type === b.type) return 0;
      return a.type === 'expense' ? -1 : 1;
    });

    const rowsToDelete: {
      id: string;
      wallet_id: string;
      pocket_id: string;
      type: TransactionType;
      amount: number;
      image_uri?: string;
    }[] = [];

    const addRowToDelete = (row: typeof rowsToDelete[number]) => {
      if (processedIds.has(row.id)) return;
      processedIds.add(row.id);
      rowsToDelete.push(row);
    };

    for (const tx of candidateRows) {
      if (processedIds.has(tx.id)) continue;

      let pairedTx: typeof tx | null = null;
      if (tx.transfer_pair_id) {
        pairedTx = await db.getFirstAsync<typeof tx>(
          'SELECT id, wallet_id, pocket_id, type, amount, image_uri, transfer_pair_id, is_lent, lent_parent_tx_id, deleted_wallet_name, deleted_pocket_name FROM transactions WHERE id = ?',
          tx.transfer_pair_id
        );
        if (pairedTx && (pairedTx.deleted_wallet_name || pairedTx.deleted_pocket_name)) {
          continue;
        }
      }

      if (tx.lent_parent_tx_id) {
        const parentLoan = await db.getFirstAsync<{
          deleted_wallet_name?: string;
          deleted_pocket_name?: string;
        }>(
          'SELECT deleted_wallet_name, deleted_pocket_name FROM transactions WHERE id = ?',
          tx.lent_parent_tx_id
        );
        if (parentLoan && (parentLoan.deleted_wallet_name || parentLoan.deleted_pocket_name)) {
          continue;
        }
        parentsToSync.add(tx.lent_parent_tx_id);
      }

      if (tx.is_lent) {
        const childRepayments = await db.getAllAsync<{
          id: string;
          wallet_id: string;
          pocket_id: string;
          type: TransactionType;
          amount: number;
          image_uri?: string;
          deleted_wallet_name?: string;
          deleted_pocket_name?: string;
        }>(
          'SELECT id, wallet_id, pocket_id, type, amount, image_uri, deleted_wallet_name, deleted_pocket_name FROM transactions WHERE lent_parent_tx_id = ?',
          tx.id
        );
        if (childRepayments.some((c) => Boolean(c.deleted_wallet_name || c.deleted_pocket_name))) {
          continue;
        }
        for (const child of childRepayments) {
          addRowToDelete(child);
        }
      }

      if (pairedTx) {
        addRowToDelete(pairedTx);
      }
      addRowToDelete(tx);
    }

    // Apply all balance reversals together against net post-delete balances
    await applyBalanceDeltasBatch(
      db,
      rowsToDelete.map((targetTx) => ({
        walletId: targetTx.wallet_id,
        pocketId: targetTx.pocket_id || '',
        delta: targetTx.type === 'expense' ? targetTx.amount : -targetTx.amount,
      }))
    );

    for (const targetTx of rowsToDelete) {
      await db.runAsync('DELETE FROM transaction_items WHERE transaction_id = ?', targetTx.id);
      await db.runAsync('DELETE FROM transactions WHERE id = ?', targetTx.id);
      if (targetTx.image_uri) {
        imagesToDelete.push(targetTx.image_uri);
      }
    }

    // Recalculate parent loans affected by deleted repayments (skip any parent that was also deleted)
    for (const parentId of parentsToSync) {
      if (!processedIds.has(parentId)) {
        await syncLentParentLoan(db, parentId);
      }
    }
  });

  for (const uri of imagesToDelete) {
    await deleteReceiptImageIfLocal(uri);
  }
}

export interface UpdateTransactionParams {
  walletId: string;
  pocketId: string;
  merchantName: string;
  category: string;
  type: TransactionType;
  amount: number;
  currency: CurrencyType;
  taxAmount?: number;
  discountAmount?: number;
  timestamp: string;
  paymentMethod: string;
  notes?: string;
  isLent?: boolean;
  lentTo?: string;
  lentRepaidAmount?: number;
  lentStatus?: LentStatus;
}

/**
 * Atomically recalculates and synchronizes the total repaid amount and lent status
 * of a parent loan transaction directly from the SQL sum of its child repayments.
 */
export async function syncLentParentLoan(db: SQLite.SQLiteDatabase, parentTxId: string): Promise<void> {
  if (!parentTxId) return;
  const parent = await db.getFirstAsync<{
    id: string;
    amount: number;
    currency: CurrencyType;
  }>('SELECT id, amount, currency FROM transactions WHERE id = ?', parentTxId);

  if (!parent) return;

  const expectedRepaymentType: TransactionType = 'expense';
  const parentRow = await db.getFirstAsync<{ type: TransactionType }>(
    'SELECT type FROM transactions WHERE id = ?',
    parentTxId
  );
  const childType = parentRow?.type === 'income' ? expectedRepaymentType : 'income';

  const sumResult = await db.getFirstAsync<{ total: number }>(
    'SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE lent_parent_tx_id = ? AND type = ?',
    parent.id,
    childType
  );

  const curr = parent.currency || 'IDR';
  const totalRepaid = roundForCurrency(Math.max(0, Number(sumResult?.total) || 0), curr);
  const epsilon = curr === 'USD' ? 0.001 : 0;
  const newStatus: LentStatus =
    totalRepaid <= 0
      ? 'unsettled'
      : totalRepaid >= parent.amount - epsilon
      ? 'settled'
      : 'partial';

  await db.runAsync(
    'UPDATE transactions SET lent_repaid_amount = ?, lent_status = ? WHERE id = ?',
    totalRepaid,
    newStatus,
    parent.id
  );
}

export async function updateTransaction(
  id: string,
  updates: UpdateTransactionParams
): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    const oldTx = await db.getFirstAsync<{
      wallet_id: string;
      pocket_id: string;
      type: TransactionType;
      amount: number;
      is_lent?: number;
      lent_repaid_amount?: number;
      lent_status?: string;
      lent_parent_tx_id?: string;
      deleted_wallet_name?: string;
      deleted_pocket_name?: string;
    }>('SELECT wallet_id, pocket_id, type, amount, is_lent, lent_repaid_amount, lent_status, lent_parent_tx_id, deleted_wallet_name, deleted_pocket_name FROM transactions WHERE id = ?', id);

    if (!oldTx) {
      throw new Error('Transaction not found');
    }
    if (oldTx.deleted_wallet_name || oldTx.deleted_pocket_name) {
      throw new Error('This archived transaction belongs to a deleted account or pocket and cannot be modified.');
    }

    const requestedIsLent = updates.isLent ?? Boolean(oldTx.is_lent);
    let finalType = updates.type;
    let finalIsLent = requestedIsLent;

    // Protect parent loan <-> child repayment structural integrity
    if (oldTx.lent_parent_tx_id) {
      const parentLoan = await db.getFirstAsync<{
        id: string;
        type: TransactionType;
        amount: number;
        currency: CurrencyType;
        deleted_wallet_name?: string;
        deleted_pocket_name?: string;
      }>(
        'SELECT id, type, amount, currency, deleted_wallet_name, deleted_pocket_name FROM transactions WHERE id = ?',
        oldTx.lent_parent_tx_id
      );
      if (parentLoan) {
        if (parentLoan.deleted_wallet_name || parentLoan.deleted_pocket_name) {
          throw new Error('This repayment settles an archived loan on a deleted account and cannot be edited.');
        }
        const expectedChildType: TransactionType = parentLoan.type === 'income' ? 'expense' : 'income';
        if (updates.type !== expectedChildType) {
          throw new Error('Cannot flip Expense/Income type on a repayment linked to a loan.');
        }
        finalType = expectedChildType;
        finalIsLent = false;

        const otherSumRow = await db.getFirstAsync<{ total: number }>(
          'SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE lent_parent_tx_id = ? AND id != ? AND type = ?',
          parentLoan.id,
          id,
          expectedChildType
        );
        const otherSum = roundForCurrency(Number(otherSumRow?.total) || 0, parentLoan.currency || 'IDR');
        const newSum = roundForCurrency(otherSum + updates.amount, parentLoan.currency || 'IDR');
        const eps = parentLoan.currency === 'USD' ? 0.001 : 0;
        if (newSum > parentLoan.amount + eps) {
          throw new Error('Total repayments cannot exceed the original loan amount.');
        }
      }
    } else if (oldTx.is_lent) {
      const childSummary = await db.getFirstAsync<{ count: number; total: number }>(
        'SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total FROM transactions WHERE lent_parent_tx_id = ?',
        id
      );
      const childCount = Number(childSummary?.count) || 0;
      const repaidSum = roundForCurrency(Number(childSummary?.total) || 0, updates.currency || 'IDR');
      if (childCount > 0) {
        if (!requestedIsLent) {
          throw new Error('Cannot turn off Lent / Borrowed status while repayments exist. Delete the repayment records first.');
        }
        if (updates.type !== oldTx.type) {
          throw new Error('Cannot change Expense/Income type while repayments are recorded.');
        }
        const eps = updates.currency === 'USD' ? 0.001 : 0;
        if (updates.amount + eps < repaidSum) {
          throw new Error('Loan amount cannot be less than the total already repaid.');
        }
      }
    }

    // 1 & 2. Revert previous leg and apply new leg atomically against net final balances
    const revertDelta = oldTx.type === 'expense' ? oldTx.amount : -oldTx.amount;
    const newDelta = finalType === 'expense' ? -updates.amount : updates.amount;
    await applyBalanceDeltasBatch(db, [
      { walletId: oldTx.wallet_id, pocketId: oldTx.pocket_id || '', delta: revertDelta },
      { walletId: updates.walletId, pocketId: updates.pocketId || '', delta: newDelta },
    ]);

    // 3. Compute lent status & repaid amount
    const oldRepaid = Number(oldTx.lent_repaid_amount) || 0;
    const repaidAmount = updates.lentRepaidAmount !== undefined ? updates.lentRepaidAmount : oldRepaid;
    const isLent = finalIsLent;
    const eps = (updates.currency || 'IDR') === 'USD' ? 0.001 : 0;
    const computedStatus: LentStatus = isLent
      ? (repaidAmount >= updates.amount - eps ? 'settled' : (repaidAmount > 0 ? 'partial' : 'unsettled'))
      : 'settled';

    // 4. Update the transaction row
    await db.runAsync(
      `UPDATE transactions SET
         wallet_id = ?,
         pocket_id = ?,
         merchant_name = ?,
         category = ?,
         type = ?,
         amount = ?,
         currency = ?,
         tax_amount = ?,
         discount_amount = ?,
         timestamp = ?,
         payment_method = ?,
         notes = ?,
         is_lent = ?,
         lent_to = ?,
         lent_repaid_amount = ?,
         lent_status = ?
       WHERE id = ?`,
      updates.walletId,
      updates.pocketId || '',
      updates.merchantName.trim(),
      updates.category,
      finalType,
      updates.amount,
      updates.currency || 'IDR',
      updates.taxAmount || 0,
      updates.discountAmount || 0,
      updates.timestamp,
      updates.paymentMethod,
      updates.notes || '',
      isLent ? 1 : 0,
      isLent ? (updates.lentTo || '') : '',
      isLent ? repaidAmount : 0,
      computedStatus,
      id
    );

    // 5. If this transaction is a repayment for a parent loan, recalculate the parent loan's repaid amount & status
    if (oldTx.lent_parent_tx_id) {
      await syncLentParentLoan(db, oldTx.lent_parent_tx_id);
    }

    // 6. If this transaction itself is a lent loan, synchronize its repaid amount & status based on all child repayments
    if (isLent) {
      await syncLentParentLoan(db, id);
    }
  });
}

export interface RecordLentRepaymentParams {
  parentTxId: string;
  walletId: string;
  amount: number;
  timestamp?: string;
  paymentMethod?: string;
  notes?: string;
}

export async function recordLentRepayment(params: RecordLentRepaymentParams): Promise<string> {
  const db = await getDatabase();
  const repaymentTxId = 'tx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

  await db.withTransactionAsync(async () => {
    const parent = await db.getFirstAsync<{
      id: string;
      type: TransactionType;
      amount: number;
      currency: CurrencyType;
      merchant_name: string;
      is_lent?: number;
      lent_to: string;
      lent_repaid_amount: number;
      lent_status: string;
      deleted_wallet_name?: string;
      deleted_pocket_name?: string;
    }>(
      'SELECT id, type, amount, currency, merchant_name, is_lent, lent_to, lent_repaid_amount, lent_status, deleted_wallet_name, deleted_pocket_name FROM transactions WHERE id = ?',
      params.parentTxId
    );

    if (!parent || !parent.is_lent) {
      throw new Error('Original loan transaction was not found.');
    }
    if (parent.deleted_wallet_name || parent.deleted_pocket_name) {
      throw new Error('Cannot record repayments on an archived loan from a deleted account.');
    }

    const isBorrowed = parent.type === 'income';
    const curr = parent.currency || 'IDR';
    const roundedPayment = roundForCurrency(params.amount, curr);
    const currentRepaid = Number(parent.lent_repaid_amount) || 0;
    const remainingDue = roundForCurrency(Math.max(0, parent.amount - currentRepaid), curr);
    const epsilon = curr === 'USD' ? 0.0001 : 0;
    if (roundedPayment <= 0) {
      throw new Error('Repayment amount must be greater than zero.');
    }
    if (roundedPayment > remainingDue + epsilon) {
      throw new Error('Repayment amount cannot exceed remaining balance.');
    }

    // 1. Validate target wallet exists (and has sufficient funds if paying back borrowed debt)
    const targetWallet = await db.getFirstAsync<{ id: string; balance: number }>(
      'SELECT id, balance FROM wallets WHERE id = ? AND COALESCE(is_deleted, 0) = 0',
      params.walletId
    );
    if (!targetWallet) {
      throw new Error('Selected account not found.');
    }
    if (isBorrowed && targetWallet.balance < roundedPayment - 0.005) {
      throw new InsufficientFundsError(
        'account',
        targetWallet.balance,
        'Selected account does not have enough balance to pay this debt.'
      );
    }

    // 2. Insert child repayment transaction (expense if paying back borrowed debt; income if receiving lent repayment)
    const counterparty = (parent.lent_to || '').trim() || parent.merchant_name;
    const txTimestamp = params.timestamp || new Date().toISOString();
    const txNotes =
      params.notes?.trim() ||
      (isBorrowed
        ? `Debt repayment to ${counterparty}`
        : `Repayment for lent to ${counterparty}`);
    const childMerchantName = isBorrowed
      ? `Debt Repayment: ${counterparty}`
      : `Repayment: ${counterparty}`;
    const childCategory = isBorrowed ? 'Bills & Utilities' : 'Allowance';
    const childType: TransactionType = isBorrowed ? 'expense' : 'income';

    await db.runAsync(
      `INSERT INTO transactions
       (id, wallet_id, pocket_id, merchant_name, category, type, amount, currency, tax_amount, discount_amount, timestamp, payment_method, notes, image_uri, is_lent, lent_to, lent_repaid_amount, lent_status, lent_parent_tx_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      repaymentTxId,
      params.walletId,
      '',
      childMerchantName,
      childCategory,
      childType,
      roundedPayment,
      curr,
      0,
      0,
      txTimestamp,
      params.paymentMethod || 'Bank Transfer',
      txNotes,
      '',
      0,
      '',
      0,
      'settled',
      parent.id
    );

    // 3. Update wallet balance while protecting any allocated pocket reserves
    const walletDelta = isBorrowed ? -roundedPayment : roundedPayment;
    await applyTransactionBalanceDelta(db, params.walletId, '', walletDelta);

    // 4. Atomically recalculate and sync parent loan status and repaid sum
    await syncLentParentLoan(db, parent.id);
  });

  return repaymentTxId;
}

export async function getLentRepayments(parentTxId: string): Promise<Transaction[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM transactions WHERE lent_parent_tx_id = ? ORDER BY timestamp DESC',
    parentTxId
  );
  if (rows.length === 0) return [];

  return rows.map((r) => ({
    id: r.id,
    walletId: r.wallet_id,
    pocketId: r.pocket_id || '',
    merchantName: r.merchant_name,
    category: r.category,
    type: r.type as TransactionType,
    amount: r.amount,
    currency: (r.currency as CurrencyType) || 'IDR',
    taxAmount: r.tax_amount,
    discountAmount: r.discount_amount,
    timestamp: r.timestamp,
    paymentMethod: r.payment_method,
    notes: r.notes,
    imageUri: r.image_uri,
    transferPairId: r.transfer_pair_id || undefined,
    exchangeRate: r.exchange_rate ? Number(r.exchange_rate) : undefined,
    isLent: Boolean(r.is_lent),
    lentTo: r.lent_to || '',
    lentRepaidAmount: Number(r.lent_repaid_amount) || 0,
    lentStatus: (r.lent_status || 'settled') as LentStatus,
    lentParentTxId: r.lent_parent_tx_id || undefined,
    deletedWalletName: r.deleted_wallet_name || undefined,
    deletedPocketName: r.deleted_pocket_name || undefined,
  }));
}

export interface TransferFundsParams {
  fromWalletId: string;
  toWalletId: string;
  fromPocketId?: string;
  toPocketId?: string;
  amount: number;
  currency: CurrencyType;
  targetAmount?: number;
  exchangeRate?: number;
  timestamp?: string;
  notes?: string;
}

// Atomically transfer funds between two accounts (supports multi-currency with FX conversion and optional pockets)
export async function transferFunds(
  params: TransferFundsParams
): Promise<{ outTxId: string; inTxId: string }> {
  const db = await getDatabase();
  const { fromWalletId, toWalletId, fromPocketId, toPocketId, amount, notes } = params;

  if (!fromWalletId || !toWalletId) {
    throw new Error('Both source and destination accounts are required.');
  }
  const isSameWallet = fromWalletId === toWalletId;
  if (isSameWallet && (fromPocketId || '') === (toPocketId || '')) {
    throw new Error('Source and destination must be different.');
  }
  if (!amount || isNaN(amount) || amount <= 0) {
    throw new Error('Transfer amount must be greater than zero.');
  }

  const fromWallet = await db.getFirstAsync<any>(
    'SELECT * FROM wallets WHERE id = ? AND COALESCE(is_deleted, 0) = 0',
    fromWalletId
  );
  const toWallet = await db.getFirstAsync<any>(
    'SELECT * FROM wallets WHERE id = ? AND COALESCE(is_deleted, 0) = 0',
    toWalletId
  );

  if (!fromWallet) throw new Error('Source account not found.');
  if (!toWallet) throw new Error('Destination account not found.');

  let sourcePocket: any = null;
  if (fromPocketId) {
    sourcePocket = await db.getFirstAsync<any>(
      'SELECT * FROM pockets WHERE id = ? AND wallet_id = ?',
      fromPocketId,
      fromWalletId
    );
    if (!sourcePocket) throw new Error('Selected source pocket not found.');
    if (sourcePocket.balance + 0.005 < amount) {
      throw new Error(
        `Insufficient balance in pocket "${sourcePocket.name}". Available: ${sourcePocket.balance}`
      );
    }
  } else {
    const allocatedRow = await db.getFirstAsync<{ total: number }>(
      'SELECT COALESCE(SUM(balance), 0) as total FROM pockets WHERE wallet_id = ?',
      fromWalletId
    );
    const allocated = allocatedRow ? Number(allocatedRow.total) || 0 : 0;
    const unallocated = Math.max(fromWallet.balance - allocated, 0);
    if (allocated > 0 && unallocated + 0.005 < amount) {
      throw new Error(
        `Insufficient unallocated balance in ${fromWallet.name}. Available unallocated: ${unallocated}`
      );
    }
  }

  if (fromWallet.balance + 0.005 < amount) {
    throw new Error(
      `Insufficient balance in ${fromWallet.name}. Available: ${fromWallet.balance}`
    );
  }

  let targetPocket: any = null;
  if (toPocketId) {
    targetPocket = await db.getFirstAsync<any>(
      'SELECT * FROM pockets WHERE id = ? AND wallet_id = ?',
      toPocketId,
      toWalletId
    );
    if (!targetPocket) throw new Error('Selected destination pocket not found.');
  }

  const isCrossCurrency = fromWallet.currency !== toWallet.currency;
  let finalTargetAmount = amount;
  let appliedExchangeRate = 0;

  if (isCrossCurrency) {
    if (
      params.exchangeRate !== undefined &&
      (isNaN(params.exchangeRate) || params.exchangeRate <= 0 || params.exchangeRate > 1e9)
    ) {
      throw new Error('That exchange rate looks invalid. Please check the rate value.');
    }
    const rate = params.exchangeRate && params.exchangeRate > 0 ? params.exchangeRate : 16000;
    appliedExchangeRate = rate;
    if (params.targetAmount && params.targetAmount > 0) {
      finalTargetAmount = roundForCurrency(params.targetAmount, toWallet.currency);
    } else {
      if (fromWallet.currency === 'USD' && toWallet.currency === 'IDR') {
        finalTargetAmount = Math.round(amount * rate);
      } else if (fromWallet.currency === 'IDR' && toWallet.currency === 'USD') {
        finalTargetAmount = Math.round((amount / rate) * 100) / 100;
      }
    }
    if (!finalTargetAmount || finalTargetAmount <= 0) {
      throw new Error('Converted amount is too small (rounds to 0). Please increase the transfer amount.');
    }
  }

  const outTxId = 'tx_tr_out_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const inTxId = 'tx_tr_in_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const txTimestamp = params.timestamp || new Date().toISOString();

  await db.withTransactionAsync(async () => {
    // Atomically debit source & credit destination with rounded balances and invariant validation
    await applyBalanceDeltasBatch(
      db,
      [
        { walletId: fromWalletId, pocketId: sourcePocket ? sourcePocket.id : '', delta: -amount },
        { walletId: toWalletId, pocketId: targetPocket ? targetPocket.id : '', delta: finalTargetAmount },
      ],
      { disallowNegativeWalletIds: [fromWalletId] }
    );

    const cleanUserNote = notes ? notes.trim() : '';
    const transferTitle = isSameWallet
      ? `${fromWallet.name}: ${sourcePocket ? sourcePocket.name : 'Main Balance'} to ${
          targetPocket ? targetPocket.name : 'Main Balance'
        }`
      : `${fromWallet.name} to ${toWallet.name}`;

    // Record outgoing transaction
    await db.runAsync(
      `INSERT INTO transactions
       (id, wallet_id, pocket_id, merchant_name, category, type, amount, currency, tax_amount, discount_amount, timestamp, payment_method, notes, image_uri, transfer_pair_id, exchange_rate)
       VALUES (?, ?, ?, ?, 'Transfer', 'expense', ?, ?, 0, 0, ?, 'Transfer', ?, '', ?, ?)`,
      outTxId,
      fromWalletId,
      sourcePocket ? sourcePocket.id : '',
      transferTitle,
      amount,
      fromWallet.currency,
      txTimestamp,
      cleanUserNote,
      inTxId,
      appliedExchangeRate
    );

    // Record incoming transaction
    await db.runAsync(
      `INSERT INTO transactions
       (id, wallet_id, pocket_id, merchant_name, category, type, amount, currency, tax_amount, discount_amount, timestamp, payment_method, notes, image_uri, transfer_pair_id, exchange_rate)
       VALUES (?, ?, ?, ?, 'Transfer', 'income', ?, ?, 0, 0, ?, 'Transfer', ?, '', ?, ?)`,
      inTxId,
      toWalletId,
      targetPocket ? targetPocket.id : '',
      transferTitle,
      finalTargetAmount,
      toWallet.currency,
      txTimestamp,
      cleanUserNote,
      outTxId,
      appliedExchangeRate
    );
  });

  return { outTxId, inTxId };
}

export interface UpdateTransferFundsParams {
  txId: string;
  fromWalletId: string;
  toWalletId: string;
  fromPocketId?: string;
  toPocketId?: string;
  amount: number;
  targetAmount?: number;
  exchangeRate?: number;
  notes?: string;
}

export async function updateTransferFunds(params: UpdateTransferFundsParams): Promise<void> {
  const db = await getDatabase();
  const { txId, fromWalletId, toWalletId, fromPocketId, toPocketId, amount, notes } = params;

  if (!fromWalletId || !toWalletId) {
    throw new Error('Both source and destination accounts are required.');
  }
  const isSameWallet = fromWalletId === toWalletId;
  if (isSameWallet && (fromPocketId || '') === (toPocketId || '')) {
    throw new Error('Source and destination must be different.');
  }
  if (!amount || isNaN(amount) || amount <= 0) {
    throw new Error('Transfer amount must be greater than zero.');
  }

  await db.withTransactionAsync(async () => {
    const clickedRow = await db.getFirstAsync<any>(
      'SELECT * FROM transactions WHERE id = ?',
      txId
    );
    if (!clickedRow) throw new Error('Transfer transaction not found.');
    if (clickedRow.deleted_wallet_name || clickedRow.deleted_pocket_name) {
      throw new Error('Archived transfer records cannot be modified.');
    }

    const pairedRow = clickedRow.transfer_pair_id
      ? await db.getFirstAsync<any>(
          'SELECT * FROM transactions WHERE id = ?',
          clickedRow.transfer_pair_id
        )
      : null;

    if (!pairedRow) {
      throw new Error('Paired transfer record not found.');
    }
    if (pairedRow.deleted_wallet_name || pairedRow.deleted_pocket_name) {
      throw new Error('This transfer involves a deleted account or pocket and cannot be modified.');
    }

    const oldOutTx = clickedRow.type === 'expense' ? clickedRow : pairedRow;
    const oldInTx = clickedRow.type === 'income' ? clickedRow : pairedRow;

    // 1. Validate new source & destination accounts and pockets exist
    const fromWallet = await db.getFirstAsync<any>(
      'SELECT * FROM wallets WHERE id = ? AND COALESCE(is_deleted, 0) = 0',
      fromWalletId
    );
    const toWallet = await db.getFirstAsync<any>(
      'SELECT * FROM wallets WHERE id = ? AND COALESCE(is_deleted, 0) = 0',
      toWalletId
    );
    if (!fromWallet) throw new Error('Source account not found.');
    if (!toWallet) throw new Error('Destination account not found.');

    let sourcePocket: any = null;
    if (fromPocketId) {
      sourcePocket = await db.getFirstAsync<any>(
        'SELECT * FROM pockets WHERE id = ? AND wallet_id = ?',
        fromPocketId,
        fromWalletId
      );
      if (!sourcePocket) throw new Error('Selected source pocket not found.');
    }

    let targetPocket: any = null;
    if (toPocketId) {
      targetPocket = await db.getFirstAsync<any>(
        'SELECT * FROM pockets WHERE id = ? AND wallet_id = ?',
        toPocketId,
        toWalletId
      );
      if (!targetPocket) throw new Error('Selected destination pocket not found.');
    }

    const isCrossCurrency = fromWallet.currency !== toWallet.currency;
    let finalTargetAmount = amount;
    let appliedExchangeRate = 0;

    if (isCrossCurrency) {
      if (
        params.exchangeRate !== undefined &&
        (isNaN(params.exchangeRate) || params.exchangeRate <= 0 || params.exchangeRate > 1e9)
      ) {
        throw new Error('That exchange rate looks invalid. Please check the rate value.');
      }
      const rate = params.exchangeRate && params.exchangeRate > 0 ? params.exchangeRate : 16000;
      appliedExchangeRate = rate;
      if (params.targetAmount && params.targetAmount > 0) {
        finalTargetAmount = roundForCurrency(params.targetAmount, toWallet.currency);
      } else {
        if (fromWallet.currency === 'USD' && toWallet.currency === 'IDR') {
          finalTargetAmount = Math.round(amount * rate);
        } else if (fromWallet.currency === 'IDR' && toWallet.currency === 'USD') {
          finalTargetAmount = Math.round((amount / rate) * 100) / 100;
        }
      }
      if (!finalTargetAmount || finalTargetAmount <= 0) {
        throw new Error('Converted amount is too small (rounds to 0). Please increase the transfer amount.');
      }
    }

    // 2 & 3. Revert old legs and apply new legs atomically against FINAL net balances
    // (prevents false InsufficientFundsError when editing notes or adjusting transfers with pockets)
    await applyBalanceDeltasBatch(
      db,
      [
        { walletId: oldOutTx.wallet_id, pocketId: oldOutTx.pocket_id || '', delta: oldOutTx.amount },
        { walletId: oldInTx.wallet_id, pocketId: oldInTx.pocket_id || '', delta: -oldInTx.amount },
        { walletId: fromWalletId, pocketId: sourcePocket ? sourcePocket.id : '', delta: -amount },
        { walletId: toWalletId, pocketId: targetPocket ? targetPocket.id : '', delta: finalTargetAmount },
      ],
      { disallowNegativeWalletIds: [fromWalletId] }
    );

    const cleanUserNote = notes ? notes.trim() : '';
    const transferTitle = isSameWallet
      ? `${fromWallet.name}: ${sourcePocket ? sourcePocket.name : 'Main Balance'} to ${
          targetPocket ? targetPocket.name : 'Main Balance'
        }`
      : `${fromWallet.name} to ${toWallet.name}`;

    // 4. Update both transaction legs
    await db.runAsync(
      `UPDATE transactions SET
         wallet_id = ?,
         pocket_id = ?,
         merchant_name = ?,
         amount = ?,
         currency = ?,
         notes = ?,
         exchange_rate = ?
       WHERE id = ?`,
      fromWalletId,
      sourcePocket ? sourcePocket.id : '',
      transferTitle,
      amount,
      fromWallet.currency,
      cleanUserNote,
      appliedExchangeRate,
      oldOutTx.id
    );

    await db.runAsync(
      `UPDATE transactions SET
         wallet_id = ?,
         pocket_id = ?,
         merchant_name = ?,
         amount = ?,
         currency = ?,
         notes = ?,
         exchange_rate = ?
       WHERE id = ?`,
      toWalletId,
      targetPocket ? targetPocket.id : '',
      transferTitle,
      finalTargetAmount,
      toWallet.currency,
      cleanUserNote,
      appliedExchangeRate,
      oldInTx.id
    );
  });
}

// App Settings Management
export async function getSetting(key: string, defaultValue: string = ''): Promise<string> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?',
    key
  );
  return row ? row.value : defaultValue;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
    key,
    value
  );
}

export async function deleteSetting(key: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM app_settings WHERE key = ?', key);
}

const SENSITIVE_OR_INTERNAL_SETTING_KEYS = new Set([
  '__pre_restore_snapshot',
  'ai_disclosure_accepted',
  'app_lock_enabled',
  'app_lock_pin_hash',
  'app_lock_biometrics_enabled',
]);

function isExcludedBackupSetting(key: string): boolean {
  return SENSITIVE_OR_INTERNAL_SETTING_KEYS.has(key) || key.startsWith('app_lock_');
}

// Budgeting & Spending Limits
// Budgets are stored per month so setting one month never rewrites another.
// The legacy global key is only read as a fallback for data created by older versions.
export async function getMonthlyBudget(
  currency: CurrencyType,
  month?: string
): Promise<number> {
  const db = await getDatabase();
  let monthKey = month;
  if (!monthKey || monthKey === 'all') {
    const now = new Date();
    monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  const catBudgets = await getCategoryBudgets(currency, monthKey);
  const catSum = Object.values(catBudgets).reduce((sum, val) => sum + (Number(val) || 0), 0);
  if (catSum > 0) {
    return roundForCurrency(catSum, currency);
  }

  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?',
    `monthly_budget_${monthKey}_${currency}`
  );
  if (row) return Number(row.value) || 0;

  const legacy = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?',
    `monthly_budget_${currency}`
  );
  if (legacy) return Number(legacy.value) || 0;
  return 0;
}

export async function setMonthlyBudget(
  amount: number,
  currency: CurrencyType,
  month?: string
): Promise<void> {
  let monthKey = month;
  if (!monthKey || monthKey === 'all') {
    const now = new Date();
    monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  await setSetting(`monthly_budget_${monthKey}_${currency}`, String(amount));
}

export async function getCategoryBudgets(
  currency: CurrencyType,
  month?: string
): Promise<CategoryBudgetsMap> {
  let monthKey = month;
  if (!monthKey || monthKey === 'all') {
    const now = new Date();
    monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  const raw = await getSetting(`category_budgets_${monthKey}_${currency}`, '');
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const cleaned: CategoryBudgetsMap = {};
    for (const [k, v] of Object.entries(parsed)) {
      const num = roundForCurrency(Number(v) || 0, currency);
      if (k.trim() && num > 0 && !isReservedTransferCategory(k)) {
        cleaned[k.trim()] = num;
      }
    }
    return cleaned;
  } catch {
    return {};
  }
}

export async function setCategoryBudgets(
  budgets: CategoryBudgetsMap,
  currency: CurrencyType,
  month?: string
): Promise<{ categoryBudgets: CategoryBudgetsMap; totalBudget: number }> {
  let monthKey = month;
  if (!monthKey || monthKey === 'all') {
    const now = new Date();
    monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  const cleaned: CategoryBudgetsMap = {};
  let total = 0;
  for (const [catName, rawVal] of Object.entries(budgets)) {
    const trimmed = catName.trim();
    const val = roundForCurrency(Number(rawVal) || 0, currency);
    if (trimmed && val > 0 && !isReservedTransferCategory(trimmed)) {
      cleaned[trimmed] = val;
      total += val;
    }
  }
  const roundedTotal = roundForCurrency(total, currency);
  await setSetting(`category_budgets_${monthKey}_${currency}`, JSON.stringify(cleaned));
  await setSetting(`monthly_budget_${monthKey}_${currency}`, String(roundedTotal));
  return { categoryBudgets: cleaned, totalBudget: roundedTotal };
}

export async function getBillingCycleConfig(): Promise<BillingCycleConfig> {
  const [dayStr, adjustStr] = await Promise.all([
    getSetting('budget_cycle_day', String(DEFAULT_BILLING_CYCLE.startDay)),
    getSetting(
      'budget_cycle_weekend_adjust',
      DEFAULT_BILLING_CYCLE.adjustWeekendToFriday ? '1' : '0'
    ),
  ]);
  return normalizeBillingCycleConfig({
    startDay: parseInt(dayStr, 10),
    adjustWeekendToFriday: adjustStr !== '0',
  });
}

export async function setBillingCycleConfig(
  config: BillingCycleConfig
): Promise<BillingCycleConfig> {
  const normalized = normalizeBillingCycleConfig(config);
  await Promise.all([
    setSetting('budget_cycle_day', String(normalized.startDay)),
    setSetting(
      'budget_cycle_weekend_adjust',
      normalized.adjustWeekendToFriday ? '1' : '0'
    ),
  ]);
  return normalized;
}

// Liquidity & Asset Allocation Plans & Notes
export interface AllocationItem {
  id: string;
  label: string;
  amount: number;
}

export interface AllocationPlan {
  id: string;
  title: string;
  currency: CurrencyType;
  items: AllocationItem[];
}

export async function getAllocationPlans(currency: CurrencyType): Promise<AllocationPlan[]> {
  const json = await getSetting(`allocation_plans_${currency}`, '');
  if (!json) {
    const legacyNote = await getSetting(`allocation_note_${currency}`, '');
    if (legacyNote && legacyNote.trim().length > 0) {
      return [
        {
          id: 'plan_initial',
          title: 'Primary Allocation',
          currency,
          items: [
            { id: 'item_1', label: legacyNote.trim(), amount: 0 },
          ],
        },
      ];
    }
    return [];
  }
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveAllocationPlans(
  plans: AllocationPlan[],
  currency: CurrencyType
): Promise<void> {
  await setSetting(`allocation_plans_${currency}`, JSON.stringify(plans));
}

export interface AppExportData {
  version: number;
  exportedAt: string;
  settings: Record<string, string>;
  wallets: Wallet[];
  pockets: Pocket[];
  categories: Category[];
  transactions: Transaction[];
  transactionItems: TransactionItem[];
}

// Export unified database snapshot into clean portable JSON
export async function exportAllData(): Promise<string> {
  const db = await getDatabase();
  const wallets = await getWallets();
  const pockets = await getPockets();
  const categories = await getCategories();
  const transactions = await getTransactions();
  const settingRows = await db.getAllAsync<{ key: string; value: string }>(
    'SELECT key, value FROM app_settings'
  );
  const itemsRows = await db.getAllAsync<any>('SELECT * FROM transaction_items');

  const settings: Record<string, string> = {};
  for (const s of settingRows) {
    if (isExcludedBackupSetting(s.key)) continue;
    settings[s.key] = s.value;
  }

  const exportPayload: AppExportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    wallets,
    pockets,
    categories,
    transactions,
    transactionItems: itemsRows.map((it) => ({
      id: it.id,
      transactionId: it.transaction_id,
      name: it.name,
      quantity: it.quantity,
      unitPrice: it.unit_price,
      totalPrice: it.total_price,
      category: it.category || '',
    })),
  };

  return JSON.stringify(exportPayload, null, 2);
}

// Export ledger transactions formatted as CSV for Excel / Google Sheets
export async function exportTransactionsCSV(): Promise<string> {
  const [transactions, wallets, pockets] = await Promise.all([
    getTransactions(),
    getWallets(),
    getPockets(),
  ]);

  const walletMap = new Map<string, string>();
  wallets.forEach((w) => walletMap.set(w.id, w.name));

  const pocketMap = new Map<string, string>();
  pockets.forEach((p) => pocketMap.set(p.id, p.name));

  const headers = [
    'Transaction ID',
    'Date & Time',
    'Type',
    'Account / Wallet',
    'Sub-Account / Pocket',
    'Merchant / Description',
    'Category',
    'Currency',
    'Amount',
    'Payment Method',
    'Notes',
  ];

  // Escape quotes and neutralize spreadsheet formula injection (=, +, -, @, tab, CR)
  const escapeCSV = (str: any) => {
    if (str === null || str === undefined) return '""';
    let raw = String(str);
    if (/^[\t\r ]*[=+\-@]/.test(raw) || /^[\t\r]/.test(raw)) {
      raw = `'${raw}`;
    }
    const s = raw.replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = transactions.map((tx) => [
    escapeCSV(tx.id),
    escapeCSV(tx.timestamp),
    escapeCSV(tx.type),
    escapeCSV(
      tx.deletedWalletName
        ? `${tx.deletedWalletName} (Deleted Acc)`
        : (walletMap.get(tx.walletId) || 'Main Account')
    ),
    escapeCSV(
      tx.deletedPocketName
        ? `${tx.deletedPocketName} (Deleted Pocket)`
        : (tx.pocketId ? (pocketMap.get(tx.pocketId) || '') : '')
    ),
    escapeCSV(tx.merchantName),
    escapeCSV(tx.category),
    escapeCSV(tx.currency),
    tx.amount,
    escapeCSV(tx.paymentMethod),
    escapeCSV(tx.notes || ''),
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export interface ImportOptions {
  skipSnapshot?: boolean;
}

// Import & restore unified database snapshot inside an atomic transaction.
// The current data is snapshotted first so the restore can be undone.
export async function importAllData(
  jsonString: string,
  options: ImportOptions = {}
): Promise<void> {
  let data: any;
  try {
    data = JSON.parse(jsonString);
  } catch {
    throw new Error('Invalid JSON format. Please choose a valid REKA backup file.');
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid backup structure. A REKA backup object is expected.');
  }

  if (data.version !== undefined && Number(data.version) > 1) {
    throw new Error(
      `This backup was created by a newer version of the app (v${data.version}) and cannot be restored here.`
    );
  }

  if (!Array.isArray(data.wallets) || data.wallets.length === 0) {
    throw new Error('Backup data contains no accounts. At least one account is required.');
  }

  // --- Strict structural validation before anything is deleted ---
  const walletIds = new Set<string>();
  for (const w of data.wallets) {
    if (!w || typeof w.id !== 'string' || !w.id || typeof w.name !== 'string' || !w.name.trim()) {
      throw new Error('The backup contains an invalid account record.');
    }
    if (walletIds.has(w.id)) {
      throw new Error('The backup contains duplicate account ids.');
    }
    walletIds.add(w.id);
  }

  const pockets = Array.isArray(data.pockets) ? data.pockets : [];
  for (const p of pockets) {
    if (!p || !p.id || !walletIds.has(p.walletId)) {
      throw new Error('The backup contains a pocket linked to a missing account.');
    }
  }

  const transactions = Array.isArray(data.transactions) ? data.transactions : [];
  const txIds = new Set<string>();
  const deletedWalletStubs = new Map<string, { id: string; name: string; currency: string }>();
  for (const tx of transactions) {
    const delWalletName = tx?.deletedWalletName || tx?.deleted_wallet_name || '';
    if (!tx || !tx.id || (!walletIds.has(tx.walletId) && !delWalletName)) {
      throw new Error('The backup contains a transaction linked to a missing account.');
    }
    if (!walletIds.has(tx.walletId) && delWalletName && !deletedWalletStubs.has(tx.walletId)) {
      deletedWalletStubs.set(tx.walletId, {
        id: tx.walletId,
        name: delWalletName,
        currency: tx.currency || 'IDR',
      });
    }
    if (txIds.has(tx.id)) {
      throw new Error('The backup contains duplicate transaction ids.');
    }
    txIds.add(tx.id);
  }

  const items = Array.isArray(data.transactionItems) ? data.transactionItems : [];
  for (const it of items) {
    if (!it || !it.id || !txIds.has(it.transactionId)) {
      throw new Error('The backup contains a line item linked to a missing transaction.');
    }
  }

  // Keep the pre-restore data so the user can undo an accidental restore
  let previousSnapshot = '';
  try {
    previousSnapshot = options.skipSnapshot
      ? await getSetting(PRE_RESTORE_KEY, '')
      : await exportAllData();
  } catch {
    previousSnapshot = '';
  }

  const db = await getDatabase();
  try {
    await db.withTransactionAsync(async () => {
      // Clear current database contents cleanly
      await db.runAsync('DELETE FROM transaction_items');
      await db.runAsync('DELETE FROM transactions');
      await db.runAsync('DELETE FROM pockets');
      await db.runAsync('DELETE FROM wallets');
      await db.runAsync('DELETE FROM app_settings');

      // Restore settings (never import device-local security lock keys or internal snapshots)
      if (data.settings && typeof data.settings === 'object') {
        for (const [k, v] of Object.entries(data.settings)) {
          if (isExcludedBackupSetting(k)) continue;
          await db.runAsync(
            'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
            k,
            String(v)
          );
        }
      }

      // Restore wallets (keep the user's custom ordering)
      for (const w of data.wallets) {
        await db.runAsync(
          `INSERT INTO wallets (id, name, type, balance, currency, color, account_number, sort_order, is_deleted)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
          w.id,
          w.name,
          w.type || 'bank',
          Number(w.balance) || 0,
          w.currency || 'IDR',
          w.color || '#CC785C',
          w.accountNumber || '',
          Number.isFinite(Number(w.sortOrder)) ? Number(w.sortOrder) : 0
        );
      }

      // Restore soft-deleted wallet stubs for archived transactions so FK constraints are satisfied
      for (const stub of deletedWalletStubs.values()) {
        await db.runAsync(
          `INSERT OR IGNORE INTO wallets (id, name, type, balance, currency, color, account_number, sort_order, is_deleted)
           VALUES (?, ?, 'bank', 0, ?, '#CC785C', '', 999, 1)`,
          stub.id,
          stub.name,
          stub.currency
        );
      }

      // Restore pockets
      for (const p of pockets) {
        await db.runAsync(
          `INSERT INTO pockets (id, wallet_id, name, balance, target_amount, icon, color)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          p.id,
          p.walletId,
          p.name,
          Number(p.balance) || 0,
          Number(p.targetAmount) || 0,
          p.icon || 'Briefcase',
          p.color || '#CC785C'
        );
      }

      // Clear categories before restoring so pre-existing timestamp-ID defaults never duplicate or leak
      await db.runAsync('DELETE FROM categories');
      if (Array.isArray(data.categories) && data.categories.length > 0) {
        for (const c of data.categories) {
          await db.runAsync(
            `INSERT OR REPLACE INTO categories (id, name, type, icon, color, is_default)
             VALUES (?, ?, ?, ?, ?, ?)`,
            c.id,
            c.name,
            c.type,
            c.icon || 'HelpCircle',
            c.color || '#CC785C',
            c.isDefault ? 1 : 0
          );
        }
      } else {
        await seedDefaultCategories(db, true);
      }
      await removeSystemTransferCategory(db);
      // Categories came from the backup, so never re-add defaults the user deleted
      await db.runAsync(
        "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('defaults_seeded_v1', '1')"
      );

      // Restore transactions
      for (const tx of transactions) {
        const pairId = tx.transferPairId || tx.transfer_pair_id || null;
        const parentLentId = tx.lentParentTxId || tx.lent_parent_tx_id || null;
        await db.runAsync(
          `INSERT INTO transactions 
           (id, wallet_id, pocket_id, merchant_name, category, type, amount, currency, tax_amount, discount_amount, timestamp, payment_method, notes, image_uri, transfer_pair_id, exchange_rate, is_lent, lent_to, lent_repaid_amount, lent_status, lent_parent_tx_id, deleted_wallet_name, deleted_pocket_name)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          tx.id,
          tx.walletId,
          tx.pocketId || '',
          tx.merchantName || 'Transaction',
          tx.category || 'Others',
          tx.type === 'income' ? 'income' : 'expense',
          Number(tx.amount) || 0,
          tx.currency || 'IDR',
          Number(tx.taxAmount) || 0,
          Number(tx.discountAmount) || 0,
          tx.timestamp || new Date().toISOString(),
          tx.paymentMethod || 'QRIS',
          tx.notes || '',
          tx.imageUri || '',
          pairId && txIds.has(pairId) ? pairId : null,
          Number(tx.exchangeRate || tx.exchange_rate) || 0,
          tx.isLent || tx.is_lent ? 1 : 0,
          tx.lentTo || tx.lent_to || '',
          Number(tx.lentRepaidAmount || tx.lent_repaid_amount) || 0,
          tx.lentStatus || tx.lent_status || (tx.isLent || tx.is_lent ? 'unsettled' : 'settled'),
          parentLentId && txIds.has(parentLentId) ? parentLentId : null,
          tx.deletedWalletName || tx.deleted_wallet_name || '',
          tx.deletedPocketName || tx.deleted_pocket_name || ''
        );
      }

      // Restore transaction items
      for (const it of items) {
        await db.runAsync(
          `INSERT INTO transaction_items (id, transaction_id, name, quantity, unit_price, total_price, category)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          it.id,
          it.transactionId,
          it.name || 'Item',
          Number(it.quantity) || 1,
          Number(it.unitPrice) || 0,
          Number(it.totalPrice) || 0,
          it.category || ''
        );
      }

      await migrateCategoriesV2(db);
      await migrateCategoryIcons(db);

      // Re-store the snapshot so an accidental restore can be undone
      if (previousSnapshot) {
        await db.runAsync(
          'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
          PRE_RESTORE_KEY,
          previousSnapshot
        );
      }
    });
  } catch (err: any) {
    const message = String(err?.message || '');
    if (message.includes('FOREIGN KEY') || message.includes('constraint')) {
      throw new Error(
        'This backup is inconsistent, so nothing was changed. Your current data is safe.'
      );
    }
    throw new Error(message || 'Failed to restore the backup. Nothing was changed.');
  }
}

// Wipe all user transactions, accounts, and pockets, resetting to fresh state
export async function wipeAllData(): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM transaction_items');
    await db.runAsync('DELETE FROM transactions');
    await db.runAsync('DELETE FROM pockets');
    await db.runAsync('DELETE FROM wallets');
    await db.runAsync('DELETE FROM categories');
    await db.runAsync('DELETE FROM app_settings');

    // Restore factory categories and a clean default account
    await seedDefaultCategories(db, true);
    await removeSystemTransferCategory(db);

    const defaultWalletId = 'w_primary_' + Date.now();
    await db.runAsync(
      `INSERT INTO wallets (id, name, type, balance, currency, color, account_number)
       VALUES (?, 'Main Account', 'bank', 0, 'IDR', '#CC785C', '')`,
      defaultWalletId
    );
  });
  await clearAllReceiptImages();
}

// ---------------------------------------------------------------
// Restore safety net: keep the data that existed right before an import
// so an accidental restore can be undone from Settings.
// ---------------------------------------------------------------
const PRE_RESTORE_KEY = '__pre_restore_snapshot';

export async function hasPreRestoreSnapshot(): Promise<boolean> {
  const snapshot = await getSetting(PRE_RESTORE_KEY, '');
  return snapshot.trim().length > 2;
}

export async function restorePreRestoreSnapshot(): Promise<void> {
  const snapshot = await getSetting(PRE_RESTORE_KEY, '');
  if (!snapshot) throw new Error('No previous data snapshot is available.');
  // Keep the snapshot itself so the undo stays repeatable
  await importAllData(snapshot, { skipSnapshot: true });
}
