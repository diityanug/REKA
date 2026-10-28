import * as SQLite from 'expo-sqlite';

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
  items?: TransactionItem[];
}

let dbInstance: SQLite.SQLiteDatabase | null = null;
let dbInitPromise: Promise<SQLite.SQLiteDatabase> | null = null;

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
        CREATE INDEX IF NOT EXISTS idx_items_tx ON transaction_items (transaction_id);
        CREATE INDEX IF NOT EXISTS idx_pockets_wallet ON pockets (wallet_id);
      `);

      // Ensure all default categories from data uwu.md exist safely
      const defaultCategories: {
        name: string;
        type: TransactionType;
        icon: string;
        color: string;
      }[] = [
        // Expenses (from data uwu.md)
        { name: 'Bills & Utilities', type: 'expense', icon: 'Zap', color: '#C64545' },
        { name: 'Subscriptions', type: 'expense', icon: 'Film', color: '#6366F1' },
        { name: 'Housing / Rent', type: 'expense', icon: 'Home', color: '#0EA5E9' },
        { name: 'Internet & Phone', type: 'expense', icon: 'Wifi', color: '#3B82F6' },
        { name: 'Insurance', type: 'expense', icon: 'ShieldCheck', color: '#10B981' },
        { name: 'Fitness & Gym', type: 'expense', icon: 'Dumbbell', color: '#F97316' },
        { name: 'Cloud & Storage', type: 'expense', icon: 'Cloud', color: '#8B5CF6' },
        { name: 'Food & Beverages', type: 'expense', icon: 'Utensils', color: '#CC785C' },
        { name: 'Snacks', type: 'expense', icon: 'Coffee', color: '#D97706' },
        { name: 'Shopping', type: 'expense', icon: 'ShoppingBag', color: '#EC4899' },
        { name: 'Fuel', type: 'expense', icon: 'Fuel', color: '#EF4444' },
        { name: 'Parking', type: 'expense', icon: 'CircleParking', color: '#64748B' },
        { name: 'Vehicle Services', type: 'expense', icon: 'Wrench', color: '#F59E0B' },
        { name: 'Public Services', type: 'expense', icon: 'Landmark', color: '#0284C7' },
        { name: 'Personal', type: 'expense', icon: 'User', color: '#A855F7' },
        { name: 'Home Services', type: 'expense', icon: 'Hammer', color: '#14B8A6' },
        { name: 'Furnisings', type: 'expense', icon: 'Armchair', color: '#84CC16' },
        { name: 'Social', type: 'expense', icon: 'Users', color: '#E11D48' },
        { name: 'Health & Medical', type: 'expense', icon: 'HeartPulse', color: '#06B6D4' },
        { name: 'Education', type: 'expense', icon: 'GraduationCap', color: '#3B82F6' },
        { name: 'Travel', type: 'expense', icon: 'Plane', color: '#F97316' },
        { name: 'Others', type: 'expense', icon: 'CircleEllipsis', color: '#78716C' },
        // Income (from data uwu.md)
        { name: 'Salary', type: 'income', icon: 'DollarSign', color: '#059669' },
        { name: 'Allowance', type: 'income', icon: 'HandCoins', color: '#10B981' },
        { name: 'Interest', type: 'income', icon: 'Percent', color: '#14B8A6' },
        { name: 'Investments', type: 'income', icon: 'TrendingUp', color: '#0284C7' },
        { name: 'Bonus', type: 'income', icon: 'Award', color: '#F59E0B' },
        { name: 'Gift', type: 'income', icon: 'Gift', color: '#EC4899' },
        { name: 'Others', type: 'income', icon: 'CircleEllipsis', color: '#059669' },
      ];

      for (let i = 0; i < defaultCategories.length; i++) {
        const cat = defaultCategories[i];
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
            await db.runAsync('UPDATE categories SET icon = ?, color = ? WHERE id = ?', cat.icon, cat.color, existing.id);
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

      // Explicitly guarantee both Expense Others and Income Others exist and have the proper icons
      const expenseOthers = await db.getFirstAsync<{ id: string; icon: string }>(
        "SELECT id, icon FROM categories WHERE LOWER(TRIM(name)) = 'others' AND LOWER(TRIM(type)) = 'expense'"
      );
      if (!expenseOthers) {
        await db.runAsync(
          `INSERT OR IGNORE INTO categories (id, name, type, icon, color, is_default)
           VALUES ('cat_e_others_default', 'Others', 'expense', 'CircleEllipsis', '#78716C', 1)`
        );
      } else {
        await db.runAsync("UPDATE categories SET icon = 'CircleEllipsis' WHERE id = ?", expenseOthers.id);
      }

      const incomeOthers = await db.getFirstAsync<{ id: string; icon: string }>(
        "SELECT id, icon FROM categories WHERE LOWER(TRIM(name)) = 'others' AND LOWER(TRIM(type)) = 'income'"
      );
      if (!incomeOthers) {
        await db.runAsync(
          `INSERT OR IGNORE INTO categories (id, name, type, icon, color, is_default)
           VALUES ('cat_i_others_default', 'Others', 'income', 'CircleEllipsis', '#059669', 1)`
        );
      } else {
        await db.runAsync("UPDATE categories SET icon = 'CircleEllipsis', color = '#059669' WHERE id = ?", incomeOthers.id);
      }

      // Unify all 'Others' categories (expense & income) to use the identical expense model icon (CircleEllipsis)
      await db.runAsync("UPDATE categories SET icon = 'CircleEllipsis' WHERE LOWER(TRIM(name)) = 'others'");

      // Ensure Transfer category is always available for internal ledger movements
      const transferCat = await db.getFirstAsync<{ id: string }>(
        'SELECT id FROM categories WHERE LOWER(TRIM(name)) = ?',
        'transfer'
      );
      if (!transferCat) {
        await db.runAsync(
          `INSERT OR IGNORE INTO categories (id, name, type, icon, color, is_default)
           VALUES ('cat_t_transfer', 'Transfer', 'expense', 'ArrowLeftRight', '#6C7A89', 1)`
        );
      }

      // Ensure at least one wallet exists for fresh installation
      const walletCount = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM wallets'
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

      dbInstance = db;
      return db;
    } catch (err) {
      dbInitPromise = null;
      throw err;
    }
  })();

  return dbInitPromise;
}

export async function clearAllSampleData(): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM transaction_items WHERE transaction_id LIKE 'tx_seed_%'");
    await db.runAsync("DELETE FROM transactions WHERE id LIKE 'tx_seed_%'");
    await db.runAsync("DELETE FROM wallets WHERE id IN ('w_checking', 'w_savings', 'w_cash', 'w_main')");
  });
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
  const db = await getDatabase();
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
    'SELECT * FROM wallets ORDER BY sort_order ASC, balance DESC'
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    balance: r.balance,
    currency: (r.currency as CurrencyType) || 'IDR',
    color: r.color,
    accountNumber: r.account_number || '',
    sortOrder: r.sort_order ?? 0,
  }));
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

export async function updateWalletName(id: string, newName: string): Promise<void> {
  const db = await getDatabase();
  const trimmed = newName.trim();
  if (!trimmed) throw new Error('Account name cannot be empty.');
  await db.runAsync('UPDATE wallets SET name = ? WHERE id = ?', trimmed, id);
}

export async function adjustWalletBalance(id: string, newBalance: number): Promise<void> {
  const db = await getDatabase();
  if (isNaN(newBalance) || newBalance < 0) {
    throw new Error('Balance must be a valid non-negative number.');
  }
  await db.runAsync('UPDATE wallets SET balance = ? WHERE id = ?', newBalance, id);
}

export async function deleteWallet(id: string): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'DELETE FROM transaction_items WHERE transaction_id IN (SELECT id FROM transactions WHERE wallet_id = ?)',
      id
    );
    await db.runAsync('DELETE FROM transactions WHERE wallet_id = ?', id);
    await db.runAsync('DELETE FROM pockets WHERE wallet_id = ?', id);
    await db.runAsync('DELETE FROM wallets WHERE id = ?', id);
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

    if (safeBal > unallocated) {
      const excess = safeBal - unallocated;
      await db.runAsync(
        'UPDATE wallets SET balance = balance + ? WHERE id = ?',
        excess,
        pocket.walletId
      );
    }
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
    if (!pocket) return;

    if (delta > 0) {
      const wallet = await db.getFirstAsync<{ balance: number }>(
        'SELECT balance FROM wallets WHERE id = ?',
        pocket.wallet_id
      );
      const allocatedRow = await db.getFirstAsync<{ total: number }>(
        'SELECT COALESCE(SUM(balance), 0) as total FROM pockets WHERE wallet_id = ?',
        pocket.wallet_id
      );
      const unallocated = Math.max(
        (wallet ? wallet.balance : 0) - (allocatedRow ? allocatedRow.total : 0),
        0
      );
      await db.runAsync('UPDATE pockets SET balance = balance + ? WHERE id = ?', delta, pocketId);
      if (delta > unallocated) {
        await db.runAsync(
          'UPDATE wallets SET balance = balance + ? WHERE id = ?',
          delta - unallocated,
          pocket.wallet_id
        );
      }
    } else if (delta < 0) {
      const nextBal = Math.max(pocket.balance + delta, 0);
      await db.runAsync('UPDATE pockets SET balance = ? WHERE id = ?', nextBal, pocketId);
    }
  });
}

export async function updatePocketName(id: string, newName: string): Promise<void> {
  const db = await getDatabase();
  const trimmed = newName.trim();
  if (!trimmed) throw new Error('Pocket name cannot be empty.');
  await db.runAsync('UPDATE pockets SET name = ? WHERE id = ?', trimmed, id);
}

export async function deletePocket(id: string): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync("UPDATE transactions SET pocket_id = '' WHERE pocket_id = ?", id);
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
      tx.paymentMethod,
      tx.notes || '',
      tx.imageUri || ''
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

    // Adjust wallet and optional pocket balance
    const balanceDelta = tx.type === 'expense' ? -tx.amount : tx.amount;
    await db.runAsync(
      'UPDATE wallets SET balance = balance + ? WHERE id = ?',
      balanceDelta,
      tx.walletId
    );
    if (tx.pocketId) {
      await db.runAsync(
        'UPDATE pockets SET balance = MAX(0, balance + ?) WHERE id = ?',
        balanceDelta,
        tx.pocketId
      );
    }
  });

  return txId;
}

export async function deleteTransaction(id: string): Promise<void> {
  const db = await getDatabase();
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
      transfer_pair_id?: string;
    }>(
      'SELECT id, wallet_id, pocket_id, type, amount, category, payment_method, merchant_name, transfer_pair_id FROM transactions WHERE id = ?',
      id
    );

    if (!tx) return;

    // Check if this is a transfer transaction with a paired counterpart
    let pairedTx: typeof tx | null = null;
    if (tx.transfer_pair_id) {
      pairedTx = await db.getFirstAsync<typeof tx>(
        'SELECT id, wallet_id, pocket_id, type, amount, category, payment_method, merchant_name, transfer_pair_id FROM transactions WHERE id = ?',
        tx.transfer_pair_id
      );
    } else if (
      tx.category === 'Transfer' ||
      tx.payment_method === 'Transfer' ||
      /^Transfer (to|from)\s+/i.test(tx.merchant_name)
    ) {
      // Legacy fallback for transfers created before transfer_pair_id
      pairedTx = await db.getFirstAsync<typeof tx>(
        `SELECT id, wallet_id, pocket_id, type, amount, category, payment_method, merchant_name, transfer_pair_id
         FROM transactions
         WHERE id != ?
           AND (category = 'Transfer' OR payment_method = 'Transfer' OR merchant_name LIKE 'Transfer %')
           AND type != ?
         ORDER BY id DESC LIMIT 1`,
        id,
        tx.type
      );
    }

    const revertTxBalance = async (targetTx: typeof tx) => {
      const reverseDelta = targetTx.type === 'expense' ? targetTx.amount : -targetTx.amount;
      await db.runAsync(
        'UPDATE wallets SET balance = balance + ? WHERE id = ?',
        reverseDelta,
        targetTx.wallet_id
      );
      if (targetTx.pocket_id) {
        await db.runAsync(
          'UPDATE pockets SET balance = MAX(0, balance + ?) WHERE id = ?',
          reverseDelta,
          targetTx.pocket_id
        );
      }
      await db.runAsync('DELETE FROM transaction_items WHERE transaction_id = ?', targetTx.id);
      await db.runAsync('DELETE FROM transactions WHERE id = ?', targetTx.id);
    };

    // Revert target transaction
    await revertTxBalance(tx);

    // If paired transfer transaction exists, revert it atomically as well
    if (pairedTx && pairedTx.id !== tx.id) {
      await revertTxBalance(pairedTx);
    }
  });
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
    }>('SELECT wallet_id, pocket_id, type, amount FROM transactions WHERE id = ?', id);

    if (!oldTx) {
      throw new Error('Transaction not found');
    }

    // 1. Revert previous wallet & pocket balance effect
    const revertDelta = oldTx.type === 'expense' ? oldTx.amount : -oldTx.amount;
    await db.runAsync(
      'UPDATE wallets SET balance = balance + ? WHERE id = ?',
      revertDelta,
      oldTx.wallet_id
    );
    if (oldTx.pocket_id) {
      await db.runAsync(
        'UPDATE pockets SET balance = MAX(0, balance + ?) WHERE id = ?',
        revertDelta,
        oldTx.pocket_id
      );
    }

    // 2. Apply new wallet & pocket balance effect
    const newDelta = updates.type === 'expense' ? -updates.amount : updates.amount;
    await db.runAsync(
      'UPDATE wallets SET balance = balance + ? WHERE id = ?',
      newDelta,
      updates.walletId
    );
    if (updates.pocketId) {
      await db.runAsync(
        'UPDATE pockets SET balance = MAX(0, balance + ?) WHERE id = ?',
        newDelta,
        updates.pocketId
      );
    }

    // 3. Update the transaction row
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
         notes = ?
       WHERE id = ?`,
      updates.walletId,
      updates.pocketId || '',
      updates.merchantName.trim(),
      updates.category,
      updates.type,
      updates.amount,
      updates.currency || 'IDR',
      updates.taxAmount || 0,
      updates.discountAmount || 0,
      updates.timestamp,
      updates.paymentMethod,
      updates.notes || '',
      id
    );
  });
}

