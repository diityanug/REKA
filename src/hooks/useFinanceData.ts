import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Wallet,
  Pocket,
  Transaction,
  Category,
  AllocationPlan,
  CurrencyType,
  AccountType,
  TransactionType,
} from '../types';
import {
  getWallets,
  getPockets,
  getTransactions,
  getCategories,
  createWallet,
  updateWalletName,
  updateWalletsOrder,
  adjustWalletBalance,
  deleteWallet,
  createPocket,
  updatePocketName,
  adjustPocketBalance,
  setPocketBalanceDirect,
  applyAllocationPlanToWallet,
  deletePocket,
  createCategory,
  deleteCategory,
  deleteTransaction,
  deleteTransactionsBatch,
  recordLentRepayment,
  getLentRepayments,
  RecordLentRepaymentParams,
  transferFunds,
  updateTransferFunds,
  UpdateTransferFundsParams,
  getMonthlyBudget,
  setMonthlyBudget,
  getAllocationPlans,
  saveAllocationPlans,
  exportAllData,
  exportTransactionsCSV,
  importAllData,
  wipeAllData,
  hasPreRestoreSnapshot,
  restorePreRestoreSnapshot,
  setSetting,
  InsufficientFundsError,
} from '../services/database';
import { AppHaptics } from '../utils/haptics';
import { parseAmount, formatCurrency } from '../utils/formatters';
import { toUserFriendlyErrorMessage } from '../utils/errorHandling';
import { getUniqueEntityColor } from '../utils/colors';
import { useCurrentDate } from './useCurrentDate';
import { getLiveExchangeRate, ExchangeRateResult } from '../services/currencyService';
import {
  getLockSettings,
  checkBiometricCapabilities,
  setLockEnabled,
  setBiometricsEnabled,
  LockSettings,
  BiometricCapabilities,
} from '../services/authService';
import { generateAndShareStatementPdf } from '../services/statementPdfGenerator';

interface UseFinanceDataProps {
  showAlert: (
    title: string,
    message?: string,
    buttons?: any[],
    type?: 'info' | 'warning' | 'error' | 'success' | 'confirm'
  ) => void;
}

const SEMANTIC_CATEGORY_ICON_FALLBACKS: Record<string, string> = {
  // Shopping & Retail
  shopping: 'ShoppingCart',
  belanja: 'ShoppingCart',
  groceries: 'ShoppingCart',
  grocery: 'ShoppingCart',
  supermarket: 'ShoppingCart',
  minimarket: 'ShoppingCart',
  retail: 'ShoppingCart',
  mall: 'ShoppingCart',
  ecommerce: 'ShoppingCart',
  marketplace: 'ShoppingCart',
  toko: 'ShoppingCart',

  // Snacks & Camilan
  snacks: 'Cookie',
  snack: 'Cookie',
  camilan: 'Cookie',
  dessert: 'Cookie',
  bakery: 'Cookie',
  pastry: 'Cookie',
  roti: 'Cookie',
  kue: 'Cookie',

  // Coffee & Drinks
  coffee: 'Coffee',
  cafe: 'Coffee',
  kopi: 'Coffee',
  tea: 'Coffee',
  teh: 'Coffee',
  bar: 'Beer',

  // Food & Dining
  'food & beverages': 'Utensils',
  food: 'Utensils',
  makanan: 'Utensils',
  beverages: 'Utensils',
  minuman: 'Utensils',
  dining: 'Utensils',
  restaurant: 'Utensils',
  resto: 'Utensils',
  lunch: 'Utensils',
  dinner: 'Utensils',
  breakfast: 'Utensils',
  sarapan: 'Utensils',

  // Utilities & Bills
  'bills & utilities': 'Zap',
  bills: 'Zap',
  utilities: 'Zap',
  tagihan: 'Zap',
  listrik: 'Zap',
  electricity: 'Zap',
  water: 'Droplet',
  air: 'Droplet',
  pdam: 'Droplet',

  // Subscriptions & Entertainment
  subscriptions: 'Film',
  subscription: 'Film',
  langganan: 'Film',
  entertainment: 'Film',
  streaming: 'Film',
  hiburan: 'Film',
  movie: 'Film',
  cinema: 'Film',
  bioskop: 'Film',
  netflix: 'Film',
  spotify: 'Music2',
  music: 'Music2',
  musik: 'Music2',
  game: 'Gamepad2',
  gaming: 'Gamepad2',

  // Transport & Travel
  fuel: 'Fuel',
  bensin: 'Fuel',
  gas: 'Fuel',
  spbu: 'Fuel',
  pertamina: 'Fuel',
  shell: 'Fuel',
  parking: 'CircleParking',
  parkir: 'CircleParking',
  transport: 'Car',
  transportation: 'Car',
  taxi: 'Car',
  taksi: 'Car',
  ojol: 'Car',
  grab: 'Car',
  gojek: 'Car',
  travel: 'Plane',
  flight: 'Plane',
  pesawat: 'Plane',
  train: 'Bus',
  kereta: 'Bus',

  // Housing
  'housing / rent': 'Home',
  housing: 'Home',
  rent: 'Home',
  sewa: 'Home',
  kost: 'Home',
  kontrakan: 'Home',

  // Health
  'health & medical': 'HeartPulse',
  health: 'HeartPulse',
  medical: 'HeartPulse',
  kesehatan: 'HeartPulse',
  pharmacy: 'Pill',
  apotek: 'Pill',
  doctor: 'Stethoscope',
  dokter: 'Stethoscope',
  rumahsakit: 'HeartPulse',
  hospital: 'HeartPulse',

  // Fitness
  'fitness & gym': 'Dumbbell',
  fitness: 'Dumbbell',
  gym: 'Dumbbell',
  olahraga: 'Dumbbell',
  sports: 'Dumbbell',

  // Income
  salary: 'DollarSign',
  gaji: 'DollarSign',
  wage: 'DollarSign',
  income: 'DollarSign',
  pendapatan: 'DollarSign',
  allowance: 'HandCoins',
  uangsaku: 'HandCoins',
  investments: 'TrendingUp',
  investment: 'TrendingUp',
  investasi: 'TrendingUp',
  interest: 'Percent',
  bunga: 'Percent',
  bonus: 'Award',
  gift: 'Gift',
  hadiah: 'Gift',

  // Others
  transfer: 'ArrowLeftRight',
  others: 'CircleEllipsis',
  lainnya: 'CircleEllipsis',
  general: 'Tag',
  umum: 'Tag',
};

