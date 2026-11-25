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
 * Generates a rich 6-month REKA backup JSON payload for stress-testing all UI screens in Expo Go (__DEV__ only).
 * Covers:
 * - 5 IDR & USD accounts with balances up to Rp 2.48 Miliar+ and $124,850+
 * - 6 Pockets showcasing KPR, Safe Vault, Gold, Personal, and Tax icons with large goals
 * - 100+ total transactions, with BCA Primary holding 55+ transactions alone
 * - Wide range of amounts: micro (Rp 7.500) -> millions -> hundreds of millions -> billions (Rp 1.850.000.000)
 * - 6-Month Trend data, Payday Cycle boundary dates, Category Budgets, Same-Account & Cross-Account Transfers,
 *   and Partial Lent Receivable + Repayment.
 */
export function buildDevDummyBackupJson(): string {
  const now = new Date();
  const currentDay = now.getDate();

  const wallets: Wallet[] = [
    {
      id: 'w_dummy_bca',
      name: 'BCA Primary',
      type: 'Bank',
      balance: 2485750000, // Rp 2.485.750.000 (2.48 Miliar)
      currency: 'IDR',
      color: '#2563EB',
      accountNumber: '8820 4419',
      sortOrder: 0,
    },
    {
      id: 'w_dummy_mandiri',
      name: 'Mandiri Business',
      type: 'Bank',
      balance: 1120400000, // Rp 1.120.400.000 (1.12 Miliar)
      currency: 'IDR',
      color: '#1D4ED8',
      accountNumber: '1320 9901',
      sortOrder: 1,
    },
    {
      id: 'w_dummy_gopay',
      name: 'GoPay',
      type: 'E-Wallet',
      balance: 4850000,
      currency: 'IDR',
      color: '#0D9488',
      accountNumber: '0812-3456-7890',
      sortOrder: 2,
    },
    {
      id: 'w_dummy_cash',
      name: 'Cash Wallet',
      type: 'Cash',
      balance: 1425000,
      currency: 'IDR',
      color: '#D97706',
      accountNumber: '',
      sortOrder: 3,
    },
    {
      id: 'w_dummy_wise',
      name: 'Wise USD',
      type: 'Bank',
      balance: 124850.75,
      currency: 'USD',
      color: '#7C3AED',
      accountNumber: 'US-9921',
      sortOrder: 4,
    },
  ];

  // BCA allocated = 650M + 420M + 185M + 35M = 1.290M (unallocated Main Balance = 1.195.75M)
  const pockets: Pocket[] = [
    {
      id: 'p_dummy_kpr',
      walletId: 'w_dummy_bca',
      name: 'KPR Rumah',
      balance: 650000000,
      targetAmount: 1500000000,
      icon: 'mci:home-percent-outline',
      color: '#0EA5E9',
    },
    {
      id: 'p_dummy_emerg',
      walletId: 'w_dummy_bca',
      name: 'Dana Darurat',
      balance: 420000000,
      targetAmount: 500000000,
      icon: 'mci:safe-square-outline',
      color: '#10B981',
    },
    {
      id: 'p_dummy_gold',
      walletId: 'w_dummy_bca',
      name: 'Tabungan Emas',
      balance: 185000000,
      targetAmount: 250000000,
      icon: 'mci:gold',
      color: '#D97706',
    },
    {
      id: 'p_dummy_personal',
      walletId: 'w_dummy_bca',
      name: 'Personal Care',
      balance: 35000000,
      targetAmount: 0, // Intentionally 0 so user can test adding a Target Goal in Edit Pocket mode
      icon: 'mci:account-heart-outline',
      color: '#EC4899',
    },
    {
      id: 'p_dummy_tax',
      walletId: 'w_dummy_mandiri',
      name: 'Tax Reserve',
      balance: 320000000,
      targetAmount: 450000000,
      icon: 'mci:scale-balance',
      color: '#6366F1',
    },
    {
      id: 'p_dummy_usd_res',
      walletId: 'w_dummy_wise',
      name: 'USD Reserve',
      balance: 45000,
      targetAmount: 100000,
      icon: 'mci:safe-square-outline',
      color: '#65A30D',
    },
  ];

  const categories: Category[] = [
    // Expense (18 — exact 6x3 symmetrical grid)
    { id: 'cat_e_food', name: 'Food & Dining', type: 'expense', icon: 'Utensils', color: '#CC785C', isDefault: true },
    { id: 'cat_e_snacks', name: 'Coffee & Snacks', type: 'expense', icon: 'Coffee', color: '#D97706', isDefault: true },
    { id: 'cat_e_trans', name: 'Transport', type: 'expense', icon: 'Car', color: '#0284C7', isDefault: true },
    { id: 'cat_e_veh', name: 'Vehicle & Fuel', type: 'expense', icon: 'Fuel', color: '#EF4444', isDefault: true },
    { id: 'cat_e_shop', name: 'Shopping', type: 'expense', icon: 'ShoppingCart', color: '#EC4899', isDefault: true },
    { id: 'cat_e_house', name: 'Housing & KPR', type: 'expense', icon: 'mci:home-percent-outline', color: '#0EA5E9', isDefault: true },
    { id: 'cat_e_bills', name: 'Bills & Utilities', type: 'expense', icon: 'Zap', color: '#C64545', isDefault: true },
    { id: 'cat_e_subs', name: 'Subscriptions', type: 'expense', icon: 'Film', color: '#6366F1', isDefault: true },
    { id: 'cat_e_health', name: 'Health & Medical', type: 'expense', icon: 'HeartPulse', color: '#06B6D4', isDefault: true },
    { id: 'cat_e_fit', name: 'Fitness & Gym', type: 'expense', icon: 'Dumbbell', color: '#F97316', isDefault: true },
    { id: 'cat_e_personal', name: 'Personal', type: 'expense', icon: 'mci:account-heart-outline', color: '#A855F7', isDefault: true },
    { id: 'cat_e_family', name: 'Family', type: 'expense', icon: 'mci:human-male-female-child', color: '#E11D48', isDefault: true },
    { id: 'cat_e_charity', name: 'Charity & Gifts', type: 'expense', icon: 'mci:hand-heart-outline', color: '#14B8A6', isDefault: true },
    { id: 'cat_e_ent', name: 'Entertainment', type: 'expense', icon: 'Gamepad2', color: '#8B5CF6', isDefault: true },
    { id: 'cat_e_travel', name: 'Travel', type: 'expense', icon: 'Plane', color: '#F59E0B', isDefault: true },
    { id: 'cat_e_edu', name: 'Education', type: 'expense', icon: 'GraduationCap', color: '#3B82F6', isDefault: true },
    { id: 'cat_e_ins', name: 'Insurance & Tax', type: 'expense', icon: 'mci:scale-balance', color: '#10B981', isDefault: true },
    { id: 'cat_e_other', name: 'Others', type: 'expense', icon: 'CircleEllipsis', color: '#78716C', isDefault: true },
    // Income (8)
    { id: 'cat_i_sal', name: 'Salary', type: 'income', icon: 'DollarSign', color: '#059669', isDefault: true },
    { id: 'cat_i_biz', name: 'Freelance / Business', type: 'income', icon: 'Briefcase', color: '#0EA5E9', isDefault: true },
    { id: 'cat_i_bon', name: 'Bonus', type: 'income', icon: 'Award', color: '#F59E0B', isDefault: true },
    { id: 'cat_i_inv', name: 'Investments', type: 'income', icon: 'TrendingUp', color: '#0284C7', isDefault: true },
    { id: 'cat_i_int', name: 'Interest', type: 'income', icon: 'Percent', color: '#14B8A6', isDefault: true },
    { id: 'cat_i_allow', name: 'Allowance', type: 'income', icon: 'HandCoins', color: '#10B981', isDefault: true },
    { id: 'cat_i_gift', name: 'Gift', type: 'income', icon: 'Gift', color: '#EC4899', isDefault: true },
    { id: 'cat_i_other', name: 'Others', type: 'income', icon: 'CircleEllipsis', color: '#059669', isDefault: true },
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

  // Seed 6 months of rich cashflow (delta -5 .. 0) for TrendChart & MoM comparison
  // BCA Primary gets 7 recurring entries/month here (= 42) + 18+ extra stress-test entries below (= 60+ on BCA alone!)
  const monthlyExpenseScale = [0.85, 0.96, 0.82, 1.08, 0.92, 1.0];
  for (let offset = -5; offset <= 0; offset += 1) {
    const { year, month } = getMonthPair(now, offset);
    const scale = monthlyExpenseScale[offset + 5];
    const safeDay = (d: number) => (offset === 0 ? Math.min(d, Math.max(1, currentDay)) : d);

    // 1. BCA Monthly Executive Salary (Payday 24th in prior months)
    const salaryDay = offset === 0 ? safeDay(2) : 24;
    pushTx({
      walletId: 'w_dummy_bca',
      pocketId: '',
      merchantName: 'Monthly Executive Salary',
      category: 'Salary',
      type: 'income',
      amount: 42500000,
      currency: 'IDR',
      timestamp: makeLocalIso(year, month, salaryDay, 9, 0),
      paymentMethod: 'Bank Transfer',
      notes: 'Payroll transfer',
    });

    // 2. BCA Cicilan KPR Bulanan (tens of millions)
    pushTx({
      walletId: 'w_dummy_bca',
      pocketId: 'p_dummy_kpr',
      merchantName: 'Cicilan KPR BCA',
      category: 'Housing & KPR',
      type: 'expense',
      amount: 24750000,
      currency: 'IDR',
      timestamp: makeLocalIso(year, month, safeDay(4), 10, 0),
      paymentMethod: 'Bank Transfer',
      notes: 'Auto-debit KPR bulanan',
    });

    // 3. BCA Utilities
    pushTx({
      walletId: 'w_dummy_bca',
      pocketId: '',
      merchantName: 'PLN Electricity & PDAM Water',
      category: 'Bills & Utilities',
      type: 'expense',
      amount: Math.round(1850000 * scale),
      currency: 'IDR',
      timestamp: makeLocalIso(year, month, safeDay(6), 14, 10),
      paymentMethod: 'Bank Transfer',
      notes: 'Monthly home utilities',
    });

    // 4. BCA Shopping / E-commerce
    pushTx({
      walletId: 'w_dummy_bca',
      pocketId: '',
      merchantName: 'Tokopedia & Uniqlo Official',
      category: 'Shopping',
      type: 'expense',
      amount: Math.round(3450000 * scale),
      currency: 'IDR',
      timestamp: makeLocalIso(year, month, safeDay(9), 20, 5),
      paymentMethod: 'Debit Card',
      notes: 'Apparel & home essentials',
    });

    // 5. BCA Fine Dining / Groceries
    pushTx({
      walletId: 'w_dummy_bca',
      pocketId: '',
      merchantName: 'Ranch Market & Family Dinner',
      category: 'Food & Dining',
      type: 'expense',
      amount: Math.round(2150000 * scale),
      currency: 'IDR',
      timestamp: makeLocalIso(year, month, safeDay(12), 19, 15),
      paymentMethod: 'Debit Card',
      notes: 'Monthly groceries & dining',
    });

    // 6. BCA Personal Care
    pushTx({
      walletId: 'w_dummy_bca',
      pocketId: 'p_dummy_personal',
      merchantName: 'Skincare & Barbershop',
      category: 'Personal',
      type: 'expense',
      amount: Math.round(875000 * scale),
      currency: 'IDR',
      timestamp: makeLocalIso(year, month, safeDay(16), 16, 30),
      paymentMethod: 'QRIS',
      notes: 'Routine self-care',
    });

    // 7. BCA Bank Interest / Yield
    pushTx({
      walletId: 'w_dummy_bca',
      pocketId: 'p_dummy_emerg',
      merchantName: 'Deposito & Savings Yield',
      category: 'Interest',
      type: 'income',
      amount: Math.round(2850000 * scale),
      currency: 'IDR',
      timestamp: makeLocalIso(year, month, safeDay(20), 8, 15),
      paymentMethod: 'Bank Transfer',
      notes: 'Monthly yield credit',
    });

    // Mandiri Business monthly activity
    pushTx({
      walletId: 'w_dummy_mandiri',
      pocketId: '',
      merchantName: 'B2B Client Retainer Invoice',
      category: 'Investments',
      type: 'income',
      amount: Math.round(85000000 * scale),
      currency: 'IDR',
      timestamp: makeLocalIso(year, month, safeDay(7), 11, 0),
      paymentMethod: 'Bank Transfer',
      notes: 'Monthly corporate retainer',
    });

    pushTx({
      walletId: 'w_dummy_mandiri',
      pocketId: 'p_dummy_tax',
      merchantName: 'PPh & Operational Tax',
      category: 'Bills & Utilities',
      type: 'expense',
      amount: Math.round(14500000 * scale),
      currency: 'IDR',
      timestamp: makeLocalIso(year, month, safeDay(15), 13, 45),
      paymentMethod: 'Bank Transfer',
      notes: 'Monthly tax remittance',
    });

    // GoPay & Cash regular daily entries
    pushTx({
      walletId: 'w_dummy_gopay',
      pocketId: '',
      merchantName: 'Supermarket & GoFood',
      category: 'Food & Dining',
      type: 'expense',
      amount: Math.round(1150000 * scale),
      currency: 'IDR',
      timestamp: makeLocalIso(year, month, safeDay(8), 18, 20),
      paymentMethod: 'QRIS',
      notes: 'Weekly groceries & lunch',
    });

    pushTx({
      walletId: 'w_dummy_cash',
      pocketId: '',
      merchantName: 'Pertamina Pertamax Turbo',
      category: 'Vehicle & Fuel',
      type: 'expense',
      amount: Math.round(480000 * scale),
      currency: 'IDR',
      timestamp: makeLocalIso(year, month, safeDay(17), 16, 40),
      paymentMethod: 'Cash',
      notes: 'Full tank refill',
    });

    // Previous month boundary test transactions (23rd & 24th) for Payday Cycle verification
    if (offset === -1) {
      pushTx({
        walletId: 'w_dummy_gopay',
        pocketId: '',
        merchantName: 'Payday Eve Dinner (23rd)',
        category: 'Food & Dining',
        type: 'expense',
        amount: 215000,
        currency: 'IDR',
        timestamp: makeLocalIso(year, month, 23, 19, 30),
        paymentMethod: 'QRIS',
        notes: 'Test transaction on day 23',
      });
      pushTx({
        walletId: 'w_dummy_bca',
        pocketId: '',
        merchantName: 'Payday Grocery Run (24th)',
        category: 'Shopping',
        type: 'expense',
        amount: 650000,
        currency: 'IDR',
        timestamp: makeLocalIso(year, month, 24, 15, 0),
        paymentMethod: 'Debit Card',
        notes: 'Test transaction on day 24',
      });
    }

    // USD activity across months (varied scale)
    pushTx({
      walletId: 'w_dummy_wise',
      pocketId: '',
      merchantName: 'US Consulting Retainer',
      category: 'Salary',
      type: 'income',
      amount: 4500,
      currency: 'USD',
      timestamp: makeLocalIso(year, month, safeDay(6), 11, 0),
      paymentMethod: 'Bank Transfer',
      notes: 'Remote advisory invoice',
    });

    pushTx({
      walletId: 'w_dummy_wise',
      pocketId: '',
      merchantName: 'Cloud & AI SaaS Suite',
      category: 'Subscriptions',
      type: 'expense',
      amount: Number((149.99 * scale).toFixed(2)),
      currency: 'USD',
      timestamp: makeLocalIso(year, month, safeDay(11), 8, 30),
      paymentMethod: 'Debit Card',
      notes: 'Monthly cloud & dev tools',
    });
  }

  // =========================================================================
  // BILLION-SCALE (MILIAR) & HIGH-VALUE STRESS-TEST TRANSACTIONS
  // =========================================================================
  const curr = getMonthPair(now, 0);
  const m1 = getMonthPair(now, -1);
  const m2 = getMonthPair(now, -2);
  const m3 = getMonthPair(now, -3);
  const dCurr = (d: number) => Math.min(d, Math.max(1, currentDay));

  // Rp 1.850.000.000 (1.85 Miliar) — Property Sale Settlement on BCA Primary (2 months ago)
  pushTx({
    walletId: 'w_dummy_bca',
    pocketId: '',
    merchantName: 'Penjualan Ruko BSD City',
    category: 'Investments',
    type: 'income',
    amount: 1850000000,
    currency: 'IDR',
    timestamp: makeLocalIso(m2.year, m2.month, 14, 11, 0),
    paymentMethod: 'Bank Transfer',
    notes: 'Pelunasan AJB Notaris (1.85 Miliar)',
  });

  // Rp 1.250.000.000 (1.25 Miliar) — DP & Pelunasan Rumah Baru on BCA Primary (2 months ago)
  pushTx({
    walletId: 'w_dummy_bca',
    pocketId: 'p_dummy_kpr',
    merchantName: 'DP & Akad KPR Rumah Baru',
    category: 'Housing & KPR',
    type: 'expense',
    amount: 1250000000,
    currency: 'IDR',
    timestamp: makeLocalIso(m2.year, m2.month, 18, 14, 30),
    paymentMethod: 'Bank Transfer',
    notes: 'Down payment properti utama (1.25 Miliar)',
  });

  // Rp 1.150.000.000 (1.15 Miliar) — Enterprise Annual Contract on Mandiri Business (current month)
  pushTx({
    walletId: 'w_dummy_mandiri',
    pocketId: '',
    merchantName: 'PT Nusantara Enterprise Deal',
    category: 'Investments',
    type: 'income',
    amount: 1150000000,
    currency: 'IDR',
    timestamp: makeLocalIso(curr.year, curr.month, dCurr(3), 10, 15),
    paymentMethod: 'Bank Transfer',
    notes: 'Annual enterprise milestone (1.15 Miliar)',
  });

  // Rp 1.025.000.000 (1.025 Miliar) — Commercial Land Purchase on BCA Primary (current month)
  pushTx({
    walletId: 'w_dummy_bca',
    pocketId: 'p_dummy_kpr',
    merchantName: 'Pelunasan Kavling Komersial',
    category: 'Housing & KPR',
    type: 'expense',
    amount: 1025000000,
    currency: 'IDR',
    timestamp: makeLocalIso(curr.year, curr.month, dCurr(5), 13, 20),
    paymentMethod: 'Bank Transfer',
    notes: 'Investasi tanah komersial (1.025 Miliar)',
  });

  // Hundreds of millions (Ratusan Juta)
  pushTx({
    walletId: 'w_dummy_bca',
    pocketId: 'p_dummy_emerg',
    merchantName: 'Dividen Saham BBCA & SBN',
    category: 'Investments',
    type: 'income',
    amount: 350000000,
    currency: 'IDR',
    timestamp: makeLocalIso(curr.year, curr.month, dCurr(4), 9, 45),
    paymentMethod: 'Bank Transfer',
    notes: 'Dividen tahunan & kupon obligasi',
  });
  pushTx({
    walletId: 'w_dummy_bca',
    pocketId: 'p_dummy_gold',
    merchantName: 'Beli Emas Antam 100gr',
    category: 'Others',
    type: 'expense',
    amount: 168500000,
    currency: 'IDR',
    timestamp: makeLocalIso(m1.year, m1.month, 12, 11, 20),
    paymentMethod: 'Bank Transfer',
    notes: 'Logam mulia Antam certicard',
  });
  pushTx({
    walletId: 'w_dummy_bca',
    pocketId: '',
    merchantName: 'Renovasi Interior & Kitchen Set',
    category: 'Housing & KPR',
    type: 'expense',
    amount: 185000000,
    currency: 'IDR',
    timestamp: makeLocalIso(m3.year, m3.month, 21, 15, 10),
    paymentMethod: 'Bank Transfer',
    notes: 'Kontraktor interior tahap akhir',
  });
  pushTx({
    walletId: 'w_dummy_mandiri',
    pocketId: '',
    merchantName: 'DP Mobil Keluarga Hybrid',
    category: 'Shopping',
    type: 'expense',
    amount: 128500000,
    currency: 'IDR',
    timestamp: makeLocalIso(m1.year, m1.month, 19, 14, 0),
    paymentMethod: 'Bank Transfer',
    notes: 'Dealer resmi Toyota',
  });

  // Big USD milestone ($38,500) + micro USD ($9.99)
  pushTx({
    walletId: 'w_dummy_wise',
    pocketId: 'p_dummy_usd_res',
    merchantName: 'US Series-A Advisory Exit',
    category: 'Bonus',
    type: 'income',
    amount: 38500,
    currency: 'USD',
    timestamp: makeLocalIso(curr.year, curr.month, dCurr(6), 16, 0),
    paymentMethod: 'Bank Transfer',
    notes: 'Advisory equity payout',
  });
  pushTx({
    walletId: 'w_dummy_wise',
    pocketId: '',
    merchantName: 'Apple iCloud+ 2TB',
    category: 'Subscriptions',
    type: 'expense',
    amount: 9.99,
    currency: 'USD',
    timestamp: makeLocalIso(curr.year, curr.month, dCurr(7), 7, 15),
    paymentMethod: 'Debit Card',
    notes: 'Cloud backup',
  });

  // =========================================================================
  // EXTRA VARIED TRANSACTIONS ON BCA PRIMARY (pushes BCA Primary to 55+ tx!)
  // Ranges from Rp 7.500 (micro) up to Rp 45.000.000 (tens of millions)
  // =========================================================================
  const bcaExtraSeed: {
    merchantName: string;
    category: string;
    type: 'expense' | 'income';
    amount: number;
    day: number;
    hour: number;
    minute: number;
    method: string;
    pocketId?: string;
    notes?: string;
    monthTarget?: { year: number; month: number };
  }[] = [
    { merchantName: 'Parkir Indomaret', category: 'Vehicle & Fuel', type: 'expense', amount: 7500, day: 1, hour: 8, minute: 45, method: 'QRIS', notes: 'Parkir singkat' },
    { merchantName: 'Es Kopi Susu Tetangga', category: 'Coffee & Snacks', type: 'expense', amount: 24000, day: 1, hour: 15, minute: 10, method: 'QRIS', notes: 'Afternoon coffee' },
    { merchantName: 'GoCar Bandara & KRL', category: 'Transport', type: 'expense', amount: 145000, day: 2, hour: 17, minute: 30, method: 'QRIS', notes: 'Commute & airport ride' },
    { merchantName: 'Bakmi GM Lunch', category: 'Food & Dining', type: 'expense', amount: 89000, day: 2, hour: 12, minute: 20, method: 'QRIS', notes: 'Quick lunch' },
    { merchantName: 'Spotify & YouTube Premium', category: 'Subscriptions', type: 'expense', amount: 158000, day: 3, hour: 9, minute: 15, method: 'Debit Card', notes: 'Family bundle' },
    { merchantName: 'Biznet Fiber 250Mbps', category: 'Bills & Utilities', type: 'expense', amount: 575000, day: 4, hour: 13, minute: 0, method: 'Bank Transfer', notes: 'Home internet' },
    { merchantName: 'Apotek Guardian & Vitamin', category: 'Health & Medical', type: 'expense', amount: 342500, day: 5, hour: 16, minute: 25, method: 'Debit Card', notes: 'Supplements' },
    { merchantName: 'Fitness First Platinum', category: 'Fitness & Gym', type: 'expense', amount: 980000, day: 6, hour: 7, minute: 30, method: 'Debit Card', notes: 'Monthly membership' },
    { merchantName: 'Sushi Tei Weekend Dinner', category: 'Food & Dining', type: 'expense', amount: 645000, day: 7, hour: 19, minute: 45, method: 'Debit Card', notes: 'Family dinner' },
    { merchantName: 'Dental Scaling & Checkup', category: 'Health & Medical', type: 'expense', amount: 1250000, day: 8, hour: 11, minute: 0, method: 'Debit Card', pocketId: 'p_dummy_personal', notes: '6-month checkup' },
    { merchantName: 'Garuda Indonesia JKT-DPS', category: 'Travel', type: 'expense', amount: 4850000, day: 9, hour: 14, minute: 50, method: 'Bank Transfer', notes: 'Round-trip Bali tickets' },
    { merchantName: 'The Mulia Resort Bali', category: 'Travel', type: 'expense', amount: 14200000, day: 10, hour: 15, minute: 10, method: 'Debit Card', notes: '3 nights family staycation' },
    { merchantName: 'MacBook Pro M4 Upgrade', category: 'Shopping', type: 'expense', amount: 32999000, day: 11, hour: 18, minute: 0, method: 'Bank Transfer', notes: 'iBox official store' },
    { merchantName: 'Quarterly Performance Bonus', category: 'Bonus', type: 'income', amount: 28500000, day: 11, hour: 10, minute: 0, method: 'Bank Transfer', notes: 'KPI achievement bonus' },
    { merchantName: 'XXI IMAX & Popcorn', category: 'Entertainment', type: 'expense', amount: 285000, day: 12, hour: 20, minute: 15, method: 'QRIS', notes: 'Movie night' },
    { merchantName: 'Starbucks Reserve', category: 'Coffee & Snacks', type: 'expense', amount: 118000, day: 13, hour: 14, minute: 5, method: 'QRIS', notes: 'Client catchup' },
    { merchantName: 'Servis Berkala Mobil', category: 'Vehicle & Fuel', type: 'expense', amount: 3650000, day: 14, hour: 10, minute: 40, method: 'Debit Card', notes: 'Ganti oli & rem' },
    { merchantName: 'Nafkah & Belanja Istri', category: 'Family', type: 'expense', amount: 15000000, day: 15, hour: 13, minute: 15, method: 'Bank Transfer', notes: 'Transfer bulanan keluarga' },
    { merchantName: 'Cashback Kartu Kredit', category: 'Gift', type: 'income', amount: 475000, day: 16, hour: 9, minute: 0, method: 'Bank Transfer', notes: 'Monthly statement rebate' },
    { merchantName: 'Laundry & Dry Clean', category: 'Personal', type: 'expense', amount: 195000, day: 17, hour: 17, minute: 0, method: 'QRIS', pocketId: 'p_dummy_personal', notes: 'Suits & bedding' },
    { merchantName: 'Telkomsel Halo Pascabayar', category: 'Bills & Utilities', type: 'expense', amount: 265000, day: 18, hour: 12, minute: 0, method: 'Bank Transfer', notes: 'Mobile plan' },
    { merchantName: 'Beli Kursi Ergonomis Kerja', category: 'Shopping', type: 'expense', amount: 8750000, day: 19, hour: 16, minute: 15, method: 'Bank Transfer', notes: 'Home office upgrade' },
    { merchantName: 'Bibit Obligasi Kupon', category: 'Investments', type: 'income', amount: 6250000, day: 20, hour: 8, minute: 30, method: 'Bank Transfer', pocketId: 'p_dummy_emerg', notes: 'FR bond coupon' },
    { merchantName: 'Martabak Pecenongan', category: 'Coffee & Snacks', type: 'expense', amount: 92000, day: 21, hour: 21, minute: 0, method: 'QRIS', notes: 'Late night treat' },
    { merchantName: 'Asuransi Kesehatan Tahunan', category: 'Insurance & Tax', type: 'expense', amount: 18400000, day: 22, hour: 10, minute: 10, method: 'Bank Transfer', notes: 'Allianz family policy', monthTarget: m1 },
    { merchantName: 'Zakat & Donasi Pendidikan', category: 'Charity & Gifts', type: 'expense', amount: 7500000, day: 15, hour: 11, minute: 30, method: 'Bank Transfer', notes: 'Beasiswa anak yatim', monthTarget: m1 },
  ];

  for (const item of bcaExtraSeed) {
    const targetM = item.monthTarget || curr;
    const dayVal = item.monthTarget ? item.day : dCurr(item.day);
    pushTx({
      walletId: 'w_dummy_bca',
      pocketId: item.pocketId || '',
      merchantName: item.merchantName,
      category: item.category,
      type: item.type,
      amount: item.amount,
      currency: 'IDR',
      timestamp: makeLocalIso(targetM.year, targetM.month, dayVal, item.hour, item.minute),
      paymentMethod: item.method,
      notes: item.notes || '',
    });
  }

  // Extra GoPay & Cash micro-to-medium entries in current month
  pushTx({
    walletId: 'w_dummy_gopay',
    pocketId: '',
    merchantName: 'Kopi Kenangan & Croissant',
    category: 'Coffee & Snacks',
    type: 'expense',
    amount: 64500,
    currency: 'IDR',
    timestamp: makeLocalIso(curr.year, curr.month, dCurr(11), 15, 10),
    paymentMethod: 'QRIS',
    notes: 'Afternoon snack',
  });
  pushTx({
    walletId: 'w_dummy_cash',
    pocketId: '',
    merchantName: 'Parkir Mall & Tips',
    category: 'Vehicle & Fuel',
    type: 'expense',
    amount: 15000,
    currency: 'IDR',
    timestamp: makeLocalIso(curr.year, curr.month, dCurr(12), 18, 0),
    paymentMethod: 'Cash',
    notes: 'Parkir',
  });

  // Same-Account Pocket-to-Pocket Transfer (BCA: Personal Care -> Tabungan Emas)
  const pocketTrTs = makeLocalIso(curr.year, curr.month, dCurr(14), 12, 0);
  pushTx({
    id: 'tx_dummy_tr_p_out',
    walletId: 'w_dummy_bca',
    pocketId: 'p_dummy_personal',
    merchantName: 'BCA Primary: Personal Care to Tabungan Emas',
    category: 'Transfer',
    type: 'expense',
    amount: 5000000,
    currency: 'IDR',
    timestamp: pocketTrTs,
    paymentMethod: 'Transfer',
    notes: 'Alokasi tambahan tabungan emas',
    transferPairId: 'tx_dummy_tr_p_in',
  });
  pushTx({
    id: 'tx_dummy_tr_p_in',
    walletId: 'w_dummy_bca',
    pocketId: 'p_dummy_gold',
    merchantName: 'BCA Primary: Personal Care to Tabungan Emas',
    category: 'Transfer',
    type: 'income',
    amount: 5000000,
    currency: 'IDR',
    timestamp: pocketTrTs,
    paymentMethod: 'Transfer',
    notes: 'Alokasi tambahan tabungan emas',
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
    amount: 3500000,
    currency: 'IDR',
    timestamp: bankTrTs,
    paymentMethod: 'Transfer',
    notes: 'Top up e-wallet bulanan',
    transferPairId: 'tx_dummy_tr_w_in',
  });
  pushTx({
    id: 'tx_dummy_tr_w_in',
    walletId: 'w_dummy_gopay',
    pocketId: '',
    merchantName: 'BCA Primary to GoPay',
    category: 'Transfer',
    type: 'income',
    amount: 3500000,
    currency: 'IDR',
    timestamp: bankTrTs,
    paymentMethod: 'Transfer',
    notes: 'Top up e-wallet bulanan',
    transferPairId: 'tx_dummy_tr_w_out',
  });

  // Partial Lent Receivable + 1 Child Repayment
  pushTx({
    id: 'tx_dummy_lent_parent',
    walletId: 'w_dummy_gopay',
    pocketId: '',
    merchantName: 'Team Dinner Split',
    category: 'Food & Dining',
    type: 'expense',
    amount: 1450000,
    currency: 'IDR',
    timestamp: makeLocalIso(curr.year, curr.month, dCurr(8), 21, 0),
    paymentMethod: 'QRIS',
    notes: 'Talangan makan malam tim (Budi)',
    isLent: true,
    lentTo: 'Budi',
    lentRepaidAmount: 550000,
    lentStatus: 'partial',
  });
  pushTx({
    id: 'tx_dummy_lent_repay_1',
    walletId: 'w_dummy_bca',
    pocketId: '',
    merchantName: 'Repayment from Budi',
    category: 'Others',
    type: 'income',
    amount: 550000,
    currency: 'IDR',
    timestamp: makeLocalIso(curr.year, curr.month, dCurr(13), 10, 30),
    paymentMethod: 'Bank Transfer',
    notes: 'Cicilan pertama talangan dinner',
    lentParentTxId: 'tx_dummy_lent_parent',
  });

  const prev = getMonthPair(now, -1);
  const sampleCatBudgetsIdr = {
    'Housing & KPR': 30000000,
    'Food & Dining': 5000000,
    Family: 15000000,
    Shopping: 10000000,
    'Bills & Utilities': 3500000,
    Personal: 3000000,
    Travel: 15000000,
    'Vehicle & Fuel': 4500000,
    Subscriptions: 500000,
  };
  const totalBudgetIdr = Object.values(sampleCatBudgetsIdr).reduce((a, b) => a + b, 0);

  const sampleAllocationPlansIdr = [
    {
      id: 'plan_dummy_salary',
      title: 'Monthly Cashflow Plan',
      currency: 'IDR',
      items: [
        { id: 'pi_1', label: 'Cicilan KPR Rumah', amount: 24750000 },
        { id: 'pi_2', label: 'Dana Darurat & SBN', amount: 12000000 },
        { id: 'pi_3', label: 'Tabungan Emas', amount: 5000000 },
        { id: 'pi_4', label: 'Personal & Lifestyle', amount: 3500000 },
      ],
      createdAt: new Date().toISOString(),
    },
    {
      id: 'plan_dummy_property',
      title: 'Property & Reserve Allocation',
      currency: 'IDR',
      items: [
        { id: 'pi_5', label: 'Pelunasan Properti', amount: 1250000000 },
        { id: 'pi_6', label: 'Dana Cadangan Renovasi', amount: 250000000 },
      ],
      createdAt: new Date().toISOString(),
    },
  ];

  const payload: AppExportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: {
      defaults_seeded_v1: '1',
      categories_v2_migrated: '1',
      usd_idr_rate: '16200',
      budget_cycle_day: '1',
      budget_cycle_weekend_adjust: '1',
      allocation_plans_IDR: JSON.stringify(sampleAllocationPlansIdr),
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
