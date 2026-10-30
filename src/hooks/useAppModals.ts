import { useState, useCallback, useRef } from 'react';
import { Keyboard } from 'react-native';
import {
  Wallet,
  Pocket,
  Transaction,
  AllocationPlan,
  CurrencyType,
  AccountType,
  TransactionType,
  ReturnModalType,
  ExtractedReceiptData,
} from '../types';
import { AlertButton, AlertType } from '../components/CustomAlertModal';
import { AppHaptics } from '../utils/haptics';
import { getTodayDateStr, getCurrentTimeStr, getTimeStrFromTimestamp } from '../utils/formatters';

export function useAppModals() {
  // Alert dialog state
  const alertSeq = useRef(0);
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    id: string;
    title: string;
    message?: string;
    buttons?: AlertButton[];
    type?: AlertType;
  }>({
    visible: false,
    id: '',
    title: '',
  });

  const showAlert = useCallback(
    (
      title: string,
      message?: string,
      buttons?: AlertButton[],
      type: AlertType = 'info'
    ) => {
      alertSeq.current += 1;
      setAlertConfig({
        visible: true,
        id: `alert_${alertSeq.current}`,
        title,
        message,
        buttons: buttons || [{ text: 'OK', style: 'default' }],
        type,
      });
    },
    []
  );

  // Only close the dialog that is actually on screen; a chained alert stays open
  const hideAlert = useCallback((alertId?: string) => {
    setAlertConfig((prev) => {
      if (alertId && prev.id !== alertId) return prev;
      return { ...prev, visible: false };
    });
  }, []);

  // Modal Return State (prevents stacking multiple Modals)
  const [returnModal, setReturnModal] = useState<ReturnModalType>('none');
  const [returnWalletDetail, setReturnWalletDetail] = useState<Wallet | null>(null);

  // Settings & Reorder
  const [settingsModalVisible, setSettingsModalVisible] = useState<boolean>(false);
  const [manageOrderModalVisible, setManageOrderModalVisible] = useState<boolean>(false);

  // Transfer
  const [transferModalVisible, setTransferModalVisible] = useState<boolean>(false);

  // Month Picker
  const [monthPickerVisible, setMonthPickerVisible] = useState<boolean>(false);
  const [monthPickerTarget, setMonthPickerTarget] = useState<'overview' | 'analytics' | 'history'>('overview');

  const openMonthPicker = useCallback((target: 'overview' | 'analytics' | 'history') => {
    setMonthPickerTarget(target);
    setMonthPickerVisible(true);
  }, []);

  const closeMonthPicker = useCallback(() => {
    setMonthPickerVisible(false);
  }, []);

  // Set Budget
  const [setBudgetModalVisible, setSetBudgetModalVisible] = useState<boolean>(false);
  const [budgetInputAmount, setBudgetInputAmount] = useState<string>('');

  const openSetBudget = useCallback((initialAmountStr: string = '') => {
    AppHaptics.light();
    setBudgetInputAmount(initialAmountStr);
    setSetBudgetModalVisible(true);
  }, []);

  const closeSetBudget = useCallback(() => {
    Keyboard.dismiss();
    setSetBudgetModalVisible(false);
  }, []);

  // Allocation Plans
  const [allocationPlanModalVisible, setAllocationPlanModalVisible] = useState<boolean>(false);
  const [selectedAllocationPlan, setSelectedAllocationPlan] = useState<AllocationPlan | null>(null);

  const openCreateAllocationPlan = useCallback(() => {
    AppHaptics.light();
    setSelectedAllocationPlan(null);
    setAllocationPlanModalVisible(true);
  }, []);

  const openEditAllocationPlan = useCallback((plan: AllocationPlan) => {
    AppHaptics.light();
    setSelectedAllocationPlan(plan);
    setAllocationPlanModalVisible(true);
  }, []);

  const closeAllocationPlan = useCallback(() => {
    Keyboard.dismiss();
    setAllocationPlanModalVisible(false);
  }, []);

  // Account Detail
  const [viewingWallet, setViewingWallet] = useState<Wallet | null>(null);

  const openAccountDetail = useCallback((w: Wallet) => {
    AppHaptics.selection();
    setViewingWallet(w);
  }, []);

  const closeAccountDetail = useCallback(() => {
    setViewingWallet(null);
  }, []);

  // Create Account
  const [newAccountModalVisible, setNewAccountModalVisible] = useState<boolean>(false);
  const [newAccName, setNewAccName] = useState<string>('');
  const [newAccType, setNewAccType] = useState<AccountType>('Bank');
  const [newAccCurrency, setNewAccCurrency] = useState<CurrencyType>('IDR');
  const [newAccBalance, setNewAccBalance] = useState<string>('');
  const [newAccNumber, setNewAccNumber] = useState<string>('');

  const openAddAccountModal = useCallback(
    (activeCurrency: CurrencyType, fromModal: ReturnModalType = 'none') => {
      AppHaptics.light();
      setReturnModal(fromModal);
      setNewAccName('');
      setNewAccBalance('');
      setNewAccNumber('');
      setNewAccType('Bank');
      setNewAccCurrency(activeCurrency);
      setNewAccountModalVisible(true);
    },
    []
  );

  const closeAddAccountModal = useCallback(() => {
    Keyboard.dismiss();
    setNewAccountModalVisible(false);
    setReturnModal('none');
  }, []);

  // Selected Account & Pocket for transaction recording
  const [selectedWalletId, setSelectedWalletId] = useState<string>('');
  const [selectedPocketId, setSelectedPocketId] = useState<string>('');

  // Create & Adjust Sub-Account / Pocket
  const [newPocketModalVisible, setNewPocketModalVisible] = useState<boolean>(false);
  const [newPocketName, setNewPocketName] = useState<string>('');
  const [newPocketBalance, setNewPocketBalance] = useState<string>('');
  const [newPocketTarget, setNewPocketTarget] = useState<string>('');
  const [newPocketIcon, setNewPocketIcon] = useState<string>('Briefcase');

  const openAddPocketModal = useCallback((fromModal: ReturnModalType = 'none') => {
    AppHaptics.light();
    setReturnModal(fromModal);
    setNewPocketName('');
    setNewPocketBalance('');
    setNewPocketTarget('');
    setNewPocketIcon('Briefcase');
    setNewPocketModalVisible(true);
  }, []);

  const openAddPocketForWallet = useCallback((w: Wallet) => {
    AppHaptics.light();
    setSelectedWalletId(w.id);
    setNewPocketName('');
    setNewPocketBalance('');
    setNewPocketTarget('');
    setNewPocketIcon('FolderTree');
    setReturnWalletDetail(w);
    setNewPocketModalVisible(true);
  }, []);

  const closeAddPocketModal = useCallback(() => {
    Keyboard.dismiss();
    setNewPocketModalVisible(false);
    setReturnModal('none');
  }, []);

  const [adjustPocketTarget, setAdjustPocketTarget] = useState<Pocket | null>(null);
  const [adjustPocketMode, setAdjustPocketMode] = useState<'allocate' | 'release'>('allocate');
  const [adjustPocketAmount, setAdjustPocketAmount] = useState<string>('');

  const openAdjustPocketFromDetail = useCallback((pocket: Pocket, w: Wallet) => {
    AppHaptics.selection();
    setReturnWalletDetail(w);
    setAdjustPocketMode('allocate');
    setAdjustPocketAmount('');
    setAdjustPocketTarget(pocket);
  }, []);
  const closeAdjustPocketModal = useCallback(() => {
    Keyboard.dismiss();
    setAdjustPocketTarget(null);
  }, []);

  // Category Manager Modal
  const [categoryModalVisible, setCategoryModalVisible] = useState<boolean>(false);
  const [showAddCategoryForm, setShowAddCategoryForm] = useState<boolean>(false);
  const [newCatName, setNewCatName] = useState<string>('');
  const [newCatType, setNewCatType] = useState<TransactionType>('expense');
  const [newCatIcon, setNewCatIcon] = useState<string>('Utensils');

  const openCategoryManager = useCallback(
    (type: TransactionType, openCreator: boolean = false, fromModal: ReturnModalType = 'none') => {
      AppHaptics.light();
      setReturnModal(fromModal);
      setNewCatType(type);
      setNewCatName('');
      setNewCatIcon('Utensils');
      setShowAddCategoryForm(openCreator);
      setCategoryModalVisible(true);
    },
    []
  );

  const closeCategoryManager = useCallback(() => {
    Keyboard.dismiss();
    setCategoryModalVisible(false);
    setReturnModal('none');
  }, []);

  // Transaction Detail Modal
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  // Manual Transaction Modal
  const [manualTxModalVisible, setManualTxModalVisible] = useState<boolean>(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [manMerchant, setManMerchant] = useState<string>('');
  const [manAmount, setManAmount] = useState<string>('');
  const [manCategory, setManCategory] = useState<string>('Food & Beverages');
  const [manType, setManType] = useState<TransactionType>('expense');
  const [manCurrency, setManCurrency] = useState<CurrencyType>('IDR');
  const [manMethod, setManMethod] = useState<string>('QRIS');
  const [manDate, setManDate] = useState<string>(() => getTodayDateStr());
  const [manTime, setManTime] = useState<string>(() => getCurrentTimeStr());
  const [manNotes, setManNotes] = useState<string>('');

  const openManualModal = useCallback((activeCurrency: CurrencyType) => {
    AppHaptics.light();
    setEditingTransaction(null);
    setManMerchant('');
    setManAmount('');
    setManNotes('');
    setManCategory('Food & Beverages');
    setManType('expense');
    setManCurrency(activeCurrency);
    setManMethod('QRIS');
    setManDate(getTodayDateStr());
    setManTime(getCurrentTimeStr());
    setManualTxModalVisible(true);
  }, []);

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
    // Keep the original time of day so editing never silently rewrites it
    setManTime(getTimeStrFromTimestamp(tx.timestamp));
    setTimeout(() => {
      setManualTxModalVisible(true);
    }, 220);
  }, []);

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
    setManTime(getCurrentTimeStr());
    setTimeout(() => {
      setManualTxModalVisible(true);
    }, 220);
  }, []);

  const handleCloseManualModal = useCallback(() => {
    Keyboard.dismiss();
    setManualTxModalVisible(false);
  }, []);

  // Review Scanned Receipt Modal
  const [reviewModalVisible, setReviewModalVisible] = useState<boolean>(false);
  const [extractedData, setExtractedData] = useState<ExtractedReceiptData | null>(null);

  const closeReviewModal = useCallback(() => {
    setReviewModalVisible(false);
  }, []);

  return {
    alertConfig,
    showAlert,
    hideAlert,
    returnModal,
    setReturnModal,
    returnWalletDetail,
    setReturnWalletDetail,
    settingsModalVisible,
    setSettingsModalVisible,
    manageOrderModalVisible,
    setManageOrderModalVisible,
    transferModalVisible,
    setTransferModalVisible,
    monthPickerVisible,
    monthPickerTarget,
    openMonthPicker,
    closeMonthPicker,
    setBudgetModalVisible,
    budgetInputAmount,
    setBudgetInputAmount,
    openSetBudget,
    closeSetBudget,
    allocationPlanModalVisible,
    selectedAllocationPlan,
    openCreateAllocationPlan,
    openEditAllocationPlan,
    closeAllocationPlan,
    viewingWallet,
    setViewingWallet,
    openAccountDetail,
    closeAccountDetail,
    newAccountModalVisible,
    newAccName,
    setNewAccName,
    newAccType,
    setNewAccType,
    newAccCurrency,
    setNewAccCurrency,
    newAccBalance,
    setNewAccBalance,
    newAccNumber,
    setNewAccNumber,
    openAddAccountModal,
    closeAddAccountModal,
    selectedWalletId,
    setSelectedWalletId,
    selectedPocketId,
    setSelectedPocketId,
    newPocketModalVisible,
    newPocketName,
    setNewPocketName,
    newPocketBalance,
    setNewPocketBalance,
    newPocketTarget,
    setNewPocketTarget,
    newPocketIcon,
    setNewPocketIcon,
    openAddPocketModal,
    openAddPocketForWallet,
    closeAddPocketModal,
    adjustPocketTarget,
    adjustPocketMode,
    setAdjustPocketMode,
    adjustPocketAmount,
    setAdjustPocketAmount,
    openAdjustPocketFromDetail,
    closeAdjustPocketModal,
    categoryModalVisible,
    showAddCategoryForm,
    setShowAddCategoryForm,
    newCatName,
    setNewCatName,
    newCatType,
    setNewCatType,
    newCatIcon,
    setNewCatIcon,
    openCategoryManager,
    closeCategoryManager,
    selectedTx,
    setSelectedTx,
    manualTxModalVisible,
    setManualTxModalVisible,
    editingTransaction,
    manMerchant,
    setManMerchant,
    manAmount,
    setManAmount,
    manCategory,
    setManCategory,
    manType,
    setManType,
    manCurrency,
    setManCurrency,
    manMethod,
    setManMethod,
    manDate,
    setManDate,
    manTime,
    setManTime,
    manNotes,
    setManNotes,
    openManualModal,
    handleStartEditTransaction,
    handleDuplicateTransaction,
    handleCloseManualModal,
    reviewModalVisible,
    setReviewModalVisible,
    extractedData,
    setExtractedData,
    closeReviewModal,
  };
}