export function useFinanceData({ showAlert }: UseFinanceDataProps) {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [pockets, setPockets] = useState<Pocket[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allocationPlansMap, setAllocationPlansMap] = useState<Record<CurrencyType, AllocationPlan[]>>({
    IDR: [],
    USD: [],
  });
  const [monthlyBudgetsMap, setMonthlyBudgetsMap] = useState<Record<CurrencyType, number>>({
    IDR: 0,
    USD: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [initialAppReady, setInitialAppReady] = useState<boolean>(false);
  const [activeCurrency, setActiveCurrency] = useState<CurrencyType>('IDR');

  // Unified Month State across Overview & Analytics (updates live on month rollover)
  const { currentMonthKey } = useCurrentDate();
  const [selectedMonth, setSelectedMonth] = useState<string>(() => currentMonthKey);
  const prevMonthKeyRef = useRef<string>(currentMonthKey);

  useEffect(() => {
    if (prevMonthKeyRef.current !== currentMonthKey) {
      const prevKey = prevMonthKeyRef.current;
      prevMonthKeyRef.current = currentMonthKey;
      setSelectedMonth((curr) => (curr === prevKey ? currentMonthKey : curr));
    }
  }, [currentMonthKey]);

  // Budgets always belong to exactly one calendar month (never "all")
  const budgetMonthKey = useMemo(
    () => (selectedMonth === 'all' ? currentMonthKey : selectedMonth),
    [selectedMonth, currentMonthKey]
  );

  // Live exchange rate & status info for cross-currency transfers & analytics
  const [exchangeRate, setExchangeRate] = useState<number>(16000);
  const [exchangeRateInfo, setExchangeRateInfo] = useState<ExchangeRateResult>({
    rate: 16000,
    lastUpdated: '',
    isLive: false,
    fromCache: true,
  });

  // App Lock & Biometrics security settings
  const [lockSettings, setLockSettings] = useState<LockSettings>({
    isLockEnabled: false,
    isBiometricsEnabled: true,
    hasPin: false,
  });
  const [biometricCaps, setBiometricCaps] = useState<BiometricCapabilities>({
    hasHardware: false,
    isEnrolled: false,
    biometricType: 'None',
  });

  // Unified allocation plans across both IDR and USD
  const allocationPlans = useMemo(() => {
    const idr = (allocationPlansMap.IDR || []).map((p) => ({
      ...p,
      currency: (p.currency || 'IDR') as CurrencyType,
    }));
    const usd = (allocationPlansMap.USD || []).map((p) => ({
      ...p,
      currency: (p.currency || 'USD') as CurrencyType,
    }));
    return [...idr, ...usd];
  }, [allocationPlansMap]);

  const monthlyBudget = useMemo(() => {
    return monthlyBudgetsMap[activeCurrency] || 0;
  }, [monthlyBudgetsMap, activeCurrency]);

  // Load database state (pre-populating both currencies for instant switching)
  const loadData = useCallback(async () => {
    try {
      const [
        wList,
        pList,
        txList,
        catList,
        idrBudget,
        usdBudget,
        idrPlans,
        usdPlans,
      ] = await Promise.all([
        getWallets(),
        getPockets(),
        getTransactions(),
        getCategories(),
        getMonthlyBudget('IDR', budgetMonthKey),
        getMonthlyBudget('USD', budgetMonthKey),
        getAllocationPlans('IDR'),
        getAllocationPlans('USD'),
      ]);
      setWallets(wList);
      setPockets(pList);
      setTransactions(txList);
      setCategories(catList);
      setMonthlyBudgetsMap({ IDR: idrBudget, USD: usdBudget });
      setAllocationPlansMap({ IDR: idrPlans, USD: usdPlans });

      // Load cached exchange rate first for instant render, then refresh in background
      const rateResult = await getLiveExchangeRate(false);
      if (rateResult.rate > 0) {
        setExchangeRate(rateResult.rate);
        setExchangeRateInfo(rateResult);
      }

      // Load app lock security settings and biometric hardware capabilities
      const [fetchedLockSettings, fetchedBioCaps] = await Promise.all([
        getLockSettings(),
        checkBiometricCapabilities(),
      ]);
      setLockSettings(fetchedLockSettings);
      setBiometricCaps(fetchedBioCaps);
    } catch (err: any) {
      showAlert('Storage Notice', toUserFriendlyErrorMessage(err, 'database'), undefined, 'error');
    } finally {
      setLoading(false);
      setInitialAppReady(true);
    }
  }, [budgetMonthKey, showAlert]);

  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      loadData();
    } else {
      // Month changed: reload budgets for IDR & USD without touching wallets or tx
      Promise.all([
        getMonthlyBudget('IDR', budgetMonthKey),
        getMonthlyBudget('USD', budgetMonthKey),
      ])
        .then(([idrB, usdB]) => {
          setMonthlyBudgetsMap({ IDR: idrB, USD: usdB });
        })
        .catch((err) => console.warn('Failed to update month budgets:', err));
    }
  }, [budgetMonthKey, loadData]);

  // Active currency wallets & total balance
  const currencyWallets = useMemo(() => {
    return wallets.filter((w) => w.currency === activeCurrency);
  }, [wallets, activeCurrency]);

  const totalBalance = useMemo(() => {
    return currencyWallets.reduce((acc, w) => acc + w.balance, 0);
  }, [currencyWallets]);

  // Outstanding lent money summary (unsettled or partial receivables across all dates)
  const outstandingLentSummary = useMemo(() => {
    const lentTxs = transactions.filter(
      (tx) =>
        tx.isLent &&
        tx.type === 'expense' &&
        tx.currency === activeCurrency &&
        tx.lentStatus !== 'settled'
    );
    const totalOutstanding = lentTxs.reduce((acc, tx) => {
      const repaid = tx.lentRepaidAmount || 0;
      return acc + Math.max(0, tx.amount - repaid);
    }, 0);
    return {
      count: lentTxs.length,
      totalOutstanding,
      transactions: lentTxs,
    };
  }, [transactions, activeCurrency]);

  // Funds in an account that have not been assigned to a pocket yet
  const getUnallocated = useCallback(
    (walletId: string): number => {
      const wallet = wallets.find((w) => w.id === walletId);
      if (!wallet) return 0;
      const allocated = pockets
        .filter((p) => p.walletId === walletId)
        .reduce((acc, p) => acc + p.balance, 0);
      return Math.max(wallet.balance - allocated, 0);
    },
    [wallets, pockets]
  );

  // Helpers
  const getPocketName = useCallback(
    (pocketId?: string): string => {
      if (!pocketId) return '';
      const found = pockets.find((p) => p.id === pocketId);
      return found ? found.name : '';
    },
    [pockets]
  );

  const getCategoryIconName = useCallback(
    (catName: string, type?: TransactionType): string => {
      const lower = (catName || '').toLowerCase().trim();
      if (lower === 'transfer') return 'ArrowLeftRight';
      if (lower === 'others') return 'CircleEllipsis';

      // 1. Direct semantic overrides for high-frequency categories where icons were previously mismatched
      if (lower === 'shopping' || lower === 'belanja') return 'ShoppingCart';
      if (lower === 'snacks' || lower === 'snack' || lower === 'camilan') return 'Cookie';

      // 2. Exact match in user's category list with matching type
      if (type) {
        const foundWithType = categories.find(
          (c) => c.name.toLowerCase() === lower && c.type === type
        );
        if (foundWithType) {
          if (foundWithType.name.toLowerCase() === 'shopping' && (foundWithType.icon === 'ShoppingBag' || foundWithType.icon === 'Gift')) {
            return 'ShoppingCart';
          }
          if ((foundWithType.name.toLowerCase() === 'snacks' || foundWithType.name.toLowerCase() === 'snack') && foundWithType.icon === 'Coffee') {
            return 'Cookie';
          }
          return foundWithType.icon;
        }
      }

      // 3. Exact match in user's category list
      const found = categories.find((c) => c.name.toLowerCase() === lower);
      if (found) {
        if (found.name.toLowerCase() === 'shopping' && (found.icon === 'ShoppingBag' || found.icon === 'Gift')) {
          return 'ShoppingCart';
        }
        if ((found.name.toLowerCase() === 'snacks' || found.name.toLowerCase() === 'snack') && found.icon === 'Coffee') {
          return 'Cookie';
        }
        return found.icon;
      }

      // 4. Semantic fallback mapping
      if (SEMANTIC_CATEGORY_ICON_FALLBACKS[lower]) {
        return SEMANTIC_CATEGORY_ICON_FALLBACKS[lower];
      }

      // 5. Partial keyword matching
      if (lower.includes('shop') || lower.includes('belanja') || lower.includes('store') || lower.includes('market')) {
        return 'ShoppingCart';
      }
      if (lower.includes('snack') || lower.includes('camilan') || lower.includes('kue') || lower.includes('roti') || lower.includes('cookie') || lower.includes('biscuit')) {
        return 'Cookie';
      }
      if (lower.includes('kopi') || lower.includes('coffee') || lower.includes('cafe')) {
        return 'Coffee';
      }
      if (lower.includes('makan') || lower.includes('food') || lower.includes('resto') || lower.includes('dining')) {
        return 'Utensils';
      }

      return 'CircleEllipsis';
    },
    [categories]
  );

  // Available filter options extracted dynamically from real transactions
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    transactions
      .filter((tx) => tx.currency === activeCurrency)
      .forEach((tx) => {
        const d = new Date(tx.timestamp);
        if (!isNaN(d.getTime())) {
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          set.add(key);
        }
      });
    return Array.from(set).sort().reverse();
  }, [transactions, activeCurrency]);

  const availableExpenseCategories = useMemo(() => {
    const set = new Set<string>();
    categories
      .filter((c) => c.type === 'expense')
      .forEach((c) => set.add(c.name));
    transactions
      .filter((tx) => tx.type === 'expense' && tx.currency === activeCurrency)
      .forEach((tx) => {
        if (tx.category) set.add(tx.category);
      });
    return Array.from(set).sort();
  }, [categories, transactions, activeCurrency]);

  const availableIncomeCategories = useMemo(() => {
    const set = new Set<string>();
    categories
      .filter((c) => c.type === 'income')
      .forEach((c) => set.add(c.name));
    transactions
      .filter((tx) => tx.type === 'income' && tx.currency === activeCurrency)
      .forEach((tx) => {
        if (tx.category) set.add(tx.category);
      });
    return Array.from(set).sort();
  }, [categories, transactions, activeCurrency]);

  const availableCategories = useMemo(() => {
    const set = new Set<string>([
      ...availableExpenseCategories,
      ...availableIncomeCategories,
    ]);
    return Array.from(set).sort();
  }, [availableExpenseCategories, availableIncomeCategories]);

  // CRUD & Actions
  const handleCreateAccount = async (params: {
    name: string;
    type: AccountType;
    balance: string;
    currency: CurrencyType;
    accountNumber: string;
  }): Promise<string> => {
    const trimmedName = params.name.trim();
    if (!trimmedName) {
      showAlert('Missing Account Name', 'Please enter a name for your account.', undefined, 'warning');
      throw new Error('Missing account name');
    }
    const parsedBal = parseAmount(params.balance, params.currency);
    const initialBal = isNaN(parsedBal) ? 0 : parsedBal;

    const usedColors = [...wallets.map((w) => w.color), ...pockets.map((p) => p.color)];
    const assignedColor = getUniqueEntityColor(usedColors);

    try {
      const createdId = await createWallet({
        name: trimmedName,
        type: params.type,
        balance: initialBal,
        currency: params.currency,
        color: assignedColor,
        accountNumber: params.accountNumber.trim() || 'Main',
      });
      setActiveCurrency(params.currency);
      await loadData();
      AppHaptics.success();
      return createdId;
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to create account.', undefined, 'error');
      throw err;
    }
  };

  const handleRenameWallet = async (
    walletId: string,
    newName: string,
    newType?: AccountType | string,
    newAccountNumber?: string
  ) => {
    try {
      await updateWalletName(walletId, newName, newType, newAccountNumber);
      AppHaptics.success();
      await loadData();
    } catch (err: any) {
      showAlert('Error', err?.message || 'Could not update account.', undefined, 'error');
    }
  };

  const handleAdjustWalletBalance = async (walletId: string, newBalance: number) => {
    try {
      await adjustWalletBalance(walletId, newBalance);
      AppHaptics.success();
      await loadData();
    } catch (err: any) {
      showAlert('Error', err?.message || 'Could not adjust account balance.', undefined, 'error');
    }
  };

  const handleDeleteAccount = (wallet: Wallet, onDeleted?: () => void) => {
    if (wallets.length <= 1) {
      showAlert(
        'Cannot Delete Account',
        'This is your only account. Create another account first so the app always has somewhere to record transactions.',
        undefined,
        'warning'
      );
      return;
    }

    if (Math.abs(wallet.balance) > 0.005) {
      showAlert(
        'Cannot Delete Account',
        `"${wallet.name}" still has a balance of ${formatCurrency(wallet.balance, wallet.currency)}. Please transfer or clear all funds until the balance is 0 before deleting this account.`,
        undefined,
        'warning'
      );
      return;
    }

    const activePocketsWithBalance = pockets.filter(
      (p) => p.walletId === wallet.id && Math.abs(p.balance) > 0.005
    );
    if (activePocketsWithBalance.length > 0) {
      showAlert(
        'Cannot Delete Account',
        `"${wallet.name}" still has pockets holding allocated funds. Please release all pocket funds first.`,
        undefined,
        'warning'
      );
      return;
    }

    const unsettledLoans = transactions.filter(
      (t) => t.walletId === wallet.id && t.isLent && t.lentStatus !== 'settled'
    );
    if (unsettledLoans.length > 0) {
      showAlert(
        'Cannot Delete Account',
        `"${wallet.name}" still has ${unsettledLoans.length} unsettled loan or debt record${unsettledLoans.length === 1 ? '' : 's'}. Please settle them completely before deleting this account.`,
        undefined,
        'warning'
      );
      return;
    }

    const txCount = transactions.filter((t) => t.walletId === wallet.id).length;

    showAlert(
      'Delete Account',
      txCount > 0
        ? `Remove "${wallet.name}"? Its ${txCount} historical transaction${txCount === 1 ? '' : 's'} will be preserved in History as "${wallet.name} (Deleted Acc)" and locked as read-only.`
        : `Remove "${wallet.name}" from this device? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteWallet(wallet.id);
              if (onDeleted) onDeleted();
              await loadData();
              AppHaptics.light();
            } catch (err: any) {
              showAlert('Error', err.message || 'Could not delete account.', undefined, 'error');
            }
          },
        },
      ],
      'confirm'
    );
  };

  const handleUpdateWalletsOrder = async (orderedIds: string[]) => {
    try {
      setWallets((prev) => {
        const idMap = new Map(prev.map((w) => [w.id, w]));
        return orderedIds.map((id) => idMap.get(id)).filter((w): w is Wallet => !!w);
      });
      await updateWalletsOrder(orderedIds);
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to update account order.', undefined, 'error');
      await loadData();
    }
  };

  const handleCreatePocket = async (params: {
    walletId: string;
    name: string;
    balance: string;
    target: string;
    icon: string;
  }): Promise<string> => {
    const trimmedName = params.name.trim();
    if (!trimmedName) {
      showAlert('Missing Pocket Name', 'Please enter a name for your pocket.', undefined, 'warning');
      throw new Error('Missing pocket name');
    }
    if (!params.walletId) {
      showAlert('Account Required', 'Please select a main account.', undefined, 'warning');
      throw new Error('Account required');
    }

    const parentWallet = wallets.find((w) => w.id === params.walletId);
    const pCurrency = parentWallet ? parentWallet.currency : activeCurrency;
    const parsedBal = parseAmount(params.balance, pCurrency);
    const parsedTarget = parseAmount(params.target, pCurrency);
    const initialBal = isNaN(parsedBal) ? 0 : parsedBal;
    const targetAmt = isNaN(parsedTarget) ? 0 : parsedTarget;

    const unallocated = getUnallocated(params.walletId);
    if (initialBal > unallocated + 0.005) {
      showAlert(
        'Not Enough Funds',
        `Only ${formatCurrency(unallocated, pCurrency)} is available in this account. Your starting balance cannot exceed that amount.`,
        undefined,
        'warning'
      );
      throw new Error('Starting balance exceeds available funds');
    }

    const usedColors = [...wallets.map((w) => w.color), ...pockets.map((p) => p.color)];
    const assignedColor = getUniqueEntityColor(usedColors);

    try {
      const createdId = await createPocket({
        walletId: params.walletId,
        name: trimmedName,
        balance: initialBal,
        targetAmount: targetAmt,
        icon: params.icon,
        color: assignedColor,
      });
      await loadData();
      AppHaptics.success();
      return createdId;
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to create pocket.', undefined, 'error');
      throw err;
    }
  };

  const handleRenamePocket = async (
    pocketId: string,
    newName: string,
    newIcon?: string
  ) => {
    try {
      await updatePocketName(pocketId, newName, newIcon);
      AppHaptics.success();
      await loadData();
    } catch (err: any) {
      showAlert('Error', err?.message || 'Could not update pocket.', undefined, 'error');
    }
  };

  const handleAdjustPocket = async (
    targetPocket: Pocket,
    mode: 'allocate' | 'release',
    amountStr: string
  ): Promise<boolean> => {
    const parentWallet = wallets.find((w) => w.id === targetPocket.walletId);
    const pCurrency = parentWallet ? parentWallet.currency : activeCurrency;
    const amt = parseAmount(amountStr, pCurrency);
    if (isNaN(amt) || amt <= 0) {
      showAlert('Invalid Amount', 'Please enter a valid amount.', undefined, 'warning');
      return false;
    }

    if (mode === 'allocate') {
      const unallocated = getUnallocated(targetPocket.walletId);
      if (amt > unallocated + 0.005) {
        showAlert(
          'Not Enough Funds',
          `Only ${formatCurrency(unallocated, pCurrency)} is available to allocate from this account.`,
          undefined,
          'warning'
        );
        return false;
      }
    } else if (amt > targetPocket.balance + 0.005) {
      showAlert(
        'Not Enough Funds',
        `You can release at most ${formatCurrency(targetPocket.balance, pCurrency)} from this pocket.`,
        undefined,
        'warning'
      );
      return false;
    }

    try {
      const delta = mode === 'allocate' ? amt : -amt;
      await adjustPocketBalance(targetPocket.id, delta);
      await loadData();
      AppHaptics.success();
      return true;
    } catch (err: any) {
      if (err instanceof InsufficientFundsError) {
        showAlert(
          'Not Enough Funds',
          `Only ${formatCurrency(err.available, pCurrency)} is available for this action.`,
          undefined,
          'warning'
        );
      } else {
        showAlert('Error', err.message || 'Could not update pocket balance.', undefined, 'error');
      }
      return false;
    }
  };

  const handleDirectAdjustPocketBalance = async (
    pocket: Pocket,
    newBalance: number
  ): Promise<boolean> => {
    try {
      await setPocketBalanceDirect(pocket.id, newBalance);
      await loadData();
      AppHaptics.success();
      return true;
    } catch (err: any) {
      showAlert('Notice', toUserFriendlyErrorMessage(err, 'database'), undefined, 'error');
      return false;
    }
  };

  const handleDeletePocket = (pocket: Pocket) => {
    const parentWallet = wallets.find((w) => w.id === pocket.walletId);
    const pCurrency = parentWallet ? parentWallet.currency : activeCurrency;

    if (Math.abs(pocket.balance) > 0.005) {
      showAlert(
        'Cannot Delete Pocket',
        `"${pocket.name}" still has a balance of ${formatCurrency(pocket.balance, pCurrency)}. Please release or move all funds to the main account until the pocket balance is 0 before deleting it.`,
        undefined,
        'warning'
      );
      return;
    }

    const unsettledPocketLoans = transactions.filter(
      (t) => t.pocketId === pocket.id && t.isLent && t.lentStatus !== 'settled'
    );
    if (unsettledPocketLoans.length > 0) {
      showAlert(
        'Cannot Delete Pocket',
        `"${pocket.name}" still has ${unsettledPocketLoans.length} unsettled loan or debt record${unsettledPocketLoans.length === 1 ? '' : 's'}. Please settle them completely before deleting this pocket.`,
        undefined,
        'warning'
      );
      return;
    }

    const txCount = transactions.filter((t) => t.pocketId === pocket.id).length;

    showAlert(
      'Delete Pocket',
      txCount > 0
        ? `Remove "${pocket.name}"? Its ${txCount} historical transaction${txCount === 1 ? '' : 's'} will be preserved in History as "${pocket.name} (Deleted Pocket)" and locked as read-only.`
        : `Remove "${pocket.name}" from this account?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePocket(pocket.id);
              await loadData();
              AppHaptics.light();
            } catch (err: any) {
              showAlert('Error', err.message || 'Could not delete pocket.', undefined, 'error');
            }
          },
        },
      ],
      'confirm'
    );
  };

  const handleApplyAllocationPlan = async (
    walletId: string,
    distributions: { pocketId: string; amount: number }[]
  ): Promise<boolean> => {
    try {
      AppHaptics.heavy();
      await applyAllocationPlanToWallet(walletId, distributions);
      await loadData();
      AppHaptics.success();
      showAlert(
        'Allocation Applied',
        'Funds have been distributed to the selected pockets successfully.',
        undefined,
        'success'
      );
      return true;
    } catch (err: any) {
      showAlert('Allocation Error', err.message || 'Failed to distribute funds to pockets.', undefined, 'error');
      return false;
    }
  };

  const handleCreateCategory = async (params: {
    name: string;
    type: TransactionType;
    icon: string;
  }): Promise<boolean> => {
    const trimmed = params.name.trim();
    if (!trimmed) {
      showAlert('Missing Name', 'Please enter a category name.', undefined, 'warning');
      return false;
    }
    try {
      await createCategory({
        name: trimmed,
        type: params.type,
        icon: params.icon,
        color: params.type === 'expense' ? '#CC785C' : '#5DB8A6',
      });
      await loadData();
      AppHaptics.success();
      return true;
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to create category.', undefined, 'error');
      return false;
    }
  };

  const handleDeleteCategory = (id: string, name: string) => {
    showAlert('Delete Category', `Remove "${name}" from your categories?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCategory(id);
            await loadData();
            AppHaptics.light();
          } catch (err: any) {
            showAlert('Cannot Delete', err.message, undefined, 'error');
          }
        },
      },
    ], 'confirm');
  };

  const handleExecuteTransfer = async (
    fromWalletId: string,
    toWalletId: string,
    amount: number,
    notes: string,
    targetAmount?: number,
    exchangeRate?: number,
    fromPocketId?: string,
    toPocketId?: string
  ) => {
    try {
      await transferFunds({
        fromWalletId,
        toWalletId,
        fromPocketId,
        toPocketId,
        amount,
        targetAmount,
        exchangeRate,
        currency: activeCurrency,
        notes,
      });
      if (exchangeRate && exchangeRate > 0) {
        await handleSaveExchangeRate(exchangeRate);
      }
      await loadData();
      AppHaptics.success();
    } catch (err: any) {
      throw err;
    }
  };

  const handleUpdateTransfer = async (params: UpdateTransferFundsParams) => {
    try {
      await updateTransferFunds(params);
      if (params.exchangeRate && params.exchangeRate > 0) {
        await handleSaveExchangeRate(params.exchangeRate);
      }
      await loadData();
      AppHaptics.success();
    } catch (err: any) {
      throw err;
    }
  };

  const handleDeleteTransaction = (tx: Transaction, onDeleted?: () => void) => {
    const isTransfer =
      tx.category === 'Transfer' ||
      tx.paymentMethod === 'Transfer' ||
      /^Transfer (to|from)\s+/i.test(tx.merchantName);

    const alertTitle = isTransfer ? 'Delete Transfer' : 'Delete Transaction';
    const alertMessage = isTransfer
      ? `Delete this transfer record? The amount will be reversed for both source and destination accounts.`
      : `Delete transaction from "${tx.merchantName}"? The amount will be reverted to your balance.`;

    showAlert(
      alertTitle,
      alertMessage,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTransaction(tx.id);
              if (onDeleted) onDeleted();
              await loadData();
              AppHaptics.light();
            } catch (err: any) {
              showAlert('Error', err.message || 'Could not delete transaction.', undefined, 'error');
            }
          },
        },
      ],
      'confirm'
    );
  };

  const handleDeleteTransactionsBatch = (ids: string[], onDeleted?: () => void) => {
    if (!ids || ids.length === 0) return;
    showAlert(
      `Delete ${ids.length} Transaction${ids.length > 1 ? 's' : ''}?`,
      'This will restore all corresponding account balances and cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (onDeleted) onDeleted();
              await deleteTransactionsBatch(ids);
              await loadData();
              AppHaptics.success();
            } catch (err: any) {
              showAlert('Error', err.message || 'Failed to delete selected transactions.', undefined, 'error');
            }
          },
        },
      ],
      'confirm'
    );
  };

  const handleRecordLentRepayment = async (params: RecordLentRepaymentParams): Promise<string> => {
    try {
      const repaymentTxId = await recordLentRepayment(params);
      await loadData();
      AppHaptics.success();
      return repaymentTxId;
    } catch (err: any) {
      showAlert('Repayment Notice', toUserFriendlyErrorMessage(err, 'general'), undefined, 'error');
      throw err;
    }
  };

  const getLentAuditTrail = useCallback(async (parentTxId: string): Promise<Transaction[]> => {
    return await getLentRepayments(parentTxId);
  }, []);

  const handleSaveBudget = async (amount: number) => {
    try {
      AppHaptics.heavy();
      await setMonthlyBudget(amount, activeCurrency, budgetMonthKey);
      setMonthlyBudgetsMap((prev) => ({ ...prev, [activeCurrency]: amount }));
      AppHaptics.success();
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to save budget.', undefined, 'error');
    }
  };

  const handleRemoveBudget = async () => {
    try {
      AppHaptics.light();
      await setMonthlyBudget(0, activeCurrency, budgetMonthKey);
      setMonthlyBudgetsMap((prev) => ({ ...prev, [activeCurrency]: 0 }));
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to remove budget.', undefined, 'error');
    }
  };

  const handleSaveExchangeRate = async (rate: number) => {
    if (!isFinite(rate) || rate <= 0 || rate > 1e9) return;
    setExchangeRate(rate);
    try {
      await setSetting('usd_idr_rate', String(rate));
    } catch {
      // rate persistence is a convenience, never block a transfer on it
    }
  };

  const handleRefreshExchangeRate = useCallback(async (force = true): Promise<ExchangeRateResult | null> => {
    try {
      AppHaptics.selection();
      const result = await getLiveExchangeRate(force);
      if (result.rate > 0) {
        setExchangeRate(result.rate);
        setExchangeRateInfo(result);
        if (result.isLive && !result.fromCache) {
          AppHaptics.success();
        }
      }
      return result;
    } catch {
      return null;
    }
  }, []);

  const checkPreRestoreSnapshot = async (): Promise<boolean> => {
    try {
      return await hasPreRestoreSnapshot();
    } catch {
      return false;
    }
  };

  const handleUndoRestore = async () => {
    await restorePreRestoreSnapshot();
    await loadData();
  };

  const handleSaveAllocationPlan = async (plan: AllocationPlan) => {
    try {
      AppHaptics.heavy();
      const targetCurrency: CurrencyType = plan.currency || 'IDR';
      const otherCurrency: CurrencyType = targetCurrency === 'IDR' ? 'USD' : 'IDR';

      const currPlans = allocationPlansMap[targetCurrency] || [];
      const existsInTarget = currPlans.some((p) => p.id === plan.id);
      const updatedTarget = existsInTarget
        ? currPlans.map((p) => (p.id === plan.id ? plan : p))
        : [...currPlans, plan];

      const otherPlans = allocationPlansMap[otherCurrency] || [];
      const existsInOther = otherPlans.some((p) => p.id === plan.id);
      const updatedOther = existsInOther
        ? otherPlans.filter((p) => p.id !== plan.id)
        : otherPlans;

      await saveAllocationPlans(updatedTarget, targetCurrency);
      if (existsInOther) {
        await saveAllocationPlans(updatedOther, otherCurrency);
      }

      setAllocationPlansMap({
        [targetCurrency]: updatedTarget,
        [otherCurrency]: updatedOther,
      } as Record<CurrencyType, AllocationPlan[]>);
      AppHaptics.success();
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to save allocation plan.', undefined, 'error');
    }
  };

  const handleDeleteAllocationPlan = async (planId: string) => {
    try {
      AppHaptics.light();
      const idrPlans = allocationPlansMap.IDR || [];
      const usdPlans = allocationPlansMap.USD || [];
      const inIdr = idrPlans.some((p) => p.id === planId);
      const inUsd = usdPlans.some((p) => p.id === planId);

      const nextIdr = inIdr ? idrPlans.filter((p) => p.id !== planId) : idrPlans;
      const nextUsd = inUsd ? usdPlans.filter((p) => p.id !== planId) : usdPlans;

      if (inIdr) await saveAllocationPlans(nextIdr, 'IDR');
      if (inUsd) await saveAllocationPlans(nextUsd, 'USD');

      setAllocationPlansMap({ IDR: nextIdr, USD: nextUsd });
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to delete allocation plan.', undefined, 'error');
    }
  };

  const handleDuplicateAllocationPlan = async (plan: AllocationPlan) => {
    try {
      AppHaptics.heavy();
      const targetCurrency: CurrencyType = plan.currency || 'IDR';
      const currPlans = allocationPlansMap[targetCurrency] || [];
      const newPlanId = `plan_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      let newTitle = `${plan.title} (Copy)`;
      let copyIndex = 1;
      while (currPlans.some((p) => p.title.toLowerCase() === newTitle.toLowerCase())) {
        copyIndex += 1;
        newTitle = `${plan.title} (Copy ${copyIndex})`;
      }

      const duplicatedPlan: AllocationPlan = {
        id: newPlanId,
        title: newTitle,
        currency: targetCurrency,
        items: (plan.items || []).map((it) => ({
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          label: it.label,
          amount: it.amount,
        })),
      };

      const updatedPlans = [...currPlans, duplicatedPlan];
      await saveAllocationPlans(updatedPlans, targetCurrency);
      setAllocationPlansMap((prev) => ({
        ...prev,
        [targetCurrency]: updatedPlans,
      }));
      AppHaptics.success();
      showAlert(
        'Plan Duplicated',
        `Created "${newTitle}" with ${duplicatedPlan.items.length} items.`,
        undefined,
        'success'
      );
      return duplicatedPlan;
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to duplicate allocation plan.', undefined, 'error');
      return null;
    }
  };

  const handleExportBackup = async () => {
    return await exportAllData();
  };

  const handleExportCSV = async () => {
    return await exportTransactionsCSV();
  };

  const handleImportBackup = async (jsonString: string) => {
    await importAllData(jsonString);
    await loadData();
  };

  const handleWipeAllData = async () => {
    await wipeAllData();
    await loadData();
  };

  const handleReloadLockSettings = useCallback(async () => {
    try {
      const [s, caps] = await Promise.all([
        getLockSettings(),
        checkBiometricCapabilities(),
      ]);
      setLockSettings(s);
      setBiometricCaps(caps);
    } catch {
      // safe fallback
    }
  }, []);

  const handleToggleAppLock = async (enabled: boolean) => {
    await setLockEnabled(enabled);
    await handleReloadLockSettings();
  };

  const handleToggleBiometrics = async (enabled: boolean) => {
    await setBiometricsEnabled(enabled);
    await handleReloadLockSettings();
  };

  const handleExportStatementPdf = async (month?: string): Promise<string> => {
    const targetMonth = month || selectedMonth;
    return await generateAndShareStatementPdf({
      monthKey: targetMonth,
      currency: activeCurrency,
      wallets,
      transactions,
      exchangeRate,
    });
  };

  return {
    wallets,
    pockets,
    transactions,
    categories,
    allocationPlans,
    monthlyBudget,
    loading,
    initialAppReady,
    activeCurrency,
    setActiveCurrency,
    selectedMonth,
    setSelectedMonth,
    budgetMonthKey,
    exchangeRate,
    exchangeRateInfo,
    lockSettings,
    biometricCaps,
    totalBalance,
    outstandingLentSummary,
    getUnallocated,
    availableMonths,
    availableExpenseCategories,
    availableIncomeCategories,
    availableCategories,
    getPocketName,
    getCategoryIconName,
    loadData,
    handleCreateAccount,
    handleRenameWallet,
    handleAdjustWalletBalance,
    handleDeleteAccount,
    handleUpdateWalletsOrder,
    handleCreatePocket,
    handleRenamePocket,
    handleAdjustPocket,
    handleDirectAdjustPocketBalance,
    handleDeletePocket,
    handleCreateCategory,
    handleDeleteCategory,
    handleExecuteTransfer,
    handleUpdateTransfer,
    handleDeleteTransaction,
    handleDeleteTransactionsBatch,
    handleRecordLentRepayment,
    getLentAuditTrail,
    handleSaveBudget,
    handleRemoveBudget,
    handleSaveExchangeRate,
    handleRefreshExchangeRate,
    handleReloadLockSettings,
    handleToggleAppLock,
    handleToggleBiometrics,
    checkPreRestoreSnapshot,
    handleUndoRestore,
    handleSaveAllocationPlan,
    handleDeleteAllocationPlan,
    handleDuplicateAllocationPlan,
    handleApplyAllocationPlan,
    handleExportBackup,
    handleExportCSV,
    handleExportStatementPdf,
    handleImportBackup,
    handleWipeAllData,
  };
}
