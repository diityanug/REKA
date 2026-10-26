import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  StatusBar,
  Keyboard,
  StyleSheet,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

// Domain Services & Utilities
import {
  insertTransactionWithItems,
  updateTransaction,
} from './src/services/database';
import { extractReceiptFromBase64 } from './src/services/receiptScanner';
import { Palette } from './src/theme/tokens';
import { formatCurrency, parseAmount, formatCurrencyInput, getTodayDateStr } from './src/utils/formatters';
import { AppHaptics } from './src/utils/haptics';
import {
  TabType,
  FilterType,
  Transaction,
} from './src/types';

// Custom Hooks
import { useFinanceData } from './src/hooks/useFinanceData';
import { useAppModals } from './src/hooks/useAppModals';

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

export default function App() {
  return (
    <SafeAreaProvider>
      <MainApp />
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

  // Modals & Dialogs Hook
  const modals = useAppModals();

  // Finance Domain Data Hook
  const finance = useFinanceData({ showAlert: modals.showAlert });

  // History Filter States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [historyFilter, setHistoryFilter] = useState<FilterType>('all');
  const [historyCategory, setHistoryCategory] = useState<string>('all');
  const [historyMonth, setHistoryMonth] = useState<string>('all');

  // Sync selected account with active currency
  useEffect(() => {
    if (finance.wallets.length === 0) return;
    const currentWallet = finance.wallets.find((w) => w.id === modals.selectedWalletId);
    if (!currentWallet || currentWallet.currency !== finance.activeCurrency) {
      const matching = finance.wallets.find((w) => w.currency === finance.activeCurrency);
      if (matching) {
        modals.setSelectedWalletId(matching.id);
      }
    }
  }, [finance.activeCurrency, finance.wallets, modals.selectedWalletId]);

  // Keep selectedPocketId valid for active selectedWalletId
  useEffect(() => {
    if (
      modals.selectedPocketId &&
      !finance.pockets.some((p) => p.id === modals.selectedPocketId && p.walletId === modals.selectedWalletId)
    ) {
      modals.setSelectedPocketId('');
    }
  }, [modals.selectedWalletId, finance.pockets, modals.selectedPocketId]);

  // Currently viewed account for deep detail breakdown
  const currentViewingWallet = useMemo(() => {
    const v = modals.viewingWallet;
    if (!v) return null;
    return finance.wallets.find((w) => w.id === v.id) || null;
  }, [modals.viewingWallet, finance.wallets]);

  const currentViewingPockets = useMemo(() => {
    if (!currentViewingWallet) return [];
    return finance.pockets.filter((p) => p.walletId === currentViewingWallet.id);
  }, [currentViewingWallet, finance.pockets]);

  const currentViewingTransactions = useMemo(() => {
    if (!currentViewingWallet) return [];
    return finance.transactions.filter((t) => t.walletId === currentViewingWallet.id);
  }, [currentViewingWallet, finance.transactions]);

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

    // Exclude the incoming mirror leg of a paired transfer so only 1 card represents the transfer
    const deduplicated = finance.transactions.filter((tx) => {
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

      const matchesCurrency = tx.currency === finance.activeCurrency;
      return matchesSearch && matchesType && matchesCategory && matchesMonth && matchesCurrency;
    });
  }, [
    finance.transactions,
    finance.wallets,
    finance.activeCurrency,
    finance.getPocketName,
    searchQuery,
    historyFilter,
    historyCategory,
    historyMonth,
  ]);

  // Aggregate stats for filtered history view
  const historyFlowStats = useMemo(() => {
    let income = 0;
    let expense = 0;
    filteredTransactions.forEach((tx) => {
      if (tx.category === 'Transfer' || tx.transferPairId) return;
      if (tx.type === 'income') income += tx.amount;
      if (tx.type === 'expense') expense += tx.amount;
    });
    const total = income + expense;
    return {
      income,
      expense,
      incomePct: total > 0 ? (income / total) * 100 : 0,
      expensePct: total > 0 ? (expense / total) * 100 : 0,
    };
  }, [filteredTransactions]);

  // Camera scan handler
  const handleScanReceipt = async () => {
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

  // Process receipt through Gemini API
  const processReceiptImage = async (base64: string) => {
    setScanning(true);
    try {
      const data = await extractReceiptFromBase64(base64);
      AppHaptics.success();
      modals.setExtractedData(data);

      const detectedCurrency = data.currency || finance.activeCurrency;
      if (finance.wallets.some((w) => w.currency === detectedCurrency)) {
        finance.setActiveCurrency(detectedCurrency);
      }

      const matchingWallet =
        finance.wallets.find((w) => w.currency === detectedCurrency) ||
        finance.wallets.find((w) => w.currency === finance.activeCurrency) ||
        finance.wallets[0];

      if (matchingWallet) {
        modals.setSelectedWalletId(matchingWallet.id);
      }

      modals.setReviewModalVisible(true);
    } catch (err: any) {
      AppHaptics.error();
      modals.showAlert(
        'Receipt Analysis Notice',
        err.message || 'We could not automatically extract the receipt details. Would you like to enter them manually?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Enter Manually',
            onPress: () => {
              modals.openManualModal(finance.activeCurrency);
            },
          },
        ],
        'confirm'
      );
    } finally {
      setScanning(false);
    }
  };

  // Save scanned receipt transaction
  const handleSaveScanTransaction = async (notesFromModal?: string, editedMerchant?: string) => {
    if (!modals.extractedData) return;
    if (!modals.selectedWalletId) {
      modals.showAlert('Account Required', 'Please create an account first to record this receipt.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Create Account', onPress: () => modals.openAddAccountModal(finance.activeCurrency, 'review') },
      ], 'warning');
      return;
    }

    const targetWallet = finance.wallets.find((w) => w.id === modals.selectedWalletId);
    if (!targetWallet) {
      modals.showAlert('Account Required', 'Please select a valid account to record this receipt.', undefined, 'warning');
      return;
    }

    try {
      AppHaptics.heavy();
      const txCurrency = targetWallet.currency;

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

      await insertTransactionWithItems(
        {
          walletId: modals.selectedWalletId,
          pocketId: modals.selectedPocketId || '',
          merchantName: finalMerchantName,
          category: modals.extractedData.category,
          type: modals.extractedData.type,
          amount: modals.extractedData.totalAmount,
          currency: txCurrency,
          taxAmount: 0,
          discountAmount: 0,
          timestamp: txTimestamp,
          paymentMethod: modals.extractedData.paymentMethod || 'QRIS',
          notes: (notesFromModal || '').trim(),
        },
        []
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
    if (!modals.selectedWalletId) {
      modals.showAlert('Account Required', 'Please create an account first to record transactions.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Create Account', onPress: () => modals.openAddAccountModal(finance.activeCurrency, 'manual') },
      ], 'warning');
      return;
    }

    try {
      AppHaptics.heavy();
      const targetWallet = finance.wallets.find((w) => w.id === modals.selectedWalletId);
      const txCurrency = targetWallet ? targetWallet.currency : modals.manCurrency;

      // Construct ISO timestamp using device local date and time
      const now = new Date();
      let txTimestamp: string;
      const dateParts = modals.manDate.split('-').map(Number);
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

      if (modals.editingTransaction) {
        await updateTransaction(modals.editingTransaction.id, {
          walletId: modals.selectedWalletId,
          pocketId: modals.selectedPocketId || '',
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
            walletId: modals.selectedWalletId,
            pocketId: modals.selectedPocketId || '',
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

  if (!splashFinished || (finance.loading && !finance.initialAppReady)) {
    return (
      <AnimatedSplashScreen
        minDurationMs={1200}
        onAnimationFinish={() => setSplashFinished(true)}
      />
    );
  }

  return (
    <View style={[styles.mainWrapper, { paddingTop: Math.max(insets.top, 14) }]}>
      <StatusBar barStyle="dark-content" />

      {/* Top App Bar */}
      <AppHeader
        activeCurrency={finance.activeCurrency}
        privacyMode={privacyMode}
        onCurrencyChange={(c) => {
          finance.setActiveCurrency(c);
          modals.setManCurrency(c);
        }}
        onTogglePrivacy={() => setPrivacyMode(!privacyMode)}
        onOpenSettings={() => modals.setSettingsModalVisible(true)}
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
          onClearSearch={() => setSearchQuery('')}
          onChangeFilter={handleHistoryFilterChange}
          onChangeCategory={setHistoryCategory}
          onChangeMonth={setHistoryMonth}
          onOpenMonthPicker={() => modals.openMonthPicker('history')}
          onResetAllFilters={() => {
            setSearchQuery('');
            setHistoryFilter('all');
            setHistoryCategory('all');
            setHistoryMonth('all');
          }}
          onOpenManualModal={() => modals.openManualModal(finance.activeCurrency)}
          onSelectTransaction={(tx) => modals.setSelectedTx(tx)}
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
              pockets={finance.pockets}
              transactions={finance.transactions}
              activeCurrency={finance.activeCurrency}
              privacyMode={privacyMode}
              totalBalance={finance.totalBalance}
              positiveLiquidityTotal={finance.positiveLiquidityTotal}
              selectedMonth={finance.selectedMonth}
              availableMonths={finance.availableMonths}
              last7DaysFlow={finance.last7DaysFlow}
              scanning={scanning}
              selectedWalletId={modals.selectedWalletId}
              onNavigateToAccounts={() => setActiveTab('accounts')}
              onSelectMonth={finance.setSelectedMonth}
              onOpenMonthPicker={() => modals.openMonthPicker('overview')}
              onOpenTransferModal={() => modals.setTransferModalVisible(true)}
              onOpenManualModal={() => modals.openManualModal(finance.activeCurrency)}
              onScanReceipt={handleScanReceipt}
              onPickFromGallery={handlePickFromGallery}
              onOpenAccountDetail={(w) => {
                modals.setSelectedWalletId(w.id);
                finance.setActiveCurrency(w.currency);
                modals.openAccountDetail(w);
              }}
              onOpenAddAccount={() => modals.openAddAccountModal(finance.activeCurrency, 'none')}
              onSelectTransaction={(tx) => modals.setSelectedTx(tx)}
              getCategoryIconName={finance.getCategoryIconName}
              getPocketName={finance.getPocketName}
            />
          )}

          {activeTab === 'accounts' && (
            <AccountsTab
              wallets={finance.wallets}
              pockets={finance.pockets}
              activeCurrency={finance.activeCurrency}
              positiveLiquidityTotal={finance.positiveLiquidityTotal}
              privacyMode={privacyMode}
              selectedWalletId={modals.selectedWalletId}
              allocationPlans={finance.allocationPlans}
              onOpenAccountDetail={(w) => {
                modals.setSelectedWalletId(w.id);
                finance.setActiveCurrency(w.currency);
                modals.openAccountDetail(w);
              }}
              onOpenAddAccount={() => modals.openAddAccountModal(finance.activeCurrency, 'none')}
              onOpenManageOrder={() => modals.setManageOrderModalVisible(true)}
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
              monthlyBudget={finance.monthlyBudget}
              onSelectMonth={finance.setSelectedMonth}
              onOpenMonthPicker={() => modals.openMonthPicker('analytics')}
              onOpenCategoryManager={(type) => modals.openCategoryManager(type || 'expense', false, 'none')}
              onOpenSetBudget={() => {
                const initStr = finance.monthlyBudget > 0 ? formatCurrencyInput(String(finance.monthlyBudget), finance.activeCurrency) : '';
                modals.openSetBudget(initStr);
              }}
              getCategoryIconName={finance.getCategoryIconName}
            />
          )}
        </ScrollView>
      )}

      {/* Floating Bottom Navigation Bar */}
      <BottomTabBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenManualTransaction={() => modals.openManualModal(finance.activeCurrency)}
        bottomInset={insets.bottom}
      />

      {/* Scanning Receipt In-Progress Custom Modal */}
      <ScanningReceiptModal visible={scanning} />

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
        onOpenAddAccount={() => modals.openAddAccountModal(finance.activeCurrency, 'review')}
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
        manNotes={modals.manNotes}
        wallets={finance.wallets}
        pockets={finance.pockets}
        categories={finance.categories}
        selectedWalletId={modals.selectedWalletId}
        selectedPocketId={modals.selectedPocketId}
        onChangeMerchant={modals.setManMerchant}
        onChangeAmount={modals.setManAmount}
        onChangeCategory={modals.setManCategory}
        onChangeType={modals.setManType}
        onChangeCurrency={(c) => {
          modals.setManCurrency(c);
          const firstMatching = finance.wallets.find((w) => w.currency === c);
          if (firstMatching) modals.setSelectedWalletId(firstMatching.id);
        }}
        onChangeMethod={modals.setManMethod}
        onChangeDate={modals.setManDate}
        onChangeNotes={modals.setManNotes}
        onSelectWallet={modals.setSelectedWalletId}
        onSelectPocket={modals.setSelectedPocketId}
        onOpenAddAccount={() => modals.openAddAccountModal(finance.activeCurrency, 'manual')}
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
          await finance.handleCreateCategory({
            name: modals.newCatName,
            type: modals.newCatType,
            icon: modals.newCatIcon,
          });
          modals.setNewCatName('');
          modals.setShowAddCategoryForm(false);
          if (modals.manType === modals.newCatType) {
            modals.setManCategory(modals.newCatName.trim());
          }
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
        categoryIcon={modals.selectedTx ? finance.getCategoryIconName(modals.selectedTx.category, modals.selectedTx.type) : 'HelpCircle'}
        pocketName={modals.selectedTx ? finance.getPocketName(modals.selectedTx.pocketId) : undefined}
        wallets={finance.wallets}
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
        activeCurrency={finance.activeCurrency}
        privacyMode={privacyMode}
        mode={modals.adjustPocketMode}
        amount={modals.adjustPocketAmount}
        onChangeMode={(m) => {}}
        onChangeAmount={modals.setAdjustPocketAmount}
        onConfirm={async () => {
          if (modals.adjustPocketTarget) {
            await finance.handleAdjustPocket(
              modals.adjustPocketTarget,
              modals.adjustPocketMode,
              modals.adjustPocketAmount
            );
            modals.closeAdjustPocketModal();
          }
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
        activeCurrency={finance.activeCurrency}
        privacyMode={privacyMode}
        onSaveOrder={async (orderedWallets) => {
          await finance.handleUpdateWalletsOrder(orderedWallets.map((w) => w.id));
        }}
        onClose={() => modals.setManageOrderModalVisible(false)}
      />

      {/* Custom Global Alert Dialog */}
      <CustomAlertModal
        visible={modals.alertConfig.visible}
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
