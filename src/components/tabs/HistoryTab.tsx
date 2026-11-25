import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SectionList,
  StyleSheet,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Search,
  X,
  Receipt,
  RotateCcw,
  SlidersHorizontal,
  Plus,
  Trash2,
  CheckSquare,
  HandCoins,
} from 'lucide-react-native';
import { Palette, Typography } from '../../theme/tokens';
import { Transaction, CurrencyType, FilterType, Wallet, Pocket, BillingCycleConfig } from '../../types';
import { formatCurrency, formatMonthYear, formatMonthShort, formatDate } from '../../utils/formatters';
import {
  DEFAULT_BILLING_CYCLE,
  getPeriodKeyForTimestamp,
  formatCycleRangeShort,
} from '../../utils/billingCycle';
import { AppHaptics } from '../../utils/haptics';
import { TransactionItemRow } from '../TransactionItemRow';
import { triggerSmoothLayout } from '../MotionPrimitives';
import { HistoryFilterModal } from '../modals/HistoryFilterModal';

interface HistoryTabProps {
  transactions: Transaction[];
  activeCurrency: CurrencyType;
  privacyMode: boolean;
  searchQuery: string;
  historyFilter: FilterType;
  historyCategory: string;
  historyMonth: string;
  historyLentFilter?: 'all' | 'outstanding' | 'settled';
  historyWalletId?: string;
  historyPocketId?: string;
  historyPaymentMethod?: string;
  historyDateFrom?: string;
  historyDateTo?: string;
  wallets?: Wallet[];
  pockets?: Pocket[];
  billingCycle?: BillingCycleConfig;
  availablePaymentMethods?: string[];
  outstandingLentCount?: number;
  outstandingLentTotal?: number;
  availableCategories: string[];
  availableExpenseCategories?: string[];
  availableIncomeCategories?: string[];
  availableMonths: string[];
  historyFlowStats: {
    income: number;
    expense: number;
    incomePct: number;
    expensePct: number;
    usdIncome?: number;
    usdExpense?: number;
  };
  onChangeSearch: (query: string) => void;
  onClearSearch: () => void;
  onChangeFilter: (filter: FilterType) => void;
  onChangeCategory: (category: string) => void;
  onChangeMonth: (month: string) => void;
  onChangeLentFilter?: (filter: 'all' | 'outstanding' | 'settled') => void;
  onChangeWalletId?: (walletId: string) => void;
  onChangePocketId?: (pocketId: string) => void;
  onChangePaymentMethod?: (method: string) => void;
  onChangeDateFrom?: (dateStr: string) => void;
  onChangeDateTo?: (dateStr: string) => void;
  onOpenMonthPicker: () => void;
  onResetAllFilters: () => void;
  onOpenManualModal?: () => void;
  onSelectTransaction: (tx: Transaction) => void;
  onDeleteTransactionsBatch?: (ids: string[], onDeleted?: () => void) => void | Promise<void>;
  getCategoryIconName: (category: string, type?: Transaction['type']) => string;
  getPocketName: (pocketId?: string) => string;
}

