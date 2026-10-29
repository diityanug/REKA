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
  deletePocket,
  createCategory,
  deleteCategory,
  deleteTransaction,
  transferFunds,
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
  getSetting,
  setSetting,
  InsufficientFundsError,
} from '../services/database';
import { AppHaptics } from '../utils/haptics';
import { parseAmount, formatCurrency } from '../utils/formatters';
import { getUniqueEntityColor } from '../utils/colors';

interface UseFinanceDataProps {
  showAlert: (
    title: string,
    message?: string,
    buttons?: any[],
    type?: 'info' | 'warning' | 'error' | 'success' | 'confirm'
  ) => void;
}

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

  // Unified Month State across Overview & Analytics
  const currentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => currentMonthKey);

  // Budgets always belong to exactly one calendar month (never "all")
  const budgetMonthKey = useMemo(
    () => (selectedMonth === 'all' ? currentMonthKey : selectedMonth),
    [selectedMonth, currentMonthKey]
  );

  // Last exchange rate used for cross-currency transfers
  const [exchangeRate, setExchangeRate] = useState<number>(16000);

  // Synchronous allocation plans & monthly budget matching active currency (0ms lag, zero flicker)
  const allocationPlans = useMemo(() => {
    return allocationPlansMap[activeCurrency] || [];
  }, [allocationPlansMap, activeCurrency]);

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
      const storedRate = Number(await getSetting('usd_idr_rate', '16000'));
      if (isFinite(storedRate) && storedRate > 0) {
        setExchangeRate(storedRate);
      }
    } catch (err: any) {
      showAlert('Database Error', err.message || 'Failed to load database.', undefined, 'error');
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

  const positiveLiquidityTotal = useMemo(() => {
    return currencyWallets.reduce((acc, w) => acc + Math.max(w.balance, 0), 0);
  }, [currencyWallets]);

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

  // 7-Day Cash Flow Bar Chart data
  const last7DaysFlow = useMemo(() => {
    const days: { key: string; label: string; income: number; expense: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { weekday: 'short' });
      days.push({ key, label, income: 0, expense: 0 });
    }

    transactions
      .filter((tx) => tx.currency === activeCurrency)
      .forEach((tx) => {
        // Internal transfers move money between accounts, they are not real cash flow
        if (tx.category === 'Transfer' || tx.transferPairId) return;
        const dt = new Date(tx.timestamp);
        if (isNaN(dt.getTime())) return;
        const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
          dt.getDate()
        ).padStart(2, '0')}`;
        const slot = days.find((d) => d.key === key);
        if (slot) {
          if (tx.type === 'income') slot.income += tx.amount;
          if (tx.type === 'expense') slot.expense += tx.amount;
        }
      });

    const maxVal = Math.max(
      ...days.map((d) => Math.max(d.income, d.expense)),
      1
    );

    return { days, maxVal };
  }, [transactions, activeCurrency]);

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
      if (type) {
        const foundWithType = categories.find(
          (c) => c.name.toLowerCase() === lower && c.type === type
        );
        if (foundWithType) return foundWithType.icon;
      }
      const found = categories.find((c) => c.name.toLowerCase() === lower);
      return found ? found.icon : 'HelpCircle';
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
        accountNumber: params.accountNumber.trim() || 'Main Vault',
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

  const handleRenameWallet = async (walletId: string, newName: string) => {
    try {
      await updateWalletName(walletId, newName);
      AppHaptics.success();
      await loadData();
    } catch (err: any) {
      showAlert('Error', err?.message || 'Could not rename account.', undefined, 'error');
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

    const txCount = transactions.filter((t) => t.walletId === wallet.id).length;
    const pocketCount = pockets.filter((p) => p.walletId === wallet.id).length;
    const detailParts = [
      txCount > 0 ? `${txCount} transaction${txCount === 1 ? '' : 's'}` : '',
      pocketCount > 0 ? `${pocketCount} pocket${pocketCount === 1 ? '' : 's'}` : '',
    ].filter(Boolean);

    showAlert(
      'Delete Account',
      detailParts.length > 0
        ? `Removing "${wallet.name}" will also permanently delete ${detailParts.join(' and ')}. This cannot be undone.`
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
      await updateWalletsOrder(orderedIds);
      await loadData();
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to update account order.', undefined, 'error');
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

  const handleRenamePocket = async (pocketId: string, newName: string) => {
    try {
      await updatePocketName(pocketId, newName);
      AppHaptics.success();
      await loadData();
    } catch (err: any) {
      showAlert('Error', err?.message || 'Could not rename pocket.', undefined, 'error');
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

  const handleDeletePocket = (pocket: Pocket) => {
    showAlert(
      'Delete Pocket',
      `Remove "${pocket.name}"? Its balance will return to the main account.`,
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
    exchangeRate?: number
  ) => {
    try {
      await transferFunds({
        fromWalletId,
        toWalletId,
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
      const currPlans = allocationPlansMap[activeCurrency] || [];
      const exists = currPlans.some((p) => p.id === plan.id);
      const updated = exists
        ? currPlans.map((p) => (p.id === plan.id ? plan : p))
        : [...currPlans, plan];
      await saveAllocationPlans(updated, activeCurrency);
      setAllocationPlansMap((prev) => ({ ...prev, [activeCurrency]: updated }));
      AppHaptics.success();
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to save allocation plan.', undefined, 'error');
    }
  };

  const handleDeleteAllocationPlan = async (planId: string) => {
    try {
      AppHaptics.light();
      const currPlans = allocationPlansMap[activeCurrency] || [];
      const updated = currPlans.filter((p) => p.id !== planId);
      await saveAllocationPlans(updated, activeCurrency);
      setAllocationPlansMap((prev) => ({ ...prev, [activeCurrency]: updated }));
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to delete allocation plan.', undefined, 'error');
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
    currencyWallets,
    totalBalance,
    positiveLiquidityTotal,
    getUnallocated,
    last7DaysFlow,
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
    handleDeletePocket,
    handleCreateCategory,
    handleDeleteCategory,
    handleExecuteTransfer,
    handleDeleteTransaction,
    handleSaveBudget,
    handleRemoveBudget,
    handleSaveExchangeRate,
    checkPreRestoreSnapshot,
    handleUndoRestore,
    handleSaveAllocationPlan,
    handleDeleteAllocationPlan,
    handleExportBackup,
    handleExportCSV,
    handleImportBackup,
    handleWipeAllData,
  };
}
