import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  ScrollView,
  StatusBar,
  Keyboard,
  StyleSheet,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as SplashScreen from 'expo-splash-screen';

// Domain Services & Utilities
import {
  insertTransactionWithItems,
  updateTransaction,
  getSetting,
  setSetting,
} from './src/services/database';
import { extractReceiptFromBase64, isReceiptScannerConfigured } from './src/services/receiptScanner';
import { Palette } from './src/theme/tokens';
import { formatCurrency, parseAmount, formatCurrencyInput } from './src/utils/formatters';
import { sanitizeExpressionForCurrency } from './src/utils/calculator';
import { AppHaptics } from './src/utils/haptics';
import { TabType, FilterType, CurrencyType, Wallet, Transaction } from './src/types';

// Custom Hooks
import { useFinanceData } from './src/hooks/useFinanceData';
import { useAppModals } from './src/hooks/useAppModals';
import { useLastDefined } from './src/hooks/useLastDefined';

// Visual Components & Tabs
import { AppHeader } from './src/components/AppHeader';
import { BottomTabBar } from './src/components/BottomTabBar';
import { OverviewTab } from './src/components/tabs/OverviewTab';
import { AccountsTab } from './src/components/tabs/AccountsTab';
import { HistoryTab } from './src/components/tabs/HistoryTab';
import { AnalyticsTab } from './src/components/tabs/AnalyticsTab';

// Modal Views
import { ReviewReceiptModal } from './src/components/modals/ReviewReceiptModal';
import { ScanningReceiptModal } from './src/components/modals/ScanningReceiptModal';
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
import { ManageAccountOrderModal } from './src/components/modals/ManageAccountOrderModal';
import { CustomAlertModal } from './src/components/CustomAlertModal';
import { AnimatedSplashScreen } from './src/components/AnimatedSplashScreen';
import { ErrorBoundary } from './src/components/ErrorBoundary';

// Pastikan splash bawaan tetap tampil sampai layar React siap
SplashScreen.preventAutoHideAsync().catch(() => {});

// Keep in sync with app.json "version"
const APP_VERSION = '1.0.0';