export const HistoryTab = React.memo<HistoryTabProps>(({
  transactions,
  activeCurrency,
  privacyMode,
  searchQuery,
  historyFilter,
  historyCategory,
  historyMonth,
  historyLentFilter = 'all',
  historyWalletId = 'all',
  historyPocketId = 'all',
  historyPaymentMethod = 'all',
  historyDateFrom = '',
  historyDateTo = '',
  wallets = [],
  pockets = [],
  billingCycle = DEFAULT_BILLING_CYCLE,
  availablePaymentMethods = [],
  outstandingLentCount = 0,
  outstandingLentTotal = 0,
  availableCategories,
  availableExpenseCategories = [],
  availableIncomeCategories = [],
  availableMonths,
  historyFlowStats,
  onChangeSearch,
  onClearSearch,
  onChangeFilter,
  onChangeCategory,
  onChangeMonth,
  onChangeLentFilter,
  onChangeWalletId,
  onChangePocketId,
  onChangePaymentMethod,
  onChangeDateFrom,
  onChangeDateTo,
  onOpenMonthPicker,
  onResetAllFilters,
  onOpenManualModal,
  onSelectTransaction,
  onDeleteTransactionsBatch,
  getCategoryIconName,
  getPocketName,
}) => {
  const insets = useSafeAreaInsets();
  const [filterModalVisible, setFilterModalVisible] = useState<boolean>(false);
  const [localSearch, setLocalSearch] = useState<string>(searchQuery);
  const [lastEmittedSearch, setLastEmittedSearch] = useState<string | null>(null);
  const [prevSearchQuery, setPrevSearchQuery] = useState<string>(searchQuery);

  // Sync the local (debounced) input only on external changes, never overwriting keys
  // typed right after our own debounced commit.
  if (searchQuery !== prevSearchQuery) {
    setPrevSearchQuery(searchQuery);
    if (searchQuery === lastEmittedSearch) {
      setLastEmittedSearch(null);
    } else {
      setLastEmittedSearch(null);
      setLocalSearch(searchQuery);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== searchQuery) {
        setLastEmittedSearch(localSearch);
        onChangeSearch(localSearch);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [localSearch, searchQuery, onChangeSearch]);

  // Multi-Select Batch Actions State
  const [isSelectionMode, setIsSelectionMode] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const walletById = useMemo(() => {
    const map = new Map<string, Wallet>();
    wallets.forEach((w) => map.set(w.id, w));
    return map;
  }, [wallets]);

  const isTxArchived = useCallback((tx: Transaction) => {
    return Boolean(
      tx.deletedWalletName ||
        tx.deletedPocketName ||
        tx.pairedDeletedWalletName ||
        tx.pairedDeletedPocketName
    );
  }, []);

  const selectableCount = useMemo(
    () => transactions.filter((t) => !isTxArchived(t)).length,
    [transactions, isTxArchived]
  );

  const handleToggleSelectTransaction = useCallback((tx: Transaction) => {
    if (isTxArchived(tx)) {
      onSelectTransaction(tx);
      return;
    }
    AppHaptics.selection();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(tx.id)) {
        next.delete(tx.id);
      } else {
        next.add(tx.id);
      }
      return next;
    });
  }, [isTxArchived, onSelectTransaction]);

  const handleLongPressTransaction = useCallback((tx: Transaction) => {
    if (isTxArchived(tx)) {
      onSelectTransaction(tx);
      return;
    }
    AppHaptics.heavy();
    if (!isSelectionMode) {
      triggerSmoothLayout();
      setIsSelectionMode(true);
      setSelectedIds(new Set([tx.id]));
    } else {
      handleToggleSelectTransaction(tx);
    }
  }, [isSelectionMode, handleToggleSelectTransaction, isTxArchived, onSelectTransaction]);

  const handleSelectAll = useCallback(() => {
    AppHaptics.selection();
    const selectableIds = transactions.filter((t) => !isTxArchived(t)).map((t) => t.id);
    if (selectableIds.length > 0 && selectedIds.size === selectableIds.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableIds));
    }
  }, [selectedIds.size, transactions, isTxArchived]);

  const handleExitSelectionMode = useCallback(() => {
    AppHaptics.light();
    triggerSmoothLayout();
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleBatchDelete = useCallback(() => {
    if (selectedIds.size === 0 || !onDeleteTransactionsBatch) return;
    AppHaptics.heavy();
    const ids = Array.from(selectedIds);
    onDeleteTransactionsBatch(ids, handleExitSelectionMode);
  }, [selectedIds, onDeleteTransactionsBatch, handleExitSelectionMode]);

  const handleClearSearch = useCallback(() => {
    setLocalSearch('');
    setLastEmittedSearch('');
    onChangeSearch('');
    onClearSearch();
  }, [onChangeSearch, onClearSearch]);

  const activeFilterCount =
    (historyFilter !== 'all' ? 1 : 0) +
    (historyCategory !== 'all' ? 1 : 0) +
    (historyMonth !== 'all' ? 1 : 0) +
    (historyLentFilter !== 'all' ? 1 : 0) +
    (historyWalletId !== 'all' ? 1 : 0) +
    (historyPocketId !== 'all' ? 1 : 0) +
    (historyPaymentMethod !== 'all' ? 1 : 0) +
    (historyDateFrom || historyDateTo ? 1 : 0);

  const isFilterActive = activeFilterCount > 0 || searchQuery.trim().length > 0;

  // Group transactions chronologically by period (respects Payday Cycle when configured)
  const monthGroups = useMemo(() => {
    const groups: {
      monthKey: string;
      monthTitle: string;
      rangeBadge: string;
      count: number;
      totalExpense: number;
      totalIncome: number;
      totalUsdExpense: number;
      totalUsdIncome: number;
      transactions: Transaction[];
    }[] = [];
    const map = new Map<string, (typeof groups)[0]>();

    for (const tx of transactions) {
      const resolvedKey = getPeriodKeyForTimestamp(tx.timestamp, billingCycle);
      const key = resolvedKey || 'Other';
      const rangeBadge = resolvedKey ? formatCycleRangeShort(resolvedKey, billingCycle) : '';
      const title = resolvedKey ? formatMonthYear(resolvedKey) : 'Other';

      if (!map.has(key)) {
        const g = {
          monthKey: key,
          monthTitle: title,
          rangeBadge,
          count: 0,
          totalExpense: 0,
          totalIncome: 0,
          totalUsdExpense: 0,
          totalUsdIncome: 0,
          transactions: [],
        };
        map.set(key, g);
        groups.push(g);
      }
      const group = map.get(key)!;
      group.transactions.push(tx);
      group.count += 1;
      // Only non-transfer rows contribute to cashflow totals
      if (tx.category !== 'Transfer' && !tx.transferPairId) {
        if (tx.currency === 'USD') {
          if (tx.type === 'expense') group.totalUsdExpense += tx.amount;
          if (tx.type === 'income') group.totalUsdIncome += tx.amount;
        } else {
          if (tx.type === 'expense') group.totalExpense += tx.amount;
          if (tx.type === 'income') group.totalIncome += tx.amount;
        }
      }
    }
    return groups;
  }, [transactions, billingCycle]);

  const sections = useMemo(() => {
    return monthGroups.map((g) => ({
      title: g.monthTitle,
      rangeBadge: g.rangeBadge,
      count: g.count,
      totalExpense: g.totalExpense,
      totalUsdExpense: g.totalUsdExpense,
      hasOnlyTransfers: g.transactions.every(
        (tx) => tx.category === 'Transfer' || Boolean(tx.transferPairId)
      ),
      monthKey: g.monthKey,
      data: g.transactions,
    }));
  }, [monthGroups]);

  const hasUsdHistoryFlow =
    (historyFlowStats.usdIncome || 0) > 0 || (historyFlowStats.usdExpense || 0) > 0;
  const hasAnyHistoryFlow =
    historyFlowStats.income +
      historyFlowStats.expense +
      (historyFlowStats.usdIncome || 0) +
      (historyFlowStats.usdExpense || 0) >
    0;

  // Memoize as a React element (not a function component) so SectionList reconciles
  // the header in place instead of unmounting/remounting TextInput on each keystroke.
  const listHeader = useMemo(() => (
    <View>
      {/* Title */}
      <View style={styles.bannerHeader}>
        <Text style={styles.bannerTitle}>History</Text>
        <Text style={styles.bannerSubtitle}>
          {transactions.length} record{transactions.length === 1 ? '' : 's'}
        </Text>
      </View>

      {/* Cash Flow Summary Bar */}
      <View style={styles.flowSummaryCard}>
        <View style={styles.flowMetaRow}>
          <Text
            style={[styles.flowMetaText, styles.flowMetaLeft, { color: Palette.success }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.78}
          >
            In: {formatCurrency(historyFlowStats.income, 'IDR', privacyMode)}
          </Text>
          <Text
            style={[styles.flowMetaText, styles.flowMetaRight, { color: Palette.error }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.78}
          >
            Out: {formatCurrency(historyFlowStats.expense, 'IDR', privacyMode)}
          </Text>
        </View>
        {hasUsdHistoryFlow ? (
          <View style={[styles.flowMetaRow, { marginTop: 5 }]}>
            <Text
              style={[styles.flowMetaText, styles.flowMetaLeft, { color: Palette.success, fontSize: 11 }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.78}
            >
              USD In: {formatCurrency(historyFlowStats.usdIncome || 0, 'USD', privacyMode)}
            </Text>
            <Text
              style={[styles.flowMetaText, styles.flowMetaRight, { color: Palette.error, fontSize: 11 }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.78}
            >
              USD Out: {formatCurrency(historyFlowStats.usdExpense || 0, 'USD', privacyMode)}
            </Text>
          </View>
        ) : null}
        <View style={styles.dualFlowTrack}>
          {hasAnyHistoryFlow ? (
            <>
              <View
                style={[
                  styles.dualFlowSegment,
                  {
                    flex: Math.max(historyFlowStats.incomePct, 4),
                    backgroundColor: Palette.success,
                  },
                ]}
              />
              <View
                style={[
                  styles.dualFlowSegment,
                  {
                    flex: Math.max(historyFlowStats.expensePct, 4),
                    backgroundColor: Palette.error,
                  },
                ]}
              />
            </>
          ) : (
            <View
              style={[
                styles.dualFlowSegment,
                {
                  flex: 1,
                  backgroundColor: Palette.hairline,
                },
              ]}
            />
          )}
        </View>
      </View>

      {/* Outstanding Lent Banner (if uncollected loans exist in active currency) */}
      {outstandingLentTotal > 0 && historyLentFilter !== 'outstanding' ? (
        <TouchableOpacity
          style={styles.lentBanner}
          onPress={() => {
            AppHaptics.light();
            onChangeLentFilter?.('outstanding');
          }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Outstanding Lent: ${outstandingLentCount} unsettled ${activeCurrency} loans totaling ${formatCurrency(outstandingLentTotal, activeCurrency, false)}. Tap to filter.`}
        >
          <View style={styles.lentBannerIconBox}>
            <HandCoins size={16} color={Palette.accentAmber} />
          </View>
          <View style={styles.lentBannerInfo}>
            <Text style={styles.lentBannerTitle} numberOfLines={1}>Outstanding Lent</Text>
            <Text style={styles.lentBannerSubtitle} numberOfLines={1}>
              {outstandingLentCount} unsettled ({activeCurrency}) • Tap to filter
            </Text>
          </View>
          <Text style={styles.lentBannerAmount} numberOfLines={1}>
            {formatCurrency(outstandingLentTotal, activeCurrency, privacyMode)}
          </Text>
        </TouchableOpacity>
      ) : null}

      {/* Search Bar & Filter Toggle Button */}
      <View style={styles.searchAndFilterRow}>
        <View style={styles.searchBar}>
          <Search size={16} color={Palette.muted} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search merchant, notes..."
            placeholderTextColor={Palette.mutedSoft}
            value={localSearch}
            onChangeText={setLocalSearch}
            returnKeyType="search"
            onSubmitEditing={Keyboard.dismiss}
            accessibilityRole="search"
            accessibilityLabel="Search transactions"
          />
          {localSearch.length > 0 ? (
            <TouchableOpacity
              onPress={handleClearSearch}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <X size={16} color={Palette.muted} />
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity
          style={[
            styles.filterToggleBtn,
            activeFilterCount > 0 && styles.filterToggleBtnActive,
          ]}
          onPress={() => {
            AppHaptics.light();
            setFilterModalVisible(true);
          }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Filter transactions"
          accessibilityState={{ selected: activeFilterCount > 0 }}
        >
          <SlidersHorizontal
            size={16}
            color={activeFilterCount > 0 ? Palette.white : Palette.ink}
          />
          {activeFilterCount > 0 ? (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          ) : null}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.selectModeToggleBtn,
            isSelectionMode && styles.selectModeToggleBtnActive,
          ]}
          onPress={() => {
            AppHaptics.light();
            if (isSelectionMode) {
              handleExitSelectionMode();
            } else {
              triggerSmoothLayout();
              setIsSelectionMode(true);
            }
          }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Toggle multi-select mode"
        >
          <CheckSquare
            size={16}
            color={isSelectionMode ? Palette.white : Palette.ink}
          />
        </TouchableOpacity>
      </View>

      {/* Multi-Select Control Bar */}
      {isSelectionMode ? (
        <View style={styles.selectionControlRow}>
          <TouchableOpacity
            style={styles.selectionControlBtn}
            onPress={handleExitSelectionMode}
            activeOpacity={0.7}
          >
            <Text style={styles.selectionControlBtnText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.selectionCountText}>
            {selectedIds.size} of {selectableCount} selected
          </Text>
          <TouchableOpacity
            style={styles.selectionControlBtn}
            onPress={handleSelectAll}
            activeOpacity={0.7}
          >
            <Text style={styles.selectionControlBtnText}>
              {selectableCount > 0 && selectedIds.size === selectableCount ? 'Deselect All' : 'Select All'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Active Filter Tags (Minimal & Dismissible) */}
      {activeFilterCount > 0 ? (
        <View style={styles.activeFiltersRow}>
          {historyFilter !== 'all' ? (
            <TouchableOpacity
              style={styles.activeTag}
              onPress={() => {
                AppHaptics.selection();
                onChangeFilter('all');
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.activeTagText}>
                {historyFilter === 'expense' ? 'Expenses' : 'Income'}
              </Text>
              <X size={11} color={Palette.primary} />
            </TouchableOpacity>
          ) : null}

          {historyMonth !== 'all' ? (
            <TouchableOpacity
              style={styles.activeTag}
              onPress={() => {
                AppHaptics.selection();
                onChangeMonth('all');
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.activeTagText}>
                {formatMonthShort(historyMonth)}
              </Text>
              <X size={11} color={Palette.primary} />
            </TouchableOpacity>
          ) : null}

          {historyCategory !== 'all' ? (
            <TouchableOpacity
              style={styles.activeTag}
              onPress={() => {
                AppHaptics.selection();
                onChangeCategory('all');
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.activeTagText} numberOfLines={1}>
                {historyCategory}
              </Text>
              <X size={11} color={Palette.primary} />
            </TouchableOpacity>
          ) : null}

          {historyLentFilter !== 'all' ? (
            <TouchableOpacity
              style={styles.activeTag}
              onPress={() => {
                AppHaptics.selection();
                onChangeLentFilter?.('all');
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.activeTagText}>
                {historyLentFilter === 'outstanding' ? 'Outstanding Lent' : 'Settled Lent'}
              </Text>
              <X size={11} color={Palette.primary} />
            </TouchableOpacity>
          ) : null}

          {historyWalletId !== 'all' ? (
            <TouchableOpacity
              style={styles.activeTag}
              onPress={() => {
                AppHaptics.selection();
                onChangeWalletId?.('all');
                onChangePocketId?.('all');
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.activeTagText} numberOfLines={1}>
                {wallets.find((w) => w.id === historyWalletId)?.name || 'Account'}
              </Text>
              <X size={11} color={Palette.primary} />
            </TouchableOpacity>
          ) : null}

          {historyPocketId !== 'all' ? (
            <TouchableOpacity
              style={styles.activeTag}
              onPress={() => {
                AppHaptics.selection();
                onChangePocketId?.('all');
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.activeTagText} numberOfLines={1}>
                {historyPocketId === '__main__'
                  ? 'Main Balance'
                  : pockets.find((p) => p.id === historyPocketId)?.name || 'Pocket'}
              </Text>
              <X size={11} color={Palette.primary} />
            </TouchableOpacity>
          ) : null}

          {historyPaymentMethod !== 'all' ? (
            <TouchableOpacity
              style={styles.activeTag}
              onPress={() => {
                AppHaptics.selection();
                onChangePaymentMethod?.('all');
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.activeTagText} numberOfLines={1}>
                {historyPaymentMethod}
              </Text>
              <X size={11} color={Palette.primary} />
            </TouchableOpacity>
          ) : null}

          {historyDateFrom || historyDateTo ? (
            <TouchableOpacity
              style={styles.activeTag}
              onPress={() => {
                AppHaptics.selection();
                onChangeDateFrom?.('');
                onChangeDateTo?.('');
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.activeTagText} numberOfLines={1}>
                {historyDateFrom ? formatDate(historyDateFrom) : '…'} –{' '}
                {historyDateTo ? formatDate(historyDateTo) : '…'}
              </Text>
              <X size={11} color={Palette.primary} />
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={styles.clearAllBtn}
            onPress={() => {
              AppHaptics.light();
              onResetAllFilters();
            }}
            activeOpacity={0.7}
          >
            <RotateCcw size={11} color={Palette.muted} />
            <Text style={styles.clearAllBtnText}>Clear</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  ), [
    transactions.length,
    selectableCount,
    historyFlowStats,
    hasUsdHistoryFlow,
    hasAnyHistoryFlow,
    privacyMode,
    outstandingLentTotal,
    outstandingLentCount,
    historyLentFilter,
    onChangeLentFilter,
    historyWalletId,
    onChangeWalletId,
    historyPocketId,
    onChangePocketId,
    historyPaymentMethod,
    onChangePaymentMethod,
    historyDateFrom,
    historyDateTo,
    onChangeDateFrom,
    onChangeDateTo,
    wallets,
    pockets,
    activeCurrency,
    localSearch,
    handleClearSearch,
    activeFilterCount,
    historyFilter,
    onChangeFilter,
    historyMonth,
    onChangeMonth,
    historyCategory,
    onChangeCategory,
    onResetAllFilters,
    isSelectionMode,
    selectedIds.size,
    handleExitSelectionMode,
    handleSelectAll,
  ]);

  // Two distinct empty states: filters/search hid everything vs. no records at all
  const emptyComponent = useMemo(() => {
    if (isFilterActive) {
      return (
        <View style={styles.emptyCard}>
          <Receipt size={32} color={Palette.mutedSoft} />
          <Text style={styles.emptyTitle}>No matching transactions</Text>
          <Text style={styles.emptyDesc}>Try adjusting search query or active filters.</Text>
          <TouchableOpacity
            style={styles.emptyResetBtn}
            onPress={onResetAllFilters}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Clear all filters"
          >
            <Text style={styles.emptyResetBtnText}>Clear All Filters</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.emptyCard}>
        <Receipt size={32} color={Palette.mutedSoft} />
        <Text style={styles.emptyTitle}>No transactions yet</Text>
        <Text style={styles.emptyDesc}>
          Record your first expense or income to build your history.
        </Text>
        {onOpenManualModal ? (
          <TouchableOpacity
            style={styles.emptyPrimaryBtn}
            onPress={() => {
              AppHaptics.light();
              onOpenManualModal();
            }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Add transaction"
          >
            <Plus size={15} color={Palette.white} style={{ marginRight: 6 }} />
            <Text style={styles.emptyPrimaryBtnText}>Add Transaction</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }, [isFilterActive, onResetAllFilters, onOpenManualModal]);

  const renderSectionHeader = useCallback(({ section }: { section: any }) => {
    const showIdr = !section.hasOnlyTransfers && (section.totalExpense > 0 || !section.totalUsdExpense);
    const showUsd = !section.hasOnlyTransfers && section.totalUsdExpense > 0;

    return (
      <View style={styles.monthHeaderBlock}>
        <View style={styles.monthHeaderTopRow}>
          <Text style={styles.monthHeaderTitle}>{section.title}</Text>
          <View style={styles.monthCountBadge}>
            <Text style={styles.monthCountBadgeText}>{section.count} tx</Text>
          </View>
        </View>
        <View style={styles.monthHeaderSubRow}>
          {section.rangeBadge ? (
            <Text style={styles.monthRangeText}>{section.rangeBadge}</Text>
          ) : null}
          <View
            style={[
              styles.monthAmountsRow,
              section.rangeBadge ? styles.monthAmountsRowRight : null,
            ]}
          >
            {section.hasOnlyTransfers ? (
              <Text style={styles.monthHeaderMeta} numberOfLines={1}>
                Transfers
              </Text>
            ) : (
              <>
                {showIdr ? (
                  <Text style={styles.monthHeaderMeta} numberOfLines={1}>
                    {formatCurrency(section.totalExpense, 'IDR', privacyMode)}
                  </Text>
                ) : null}
                {showIdr && showUsd ? <View style={styles.monthAmountDivider} /> : null}
                {showUsd ? (
                  <Text style={styles.monthHeaderMeta} numberOfLines={1}>
                    {formatCurrency(section.totalUsdExpense, 'USD', privacyMode)}
                  </Text>
                ) : null}
              </>
            )}
          </View>
        </View>
      </View>
    );
  }, [privacyMode]);

  const renderItem = useCallback(({ item }: { item: Transaction }) => {
    const w = item.walletId ? walletById.get(item.walletId) : undefined;
    return (
      <TransactionItemRow
        transaction={item}
        categoryIcon={getCategoryIconName(item.category, item.type)}
        walletName={w ? w.name?.trim() || w.type : undefined}
        walletType={w?.type}
        pocketName={getPocketName(item.pocketId)}
        privacyMode={privacyMode}
        selectionMode={isSelectionMode}
        isSelected={selectedIds.has(item.id)}
        onPress={isSelectionMode ? handleToggleSelectTransaction : onSelectTransaction}
        onLongPress={handleLongPressTransaction}
      />
    );
  }, [
    walletById,
    getCategoryIconName,
    getPocketName,
    privacyMode,
    isSelectionMode,
    selectedIds,
    handleToggleSelectTransaction,
    onSelectTransaction,
    handleLongPressTransaction,
  ]);

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={emptyComponent}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Math.max(insets.bottom, 16) + 96 },
        ]}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={15}
        maxToRenderPerBatch={20}
        windowSize={7}
      />

      {/* Floating Batch Action Bar — sits cleanly above BottomTabBar (70px height + 10px gap) */}
      {isSelectionMode && selectedIds.size > 0 ? (
        <View style={[styles.floatingBatchBar, { bottom: Math.max(insets.bottom, 16) + 80 }]}>
          <Text style={styles.floatingBatchText}>
            {selectedIds.size} selected
          </Text>
          <TouchableOpacity
            style={styles.batchDeleteBtn}
            onPress={handleBatchDelete}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${selectedIds.size} selected transactions`}
          >
            <Trash2 size={15} color={Palette.white} style={{ marginRight: 6 }} />
            <Text style={styles.batchDeleteBtnText}>Delete ({selectedIds.size})</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Filter Modal */}
      <HistoryFilterModal
        visible={filterModalVisible}
        filter={historyFilter}
        category={historyCategory}
        month={historyMonth}
        lentFilter={historyLentFilter}
        walletId={historyWalletId}
        pocketId={historyPocketId}
        paymentMethod={historyPaymentMethod}
        dateFrom={historyDateFrom}
        dateTo={historyDateTo}
        wallets={wallets}
        pockets={pockets}
        availablePaymentMethods={availablePaymentMethods}
        availableCategories={availableCategories}
        availableExpenseCategories={availableExpenseCategories}
        availableIncomeCategories={availableIncomeCategories}
        availableMonths={availableMonths}
        getCategoryIconName={getCategoryIconName}
        onChangeFilter={onChangeFilter}
        onChangeCategory={onChangeCategory}
        onChangeMonth={onChangeMonth}
        onChangeLentFilter={onChangeLentFilter}
        onChangeWalletId={onChangeWalletId}
        onChangePocketId={onChangePocketId}
        onChangePaymentMethod={onChangePaymentMethod}
        onChangeDateFrom={onChangeDateFrom}
        onChangeDateTo={onChangeDateTo}
        onReset={onResetAllFilters}
        onClose={() => setFilterModalVisible(false)}
      />
    </View>
  );
});

HistoryTab.displayName = 'HistoryTab';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  bannerHeader: {
    marginBottom: 12,
  },
  bannerTitle: {
    ...Typography.editorialTitle,
    fontSize: 22,
    color: Palette.ink,
  },
  bannerSubtitle: {
    ...Typography.caption,
    fontSize: 12,
    color: Palette.muted,
    marginTop: 2,
  },
  flowSummaryCard: {
    backgroundColor: Palette.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  lentBanner: {
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  lentBannerIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Palette.tintWarning,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  lentBannerInfo: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  lentBannerTitle: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '700',
    color: Palette.ink,
  },
  lentBannerSubtitle: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
    marginTop: 1,
  },
  lentBannerAmount: {
    ...Typography.mono,
    fontSize: 13,
    fontWeight: '700',
    color: Palette.accentAmber,
    flexShrink: 0,
  },
  flowMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  flowMetaText: {
    ...Typography.mono,
    fontSize: 13,
    fontWeight: '600',
  },
  flowMetaLeft: {
    flex: 1,
    minWidth: 0,
    textAlign: 'left',
  },
  flowMetaRight: {
    flex: 1,
    minWidth: 0,
    textAlign: 'right',
  },
  dualFlowTrack: {
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Palette.surfaceSoft,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  dualFlowSegment: {
    height: '100%',
  },
  searchAndFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.white,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    fontSize: 14,
    color: Palette.ink,
    padding: 0,
  },
  filterToggleBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: Palette.white,
    borderWidth: 1,
    borderColor: Palette.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  filterToggleBtnActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Palette.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: Palette.white,
  },
  filterBadgeText: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: '700',
    color: Palette.white,
  },
  selectModeToggleBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: Palette.white,
    borderWidth: 1,
    borderColor: Palette.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  selectModeToggleBtnActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  selectionControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  selectionControlBtn: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  selectionControlBtnText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: Palette.primary,
  },
  selectionCountText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: Palette.ink,
  },
  floatingBatchBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    backgroundColor: Palette.surfaceDarkElevated,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 999,
  },
  floatingBatchText: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '600',
    color: Palette.onDark,
  },
  batchDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.error,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  batchDeleteBtnText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: Palette.white,
  },
  activeFiltersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  activeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EDF5FF',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#D0E4FF',
  },
  activeTagText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '600',
    color: Palette.primary,
  },
  clearAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  clearAllBtnText: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
    fontWeight: '600',
  },
  monthHeaderBlock: {
    marginTop: 4,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  monthHeaderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  monthHeaderTitle: {
    ...Typography.heading,
    fontSize: 15.5,
    fontWeight: '700',
    color: Palette.ink,
  },
  monthCountBadge: {
    backgroundColor: Palette.surfaceSoft,
    borderWidth: 1,
    borderColor: Palette.hairline,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  monthCountBadgeText: {
    ...Typography.code,
    fontSize: 10.5,
    fontWeight: '600',
    color: Palette.muted,
  },
  monthHeaderSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    columnGap: 10,
    rowGap: 4,
    marginTop: 4,
  },
  monthRangeText: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
    flexShrink: 0,
  },
  monthAmountsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: 7,
    rowGap: 2,
    flexShrink: 1,
  },
  monthAmountsRowRight: {
    justifyContent: 'flex-end',
    marginLeft: 'auto',
  },
  monthAmountDivider: {
    width: 1,
    height: 10,
    backgroundColor: Palette.mutedSoft,
    opacity: 0.45,
  },
  monthHeaderMeta: {
    ...Typography.mono,
    fontSize: 11.5,
    color: Palette.muted,
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginTop: 6,
  },
  emptyTitle: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: '600',
    color: Palette.ink,
    marginTop: 8,
  },
  emptyDesc: {
    ...Typography.caption,
    fontSize: 12,
    color: Palette.muted,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  emptyResetBtn: {
    backgroundColor: Palette.white,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  emptyResetBtnText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: Palette.primary,
  },
  emptyPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  emptyPrimaryBtnText: {
    ...Typography.caption,
    fontSize: 13,
    fontWeight: '700',
    color: Palette.white,
  },
});
