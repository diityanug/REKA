import type { AppExportData, Category, Pocket, Transaction, Wallet } from '../types';

function makeLocalIso(year: number, month1Based: number, day: number, hour = 11, minute = 30): string {
  const maxDay = new Date(year, month1Based, 0).getDate();
  const clamped = Math.min(Math.max(1, day), maxDay);
  return new Date(year, month1Based - 1, clamped, hour, minute, 0, 0).toISOString();
}

function getMonthPair(base: Date, deltaMonths: number): { year: number; month: number; key: string } {
  const d = new Date(base.getFullYear(), base.getMonth() + deltaMonths, 1);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  return {
    year,
    month,
    key: `${year}-${String(month).padStart(2, '0')}`,
  };
}

/**
 * Generates a realistic 6-month REKA backup JSON payload for testing all features in Expo Go (__DEV__ only).
 * Covers: IDR & USD accounts, Pockets (with and without goals), 10 expense + 4 income categories (Donut Chart),
 * 6-Month Trend data, Payday Cycle boundary dates (22nd–25th), Category Budgets, Same-Account Pocket Transfer,
 * Cross-Account Transfer, Partial Lent Receivable, and varied Payment Methods for History Filter testing.
 */
export function buildDevDummyBackupJson(): string {
  const now = new Date();
  const currentDay = now.getDate();

  const wallets: Wallet[] = [
    {
      id: 'w_dummy_bca',
      name: 'BCA Primary',
      type: 'Bank',
      balance: 18500000,
      currency: 'IDR',
      color: '#2563EB',
      accountNumber: '8820 4419',
      sortOrder: 0,
    },
    {
      id: 'w_dummy_gopay',
      name: 'GoPay',
      type: 'E-Wallet',
      balance: 1250000,
      currency: 'IDR',
      color: '#0D9488',
      accountNumber: '0812-3456-7890',
      sortOrder: 1,
    },
    {
      id: 'w_dummy_cash',
      name: 'Cash Wallet',
      type: 'Cash',
      balance: 650000,
      currency: 'IDR',
      color: '#D97706',
      accountNumber: '',
      sortOrder: 2,
    },
    {
      id: 'w_dummy_wise',
      name: 'Wise USD',
      type: 'Bank',
      balance: 1250.5,
      currency: 'USD',
      color: '#7C3AED',
      accountNumber: 'US-9921',
      sortOrder: 3,
    },
  ];

  // BCA allocated = 8M + 3.5M + 2M = 13.5M (unallocated Main Balance = 5.0M)
  const pockets: Pocket[] = [
    {
      id: 'p_dummy_emerg',
      walletId: 'w_dummy_bca',
      name: 'Emergency Fund',
      balance: 8000000,
      targetAmount: 15000000,
      icon: 'ShieldCheck',
      color: '#10B981',
    },
    {
      id: 'p_dummy_travel',
      walletId: 'w_dummy_bca',
      name: 'Japan Trip',
      balance: 3500000,
      targetAmount: 12000000,
      icon: 'Plane',
      color: '#EA580C',
    },
    {
      id: 'p_dummy_buffer',
      walletId: 'w_dummy_bca',
      name: 'Daily Buffer',
      balance: 2000000,
      targetAmount: 0, // Intentionally 0 so user can test adding a Target Goal in Edit Pocket mode
      icon: 'Briefcase',
      color: '#0284C7',
    },
    {
      id: 'p_dummy_usd_res',
      walletId: 'w_dummy_wise',
      name: 'USD Reserve',
      balance: 400,
      targetAmount: 1000,
      icon: 'PiggyBank',
      color: '#65A30D',
    },
  ];

  const categories: Category[] = [
    { id: 'cat_e_food', name: 'Food & Beverages', type: 'expense', icon: 'Utensils', color: '#CC785C', isDefault: true },
    { id: 'cat_e_snacks', name: 'Snacks', type: 'expense', icon: 'Cookie', color: '#CC785C', isDefault: true },
    { id: 'cat_e_shop', name: 'Shopping', type: 'expense', icon: 'ShoppingBag', color: '#CC785C', isDefault: true },
    { id: 'cat_e_bills', name: 'Bills & Utilities', type: 'expense', icon: 'Zap', color: '#CC785C', isDefault: true },
    { id: 'cat_e_subs', name: 'Subscriptions', type: 'expense', icon: 'Repeat', color: '#CC785C', isDefault: true },
    { id: 'cat_e_house', name: 'Housing / Rent', type: 'expense', icon: 'Home', color: '#CC785C', isDefault: true },
    { id: 'cat_e_inet', name: 'Internet & Phone', type: 'expense', icon: 'Wifi', color: '#CC785C', isDefault: true },
    { id: 'cat_e_fuel', name: 'Fuel', type: 'expense', icon: 'Fuel', color: '#CC785C', isDefault: true },
    { id: 'cat_e_park', name: 'Parking', type: 'expense', icon: 'ParkingCircle', color: '#CC785C', isDefault: true },
    { id: 'cat_e_health', name: 'Health & Medical', type: 'expense', icon: 'HeartPulse', color: '#CC785C', isDefault: true },
    { id: 'cat_e_ent', name: 'Entertainment', type: 'expense', icon: 'Film', color: '#CC785C', isDefault: true },
    { id: 'cat_e_fit', name: 'Fitness & Gym', type: 'expense', icon: 'Dumbbell', color: '#CC785C', isDefault: true },
    { id: 'cat_e_other', name: 'Others', type: 'expense', icon: 'CircleEllipsis', color: '#CC785C', isDefault: true },
    { id: 'cat_i_sal', name: 'Salary', type: 'income', icon: 'DollarSign', color: '#5DB8A6', isDefault: true },
    { id: 'cat_i_bon', name: 'Bonus', type: 'income', icon: 'Award', color: '#5DB8A6', isDefault: true },
    { id: 'cat_i_inv', name: 'Investments', type: 'income', icon: 'TrendingUp', color: '#5DB8A6', isDefault: true },
    { id: 'cat_i_int', name: 'Interest', type: 'income', icon: 'Percent', color: '#5DB8A6', isDefault: true },
    { id: 'cat_i_gift', name: 'Gift', type: 'income', icon: 'Gift', color: '#5DB8A6', isDefault: true },
    { id: 'cat_i_other', name: 'Others', type: 'income', icon: 'CircleEllipsis', color: '#5DB8A6', isDefault: true },
  ];

  const transactions: Transaction[] = [];
  let seq = 1;
  const pushTx = (
    tx: Omit<Transaction, 'id' | 'taxAmount' | 'discountAmount'> & {
      id?: string;
      taxAmount?: number;
      discountAmount?: number;
    }
  ) => {
    transactions.push({
      notes: '',
      imageUri: '',
      ...tx,
      id: tx.id || `tx_dummy_${seq++}`,
      taxAmount: tx.taxAmount ?? 0,
      discountAmount: tx.discountAmount ?? 0,
    });
  };

  // Seed 6 months of realistic cashflow (delta -5 .. 0) for TrendChart & MoM comparison
  const monthlyExpenseScale = [0.82, 0.94, 0.78, 1.05, 0.91, 1.0];
  for (let offset = -5; offset <= 0; offset += 1) {
    const { year, month } = getMonthPair(now, offset);
    const scale = monthlyExpenseScale[offset + 5];
    const safeDay = (d: number) => (offset === 0 ? Math.min(d, Math.max(1, currentDay)) : d);

    // Payday salary (placed on 23rd/24th in prior months to clearly demonstrate Payday Cycle shift!)
    const salaryDay = offset === 0 ? safeDay(2) : 24;
    pushTx({
      walletId: 'w_dummy_bca',
      pocketId: '',
      merchantName: 'Monthly Salary',
      category: 'Salary',
      type: 'income',
      amount: 12500000,
      currency: 'IDR',
      timestamp: makeLocalIso(year, month, salaryDay, 9, 0),
      paymentMethod: 'Bank Transfer',
      notes: 'Payroll transfer',
    });

    if (offset % 2 === 0) {
      pushTx({
        walletId: 'w_dummy_bca',
        pocketId: 'p_dummy_emerg',
        merchantName: 'Bank Interest & Cashback',
        category: 'Interest',
        type: 'income',
        amount: 185000,
        currency: 'IDR',
        timestamp: makeLocalIso(year, month, safeDay(12), 10, 15),
        paymentMethod: 'Bank Transfer',
        notes: 'Monthly savings yield',
      });
    }

    // Core recurring expenses across all 6 months
    pushTx({
      walletId: 'w_dummy_bca',
      pocketId: '',
      merchantName: 'Apartment Rent & IPL',
      category: 'Housing / Rent',
      type: 'expense',
      amount: 2400000,
      currency: 'IDR',
      timestamp: makeLocalIso(year, month, safeDay(4), 10, 0),
      paymentMethod: 'Bank Transfer',
      notes: 'Monthly rent',
    });

    pushTx({
      walletId: 'w_dummy_gopay',
      pocketId: '',
      merchantName: 'Supermarket & Groceries',
      category: 'Food & Beverages',
      type: 'expense',
      amount: Math.round(1150000 * scale),
      currency: 'IDR',
      timestamp: makeLocalIso(year, month, safeDay(8), 18, 20),
      paymentMethod: 'QRIS',
      notes: 'Weekly groceries',
    });

    pushTx({
      walletId: 'w_dummy_bca',
      pocketId: '',
      merchantName: 'PLN Electricity & Water',
      category: 'Bills & Utilities',
      type: 'expense',
      amount: Math.round(620000 * scale),
      currency: 'IDR',
      timestamp: makeLocalIso(year, month, safeDay(10), 14, 10),
      paymentMethod: 'Bank Transfer',
      notes: 'Monthly utility bill',
    });

    pushTx({
      walletId: 'w_dummy_bca',
      pocketId: 'p_dummy_buffer',
      merchantName: 'Uniqlo & Tokopedia',
      category: 'Shopping',
      type: 'expense',
      amount: Math.round(850000 * scale),
      currency: 'IDR',
      timestamp: makeLocalIso(year, month, safeDay(15), 20, 5),
      paymentMethod: 'Debit Card',
      notes: 'Apparel & household goods',
    });

    pushTx({
      walletId: 'w_dummy_cash',
      pocketId: '',
      merchantName: 'Pertamina Pertamax',
      category: 'Fuel',
      type: 'expense',
      amount: Math.round(380000 * scale),
      currency: 'IDR',
      timestamp: makeLocalIso(year, month, safeDay(17), 16, 40),
      paymentMethod: 'Cash',
      notes: 'Fuel refill',
    });

    // Previous month boundary test transactions (22nd, 23rd, 24th, 25th) for Payday Cycle verification
    if (offset === -1) {
      pushTx({
        walletId: 'w_dummy_gopay',
        pocketId: '',
        merchantName: 'Payday Eve Dinner (23rd)',
        category: 'Food & Beverages',
        type: 'expense',
        amount: 215000,
        currency: 'IDR',
        timestamp: makeLocalIso(year, month, 23, 19, 30),
        paymentMethod: 'QRIS',
        notes: 'Test transaction on day 23 (shifts into next cycle if 24th is Saturday)',
      });
      pushTx({
        walletId: 'w_dummy_bca',
        pocketId: '',
        merchantName: 'Payday Grocery Run (24th)',
        category: 'Shopping',
        type: 'expense',
        amount: 450000,
        currency: 'IDR',
        timestamp: makeLocalIso(year, month, 24, 15, 0),
        paymentMethod: 'Debit Card',
        notes: 'Test transaction on day 24',
      });
    }

    // USD activity across months
    pushTx({
      walletId: 'w_dummy_wise',
      pocketId: '',
      merchantName: 'Freelance Retainer',
      category: 'Salary',
      type: 'income',
      amount: 650,
      currency: 'USD',
      timestamp: makeLocalIso(year, month, safeDay(6), 11, 0),
      paymentMethod: 'Bank Transfer',
      notes: 'Remote client invoice',
    });

    pushTx({
      walletId: 'w_dummy_wise',
      pocketId: '',
      merchantName: 'Cloud & AI SaaS',
      category: 'Subscriptions',
      type: 'expense',
      amount: Number((48.5 * scale).toFixed(2)),
      currency: 'USD',
      timestamp: makeLocalIso(year, month, safeDay(11), 8, 30),
      paymentMethod: 'Debit Card',
      notes: 'Monthly software tools',
    });
  }

  // Extra distinct categories in current month so Donut Chart shows 10 clearly contrasted colors
  const curr = getMonthPair(now, 0);
  const dCurr = (d: number) => Math.min(d, Math.max(1, currentDay));

  pushTx({
    walletId: 'w_dummy_gopay',
    pocketId: '',
    merchantName: 'Spotify & Netflix Family',
    category: 'Subscriptions',
    type: 'expense',
    amount: 245000,
    currency: 'IDR',
    timestamp: makeLocalIso(curr.year, curr.month, dCurr(3), 9, 15),
    paymentMethod: 'E-Wallet',
    notes: 'Streaming bundles',
  });
  pushTx({
    walletId: 'w_dummy_bca',
    pocketId: '',
    merchantName: 'Biznet Fiber & Telkomsel',
    category: 'Internet & Phone',
    type: 'expense',
    amount: 425000,
    currency: 'IDR',
    timestamp: makeLocalIso(curr.year, curr.month, dCurr(5), 13, 0),
    paymentMethod: 'Bank Transfer',
    notes: 'Home Wi-Fi & mobile data',
  });
  pushTx({
    walletId: 'w_dummy_bca',
    pocketId: 'p_dummy_buffer',
    merchantName: 'Apotek & Dental Checkup',
    category: 'Health & Medical',
    type: 'expense',
    amount: 550000,
    currency: 'IDR',
    timestamp: makeLocalIso(curr.year, curr.month, dCurr(7), 15, 45),
    paymentMethod: 'Debit Card',
    notes: 'Routine checkup',
  });
  pushTx({
    walletId: 'w_dummy_gopay',
    pocketId: '',
    merchantName: 'XXI IMAX & Bowling',
    category: 'Entertainment',
    type: 'expense',
    amount: 310000,
    currency: 'IDR',
    timestamp: makeLocalIso(curr.year, curr.month, dCurr(9), 20, 30),
    paymentMethod: 'QRIS',
    notes: 'Weekend movie',
  });
  pushTx({
    walletId: 'w_dummy_cash',
    pocketId: '',
    merchantName: 'Kopi Kenangan & Pastry',
    category: 'Snacks',
    type: 'expense',
    amount: 145000,
    currency: 'IDR',
    timestamp: makeLocalIso(curr.year, curr.month, dCurr(11), 15, 10),
    paymentMethod: 'Cash',
    notes: 'Afternoon coffee',
  });
  pushTx({
    walletId: 'w_dummy_cash',
    pocketId: '',
    merchantName: 'Mall & Office Parking',
    category: 'Parking',
    type: 'expense',
    amount: 95000,
    currency: 'IDR',
    timestamp: makeLocalIso(curr.year, curr.month, dCurr(12), 18, 0),
    paymentMethod: 'Cash',
    notes: 'Weekly parking',
  });
  pushTx({
    walletId: 'w_dummy_bca',
    pocketId: '',
    merchantName: 'Fitness First Membership',
    category: 'Fitness & Gym',
    type: 'expense',
    amount: 650000,
    currency: 'IDR',
    timestamp: makeLocalIso(curr.year, curr.month, dCurr(13), 7, 30),
    paymentMethod: 'Debit Card',
    notes: 'Monthly gym pass',
  });

  // Extra income categories in current month for Income Donut Chart
  pushTx({
    walletId: 'w_dummy_bca',
    pocketId: '',
    merchantName: 'Quarterly Performance Bonus',
    category: 'Bonus',
    type: 'income',
    amount: 2000000,
    currency: 'IDR',
    timestamp: makeLocalIso(curr.year, curr.month, dCurr(6), 14, 0),
    paymentMethod: 'Bank Transfer',
    notes: 'Q4 KPI bonus',
  });
  pushTx({
    walletId: 'w_dummy_bca',
    pocketId: 'p_dummy_emerg',
    merchantName: 'Bibit Mutual Fund Dividend',
    category: 'Investments',
    type: 'income',
    amount: 420000,
    currency: 'IDR',
    timestamp: makeLocalIso(curr.year, curr.month, dCurr(10), 11, 20),
    paymentMethod: 'Bank Transfer',
    notes: 'Money market return',
  });

  // Same-Account Pocket-to-Pocket Transfer (BCA: Daily Buffer -> Japan Trip)
  const pocketTrTs = makeLocalIso(curr.year, curr.month, dCurr(14), 12, 0);
  pushTx({
    id: 'tx_dummy_tr_p_out',
    walletId: 'w_dummy_bca',
    pocketId: 'p_dummy_buffer',
    merchantName: 'BCA Primary: Daily Buffer to Japan Trip',
    category: 'Transfer',
    type: 'expense',
    amount: 500000,
    currency: 'IDR',
    timestamp: pocketTrTs,
    paymentMethod: 'Transfer',
    notes: 'Monthly Japan savings boost',
    transferPairId: 'tx_dummy_tr_p_in',
  });
  pushTx({
    id: 'tx_dummy_tr_p_in',
    walletId: 'w_dummy_bca',
    pocketId: 'p_dummy_travel',
    merchantName: 'BCA Primary: Daily Buffer to Japan Trip',
    category: 'Transfer',
    type: 'income',
    amount: 500000,
    currency: 'IDR',
    timestamp: pocketTrTs,
    paymentMethod: 'Transfer',
    notes: 'Monthly Japan savings boost',
    transferPairId: 'tx_dummy_tr_p_out',
  });

  // Cross-Account Transfer (BCA -> GoPay)
  const bankTrTs = makeLocalIso(curr.year, curr.month, dCurr(4), 16, 15);
  pushTx({
    id: 'tx_dummy_tr_w_out',
    walletId: 'w_dummy_bca',
    pocketId: '',
    merchantName: 'BCA Primary to GoPay',
    category: 'Transfer',
    type: 'expense',
    amount: 1000000,
    currency: 'IDR',
    timestamp: bankTrTs,
    paymentMethod: 'Transfer',
    notes: 'Top up e-wallet',
    transferPairId: 'tx_dummy_tr_w_in',
  });
  pushTx({
    id: 'tx_dummy_tr_w_in',
    walletId: 'w_dummy_gopay',
    pocketId: '',
    merchantName: 'BCA Primary to GoPay',
    category: 'Transfer',
    type: 'income',
    amount: 1000000,
    currency: 'IDR',
    timestamp: bankTrTs,
    paymentMethod: 'Transfer',
    notes: 'Top up e-wallet',
    transferPairId: 'tx_dummy_tr_w_out',
  });

  // Partial Lent Receivable + 1 Child Repayment
  pushTx({
    id: 'tx_dummy_lent_parent',
    walletId: 'w_dummy_gopay',
    pocketId: '',
    merchantName: 'Team Dinner Split',
    category: 'Food & Beverages',
    type: 'expense',
    amount: 400000,
    currency: 'IDR',
    timestamp: makeLocalIso(curr.year, curr.month, dCurr(8), 21, 0),
    paymentMethod: 'QRIS',
    notes: 'Paid upfront for Budi',
    isLent: true,
    lentTo: 'Budi',
    lentRepaidAmount: 150000,
    lentStatus: 'partial',
  });
  pushTx({
    id: 'tx_dummy_lent_repay_1',
    walletId: 'w_dummy_bca',
    pocketId: '',
    merchantName: 'Repayment from Budi',
    category: 'Others',
    type: 'income',
    amount: 150000,
    currency: 'IDR',
    timestamp: makeLocalIso(curr.year, curr.month, dCurr(13), 10, 30),
    paymentMethod: 'Bank Transfer',
    notes: 'First partial transfer',
    lentParentTxId: 'tx_dummy_lent_parent',
  });

  const prev = getMonthPair(now, -1);
  const sampleCatBudgetsIdr = {
    'Food & Beverages': 1500000,
    Shopping: 1000000,
    'Bills & Utilities': 800000,
    Fuel: 500000,
    Subscriptions: 300000,
  };
  const totalBudgetIdr = Object.values(sampleCatBudgetsIdr).reduce((a, b) => a + b, 0); // 4.100.000

  const payload: AppExportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: {
      defaults_seeded_v1: '1',
      usd_idr_rate: '16200',
      budget_cycle_day: '1',
      budget_cycle_weekend_adjust: '1',
      [`category_budgets_${curr.key}_IDR`]: JSON.stringify(sampleCatBudgetsIdr),
      [`monthly_budget_${curr.key}_IDR`]: String(totalBudgetIdr),
      [`category_budgets_${prev.key}_IDR`]: JSON.stringify(sampleCatBudgetsIdr),
      [`monthly_budget_${prev.key}_IDR`]: String(totalBudgetIdr),
    },
    wallets,
    pockets,
    categories,
    transactions,
    transactionItems: [],
  };

  return JSON.stringify(payload);
}
