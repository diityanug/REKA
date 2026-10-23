import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StatusBar,
  Alert,
  Keyboard,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

// Domain Services & Utilities
import {
  getWallets,
  getPockets,
  getTransactions,
  getCategories,
  createWallet,
  updateWalletName,
  adjustWalletBalance,
  deleteWallet,
  createPocket,
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
} from './src/services/database';
import { extractReceiptFromBase64 } from './src/services/receiptScanner';
import { Palette } from './src/theme/tokens';
import { formatCurrency, parseAmount, formatCurrencyInput } from './src/utils/formatters';
import { AppHaptics } from './src/utils/haptics';
import { CHART_PALETTE } from './src/constants/presets';
import {
  TabType,
  FilterType,
  ReturnModalType,
  Wallet,
  Pocket,
  Category,
  Transaction,
  CurrencyType,
  TransactionType,
  AccountType,
  AllocationPlan,
  ExtractedReceiptData,
} from './src/types';

// Modular Components
import { AppHeader } from './src/components/AppHeader';
import { BottomTabBar } from './src/components/BottomTabBar';

// Tab Views
import { OverviewTab } from './src/components/tabs/OverviewTab';
import { AccountsTab } from './src/components/tabs/AccountsTab';
import { HistoryTab } from './src/components/tabs/HistoryTab';
import { AnalyticsTab } from './src/components/tabs/AnalyticsTab';

// Modal Views
import { ReviewReceiptModal } from './src/components/modals/ReviewReceiptModal';
import { ManualTxModal } from './src/components/modals/ManualTxModal';
import { NewAccountModal } from './src/components/modals/NewAccountModal';
import { CategoryManagerModal } from './src/components/modals/CategoryManagerModal';
import { TxDetailModal } from './src/components/modals/TxDetailModal';
import { NewPocketModal } from './src/components/modals/NewPocketModal';
import { AdjustPocketModal } from './src/components/modals/AdjustPocketModal';
import { AccountDetailModal } from './src/components/modals/AccountDetailModal';
import { TransferModal } from './src/components/modals/TransferModal';
import { SettingsModal } from './src/components/modals/SettingsModal';
import { MonthPickerModal } from './src/components/modals/MonthPickerModal';
import { SetBudgetModal } from './src/components/modals/SetBudgetModal';
import { AllocationPlanModal } from './src/components/modals/AllocationPlanModal';

export default function App() {
  return (
    <SafeAreaProvider>
      <MainApp />
    </SafeAreaProvider>
  );
}