// Build an ISO timestamp from a local YYYY-MM-DD date and HH:mm time
function buildLocalTimestamp(dateStr: string, timeStr: string): string {
  const now = new Date();
  const dateParts = (dateStr || '').split('-').map(Number);
  const timeParts = (timeStr || '').split(':').map(Number);
  const hours =
    timeParts.length === 2 && !isNaN(timeParts[0]) ? Math.min(Math.max(timeParts[0], 0), 23) : now.getHours();
  const minutes =
    timeParts.length === 2 && !isNaN(timeParts[1]) ? Math.min(Math.max(timeParts[1], 0), 59) : now.getMinutes();

  if (dateParts.length === 3 && dateParts.every((n) => !isNaN(n))) {
    const localDate = new Date(
      dateParts[0],
      dateParts[1] - 1,
      dateParts[2],
      hours,
      minutes,
      now.getSeconds(),
      now.getMilliseconds()
    );
    if (!isNaN(localDate.getTime())) return localDate.toISOString();
  }
  return new Date().toISOString();
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <MainApp />
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

function MainApp() {
  const insets = useSafeAreaInsets();

  // Navigation & Core States
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [splashFinished, setSplashFinished] = useState<boolean>(false);
  const [scanning, setScanning] = useState<boolean>(false);
  const [privacyMode, setPrivacyMode] = useState<boolean>(false);
  const scanAbortRef = useRef<AbortController | null>(null);

  // Modals & Dialogs Hook
  const modals = useAppModals();

  // Finance Domain Data Hook
  const finance = useFinanceData({ showAlert: modals.showAlert });

  // Persist privacy mode so hidden amounts stay hidden after a restart
  useEffect(() => {
    let cancelled = false;
    getSetting('privacy_mode', '0')
      .then((value) => {
        if (!cancelled) setPrivacyMode(value === '1');
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const handleTogglePrivacy = useCallback(() => {
    setPrivacyMode((prev) => {
      const next = !prev;
      setSetting('privacy_mode', next ? '1' : '0').catch(() => {});
      return next;
    });
  }, []);

  // Whether a "undo last restore" snapshot is available
  const [canUndoRestore, setCanUndoRestore] = useState<boolean>(false);
  useEffect(() => {
    if (!modals.settingsModalVisible) return;
    let cancelled = false;
    finance
      .checkPreRestoreSnapshot()
      .then((available) => {
        if (!cancelled) setCanUndoRestore(available);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [modals.settingsModalVisible, finance]);

  // History Filter States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [historyFilter, setHistoryFilter] = useState<FilterType>('all');
  const [historyCategory, setHistoryCategory] = useState<string>('all');
  const [historyMonth, setHistoryMonth] = useState<string>('all');

  // Sync selected account when currently selected wallet no longer exists or on initial load
  useEffect(() => {
    if (finance.wallets.length === 0) return;
    if (
      modals.manualTxModalVisible ||
      modals.reviewModalVisible ||
      modals.newPocketModalVisible
    ) {
      return;
    }
    const currentWallet = finance.wallets.find((w) => w.id === modals.selectedWalletId);
    if (!currentWallet) {
      const matching =
        finance.wallets.find((w) => w.currency === finance.activeCurrency) ||
        finance.wallets[0];
      if (matching) {
        modals.setSelectedWalletId(matching.id);
      }
    }
  }, [
    finance.activeCurrency,
    finance.wallets,
    modals,
  ]);

  // Keep selectedPocketId valid for active selectedWalletId
  useEffect(() => {
    if (
      modals.selectedPocketId &&
      !finance.pockets.some((p) => p.id === modals.selectedPocketId && p.walletId === modals.selectedWalletId)
    ) {
      modals.setSelectedPocketId('');
    }
  }, [finance.pockets, modals]);

  // Currently viewed account for deep detail breakdown (with sticky cache to prevent slide-down flicker)
  const lastViewedWalletId = useLastDefined(modals.viewingWallet?.id);

  const currentViewingWallet = useMemo(() => {
    const v = modals.viewingWallet;
    if (!v) return null;
    return finance.wallets.find((w) => w.id === v.id) || null;
  }, [modals.viewingWallet, finance.wallets]);

  const currentViewingPockets = useMemo(() => {
    if (!lastViewedWalletId) return [];
    return finance.pockets.filter((p) => p.walletId === lastViewedWalletId);
  }, [lastViewedWalletId, finance.pockets]);

  const currentViewingTransactions = useMemo(() => {
    if (!lastViewedWalletId) return [];
    return finance.transactions.filter((t) => t.walletId === lastViewedWalletId);
  }, [lastViewedWalletId, finance.transactions]);

  // Safely switch history filter type and reset category if incompatible
  const handleHistoryFilterChange = useCallback(
    (newFilter: FilterType) => {
      setHistoryFilter(newFilter);
      if (historyCategory !== 'all') {
        let allowedList = finance.availableCategories;
        if (newFilter === 'expense' && finance.availableExpenseCategories.length > 0) {
          allowedList = finance.availableExpenseCategories;
        } else if (newFilter === 'income' && finance.availableIncomeCategories.length > 0) {
          allowedList = finance.availableIncomeCategories;
        }
        const isStillAllowed = allowedList.some(
          (c) => c.toLowerCase() === historyCategory.toLowerCase()
        );
        if (!isStillAllowed) {
          setHistoryCategory('all');
        }
      }
    },
    [historyCategory, finance.availableCategories, finance.availableExpenseCategories, finance.availableIncomeCategories]
  );

  // Filtered transactions for history tab with Deep Search (merchant, category, notes, pocket, account, amount)
  const filteredTransactions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const cleanDigits = q.replace(/[^0-9]/g, '');

    // Exclude the incoming mirror leg only for same-currency transfers so cross-currency transfers remain visible in both currencies
    const deduplicated = finance.transactions.filter((tx) => {
      if (
        tx.type === 'income' &&
        tx.transferPairId &&
        (tx.category === 'Transfer' || tx.merchantName.toLowerCase().startsWith('transfer '))
      ) {
        const counterpart = finance.transactions.find((c) => c.id === tx.transferPairId);
        if (counterpart && counterpart.currency === tx.currency) {
          return false;
        }
      }
      return true;
    });

    return deduplicated.filter((tx) => {
      const wName = (finance.wallets.find((w) => w.id === tx.walletId)?.name || '').toLowerCase();
      const pName = finance.getPocketName(tx.pocketId).toLowerCase();
      const amtStr = String(Math.round(tx.amount));
      const formattedAmt = formatCurrency(Math.abs(tx.amount), tx.currency, false).toLowerCase();

      const matchesSearch =
        !q ||
        tx.merchantName.toLowerCase().includes(q) ||
        tx.category.toLowerCase().includes(q) ||
        wName.includes(q) ||
        pName.includes(q) ||
        (tx.notes && tx.notes.toLowerCase().includes(q)) ||
        (cleanDigits.length >= 2 && amtStr.includes(cleanDigits)) ||
        formattedAmt.includes(q);

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

      return matchesSearch && matchesType && matchesCategory && matchesMonth;
    });
  }, [
    finance,
    searchQuery,
    historyFilter,
    historyCategory,
    historyMonth,
  ]);

  // Aggregate stats for filtered history view (keeping IDR and USD native totals separate)
  const historyFlowStats = useMemo(() => {
    let income = 0;
    let expense = 0;
    let usdIncome = 0;
    let usdExpense = 0;
    filteredTransactions.forEach((tx) => {
      if (tx.category === 'Transfer' || tx.transferPairId) return;
      if (tx.currency === 'USD') {
        if (tx.type === 'income') usdIncome += tx.amount;
        if (tx.type === 'expense') usdExpense += tx.amount;
      } else {
        if (tx.type === 'income') income += tx.amount;
        if (tx.type === 'expense') expense += tx.amount;
      }
    });
    const total = income + expense;
    return {
      income,
      expense,
      usdIncome,
      usdExpense,
      incomePct: total > 0 ? (income / total) * 100 : 0,
      expensePct: total > 0 ? (expense / total) * 100 : 0,
    };
  }, [filteredTransactions]);

  // Explain the scanner state before asking for a photo
  const promptScannerNotConfigured = (): boolean => {
    if (isReceiptScannerConfigured) return false;
    modals.showAlert(
      'Scanner Not Available',
      'Receipt scanning is not configured in this build, so no photo leaves your device. You can record this purchase manually instead.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Enter Manually', onPress: () => handleOpenManualTransaction() },
      ],
      'info'
    );
    return true;
  };

  // Camera scan handler
  const handleScanReceipt = async () => {
    if (promptScannerNotConfigured()) return;
    try {
      AppHaptics.medium();
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        modals.showAlert('Camera Access', 'Camera permission is required to capture receipts.', undefined, 'warning');
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
      modals.showAlert('Scanner Error', err.message, undefined, 'error');
    }
  };

  // Gallery picker handler
  const handlePickFromGallery = async () => {
    if (promptScannerNotConfigured()) return;
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
      modals.showAlert('Upload Error', err.message, undefined, 'error');
    }
  };

  const handleCancelScan = useCallback(() => {
    AppHaptics.light();
    scanAbortRef.current?.abort();
    scanAbortRef.current = null;
    setScanning(false);
  }, []);

  // Process receipt through Gemini API
  const processReceiptImage = async (base64: string) => {
    const controller = new AbortController();
    scanAbortRef.current = controller;
    setScanning(true);
    try {
      const data = await extractReceiptFromBase64(base64, 'image/jpeg', controller.signal);
      AppHaptics.success();
      modals.setExtractedData(data);

      const detectedCurrency = data.currency || finance.activeCurrency;
      const matchingWallet = finance.wallets.find((w) => w.currency === detectedCurrency);
      if (matchingWallet) {
        finance.setActiveCurrency(detectedCurrency);
        modals.setSelectedWalletId(matchingWallet.id);
      } else {
        // No account for this currency yet: let the review sheet offer to create one
        modals.setSelectedWalletId('');
      }

      modals.setReviewModalVisible(true);
    } catch (err: any) {
      if (controller.signal.aborted) return;
      AppHaptics.error();
      modals.showAlert(
        'Receipt Analysis Notice',
        err.message || 'We could not automatically extract the receipt details. Would you like to enter them manually?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Enter Manually',
            onPress: () => {
              handleOpenManualTransaction(finance.activeCurrency);
            },
          },
        ],
        'confirm'
      );
    } finally {
      scanAbortRef.current = null;
      setScanning(false);
    }
  };

  // Open manual transaction modal with auto-selected account matching active currency
  const handleOpenManualTransaction = useCallback(
    (preferredCurrency?: CurrencyType) => {
      const curr = preferredCurrency || finance.activeCurrency;
      modals.openManualModal(curr);
      const matchingWallet = finance.wallets.find((w) => w.currency === curr);
      if (matchingWallet) {
        modals.setSelectedWalletId(matchingWallet.id);
      } else {
        modals.setSelectedWalletId('');
      }
      modals.setSelectedPocketId('');
    },
    [finance.activeCurrency, finance.wallets, modals]
  );

  // Keep the selected category valid whenever the transaction type changes
  const handleChangeManType = useCallback(
    (nextType: 'income' | 'expense') => {
      modals.setManType(nextType);
      const stillValid = finance.categories.some(
        (c) => c.type === nextType && c.name.toLowerCase() === modals.manCategory.toLowerCase()
      );
      if (!stillValid) {
        const firstMatch = finance.categories.find((c) => c.type === nextType);
        if (firstMatch) modals.setManCategory(firstMatch.name);
      }
    },
    [finance.categories, modals]
  );

  // Save scanned receipt transaction
  const handleSaveScanTransaction = async (
    notesFromModal?: string,
    editedMerchant?: string,
    amountOverride?: number
  ) => {
    if (!modals.extractedData) return;
    const receiptCurrency = modals.extractedData.currency;

    if (!modals.selectedWalletId) {
      modals.showAlert(
        'Account Required',
        `Create a ${receiptCurrency} account first so this receipt is recorded in the right currency.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Create Account',
            onPress: () => modals.openAddAccountModal(receiptCurrency, 'review'),
          },
        ],
        'warning'
      );
      return;
    }

    const targetWallet = finance.wallets.find((w) => w.id === modals.selectedWalletId);
    if (!targetWallet) {
      modals.showAlert('Account Required', 'Please select a valid account to record this receipt.', undefined, 'warning');
      return;
    }

    // Never reinterpret a receipt amount into a different currency
    if (targetWallet.currency !== receiptCurrency) {
      modals.showAlert(
        'Currency Mismatch',
        `This receipt is in ${receiptCurrency}, but the selected account uses ${targetWallet.currency}. Pick a ${receiptCurrency} account so the amount is stored correctly.`,
        undefined,
        'warning'
      );
      return;
    }

    const finalAmount =
      typeof amountOverride === 'number' && isFinite(amountOverride)
        ? amountOverride
        : modals.extractedData.totalAmount;

    if (!isFinite(finalAmount) || finalAmount <= 0) {
      modals.showAlert(
        'Missing Amount',
        'This receipt has no readable total. Enter the amount before saving.',
        undefined,
        'warning'
      );
      return;
    }

    try {
      AppHaptics.heavy();
      const txCurrency = receiptCurrency;

      let txTimestamp = new Date().toISOString();
      if (modals.extractedData.transactionDate) {
        const d = new Date(modals.extractedData.transactionDate);
        if (!isNaN(d.getTime())) {
          if (modals.extractedData.transactionDate.length <= 10) {
            const now = new Date();
            d.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
          }
          txTimestamp = d.toISOString();
        }
      }

      const finalMerchantName =
        (editedMerchant || '').trim() ||
        modals.extractedData.merchantName ||
        'Receipt Transaction';

      const rawItems = Array.isArray(modals.extractedData.items) ? modals.extractedData.items : [];
      const receiptItems = rawItems.map((it) => {
        const qty = Math.max(Number(it.quantity) || 1, 1);
        const unit = Math.abs(Number(it.unitPrice) || 0);
        const total = Math.abs(Number(it.totalPrice) || (qty * unit));
        return {
          name: (it.name || 'Item').trim(),
          quantity: qty,
          unitPrice: unit > 0 ? unit : total,
          totalPrice: total,
          category: it.category || modals.extractedData?.category || 'Shopping',
        };
      });

      const finalWalletId = targetWallet.id;
      const validPocket = finance.pockets.find(
        (p) => p.id === modals.selectedPocketId && p.walletId === finalWalletId
      );
      const finalPocketId = validPocket ? validPocket.id : '';

      await insertTransactionWithItems(
        {
          walletId: finalWalletId,
          pocketId: finalPocketId,
          merchantName: finalMerchantName,
          category: modals.extractedData.category,
          type: modals.extractedData.type,
          amount: finalAmount,
          currency: txCurrency,
          taxAmount: modals.extractedData.taxAmount || 0,
          discountAmount: modals.extractedData.discountAmount || 0,
          timestamp: txTimestamp,
          paymentMethod: modals.extractedData.paymentMethod || 'QRIS',
          notes: (notesFromModal || '').trim(),
        },
        receiptItems
      );

      if (targetWallet.currency !== finance.activeCurrency) {
        finance.setActiveCurrency(targetWallet.currency);
      }

      modals.closeReviewModal();
      await finance.loadData();
      AppHaptics.success();
    } catch (err: any) {
      modals.showAlert('Error', err.message || 'Failed to persist transaction.', undefined, 'error');
    }
  };

  // Save manual transaction (create, duplicate, or edit)
  const handleSaveManualTransaction = async () => {
    Keyboard.dismiss();
    if (!modals.manMerchant.trim()) {
      modals.showAlert('Missing Merchant', 'Please enter merchant or recipient name.', undefined, 'warning');
      return;
    }
    const parsedAmount = parseAmount(modals.manAmount, modals.manCurrency);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      modals.showAlert('Invalid Amount', 'Please enter a valid transaction amount.', undefined, 'warning');
      return;
    }
    // Category must belong to the selected transaction type
    const categoryIsValid = finance.categories.some(
      (c) => c.type === modals.manType && c.name.toLowerCase() === modals.manCategory.toLowerCase()
    );
    if (!categoryIsValid) {
      modals.showAlert(
        'Choose a Category',
        `Please pick a ${modals.manType} category for this transaction.`,
        undefined,
        'warning'
      );
      return;
    }

    // Resolve target account strictly matching the selected transaction currency
    let targetWallet = finance.wallets.find((w) => w.id === modals.selectedWalletId);
    if (!targetWallet || targetWallet.currency !== modals.manCurrency) {
      const matching = finance.wallets.find((w) => w.currency === modals.manCurrency);
      if (matching) {
        targetWallet = matching;
        modals.setSelectedWalletId(matching.id);
      }
    }

    if (!targetWallet) {
      modals.showAlert(
        'Account Required',
        `Please create a ${modals.manCurrency} account first to record this transaction.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Create Account',
            onPress: () => modals.openAddAccountModal(modals.manCurrency, 'manual'),
          },
        ],
        'warning'
      );
      return;
    }

    const finalWalletId = targetWallet.id;
    const validPocket = finance.pockets.find(
      (p) => p.id === modals.selectedPocketId && p.walletId === finalWalletId
    );
    const finalPocketId = validPocket ? validPocket.id : '';

    // A pocket can never go negative, so block this before touching the database
    if (validPocket && modals.manType === 'expense' && parsedAmount > validPocket.balance + 0.005) {
      modals.showAlert(
        'Not Enough Pocket Funds',
        `"${validPocket.name}" only has ${formatCurrency(validPocket.balance, targetWallet.currency)}. Release funds from this pocket first or choose another pocket.`,
        undefined,
        'warning'
      );
      return;
    }

    const persistTransaction = async () => {
      try {
        AppHaptics.heavy();
        const txCurrency = modals.manCurrency;
        const txTimestamp = buildLocalTimestamp(modals.manDate, modals.manTime);

        if (modals.editingTransaction) {
          await updateTransaction(modals.editingTransaction.id, {
            walletId: finalWalletId,
            pocketId: finalPocketId,
            merchantName: modals.manMerchant.trim(),
            category: modals.manCategory,
            type: modals.manType,
            amount: parsedAmount,
            currency: txCurrency,
            timestamp: txTimestamp,
            paymentMethod: modals.manMethod,
            notes: modals.manNotes.trim(),
          });
        } else {
          await insertTransactionWithItems(
            {
              walletId: finalWalletId,
              pocketId: finalPocketId,
              merchantName: modals.manMerchant.trim(),
              category: modals.manCategory,
              type: modals.manType,
              amount: parsedAmount,
              currency: txCurrency,
              taxAmount: 0,
              discountAmount: 0,
              timestamp: txTimestamp,
              paymentMethod: modals.manMethod,
              notes: modals.manNotes.trim(),
            },
            []
          );
        }

        modals.handleCloseManualModal();
        finance.setActiveCurrency(txCurrency);
        await finance.loadData();
        AppHaptics.success();
      } catch (err: any) {
        modals.showAlert('Error', err.message || 'Failed to save transaction.', undefined, 'error');
      }
    };

    // Warn (but let the user decide) when an expense exceeds the account balance
    if (modals.manType === 'expense' && parsedAmount > targetWallet.balance + 0.005) {
      modals.showAlert(
        'Balance Will Go Negative',
        `${targetWallet.name} only has ${formatCurrency(targetWallet.balance, targetWallet.currency)}. Saving this expense will make the balance negative.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save Anyway', style: 'destructive', onPress: () => { persistTransaction(); } },
        ],
        'confirm'
      );
      return;
    }

    await persistTransaction();
  };

  const handleCurrencyChange = useCallback((c: CurrencyType) => {
    if (finance.activeCurrency === c) return;
    finance.setActiveCurrency(c);
    modals.setManCurrency(c);
  }, [finance, modals]);

  const handleOpenSettings = useCallback(() => {
    modals.setSettingsModalVisible(true);
  }, [modals]);

  const handleNavigateToAccounts = useCallback(() => {
    setActiveTab('accounts');
  }, []);

  const handleOpenOverviewMonthPicker = useCallback(() => {
    modals.openMonthPicker('overview');
  }, [modals]);

  const handleOpenTransferModal = useCallback(() => {
    modals.setTransferModalVisible(true);
  }, [modals]);

  const handleOpenAccountDetail = useCallback((w: Wallet) => {
    modals.setSelectedWalletId(w.id);
    modals.openAccountDetail(w);
  }, [modals]);

  const handleOpenAddAccount = useCallback(() => {
    modals.openAddAccountModal(finance.activeCurrency, 'none');
  }, [modals, finance.activeCurrency]);

  const handleSelectTransaction = useCallback((tx: Transaction) => {
    modals.setSelectedTx(tx);
  }, [modals]);

  const handleOpenManageOrder = useCallback(() => {
    modals.setManageOrderModalVisible(true);
  }, [modals]);

  const handleOpenAnalyticsMonthPicker = useCallback(() => {
    modals.openMonthPicker('analytics');
  }, [modals]);

  const handleOpenCategoryManagerAnalytics = useCallback((type?: any) => {
    modals.openCategoryManager(type || 'expense', false, 'none');
  }, [modals]);

  const handleOpenSetBudget = useCallback(() => {
    const initStr = finance.monthlyBudget > 0 ? formatCurrencyInput(String(finance.monthlyBudget), finance.activeCurrency) : '';
    modals.openSetBudget(initStr);
  }, [finance.monthlyBudget, finance.activeCurrency, modals]);

  const handleClearSearch = useCallback(() => setSearchQuery(''), []);
  const handleOpenHistoryMonthPicker = useCallback(() => modals.openMonthPicker('history'), [modals]);
  const handleResetAllHistoryFilters = useCallback(() => {
    setSearchQuery('');
    setHistoryFilter('all');
    setHistoryCategory('all');
    setHistoryMonth('all');
  }, []);

  useEffect(() => {
    // Sembunyikan native splash bawaan OS begitu komponen React siap
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  if (!splashFinished || (finance.loading && !finance.initialAppReady)) {
    return (
      <AnimatedSplashScreen
        minDurationMs={1000}
        onAnimationFinish={() => setSplashFinished(true)}
      />
    );
  }

  return (
    <View style={[styles.mainWrapper, { paddingTop: Math.max(insets.top, 14) }]}>
      <StatusBar barStyle="dark-content" />

      {/* Top App Bar */}
      <AppHeader
        privacyMode={privacyMode}
        onTogglePrivacy={handleTogglePrivacy}
        onOpenSettings={handleOpenSettings}
      />

      {/* Main Tab Screen Content */}
      {activeTab === 'history' ? (
        <HistoryTab
          transactions={filteredTransactions}
          activeCurrency={finance.activeCurrency}
          privacyMode={privacyMode}
          searchQuery={searchQuery}
          historyFilter={historyFilter}
          historyCategory={historyCategory}
          historyMonth={historyMonth}
          availableCategories={finance.availableCategories}
          availableExpenseCategories={finance.availableExpenseCategories}
          availableIncomeCategories={finance.availableIncomeCategories}
          availableMonths={finance.availableMonths}
          historyFlowStats={historyFlowStats}
          onChangeSearch={setSearchQuery}
          onClearSearch={handleClearSearch}
          onChangeFilter={handleHistoryFilterChange}
          onChangeCategory={setHistoryCategory}
          onChangeMonth={setHistoryMonth}
          onOpenMonthPicker={handleOpenHistoryMonthPicker}
          onResetAllFilters={handleResetAllHistoryFilters}
          onOpenManualModal={handleOpenManualTransaction}
          onSelectTransaction={handleSelectTransaction}
          getCategoryIconName={finance.getCategoryIconName}
          getPocketName={finance.getPocketName}
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
              wallets={finance.wallets}
              transactions={finance.transactions}
              activeCurrency={finance.activeCurrency}
              privacyMode={privacyMode}
              selectedMonth={finance.selectedMonth}
              availableMonths={finance.availableMonths}
              last7DaysFlow={finance.last7DaysFlow}
              scanning={scanning}
              onNavigateToAccounts={handleNavigateToAccounts}
              onSelectMonth={finance.setSelectedMonth}
              onOpenMonthPicker={handleOpenOverviewMonthPicker}
              onOpenTransferModal={handleOpenTransferModal}
              onOpenManualModal={handleOpenManualTransaction}
              onScanReceipt={handleScanReceipt}
              onPickFromGallery={handlePickFromGallery}
              onOpenAccountDetail={handleOpenAccountDetail}
              onOpenAddAccount={handleOpenAddAccount}
              onSelectTransaction={handleSelectTransaction}
              onCurrencyChange={handleCurrencyChange}
              getCategoryIconName={finance.getCategoryIconName}
              getPocketName={finance.getPocketName}
            />
          )}

          {activeTab === 'accounts' && (
            <AccountsTab
              wallets={finance.wallets}
              activeCurrency={finance.activeCurrency}
              privacyMode={privacyMode}
              allocationPlans={finance.allocationPlans}
              onOpenAccountDetail={handleOpenAccountDetail}
              onOpenAddAccount={handleOpenAddAccount}
              onOpenManageOrder={handleOpenManageOrder}
              onCreateAllocationPlan={modals.openCreateAllocationPlan}
              onEditAllocationPlan={modals.openEditAllocationPlan}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsTab
              transactions={finance.transactions}
              activeCurrency={finance.activeCurrency}
              privacyMode={privacyMode}
              totalBalance={finance.totalBalance}
              selectedMonth={finance.selectedMonth}
              budgetMonthKey={finance.budgetMonthKey}
              monthlyBudget={finance.monthlyBudget}
              onSelectMonth={finance.setSelectedMonth}
              onOpenMonthPicker={handleOpenAnalyticsMonthPicker}
              onOpenCategoryManager={handleOpenCategoryManagerAnalytics}
              onOpenSetBudget={handleOpenSetBudget}
              onCurrencyChange={handleCurrencyChange}
              getCategoryIconName={finance.getCategoryIconName}
            />
          )}
        </ScrollView>
      )}

      {/* Floating Bottom Navigation Bar */}
      <BottomTabBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenManualTransaction={handleOpenManualTransaction}
        bottomInset={insets.bottom}
      />

      {/* Scanning Receipt In-Progress Custom Modal */}
      <ScanningReceiptModal visible={scanning} onCancel={handleCancelScan} />

      {/* Modal 1: Review Scanned Receipt */}
      <ReviewReceiptModal
        visible={modals.reviewModalVisible}
        extractedData={modals.extractedData}
        wallets={finance.wallets}
        pockets={finance.pockets}
        selectedWalletId={modals.selectedWalletId}
        selectedPocketId={modals.selectedPocketId}
        activeCurrency={finance.activeCurrency}
        onSelectWallet={modals.setSelectedWalletId}
        onSelectPocket={modals.setSelectedPocketId}
        onOpenAddAccount={() => modals.openAddAccountModal(modals.extractedData?.currency || finance.activeCurrency, 'review')}
        onOpenAddPocket={() => modals.openAddPocketModal('review')}
        onConfirm={handleSaveScanTransaction}
        onClose={modals.closeReviewModal}
      />

      {/* Modal 2: Manual Transaction Input */}
      <ManualTxModal
        visible={modals.manualTxModalVisible}
        isEditing={!!modals.editingTransaction}
        manMerchant={modals.manMerchant}
        manAmount={modals.manAmount}
        manCategory={modals.manCategory}
        manType={modals.manType}
        manCurrency={modals.manCurrency}
        manMethod={modals.manMethod}
        manDate={modals.manDate}
        manTime={modals.manTime}
        manNotes={modals.manNotes}
        privacyMode={privacyMode}
        wallets={finance.wallets}
        pockets={finance.pockets}
        categories={finance.categories}
        selectedWalletId={modals.selectedWalletId}
        selectedPocketId={modals.selectedPocketId}
        onChangeMerchant={modals.setManMerchant}
        onChangeAmount={modals.setManAmount}
        onChangeCategory={modals.setManCategory}
        onChangeType={handleChangeManType}
        onChangeCurrency={(c) => {
          // Changing the currency of an already saved transaction would silently
          // reinterpret its amount, so it is locked while editing.
          if (modals.editingTransaction && c !== modals.manCurrency) {
            modals.showAlert(
              'Currency Locked',
              'The currency of a saved transaction cannot be changed. Delete it and record a new one if the amount was in a different currency.',
              undefined,
              'info'
            );
            return;
          }
          modals.setManCurrency(c);
          if (c === 'IDR' && modals.manAmount) {
            modals.setManAmount(sanitizeExpressionForCurrency(modals.manAmount, 'IDR'));
          }
          const firstMatching = finance.wallets.find((w) => w.currency === c);
          if (firstMatching) {
            modals.setSelectedWalletId(firstMatching.id);
          } else {
            modals.setSelectedWalletId('');
          }
          modals.setSelectedPocketId('');
        }}
        onChangeMethod={modals.setManMethod}
        onChangeDate={modals.setManDate}
        onChangeTime={modals.setManTime}
        onChangeNotes={modals.setManNotes}
        onSelectWallet={modals.setSelectedWalletId}
        onSelectPocket={modals.setSelectedPocketId}
        onOpenAddAccount={() => modals.openAddAccountModal(modals.manCurrency, 'manual')}
        onOpenAddPocket={() => modals.openAddPocketModal('manual')}
        onOpenCategoryManager={() => modals.openCategoryManager(modals.manType, true, 'manual')}
        onSave={handleSaveManualTransaction}
        onClose={modals.handleCloseManualModal}
      />

      {/* Modal 3: Create Account */}
      <NewAccountModal
        visible={modals.newAccountModalVisible}
        name={modals.newAccName}
        type={modals.newAccType}
        currency={modals.newAccCurrency}
        balance={modals.newAccBalance}
        accountNumber={modals.newAccNumber}
        onChangeName={modals.setNewAccName}
        onChangeType={modals.setNewAccType}
        onChangeCurrency={modals.setNewAccCurrency}
        onChangeBalance={modals.setNewAccBalance}
        onChangeAccountNumber={modals.setNewAccNumber}
        onCreate={async () => {
          try {
            const createdId = await finance.handleCreateAccount({
              name: modals.newAccName,
              type: modals.newAccType,
              balance: modals.newAccBalance,
              currency: modals.newAccCurrency,
              accountNumber: modals.newAccNumber,
            });
            modals.setSelectedWalletId(createdId);
            modals.setManCurrency(modals.newAccCurrency);
            modals.closeAddAccountModal();
          } catch {
            // Handled inside handleCreateAccount
          }
        }}
        onClose={modals.closeAddAccountModal}
      />

      {/* Modal 4: Manage Categories */}
      <CategoryManagerModal
        visible={modals.categoryModalVisible}
        categories={finance.categories}
        activeType={modals.newCatType}
        showAddForm={modals.showAddCategoryForm}
        newCatName={modals.newCatName}
        newCatIcon={modals.newCatIcon}
        onChangeActiveType={modals.setNewCatType}
        onToggleAddForm={modals.setShowAddCategoryForm}
        onChangeName={modals.setNewCatName}
        onChangeIcon={modals.setNewCatIcon}
        onCreateCategory={async () => {
          const createdName = modals.newCatName.trim();
          const created = await finance.handleCreateCategory({
            name: modals.newCatName,
            type: modals.newCatType,
            icon: modals.newCatIcon,
          });
          // Keep the form intact when creation failed (duplicate / empty name)
          if (!created) return;
          if (modals.manType === modals.newCatType) {
            modals.setManCategory(createdName);
          }
          modals.setNewCatName('');
          modals.setShowAddCategoryForm(false);
        }}
        onSelectCategory={(cat) => {
          modals.setManType(cat.type);
          modals.setManCategory(cat.name);
          if (modals.returnModal === 'manual') {
            modals.closeCategoryManager();
          }
        }}
        onDeleteCategory={finance.handleDeleteCategory}
        onClose={modals.closeCategoryManager}
      />

      {/* Modal 5: Transaction Detail */}
      <TxDetailModal
        transaction={modals.selectedTx}
        categoryIcon={modals.selectedTx ? finance.getCategoryIconName(modals.selectedTx.category, modals.selectedTx.type) : ''}
        pocketName={modals.selectedTx ? finance.getPocketName(modals.selectedTx.pocketId) : undefined}
        wallets={finance.wallets}
        transactions={finance.transactions}
        privacyMode={privacyMode}
        onEdit={modals.handleStartEditTransaction}
        onDuplicate={modals.handleDuplicateTransaction}
        onDelete={(tx) => finance.handleDeleteTransaction(tx, () => modals.setSelectedTx(null))}
        onClose={() => modals.setSelectedTx(null)}
      />

      {/* Modal 6: Create Pocket */}
      <NewPocketModal
        visible={modals.newPocketModalVisible}
        wallets={finance.wallets}
        selectedWalletId={modals.selectedWalletId}
        availableAmount={finance.getUnallocated(modals.selectedWalletId)}
        currency={
          finance.wallets.find((w) => w.id === modals.selectedWalletId)?.currency ||
          finance.activeCurrency
        }
        name={modals.newPocketName}
        balance={modals.newPocketBalance}
        target={modals.newPocketTarget}
        icon={modals.newPocketIcon}
        onSelectWallet={modals.setSelectedWalletId}
        onChangeName={modals.setNewPocketName}
        onChangeBalance={modals.setNewPocketBalance}
        onChangeTarget={modals.setNewPocketTarget}
        onChangeIcon={modals.setNewPocketIcon}
        onCreate={async () => {
          try {
            const createdId = await finance.handleCreatePocket({
              walletId: modals.selectedWalletId,
              name: modals.newPocketName,
              balance: modals.newPocketBalance,
              target: modals.newPocketTarget,
              icon: modals.newPocketIcon,
            });
            modals.setSelectedPocketId(createdId);
            modals.closeAddPocketModal();
          } catch {
            // Handled inside handleCreatePocket
          }
        }}
        onClose={modals.closeAddPocketModal}
      />

      {/* Modal 7: Adjust Pocket Funds */}
      <AdjustPocketModal
        pocket={modals.adjustPocketTarget}
        wallets={finance.wallets}
        pockets={finance.pockets}
        activeCurrency={finance.activeCurrency}
        privacyMode={privacyMode}
        mode={modals.adjustPocketMode}
        amount={modals.adjustPocketAmount}
        onChangeMode={modals.setAdjustPocketMode}
        onChangeAmount={modals.setAdjustPocketAmount}
        onConfirm={async () => {
          if (!modals.adjustPocketTarget) return;
          const applied = await finance.handleAdjustPocket(
            modals.adjustPocketTarget,
            modals.adjustPocketMode,
            modals.adjustPocketAmount
          );
          if (applied) modals.closeAdjustPocketModal();
        }}
        onClose={modals.closeAdjustPocketModal}
      />

      {/* Modal 8: Account Details & Unified Sub-Pockets Breakdown */}
      <AccountDetailModal
        wallet={currentViewingWallet}
        pockets={currentViewingPockets}
        transactions={currentViewingTransactions}
        privacyMode={privacyMode}
        onRenameWallet={finance.handleRenameWallet}
        onAdjustWalletBalance={finance.handleAdjustWalletBalance}
        onRenamePocket={finance.handleRenamePocket}
        onOpenAddPocket={modals.openAddPocketForWallet}
        onAdjustPocket={modals.openAdjustPocketFromDetail}
        onDeletePocket={finance.handleDeletePocket}
        onSelectTransaction={(tx) => modals.setSelectedTx(tx)}
        onDeleteWallet={(w) => finance.handleDeleteAccount(w, () => modals.closeAccountDetail())}
        getCategoryIconName={finance.getCategoryIconName}
        getPocketName={finance.getPocketName}
        onClose={modals.closeAccountDetail}
      />

      {/* Modal 9: Transfer Funds */}
      <TransferModal
        visible={modals.transferModalVisible}
        wallets={finance.wallets}
        activeCurrency={finance.activeCurrency}
        privacyMode={privacyMode}
        initialExchangeRate={finance.exchangeRate}
        onOpenAddAccount={() => modals.openAddAccountModal(finance.activeCurrency, 'none')}
        onExecuteTransfer={finance.handleExecuteTransfer}
        onClose={() => modals.setTransferModalVisible(false)}
      />

      {/* Modal 10: Settings & Data Management */}
      <SettingsModal
        visible={modals.settingsModalVisible}
        onExportBackup={finance.handleExportBackup}
        onExportCSV={finance.handleExportCSV}
        onImportBackup={finance.handleImportBackup}
        onWipeAllData={finance.handleWipeAllData}
        canUndoRestore={canUndoRestore}
        onUndoRestore={async () => {
          await finance.handleUndoRestore();
          setCanUndoRestore(false);
        }}
        appVersion={APP_VERSION}
        onClose={() => modals.setSettingsModalVisible(false)}
      />

      {/* Modal 11: Month / Calendar Picker */}
      <MonthPickerModal
        visible={modals.monthPickerVisible}
        selectedMonth={modals.monthPickerTarget === 'history' ? historyMonth : finance.selectedMonth}
        availableMonths={finance.availableMonths}
        showAllOption={true}
        onSelectMonth={(monthKey) => {
          if (modals.monthPickerTarget === 'history') {
            setHistoryMonth(monthKey);
          } else {
            finance.setSelectedMonth(monthKey);
          }
        }}
        onClose={modals.closeMonthPicker}
      />

      {/* Modal 12: Monthly Budget Limit */}
      <SetBudgetModal
        visible={modals.setBudgetModalVisible}
        activeCurrency={finance.activeCurrency}
        selectedMonth={finance.selectedMonth}
        currentBudget={finance.monthlyBudget}
        amount={modals.budgetInputAmount}
        onChangeAmount={modals.setBudgetInputAmount}
        onSave={async () => {
          const parsed = parseAmount(modals.budgetInputAmount, finance.activeCurrency);
          if (isNaN(parsed) || parsed < 0) {
            modals.showAlert('Invalid Amount', 'Please enter a valid budget amount.', undefined, 'warning');
            return;
          }
          await finance.handleSaveBudget(parsed);
          modals.closeSetBudget();
        }}
        onRemove={async () => {
          await finance.handleRemoveBudget();
          modals.closeSetBudget();
        }}
        onClose={modals.closeSetBudget}
      />

      {/* Modal 13: Allocation Strategy & Plans */}
      <AllocationPlanModal
        visible={modals.allocationPlanModalVisible}
        activeCurrency={finance.activeCurrency}
        plan={modals.selectedAllocationPlan}
        onSave={async (plan) => {
          await finance.handleSaveAllocationPlan(plan);
          modals.closeAllocationPlan();
        }}
        onDelete={async (planId) => {
          await finance.handleDeleteAllocationPlan(planId);
          modals.closeAllocationPlan();
        }}
        onClose={modals.closeAllocationPlan}
      />

      {/* Modal 14: Manage Account Order */}
      <ManageAccountOrderModal
        visible={modals.manageOrderModalVisible}
        wallets={finance.wallets}
        privacyMode={privacyMode}
        onSaveOrder={async (orderedWallets) => {
          await finance.handleUpdateWalletsOrder(orderedWallets.map((w) => w.id));
        }}
        onClose={() => modals.setManageOrderModalVisible(false)}
      />

      {/* Custom Global Alert Dialog */}
      <CustomAlertModal
        visible={modals.alertConfig.visible}
        alertId={modals.alertConfig.id}
        title={modals.alertConfig.title}
        message={modals.alertConfig.message}
        buttons={modals.alertConfig.buttons}
        type={modals.alertConfig.type}
        onClose={modals.hideAlert}
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
});
