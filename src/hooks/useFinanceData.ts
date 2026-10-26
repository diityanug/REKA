import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Wallet,
  Pocket,
  Transaction,
  Category,
  AllocationPlan,
  CurrencyType,
  AccountType,
  TransactionType,
  ExtractedReceiptData,
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
  insertTransactionWithItems,
  updateTransaction,
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
} from '../services/database';
import { AppHaptics } from '../utils/haptics';
import { parseAmount, getTodayDateStr } from '../utils/formatters';
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
  const [allocationPlans, setAllocationPlans] = useState<AllocationPlan[]>([]);
  const [monthlyBudget, setMonthlyBudgetState] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [initialAppReady, setInitialAppReady] = useState<boolean>(false);
  const [activeCurrency, setActiveCurrency] = useState<CurrencyType>('IDR');

  // Unified Month State across Overview & Analytics
  const currentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => currentMonthKey);

  // Load database state
  const loadData = useCallback(async () => {
    try {
      const [wList, pList, txList, catList, savedBudget, plans] = await Promise.all([
        getWallets(),
        getPockets(),
        getTransactions(),
        getCategories(),
        getMonthlyBudget(activeCurrency, selectedMonth),
        getAllocationPlans(activeCurrency),
      ]);
      setWallets(wList);
      setPockets(pList);
      setTransactions(txList);
      setCategories(catList);
      setMonthlyBudgetState(savedBudget);
      setAllocationPlans(plans);
    } catch (err: any) {
      showAlert('Database Error', err.message || 'Failed to load database.', undefined, 'error');
    } finally {
      setLoading(false);
      setInitialAppReady(true);
    }
  }, [activeCurrency, selectedMonth, showAlert]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
    showAlert(
      'Delete Account',
      `Remove "${wallet.name}" and its linked records from this device?`,
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
  ) => {
    const parentWallet = wallets.find((w) => w.id === targetPocket.walletId);
    const pCurrency = parentWallet ? parentWallet.currency : activeCurrency;
    const amt = parseAmount(amountStr, pCurrency);
    if (isNaN(amt) || amt <= 0) {
      showAlert('Invalid Amount', 'Please enter a valid amount.', undefined, 'warning');
      return;
    }

    try {
      const delta = mode === 'allocate' ? amt : -amt;
      await adjustPocketBalance(targetPocket.id, delta);
      await loadData();
      AppHaptics.success();
    } catch (err: any) {
      showAlert('Error', err.message || 'Could not update pocket balance.', undefined, 'error');
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
  }) => {
    const trimmed = params.name.trim();
    if (!trimmed) {
      showAlert('Missing Name', 'Please enter a category name.', undefined, 'warning');
      return;
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
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to create category.', undefined, 'error');
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
      await setMonthlyBudget(amount, activeCurrency, selectedMonth);
      await loadData();
      AppHaptics.success();
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to save budget.', undefined, 'error');
    }
  };

  const handleRemoveBudget = async () => {
    try {
      AppHaptics.light();
      await setMonthlyBudget(0, activeCurrency, selectedMonth);
      await loadData();
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to remove budget.', undefined, 'error');
    }
  };

  const handleSaveAllocationPlan = async (plan: AllocationPlan) => {
    try {
      AppHaptics.heavy();
      let updated: AllocationPlan[];
      const exists = allocationPlans.some((p) => p.id === plan.id);
      if (exists) {
        updated = allocationPlans.map((p) => (p.id === plan.id ? plan : p));
      } else {
        updated = [...allocationPlans, plan];
      }
      await saveAllocationPlans(updated, activeCurrency);
      setAllocationPlans(updated);
      AppHaptics.success();
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to save allocation plan.', undefined, 'error');
    }
  };

  const handleDeleteAllocationPlan = async (planId: string) => {
    try {
      AppHaptics.light();
      const updated = allocationPlans.filter((p) => p.id !== planId);
      await saveAllocationPlans(updated, activeCurrency);
      setAllocationPlans(updated);
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
    currencyWallets,
    totalBalance,
    positiveLiquidityTotal,
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
    handleSaveAllocationPlan,
    handleDeleteAllocationPlan,
    handleExportBackup,
    handleExportCSV,
    handleImportBackup,
    handleWipeAllData,
  };
}