export interface TransferFundsParams {
  fromWalletId: string;
  toWalletId: string;
  amount: number;
  currency: CurrencyType;
  targetAmount?: number;
  exchangeRate?: number;
  timestamp?: string;
  notes?: string;
}

// Atomically transfer funds between two accounts (supports multi-currency with FX conversion)
export async function transferFunds(
  params: TransferFundsParams
): Promise<{ outTxId: string; inTxId: string }> {
  const db = await getDatabase();
  const { fromWalletId, toWalletId, amount, notes } = params;

  if (!fromWalletId || !toWalletId) {
    throw new Error('Both source and destination accounts are required.');
  }
  if (fromWalletId === toWalletId) {
    throw new Error('Source and destination accounts must be different.');
  }
  if (!amount || isNaN(amount) || amount <= 0) {
    throw new Error('Transfer amount must be greater than zero.');
  }

  const fromWallet = await db.getFirstAsync<any>(
    'SELECT * FROM wallets WHERE id = ?',
    fromWalletId
  );
  const toWallet = await db.getFirstAsync<any>(
    'SELECT * FROM wallets WHERE id = ?',
    toWalletId
  );

  if (!fromWallet) throw new Error('Source account not found.');
  if (!toWallet) throw new Error('Destination account not found.');

  if (fromWallet.balance < amount) {
    throw new Error(
      `Insufficient balance in ${fromWallet.name}. Available: ${fromWallet.balance}`
    );
  }

  const isCrossCurrency = fromWallet.currency !== toWallet.currency;
  let finalTargetAmount = amount;
  let rateInfo = '';

  if (isCrossCurrency) {
    const rate = params.exchangeRate && params.exchangeRate > 0 ? params.exchangeRate : 16000;
    if (params.targetAmount && params.targetAmount > 0) {
      finalTargetAmount = params.targetAmount;
    } else {
      if (fromWallet.currency === 'USD' && toWallet.currency === 'IDR') {
        finalTargetAmount = Math.round(amount * rate);
      } else if (fromWallet.currency === 'IDR' && toWallet.currency === 'USD') {
        finalTargetAmount = Math.round((amount / rate) * 100) / 100;
      }
    }
    rateInfo = `Rate: 1 USD = Rp ${rate.toLocaleString('id-ID')}`;
  }

  const outTxId = 'tx_tr_out_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const inTxId = 'tx_tr_in_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const txTimestamp = params.timestamp || new Date().toISOString();

  await db.withTransactionAsync(async () => {
    // Debit source wallet in source currency
    await db.runAsync(
      'UPDATE wallets SET balance = balance - ? WHERE id = ?',
      amount,
      fromWalletId
    );
    // Credit target wallet in target currency
    await db.runAsync(
      'UPDATE wallets SET balance = balance + ? WHERE id = ?',
      finalTargetAmount,
      toWalletId
    );

    const outNoteText = [
      notes ? notes.trim() : '',
      isCrossCurrency ? `Converted to ${toWallet.currency} • ${rateInfo}` : '',
    ]
      .filter(Boolean)
      .join(' • ') || `Transfer to ${toWallet.name}`;

    const inNoteText = [
      notes ? notes.trim() : '',
      isCrossCurrency ? `Converted from ${fromWallet.currency} • ${rateInfo}` : '',
    ]
      .filter(Boolean)
      .join(' • ') || `Transfer from ${fromWallet.name}`;

    const transferTitle = `${fromWallet.name} to ${toWallet.name}`;

    // Record outgoing transaction
    await db.runAsync(
      `INSERT INTO transactions
       (id, wallet_id, pocket_id, merchant_name, category, type, amount, currency, tax_amount, discount_amount, timestamp, payment_method, notes, image_uri, transfer_pair_id)
       VALUES (?, ?, '', ?, 'Transfer', 'expense', ?, ?, 0, 0, ?, 'Transfer', ?, '', ?)`,
      outTxId,
      fromWalletId,
      transferTitle,
      amount,
      fromWallet.currency,
      txTimestamp,
      outNoteText,
      inTxId
    );

    // Record incoming transaction
    await db.runAsync(
      `INSERT INTO transactions
       (id, wallet_id, pocket_id, merchant_name, category, type, amount, currency, tax_amount, discount_amount, timestamp, payment_method, notes, image_uri, transfer_pair_id)
       VALUES (?, ?, '', ?, 'Transfer', 'income', ?, ?, 0, 0, ?, 'Transfer', ?, '', ?)`,
      inTxId,
      toWalletId,
      transferTitle,
      finalTargetAmount,
      toWallet.currency,
      txTimestamp,
      inNoteText,
      outTxId
    );
  });

  return { outTxId, inTxId };
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

// Budgeting & Spending Limits
export async function getMonthlyBudget(
  currency: CurrencyType,
  month?: string
): Promise<number> {
  if (month && month !== 'all') {
    const specificVal = await getSetting(`monthly_budget_${month}_${currency}`, '');
    if (specificVal && !isNaN(Number(specificVal))) {
      return Number(specificVal);
    }
  }
  const defaultVal = await getSetting(`monthly_budget_${currency}`, '0');
  return Number(defaultVal) || 0;
}

export async function setMonthlyBudget(
  amount: number,
  currency: CurrencyType,
  month?: string
): Promise<void> {
  if (month && month !== 'all') {
    await setSetting(`monthly_budget_${month}_${currency}`, String(amount));
  }
  await setSetting(`monthly_budget_${currency}`, String(amount));
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

export async function getAllocationNote(currency: CurrencyType): Promise<string> {
  return await getSetting(`allocation_note_${currency}`, '');
}

export async function setAllocationNote(
  note: string,
  currency: CurrencyType
): Promise<void> {
  await setSetting(`allocation_note_${currency}`, note.trim());
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

  const escapeCSV = (str: any) => {
    if (str === null || str === undefined) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = transactions.map((tx) => [
    escapeCSV(tx.id),
    escapeCSV(tx.timestamp),
    escapeCSV(tx.type),
    escapeCSV(walletMap.get(tx.walletId) || 'Main Account'),
    escapeCSV(tx.pocketId ? (pocketMap.get(tx.pocketId) || '') : ''),
    escapeCSV(tx.merchantName),
    escapeCSV(tx.category),
    escapeCSV(tx.currency),
    tx.amount,
    escapeCSV(tx.paymentMethod),
    escapeCSV(tx.notes || ''),
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

// Import & restore unified database snapshot inside atomic transaction
export async function importAllData(jsonString: string): Promise<void> {
  let data: any;
  try {
    data = JSON.parse(jsonString);
  } catch {
    throw new Error('Invalid JSON format. Please paste valid backup data.');
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Invalid backup structure. Object expected.');
  }

  if (!Array.isArray(data.wallets) && !Array.isArray(data.transactions)) {
    throw new Error('Unrecognized backup format. Missing wallets or transactions array.');
  }

  // Pre-validate wallets before touching the database
  if (Array.isArray(data.wallets)) {
    if (data.wallets.length === 0) {
      throw new Error('Backup data contains 0 accounts. At least one account is required.');
    }
    for (const w of data.wallets) {
      if (!w || !w.id || !w.name) {
        throw new Error('Invalid wallet record found in backup data.');
      }
    }
  }

  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    // Clear current database contents cleanly
    await db.runAsync('DELETE FROM transaction_items');
    await db.runAsync('DELETE FROM transactions');
    await db.runAsync('DELETE FROM pockets');
    await db.runAsync('DELETE FROM wallets');
    await db.runAsync('DELETE FROM app_settings');

    // Restore settings
    if (data.settings && typeof data.settings === 'object') {
      for (const [k, v] of Object.entries(data.settings)) {
        await db.runAsync(
          'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
          k,
          String(v)
        );
      }
    }

    // Restore wallets
    if (Array.isArray(data.wallets)) {
      for (const w of data.wallets) {
        await db.runAsync(
          `INSERT INTO wallets (id, name, type, balance, currency, color, account_number)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          w.id,
          w.name,
          w.type || 'bank',
          w.balance || 0,
          w.currency || 'IDR',
          w.color || '#CC785C',
          w.accountNumber || ''
        );
      }
    }

    // Restore pockets
    if (Array.isArray(data.pockets)) {
      for (const p of data.pockets) {
        await db.runAsync(
          `INSERT INTO pockets (id, wallet_id, name, balance, target_amount, icon, color)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          p.id,
          p.walletId,
          p.name,
          p.balance || 0,
          p.targetAmount || 0,
          p.icon || 'Briefcase',
          p.color || '#CC785C'
        );
      }
    }

    // Restore custom categories if present
    if (Array.isArray(data.categories)) {
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
    }

    // Restore transactions
    if (Array.isArray(data.transactions)) {
      for (const tx of data.transactions) {
        await db.runAsync(
          `INSERT INTO transactions 
           (id, wallet_id, pocket_id, merchant_name, category, type, amount, currency, tax_amount, discount_amount, timestamp, payment_method, notes, image_uri, transfer_pair_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          tx.id,
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
          tx.paymentMethod || 'QRIS',
          tx.notes || '',
          tx.imageUri || '',
          tx.transferPairId || tx.transfer_pair_id || null
        );
      }
    }

    // Restore transaction items
    if (Array.isArray(data.transactionItems)) {
      for (const it of data.transactionItems) {
        await db.runAsync(
          `INSERT INTO transaction_items (id, transaction_id, name, quantity, unit_price, total_price, category)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          it.id,
          it.transactionId,
          it.name,
          it.quantity || 1,
          it.unitPrice || 0,
          it.totalPrice || 0,
          it.category || ''
        );
      }
    }
  });
}

// Wipe all user transactions, accounts, and pockets, resetting to fresh state
export async function wipeAllData(): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM transaction_items');
    await db.runAsync('DELETE FROM transactions');
    await db.runAsync('DELETE FROM pockets');
    await db.runAsync('DELETE FROM wallets');
    await db.runAsync("DELETE FROM app_settings WHERE key != 'user_name'");

    // Create fresh default primary account
    const defaultWalletId = 'w_primary_' + Date.now();
    await db.runAsync(
      `INSERT INTO wallets (id, name, type, balance, currency, color, account_number)
       VALUES (?, 'Main Account', 'bank', 0, 'IDR', '#CC785C', '')`,
      defaultWalletId
    );
  });
}