function MainApp() {
  const insets = useSafeAreaInsets();

  // Navigation & Core Data
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [pockets, setPockets] = useState<Pocket[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [scanning, setScanning] = useState<boolean>(false);
  const [privacyMode, setPrivacyMode] = useState<boolean>(false);
  const [activeCurrency, setActiveCurrency] = useState<CurrencyType>('IDR');
  const [settingsModalVisible, setSettingsModalVisible] = useState<boolean>(false);

  // History & Analytics Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [historyFilter, setHistoryFilter] = useState<FilterType>('all');
  const [historyCategory, setHistoryCategory] = useState<string>('all');
  const [historyMonth, setHistoryMonth] = useState<string>('all');

  // Unified Month State across Overview & Analytics
  const currentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => currentMonthKey);

  // Month Picker Modal State
  const [monthPickerVisible, setMonthPickerVisible] = useState<boolean>(false);
  const [monthPickerTarget, setMonthPickerTarget] = useState<'overview' | 'analytics' | 'history'>('overview');

  // Modal Return State (prevents stacking multiple Modals)
  const [returnModal, setReturnModal] = useState<ReturnModalType>('none');

  // Receipt Review Modal
  const [reviewModalVisible, setReviewModalVisible] = useState<boolean>(false);
  const [extractedData, setExtractedData] = useState<ExtractedReceiptData | null>(null);
  const [selectedWalletId, setSelectedWalletId] = useState<string>('');
  const [selectedPocketId, setSelectedPocketId] = useState<string>('');

  // Create Account Modal
  const [newAccountModalVisible, setNewAccountModalVisible] = useState<boolean>(false);
  const [newAccName, setNewAccName] = useState<string>('');
  const [newAccType, setNewAccType] = useState<AccountType>('Bank');
  const [newAccCurrency, setNewAccCurrency] = useState<CurrencyType>('IDR');
  const [newAccBalance, setNewAccBalance] = useState<string>('');
  const [newAccNumber, setNewAccNumber] = useState<string>('');

  // Create & Adjust Sub-Account / Pocket Modals
  const [newPocketModalVisible, setNewPocketModalVisible] = useState<boolean>(false);
  const [newPocketName, setNewPocketName] = useState<string>('');
  const [newPocketBalance, setNewPocketBalance] = useState<string>('');
  const [newPocketTarget, setNewPocketTarget] = useState<string>('');
  const [newPocketIcon, setNewPocketIcon] = useState<string>('Briefcase');
  const [adjustPocketTarget, setAdjustPocketTarget] = useState<Pocket | null>(null);
  const [adjustPocketMode, setAdjustPocketMode] = useState<'allocate' | 'release'>('allocate');
  const [adjustPocketAmount, setAdjustPocketAmount] = useState<string>('');

  // Account Details Modal (Unified Sub-Pockets inside Parent Account)
  const [viewingWallet, setViewingWallet] = useState<Wallet | null>(null);
  const [returnWalletDetail, setReturnWalletDetail] = useState<Wallet | null>(null);

  // Transfer Funds Modal
  const [transferModalVisible, setTransferModalVisible] = useState<boolean>(false);

  // Manual Transaction Modal
  const [manualTxModalVisible, setManualTxModalVisible] = useState<boolean>(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [manMerchant, setManMerchant] = useState<string>('');
  const [manAmount, setManAmount] = useState<string>('');
  const [manCategory, setManCategory] = useState<string>('Food & Beverages');
  const [manType, setManType] = useState<TransactionType>('expense');
  const [manCurrency, setManCurrency] = useState<CurrencyType>('IDR');
  const [manMethod, setManMethod] = useState<string>('QRIS');
  const [manDate, setManDate] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [manNotes, setManNotes] = useState<string>('');

  // Category Manager Modal
  const [categoryModalVisible, setCategoryModalVisible] = useState<boolean>(false);
  const [showAddCategoryForm, setShowAddCategoryForm] = useState<boolean>(false);
  const [newCatName, setNewCatName] = useState<string>('');
  const [newCatType, setNewCatType] = useState<TransactionType>('expense');
  const [newCatIcon, setNewCatIcon] = useState<string>('Utensils');

  // Transaction Detail Modal
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  // Monthly Budget State
  const [monthlyBudget, setMonthlyBudgetState] = useState<number>(0);
  const [setBudgetModalVisible, setSetBudgetModalVisible] = useState<boolean>(false);
  const [budgetInputAmount, setBudgetInputAmount] = useState<string>('');

  // Allocation Plans State (Card-based 2-column breakdown per income source)
  const [allocationPlans, setAllocationPlans] = useState<AllocationPlan[]>([]);
  const [allocationPlanModalVisible, setAllocationPlanModalVisible] = useState<boolean>(false);
  const [selectedAllocationPlan, setSelectedAllocationPlan] = useState<AllocationPlan | null>(null);

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
      setSelectedWalletId((prev) => {
        if (prev && wList.some((w) => w.id === prev)) return prev;
        return wList.length > 0 ? wList[0].id : '';
      });
    } catch (err: any) {
      Alert.alert('Database Error', err.message || 'Failed to load database.');
    } finally {
      setLoading(false);
    }
  }, [activeCurrency, selectedMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sync selected account with active currency
  useEffect(() => {
    if (wallets.length === 0) return;
    const currentWallet = wallets.find((w) => w.id === selectedWalletId);
    if (!currentWallet || currentWallet.currency !== activeCurrency) {
      const matching = wallets.find((w) => w.currency === activeCurrency);
      if (matching) {
        setSelectedWalletId(matching.id);
      }
    }
  }, [activeCurrency, wallets, selectedWalletId]);

  // Open Account Modal safely
  const openAddAccountModal = useCallback(
    (fromModal: ReturnModalType = 'none') => {
      AppHaptics.light();
      if (fromModal === 'manual') setManualTxModalVisible(false);
      if (fromModal === 'review') setReviewModalVisible(false);
      setReturnModal(fromModal);
      setNewAccName('');
      setNewAccBalance('');
      setNewAccNumber('');
      setNewAccType('Bank');
      setNewAccCurrency(activeCurrency);
      setNewAccountModalVisible(true);
    },
    [activeCurrency]
  );

  // Close Account Modal and restore previous modal if applicable
  const closeAddAccountModal = useCallback(() => {
    Keyboard.dismiss();
    setNewAccountModalVisible(false);
    if (returnModal === 'manual') {
      setTimeout(() => setManualTxModalVisible(true), 220);
    } else if (returnModal === 'review') {
      setTimeout(() => setReviewModalVisible(true), 220);
    }
    setReturnModal('none');
  }, [returnModal]);

  // Open Category Modal safely
  const openCategoryManager = useCallback(
    (type: TransactionType, openCreator: boolean = false, fromModal: ReturnModalType = 'none') => {
      AppHaptics.light();
      if (fromModal === 'manual') setManualTxModalVisible(false);
      setReturnModal(fromModal);
      setNewCatType(type);
      setShowAddCategoryForm(openCreator);
      setCategoryModalVisible(true);
    },
    []
  );

  // Close Category Modal and restore previous modal if applicable
  const closeCategoryManager = useCallback(() => {
    Keyboard.dismiss();
    setCategoryModalVisible(false);
    if (returnModal === 'manual') {
      setTimeout(() => setManualTxModalVisible(true), 220);
    }
    setReturnModal('none');
  }, [returnModal]);

  // Open Pocket Modal safely
  const openAddPocketModal = useCallback(
    (fromModal: ReturnModalType = 'none') => {
      if (wallets.length === 0) {
        Alert.alert('Account Required', 'Create an account first before adding a pocket.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Create Account', onPress: () => openAddAccountModal(fromModal) },
        ]);
        return;
      }
      AppHaptics.light();
      if (fromModal === 'manual') setManualTxModalVisible(false);
      if (fromModal === 'review') setReviewModalVisible(false);
      setReturnModal(fromModal);
      setNewPocketModalVisible(true);
    },
    [wallets.length, openAddAccountModal]
  );

  // Close Pocket Modal and restore previous modal if applicable
  const closeAddPocketModal = useCallback(() => {
    Keyboard.dismiss();
    setNewPocketModalVisible(false);
    if (returnModal === 'manual') {
      setTimeout(() => setManualTxModalVisible(true), 220);
    } else if (returnModal === 'review') {
      setTimeout(() => setReviewModalVisible(true), 220);
    } else if (returnWalletDetail) {
      setTimeout(() => {
        setViewingWallet(returnWalletDetail);
        setReturnWalletDetail(null);
      }, 220);
    }
    setReturnModal('none');
  }, [returnModal, returnWalletDetail]);

  // Close Adjust Pocket Modal
  const closeAdjustPocketModal = useCallback(() => {
    Keyboard.dismiss();
    setAdjustPocketTarget(null);
    setAdjustPocketAmount('');
    if (returnWalletDetail) {
      setTimeout(() => {
        setViewingWallet(returnWalletDetail);
        setReturnWalletDetail(null);
      }, 220);
    }
  }, [returnWalletDetail]);

  // Keep selectedPocketId valid for active selectedWalletId
  useEffect(() => {
    if (
      selectedPocketId &&
      !pockets.some((p) => p.id === selectedPocketId && p.walletId === selectedWalletId)
    ) {
      setSelectedPocketId('');
    }
  }, [selectedWalletId, pockets, selectedPocketId]);

  // Currently viewed account for deep detail breakdown
  const currentViewingWallet = useMemo(() => {
    if (!viewingWallet) return null;
    return wallets.find((w) => w.id === viewingWallet.id) || null;
  }, [viewingWallet, wallets]);

  const currentViewingPockets = useMemo(() => {
    if (!currentViewingWallet) return [];
    return pockets.filter((p) => p.walletId === currentViewingWallet.id);
  }, [currentViewingWallet, pockets]);

  const currentViewingTransactions = useMemo(() => {
    if (!currentViewingWallet) return [];
    return transactions.filter((t) => t.walletId === currentViewingWallet.id);
  }, [currentViewingWallet, transactions]);

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
    (catName: string): string => {
      if (catName.toLowerCase() === 'transfer') return 'ArrowLeftRight';
      const found = categories.find((c) => c.name.toLowerCase() === catName.toLowerCase());
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

  // Safely switch history filter type and reset category if incompatible
  const handleHistoryFilterChange = useCallback(
    (newFilter: FilterType) => {
      setHistoryFilter(newFilter);
      if (historyCategory !== 'all') {
        let allowedList = availableCategories;
        if (newFilter === 'expense' && availableExpenseCategories.length > 0) {
          allowedList = availableExpenseCategories;
        } else if (newFilter === 'income' && availableIncomeCategories.length > 0) {
          allowedList = availableIncomeCategories;
        }
        const isStillAllowed = allowedList.some(
          (c) => c.toLowerCase() === historyCategory.toLowerCase()
        );
        if (!isStillAllowed) {
          setHistoryCategory('all');
        }
      }
    },
    [historyCategory, availableCategories, availableExpenseCategories, availableIncomeCategories]
  );

  // Filtered transactions for history tab
  const filteredTransactions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    // Exclude the incoming mirror leg of a paired transfer so only 1 card represents the transfer
    const deduplicated = transactions.filter((tx) => {
      if (
        tx.type === 'income' &&
        tx.transferPairId &&
        (tx.category === 'Transfer' || tx.merchantName.toLowerCase().startsWith('transfer '))
      ) {
        return false;
      }
      return true;
    });

    return deduplicated.filter((tx) => {
      const pName = getPocketName(tx.pocketId).toLowerCase();
      const matchesSearch =
        !q ||
        tx.merchantName.toLowerCase().includes(q) ||
        tx.category.toLowerCase().includes(q) ||
        pName.includes(q) ||
        (tx.notes && tx.notes.toLowerCase().includes(q));

      const matchesType = historyFilter === 'all' ? true : tx.type === historyFilter;
      const matchesCategory =
        historyCategory === 'all'
          ? true
          : tx.category.toLowerCase() === historyCategory.toLowerCase();

      let matchesMonth = true;
      if (historyMonth !== 'all') {
        const d = new Date(tx.timestamp);
        if (!isNaN(d.getTime())) {
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          matchesMonth = key === historyMonth;
        } else {
          matchesMonth = false;
        }
      }

      const matchesCurrency = tx.currency === activeCurrency;
      return matchesSearch && matchesType && matchesCategory && matchesMonth && matchesCurrency;
    });
  }, [
    transactions,
    searchQuery,
    historyFilter,
    historyCategory,
    historyMonth,
    activeCurrency,
    getPocketName,
  ]);

  const historyFlowStats = useMemo(() => {
    let income = 0;
    let expense = 0;
    filteredTransactions.forEach((tx) => {
      // Exclude internal transfers from cash flow totals so internal transfers don't distort In vs Out
      if (tx.category === 'Transfer' || tx.transferPairId) return;
      if (tx.type === 'income') income += tx.amount;
      if (tx.type === 'expense') expense += tx.amount;
    });
    const total = income + expense;
    return {
      income,
      expense,
      incomePct: total > 0 ? (income / total) * 100 : 50,
      expensePct: total > 0 ? (expense / total) * 100 : 50,
    };
  }, [filteredTransactions]);

  // Camera scan handler
  const handleScanReceipt = async () => {
    try {
      AppHaptics.medium();
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Camera Access', 'Camera permission is required to capture receipts.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.85,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]?.base64) {
        processReceiptImage(result.assets[0].base64);
      }
    } catch (err: any) {
      Alert.alert('Scanner Error', err.message);
    }
  };

  // Gallery picker handler
  const handlePickFromGallery = async () => {
    try {
      AppHaptics.light();
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.85,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]?.base64) {
        processReceiptImage(result.assets[0].base64);
      }
    } catch (err: any) {
      Alert.alert('Upload Error', err.message);
    }
  };

  // Process receipt through Gemini API
  const processReceiptImage = async (base64: string) => {
    setScanning(true);
    try {
      const data = await extractReceiptFromBase64(base64);
      AppHaptics.success();
      setExtractedData(data);

      const detectedCurrency = data.currency || activeCurrency;
      if (wallets.some((w) => w.currency === detectedCurrency)) {
        setActiveCurrency(detectedCurrency);
      }

      const matchingWallet =
        wallets.find((w) => w.currency === detectedCurrency) ||
        wallets.find((w) => w.currency === activeCurrency) ||
        wallets[0];

      if (matchingWallet) {
        setSelectedWalletId(matchingWallet.id);
      }

      setReviewModalVisible(true);
    } catch (err: any) {
      AppHaptics.error();
      Alert.alert(
        'Receipt Analysis Notice',
        err.message || 'We could not automatically extract the receipt details. Would you like to enter them manually?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Enter Manually',
            onPress: () => {
              setManType('expense');
              setManCurrency(activeCurrency);
              setEditingTransaction(null);
              setManDate(getTodayDateStr());
              setManualTxModalVisible(true);
            },
          },
        ]
      );
    } finally {
      setScanning(false);
    }
  };

  // Save scanned receipt transaction
  const handleSaveScanTransaction = async (notesFromModal?: string, editedMerchant?: string) => {
    if (!extractedData) return;
    if (!selectedWalletId) {
      Alert.alert('Account Required', 'Please create an account first to record this receipt.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Create Account', onPress: () => openAddAccountModal('review') },
      ]);
      return;
    }

    const targetWallet = wallets.find((w) => w.id === selectedWalletId);
    if (!targetWallet) {
      Alert.alert('Account Required', 'Please select a valid account to record this receipt.');
      return;
    }

    try {
      AppHaptics.heavy();
      const txCurrency = targetWallet.currency;

      let txTimestamp = new Date().toISOString();
      if (extractedData.transactionDate) {
        const d = new Date(extractedData.transactionDate);
        if (!isNaN(d.getTime())) {
          if (extractedData.transactionDate.length <= 10) {
            const now = new Date();
            d.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
          }
          txTimestamp = d.toISOString();
        }
      }

      const finalMerchantName =
        (editedMerchant || '').trim() ||
        extractedData.merchantName ||
        'Receipt Transaction';

      await insertTransactionWithItems(
        {
          walletId: selectedWalletId,
          pocketId: selectedPocketId || '',
          merchantName: finalMerchantName,
          category: extractedData.category,
          type: extractedData.type,
          amount: extractedData.totalAmount,
          currency: txCurrency,
          taxAmount: 0,
          discountAmount: 0,
          timestamp: txTimestamp,
          paymentMethod: extractedData.paymentMethod || 'QRIS',
          notes: (notesFromModal || '').trim(),
        },
        []
      );

      if (targetWallet.currency !== activeCurrency) {
        setActiveCurrency(targetWallet.currency);
      }

      setReviewModalVisible(false);
      setExtractedData(null);
      await loadData();
      AppHaptics.success();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to persist transaction.');
    }
  };

  const getTodayDateStr = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };

  // Start editing existing transaction
  const handleStartEditTransaction = useCallback((tx: Transaction) => {
    AppHaptics.light();
    setSelectedTx(null);
    setEditingTransaction(tx);
    setManMerchant(tx.merchantName);
    setManAmount(String(tx.amount));
    setManCategory(tx.category);
    setManType(tx.type);
    setManCurrency(tx.currency);
    setManMethod(tx.paymentMethod);
    setManNotes(tx.notes || '');
    setSelectedWalletId(tx.walletId);
    setSelectedPocketId(tx.pocketId || '');
    const dStr = tx.timestamp ? tx.timestamp.split('T')[0] : getTodayDateStr();
    setManDate(dStr);
    setTimeout(() => {
      setManualTxModalVisible(true);
    }, 220);
  }, []);

  // Duplicate existing transaction (pre-fills all details, creates as a NEW transaction with default TODAY date)
  const handleDuplicateTransaction = useCallback((tx: Transaction) => {
    AppHaptics.light();
    setSelectedTx(null);
    setEditingTransaction(null);
    setManMerchant(tx.merchantName);
    setManAmount(String(tx.amount));
    setManCategory(tx.category);
    setManType(tx.type);
    setManCurrency(tx.currency);
    setManMethod(tx.paymentMethod);
    setManNotes(tx.notes || '');
    setSelectedWalletId(tx.walletId);
    setSelectedPocketId(tx.pocketId || '');
    setManDate(getTodayDateStr());
    setTimeout(() => {
      setManualTxModalVisible(true);
    }, 220);
  }, []);

  // Close manual transaction modal & clear edit state
  const handleCloseManualModal = useCallback(() => {
    Keyboard.dismiss();
    setManualTxModalVisible(false);
    setEditingTransaction(null);
    setManMerchant('');
    setManAmount('');
    setManNotes('');
    setManDate(getTodayDateStr());
  }, []);

  // Save manual transaction (create, duplicate, or edit)
  const handleSaveManualTransaction = async () => {
    Keyboard.dismiss();
    if (!manMerchant.trim()) {
      Alert.alert('Missing Merchant', 'Please enter merchant or recipient name.');
      return;
    }
    const parsedAmount = parseAmount(manAmount, manCurrency);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid transaction amount.');
      return;
    }
    if (!selectedWalletId) {
      Alert.alert('Account Required', 'Please create an account first to record transactions.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Create Account', onPress: () => openAddAccountModal('manual') },
      ]);
      return;
    }

    try {
      AppHaptics.heavy();
      const targetWallet = wallets.find((w) => w.id === selectedWalletId);
      const txCurrency = targetWallet ? targetWallet.currency : manCurrency;

      // Construct ISO timestamp using device local date and time
      const now = new Date();
      let txTimestamp: string;
      const dateParts = manDate.split('-').map(Number);
      if (dateParts.length === 3 && !isNaN(dateParts[0]) && !isNaN(dateParts[1]) && !isNaN(dateParts[2])) {
        const localDate = new Date(
          dateParts[0],
          dateParts[1] - 1,
          dateParts[2],
          now.getHours(),
          now.getMinutes(),
          now.getSeconds(),
          now.getMilliseconds()
        );
        txTimestamp = localDate.toISOString();
      } else {
        txTimestamp = new Date().toISOString();
      }

      if (editingTransaction) {
        await updateTransaction(editingTransaction.id, {
          walletId: selectedWalletId,
          pocketId: selectedPocketId || '',
          merchantName: manMerchant.trim(),
          category: manCategory,
          type: manType,
          amount: parsedAmount,
          currency: txCurrency,
          timestamp: txTimestamp,
          paymentMethod: manMethod,
          notes: manNotes.trim(),
        });
      } else {
        await insertTransactionWithItems(
          {
            walletId: selectedWalletId,
            pocketId: selectedPocketId || '',
            merchantName: manMerchant.trim(),
            category: manCategory,
            type: manType,
            amount: parsedAmount,
            currency: txCurrency,
            taxAmount: 0,
            discountAmount: 0,
            timestamp: txTimestamp,
            paymentMethod: manMethod,
            notes: manNotes.trim(),
          },
          []
        );
      }

      setManualTxModalVisible(false);
      setEditingTransaction(null);
      setManMerchant('');
      setManAmount('');
      setManNotes('');
      setManDate(getTodayDateStr());
      setActiveCurrency(txCurrency);
      await loadData();
      AppHaptics.success();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save transaction.');
    }
  };

  // Create account
  const handleCreateAccount = async () => {
    Keyboard.dismiss();
    const trimmedName = newAccName.trim();
    if (!trimmedName) {
      Alert.alert('Missing Account Name', 'Please enter a name for your account.');
      return;
    }
    const parsedBal = parseAmount(newAccBalance, newAccCurrency);
    const initialBal = isNaN(parsedBal) ? 0 : parsedBal;
    const colors = ['#CC785C', '#5DB8A6', '#E8A55A', '#252523', '#4A6FA5'];
    const assignedColor = colors[wallets.length % colors.length];

    try {
      const createdId = await createWallet({
        name: trimmedName,
        type: newAccType,
        balance: initialBal,
        currency: newAccCurrency,
        color: assignedColor,
        accountNumber: newAccNumber.trim() || 'Main Vault',
      });

      setNewAccName('');
      setNewAccBalance('');
      setNewAccNumber('');
      setSelectedWalletId(createdId);
      setActiveCurrency(newAccCurrency);
      setManCurrency(newAccCurrency);
      await loadData();
      AppHaptics.success();
      closeAddAccountModal();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create account.');
    }
  };

  // Delete account
  const handleDeleteAccount = (wallet: Wallet) => {
    Alert.alert(
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
              if (viewingWallet?.id === wallet.id) {
                setViewingWallet(null);
              }
              await loadData();
              AppHaptics.light();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Could not delete account.');
            }
          },
        },
      ]
    );
  };

  // Rename an existing wallet/account
  const handleRenameWallet = async (walletId: string, newName: string) => {
    try {
      await updateWalletName(walletId, newName);
      AppHaptics.success();
      await loadData();
      setViewingWallet((prev) =>
        prev && prev.id === walletId ? { ...prev, name: newName.trim() } : prev
      );
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not rename account.');
    }
  };

  // Adjust account balance (reconciliation)
  const handleAdjustWalletBalance = async (walletId: string, newBalance: number) => {
    try {
      await adjustWalletBalance(walletId, newBalance);
      AppHaptics.success();
      await loadData();
      setViewingWallet((prev) =>
        prev && prev.id === walletId ? { ...prev, balance: newBalance } : prev
      );
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not adjust account balance.');
    }
  };

  // Open account deep detail sheet with unified sub-accounts / pockets
  const handleOpenAccountDetail = (w: Wallet) => {
    AppHaptics.selection();
    setSelectedWalletId(w.id);
    setActiveCurrency(w.currency);
    setViewingWallet(w);
  };

  // Open Add Pocket modal pre-focused on a specific parent wallet
  const openAddPocketForWallet = (w: Wallet) => {
    AppHaptics.light();
    setSelectedWalletId(w.id);
    setNewPocketName('');
    setNewPocketBalance('');
    setNewPocketTarget('');
    setNewPocketIcon('FolderTree');
    setReturnWalletDetail(w);
    setViewingWallet(null);
    setNewPocketModalVisible(true);
  };

  // Open Adjust Pocket modal from within the account detail sheet
  const handleAdjustPocketFromDetail = (pocket: Pocket, w: Wallet) => {
    AppHaptics.selection();
    setReturnWalletDetail(w);
    setViewingWallet(null);
    setAdjustPocketMode('allocate');
    setAdjustPocketAmount('');
    setAdjustPocketTarget(pocket);
  };

  // Create sub-account / pocket
  const handleCreatePocket = async () => {
    Keyboard.dismiss();
    const trimmedName = newPocketName.trim();
    if (!trimmedName) {
      Alert.alert('Missing Pocket Name', 'Please enter a name for your pocket.');
      return;
    }
    if (!selectedWalletId) {
      Alert.alert('Account Required', 'Please select a parent account.');
      return;
    }
    const parentWallet = wallets.find((w) => w.id === selectedWalletId);
    const pCurrency = parentWallet ? parentWallet.currency : activeCurrency;
    const parsedBal = parseAmount(newPocketBalance, pCurrency);
    const parsedTarget = parseAmount(newPocketTarget, pCurrency);
    const initialBal = isNaN(parsedBal) ? 0 : parsedBal;
    const targetAmt = isNaN(parsedTarget) ? 0 : parsedTarget;
    const colors = ['#5DB8A6', '#CC785C', '#E8A55A', '#4A6FA5', '#9B51E0'];
    const assignedColor = colors[pockets.length % colors.length];

    try {
      const createdId = await createPocket({
        walletId: selectedWalletId,
        name: trimmedName,
        balance: initialBal,
        targetAmount: targetAmt,
        icon: newPocketIcon,
        color: assignedColor,
      });

      setNewPocketName('');
      setNewPocketBalance('');
      setNewPocketTarget('');
      setSelectedPocketId(createdId);
      await loadData();
      AppHaptics.success();
      closeAddPocketModal();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create pocket.');
    }
  };

  // Allocate or release funds in a pocket
  const handleAdjustPocket = async () => {
    Keyboard.dismiss();
    if (!adjustPocketTarget) return;
    const parentWallet = wallets.find((w) => w.id === adjustPocketTarget.walletId);
    const pCurrency = parentWallet ? parentWallet.currency : activeCurrency;
    const amt = parseAmount(adjustPocketAmount, pCurrency);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }

    try {
      const delta = adjustPocketMode === 'allocate' ? amt : -amt;
      await adjustPocketBalance(adjustPocketTarget.id, delta);
      await loadData();
      AppHaptics.success();
      closeAdjustPocketModal();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not update pocket balance.');
    }
  };

  // Delete pocket
  const handleDeletePocket = (pocket: Pocket) => {
    Alert.alert(
      'Delete Pocket',
      `Remove "${pocket.name}"? Its balance will return to the parent account.`,
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
              Alert.alert('Error', err.message || 'Could not delete pocket.');
            }
          },
        },
      ]
    );
  };

  // Delete transaction and revert balance
  const handleDeleteTransaction = (tx: Transaction) => {
    const isTransfer =
      tx.category === 'Transfer' ||
      tx.paymentMethod === 'Transfer' ||
      /^Transfer (to|from)\s+/i.test(tx.merchantName);

    const alertTitle = isTransfer ? 'Delete Transfer' : 'Delete Transaction';
    const alertMessage = isTransfer
      ? `Delete this transfer record? The amount will be reversed for both source and destination accounts.`
      : `Delete transaction from "${tx.merchantName}"? The amount of ${formatCurrency(
          tx.amount,
          tx.currency
        )} will be reverted to your balance.`;

    Alert.alert(
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
              setSelectedTx(null);
              await loadData();
              AppHaptics.light();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Could not delete transaction.');
            }
          },
        },
      ]
    );
  };

  // Create custom category
  const handleCreateCategory = async () => {
    Keyboard.dismiss();
    const trimmed = newCatName.trim();
    if (!trimmed) {
      Alert.alert('Missing Name', 'Please enter a category name.');
      return;
    }

    try {
      await createCategory({
        name: trimmed,
        type: newCatType,
        icon: newCatIcon,
        color: newCatType === 'expense' ? Palette.primary : Palette.accentTeal,
      });
      setNewCatName('');
      setShowAddCategoryForm(false);
      if (manType === newCatType) {
        setManCategory(trimmed);
      }
      await loadData();
      AppHaptics.success();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create category.');
    }
  };

  // Delete category
  const handleDeleteCategory = (id: string, name: string) => {
    Alert.alert('Delete Category', `Remove "${name}" from your categories?`, [
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
            Alert.alert('Cannot Delete', err.message);
          }
        },
      },
    ]);
  };

  // Execute fund transfer between two accounts (supports multi-currency)
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

  // Settings & Data Management
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

  // Open Set Budget Modal
  const handleOpenSetBudget = useCallback(() => {
    AppHaptics.light();
    setBudgetInputAmount(monthlyBudget > 0 ? formatCurrencyInput(String(monthlyBudget), activeCurrency) : '');
    setSetBudgetModalVisible(true);
  }, [monthlyBudget, activeCurrency]);

  // Save Monthly Budget
  const handleSaveBudget = async () => {
    Keyboard.dismiss();
    const parsed = parseAmount(budgetInputAmount, activeCurrency);
    if (isNaN(parsed) || parsed < 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid budget amount.');
      return;
    }
    try {
      AppHaptics.heavy();
      await setMonthlyBudget(parsed, activeCurrency, selectedMonth);
      setSetBudgetModalVisible(false);
      await loadData();
      AppHaptics.success();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save budget.');
    }
  };

  // Remove Monthly Budget
  const handleRemoveBudget = async () => {
    Keyboard.dismiss();
    try {
      AppHaptics.light();
      await setMonthlyBudget(0, activeCurrency, selectedMonth);
      setSetBudgetModalVisible(false);
      await loadData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to remove budget.');
    }
  };

  // Create / Edit Allocation Plans
  const handleCreateAllocationPlan = useCallback(() => {
    AppHaptics.light();
    setSelectedAllocationPlan(null);
    setAllocationPlanModalVisible(true);
  }, []);

  const handleEditAllocationPlan = useCallback((plan: AllocationPlan) => {
    AppHaptics.light();
    setSelectedAllocationPlan(plan);
    setAllocationPlanModalVisible(true);
  }, []);

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
      setAllocationPlanModalVisible(false);
      AppHaptics.success();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save allocation plan.');
    }
  };

  const handleDeleteAllocationPlan = async (planId: string) => {
    try {
      AppHaptics.light();
      const updated = allocationPlans.filter((p) => p.id !== planId);
      await saveAllocationPlans(updated, activeCurrency);
      setAllocationPlans(updated);
      setAllocationPlanModalVisible(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to delete allocation plan.');
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: Palette.canvas }]}>
        <ActivityIndicator size="large" color={Palette.primary} />
        <Text style={styles.loadingText}>Loading Vault...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.mainWrapper, { paddingTop: Math.max(insets.top, 14) }]}>
      <StatusBar barStyle="dark-content" />

      {/* Top App Bar */}
      <AppHeader
        activeCurrency={activeCurrency}
        privacyMode={privacyMode}
        onCurrencyChange={(c) => {
          setActiveCurrency(c);
          setManCurrency(c);
        }}
        onTogglePrivacy={() => setPrivacyMode(!privacyMode)}
        onOpenSettings={() => setSettingsModalVisible(true)}
      />

      {/* Main Tab Screen Content */}
      {activeTab === 'history' ? (
        <HistoryTab
          transactions={filteredTransactions}
          activeCurrency={activeCurrency}
          privacyMode={privacyMode}
          searchQuery={searchQuery}
          historyFilter={historyFilter}
          historyCategory={historyCategory}
          historyMonth={historyMonth}
          availableCategories={availableCategories}
          availableExpenseCategories={availableExpenseCategories}
          availableIncomeCategories={availableIncomeCategories}
          availableMonths={availableMonths}
          historyFlowStats={historyFlowStats}
          onChangeSearch={setSearchQuery}
          onClearSearch={() => setSearchQuery('')}
          onChangeFilter={handleHistoryFilterChange}
          onChangeCategory={setHistoryCategory}
          onChangeMonth={setHistoryMonth}
          onOpenMonthPicker={() => {
            setMonthPickerTarget('history');
            setMonthPickerVisible(true);
          }}
          onResetAllFilters={() => {
            setSearchQuery('');
            setHistoryFilter('all');
            setHistoryCategory('all');
            setHistoryMonth('all');
          }}
          onOpenManualModal={() => {
            setManCurrency(activeCurrency);
            setEditingTransaction(null);
            setManMerchant('');
            setManAmount('');
            setManNotes('');
            setManDate(getTodayDateStr());
            setManualTxModalVisible(true);
          }}
          onSelectTransaction={(tx) => setSelectedTx(tx)}
          getCategoryIconName={getCategoryIconName}
          getPocketName={getPocketName}
        />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollBody, { paddingBottom: insets.bottom + 96 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {activeTab === 'overview' && (
            <OverviewTab
              wallets={wallets}
              pockets={pockets}
              transactions={transactions}
              activeCurrency={activeCurrency}
              privacyMode={privacyMode}
              totalBalance={totalBalance}
              positiveLiquidityTotal={positiveLiquidityTotal}
              selectedMonth={selectedMonth}
              availableMonths={availableMonths}
              last7DaysFlow={last7DaysFlow}
              scanning={scanning}
              selectedWalletId={selectedWalletId}
              onNavigateToAccounts={() => setActiveTab('accounts')}
              onSelectMonth={setSelectedMonth}
              onOpenMonthPicker={() => {
                setMonthPickerTarget('overview');
                setMonthPickerVisible(true);
              }}
              onOpenTransferModal={() => setTransferModalVisible(true)}
              onOpenManualModal={() => {
                setManCurrency(activeCurrency);
                setEditingTransaction(null);
                setManMerchant('');
                setManAmount('');
                setManNotes('');
                setManDate(getTodayDateStr());
                setManualTxModalVisible(true);
              }}
              onScanReceipt={handleScanReceipt}
              onPickFromGallery={handlePickFromGallery}
              onOpenAccountDetail={handleOpenAccountDetail}
              onOpenAddAccount={() => openAddAccountModal('none')}
              onSelectTransaction={(tx) => setSelectedTx(tx)}
              getCategoryIconName={getCategoryIconName}
              getPocketName={getPocketName}
            />
          )}

          {activeTab === 'accounts' && (
            <AccountsTab
              wallets={wallets}
              pockets={pockets}
              activeCurrency={activeCurrency}
              positiveLiquidityTotal={positiveLiquidityTotal}
              privacyMode={privacyMode}
              selectedWalletId={selectedWalletId}
              allocationPlans={allocationPlans}
              onOpenAccountDetail={handleOpenAccountDetail}
              onOpenAddAccount={() => openAddAccountModal('none')}
              onCreateAllocationPlan={handleCreateAllocationPlan}
              onEditAllocationPlan={handleEditAllocationPlan}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsTab
              transactions={transactions}
              activeCurrency={activeCurrency}
              privacyMode={privacyMode}
              totalBalance={totalBalance}
              selectedMonth={selectedMonth}
              monthlyBudget={monthlyBudget}
              onSelectMonth={setSelectedMonth}
              onOpenMonthPicker={() => {
                setMonthPickerTarget('analytics');
                setMonthPickerVisible(true);
              }}
              onOpenCategoryManager={(type) => openCategoryManager(type || 'expense', false, 'none')}
              onOpenSetBudget={handleOpenSetBudget}
              getCategoryIconName={getCategoryIconName}
            />
          )}
        </ScrollView>
      )}

      {/* Floating Bottom Navigation Bar */}
      <BottomTabBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenManualTransaction={() => {
          setManCurrency(activeCurrency);
          setEditingTransaction(null);
          setManMerchant('');
          setManAmount('');
          setManNotes('');
          setManDate(getTodayDateStr());
          setManualTxModalVisible(true);
        }}
        bottomInset={insets.bottom}
      />

      {/* Modal 1: Review Scanned Receipt */}
      <ReviewReceiptModal
        visible={reviewModalVisible}
        extractedData={extractedData}
        wallets={wallets}
        pockets={pockets}
        selectedWalletId={selectedWalletId}
        selectedPocketId={selectedPocketId}
        activeCurrency={activeCurrency}
        onSelectWallet={setSelectedWalletId}
        onSelectPocket={setSelectedPocketId}
        onOpenAddAccount={() => openAddAccountModal('review')}
        onOpenAddPocket={() => openAddPocketModal('review')}
        onConfirm={handleSaveScanTransaction}
        onClose={() => setReviewModalVisible(false)}
      />

      {/* Modal 2: Manual Transaction Input */}
      <ManualTxModal
        visible={manualTxModalVisible}
        isEditing={!!editingTransaction}
        manMerchant={manMerchant}
        manAmount={manAmount}
        manCategory={manCategory}
        manType={manType}
        manCurrency={manCurrency}
        manMethod={manMethod}
        manDate={manDate}
        manNotes={manNotes}
        wallets={wallets}
        pockets={pockets}
        categories={categories}
        selectedWalletId={selectedWalletId}
        selectedPocketId={selectedPocketId}
        onChangeMerchant={setManMerchant}
        onChangeAmount={setManAmount}
        onChangeCategory={setManCategory}
        onChangeType={setManType}
        onChangeCurrency={(c) => {
          setManCurrency(c);
          const firstMatching = wallets.find((w) => w.currency === c);
          if (firstMatching) setSelectedWalletId(firstMatching.id);
        }}
        onChangeMethod={setManMethod}
        onChangeDate={setManDate}
        onChangeNotes={setManNotes}
        onSelectWallet={setSelectedWalletId}
        onSelectPocket={setSelectedPocketId}
        onOpenAddAccount={() => openAddAccountModal('manual')}
        onOpenAddPocket={() => openAddPocketModal('manual')}
        onOpenCategoryManager={() => openCategoryManager(manType, true, 'manual')}
        onSave={handleSaveManualTransaction}
        onClose={handleCloseManualModal}
      />

      {/* Modal 3: Create Account */}
      <NewAccountModal
        visible={newAccountModalVisible}
        name={newAccName}
        type={newAccType}
        currency={newAccCurrency}
        balance={newAccBalance}
        accountNumber={newAccNumber}
        onChangeName={setNewAccName}
        onChangeType={setNewAccType}
        onChangeCurrency={setNewAccCurrency}
        onChangeBalance={setNewAccBalance}
        onChangeAccountNumber={setNewAccNumber}
        onCreate={handleCreateAccount}
        onClose={closeAddAccountModal}
      />

      {/* Modal 4: Manage Categories */}
      <CategoryManagerModal
        visible={categoryModalVisible}
        categories={categories}
        activeType={newCatType}
        showAddForm={showAddCategoryForm}
        newCatName={newCatName}
        newCatIcon={newCatIcon}
        onChangeActiveType={setNewCatType}
        onToggleAddForm={setShowAddCategoryForm}
        onChangeName={setNewCatName}
        onChangeIcon={setNewCatIcon}
        onCreateCategory={handleCreateCategory}
        onSelectCategory={(cat) => {
          setManType(cat.type);
          setManCategory(cat.name);
          if (returnModal === 'manual') {
            closeCategoryManager();
          }
        }}
        onDeleteCategory={handleDeleteCategory}
        onClose={closeCategoryManager}
      />

      {/* Modal 5: Transaction Detail */}
      <TxDetailModal
        transaction={selectedTx}
        categoryIcon={selectedTx ? getCategoryIconName(selectedTx.category) : 'HelpCircle'}
        pocketName={selectedTx ? getPocketName(selectedTx.pocketId) : undefined}
        wallets={wallets}
        privacyMode={privacyMode}
        onEdit={handleStartEditTransaction}
        onDuplicate={handleDuplicateTransaction}
        onDelete={handleDeleteTransaction}
        onClose={() => setSelectedTx(null)}
      />

      {/* Modal 6: Create Pocket */}
      <NewPocketModal
        visible={newPocketModalVisible}
        wallets={wallets}
        selectedWalletId={selectedWalletId}
        name={newPocketName}
        balance={newPocketBalance}
        target={newPocketTarget}
        icon={newPocketIcon}
        onSelectWallet={setSelectedWalletId}
        onChangeName={setNewPocketName}
        onChangeBalance={setNewPocketBalance}
        onChangeTarget={setNewPocketTarget}
        onChangeIcon={setNewPocketIcon}
        onCreate={handleCreatePocket}
        onClose={closeAddPocketModal}
      />

      {/* Modal 7: Adjust Pocket Funds */}
      <AdjustPocketModal
        pocket={adjustPocketTarget}
        wallets={wallets}
        activeCurrency={activeCurrency}
        privacyMode={privacyMode}
        mode={adjustPocketMode}
        amount={adjustPocketAmount}
        onChangeMode={setAdjustPocketMode}
        onChangeAmount={setAdjustPocketAmount}
        onConfirm={handleAdjustPocket}
        onClose={closeAdjustPocketModal}
      />

      {/* Modal 8: Account Details & Unified Sub-Pockets Breakdown */}
      <AccountDetailModal
        wallet={currentViewingWallet}
        pockets={currentViewingPockets}
        transactions={currentViewingTransactions}
        privacyMode={privacyMode}
        onRenameWallet={handleRenameWallet}
        onAdjustWalletBalance={handleAdjustWalletBalance}
        onOpenAddPocket={openAddPocketForWallet}
        onAdjustPocket={handleAdjustPocketFromDetail}
        onDeletePocket={handleDeletePocket}
        onSelectTransaction={(tx) => setSelectedTx(tx)}
        onDeleteWallet={handleDeleteAccount}
        getCategoryIconName={getCategoryIconName}
        getPocketName={getPocketName}
        onClose={() => setViewingWallet(null)}
      />

      {/* Modal 9: Transfer Funds */}
      <TransferModal
        visible={transferModalVisible}
        wallets={wallets}
        activeCurrency={activeCurrency}
        privacyMode={privacyMode}
        onExecuteTransfer={handleExecuteTransfer}
        onClose={() => setTransferModalVisible(false)}
      />

      {/* Modal 10: Settings & Data Management */}
      <SettingsModal
        visible={settingsModalVisible}
        onExportBackup={handleExportBackup}
        onExportCSV={handleExportCSV}
        onImportBackup={handleImportBackup}
        onWipeAllData={handleWipeAllData}
        onClose={() => setSettingsModalVisible(false)}
      />

      {/* Modal 11: Month / Calendar Picker */}
      <MonthPickerModal
        visible={monthPickerVisible}
        selectedMonth={monthPickerTarget === 'history' ? historyMonth : selectedMonth}
        availableMonths={availableMonths}
        showAllOption={true}
        onSelectMonth={(monthKey) => {
          if (monthPickerTarget === 'history') {
            setHistoryMonth(monthKey);
          } else {
            setSelectedMonth(monthKey);
          }
        }}
        onClose={() => setMonthPickerVisible(false)}
      />

      {/* Modal 12: Monthly Budget Limit */}
      <SetBudgetModal
        visible={setBudgetModalVisible}
        activeCurrency={activeCurrency}
        selectedMonth={selectedMonth}
        currentBudget={monthlyBudget}
        amount={budgetInputAmount}
        onChangeAmount={setBudgetInputAmount}
        onSave={handleSaveBudget}
        onRemove={handleRemoveBudget}
        onClose={() => setSetBudgetModalVisible(false)}
      />

      {/* Modal 13: Allocation Strategy & Plans */}
      <AllocationPlanModal
        visible={allocationPlanModalVisible}
        activeCurrency={activeCurrency}
        plan={selectedAllocationPlan}
        onSave={handleSaveAllocationPlan}
        onDelete={handleDeleteAllocationPlan}
        onClose={() => setAllocationPlanModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  mainWrapper: {
    flex: 1,
    backgroundColor: Palette.canvas,
  },
  scrollBody: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Palette.muted,
  },
});
