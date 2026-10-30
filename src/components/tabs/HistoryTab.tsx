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
import { Search, X, Receipt, RotateCcw, SlidersHorizontal, Plus } from 'lucide-react-native';
import { Palette, Typography } from '../../theme/tokens';
import { Transaction, CurrencyType, FilterType } from '../../types';
import { formatCurrency, formatMonthYear, formatMonthShort } from '../../utils/formatters';
import { AppHaptics } from '../../utils/haptics';
import { TransactionItemRow } from '../TransactionItemRow';
import { HistoryFilterModal } from '../modals/HistoryFilterModal';

interface HistoryTabProps {
  transactions: Transaction[];
  activeCurrency: CurrencyType;
  privacyMode: boolean;
  searchQuery: string;
  historyFilter: FilterType;
  historyCategory: string;
  historyMonth: string;
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
  onOpenMonthPicker: () => void;
  onResetAllFilters: () => void;
  onOpenManualModal?: () => void;
  onSelectTransaction: (tx: Transaction) => void;
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
  onOpenMonthPicker,
  onResetAllFilters,
  onOpenManualModal,
  onSelectTransaction,
  getCategoryIconName,
  getPocketName,
}) => {
  const insets = useSafeAreaInsets();
  const [filterModalVisible, setFilterModalVisible] = useState<boolean>(false);
  const [localSearch, setLocalSearch] = useState<string>(searchQuery);
  const [prevSearchQuery, setPrevSearchQuery] = useState<string>(searchQuery);

  // Sync the local (debounced) input when the parent resets/changes the query externally.
  // Derived-state-during-render avoids the extra cascading render of a setState-in-effect.
  if (searchQuery !== prevSearchQuery) {
    setPrevSearchQuery(searchQuery);
    setLocalSearch(searchQuery);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== searchQuery) {
        onChangeSearch(localSearch);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [localSearch, searchQuery, onChangeSearch]);

  const handleClearSearch = useCallback(() => {
    setLocalSearch('');
    onChangeSearch('');
    onClearSearch();
  }, [onChangeSearch, onClearSearch]);

  const activeFilterCount =
    (historyFilter !== 'all' ? 1 : 0) +
    (historyCategory !== 'all' ? 1 : 0) +
    (historyMonth !== 'all' ? 1 : 0);

  const isFilterActive = activeFilterCount > 0 || searchQuery.trim().length > 0;

  // Group transactions chronologically by month (keeping IDR and USD native totals separate)
  const monthGroups = useMemo(() => {
    const groups: {
      monthKey: string;
      monthTitle: string;
      count: number;
      totalExpense: number;
      totalIncome: number;
      totalUsdExpense: number;
      totalUsdIncome: number;
      transactions: Transaction[];
    }[] = [];
    const map = new Map<string, (typeof groups)[0]>();

    for (const tx of transactions) {
      const d = new Date(tx.timestamp);
      const key = !isNaN(d.getTime())
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        : 'Other';
      const title = !isNaN(d.getTime()) ? formatMonthYear(key) : 'Other';

      if (!map.has(key)) {
        const g = {
          monthKey: key,
          monthTitle: title,
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
      // Count only transactions that feed the amounts below (transfers excluded)
      if (tx.category !== 'Transfer' && !tx.transferPairId) {
        group.count += 1;
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
  }, [transactions]);

  const sections = useMemo(() => {
    return monthGroups.map((g) => ({
      title: g.monthTitle,
      count: g.count,
      totalExpense: g.totalExpense,
      totalUsdExpense: g.totalUsdExpense,
      monthKey: g.monthKey,
      data: g.transactions,
    }));
  }, [monthGroups]);

  const hasUsdHistoryFlow =
    (historyFlowStats.usdIncome || 0) > 0 || (historyFlowStats.usdExpense || 0) > 0;

  const renderHeader = useCallback(() => (
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
          <Text style={[styles.flowMetaText, { color: Palette.success }]}>
            In: {formatCurrency(historyFlowStats.income, 'IDR', privacyMode)}
          </Text>
          <Text style={[styles.flowMetaText, { color: Palette.error }]}>
            Out: {formatCurrency(historyFlowStats.expense, 'IDR', privacyMode)}
          </Text>
        </View>
        {hasUsdHistoryFlow ? (
          <View style={[styles.flowMetaRow, { marginTop: 2 }]}>
            <Text style={[styles.flowMetaText, { color: Palette.success, fontSize: 11 }]}>
              USD In: {formatCurrency(historyFlowStats.usdIncome || 0, 'USD', privacyMode)}
            </Text>
            <Text style={[styles.flowMetaText, { color: Palette.error, fontSize: 11 }]}>
              USD Out: {formatCurrency(historyFlowStats.usdExpense || 0, 'USD', privacyMode)}
            </Text>
          </View>
        ) : null}
        <View style={styles.dualFlowTrack}>
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
        </View>
      </View>

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
      </View>

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
    historyFlowStats,
    hasUsdHistoryFlow,
    privacyMode,
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
  ]);

  // Two distinct empty states: filters/search hid everything vs. no records at all
  const renderEmpty = useCallback(() => {
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

  const renderSectionHeader = useCallback(({ section }: { section: any }) => (
    <View style={styles.monthHeaderRow}>
      <Text style={styles.monthHeaderTitle}>{section.title}</Text>
      <Text style={styles.monthHeaderMeta} numberOfLines={1}>
        {section.count} tx
        {section.totalExpense > 0 || !section.totalUsdExpense
          ? ` • ${formatCurrency(section.totalExpense, 'IDR', privacyMode)}`
          : ''}
        {section.totalUsdExpense > 0
          ? ` • ${formatCurrency(section.totalUsdExpense, 'USD', privacyMode)}`
          : ''}
      </Text>
    </View>
  ), [privacyMode]);

  const renderItem = useCallback(({ item }: { item: Transaction }) => (
    <TransactionItemRow
      transaction={item}
      categoryIcon={getCategoryIconName(item.category, item.type)}
      pocketName={getPocketName(item.pocketId)}
      privacyMode={privacyMode}
      onPress={onSelectTransaction}
    />
  ), [getCategoryIconName, getPocketName, privacyMode, onSelectTransaction]);

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
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

      {/* Filter Modal */}
      <HistoryFilterModal
        visible={filterModalVisible}
        filter={historyFilter}
        category={historyCategory}
        month={historyMonth}
        availableCategories={availableCategories}
        availableExpenseCategories={availableExpenseCategories}
        availableIncomeCategories={availableIncomeCategories}
        availableMonths={availableMonths}
        onChangeFilter={onChangeFilter}
        onChangeCategory={onChangeCategory}
        onChangeMonth={onChangeMonth}
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
    ...Typography.heading,
    fontSize: 22,
    fontWeight: '700',
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
  flowMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  flowMetaText: {
    ...Typography.mono,
    fontSize: 13,
    fontWeight: '700',
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
  monthHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  monthHeaderTitle: {
    ...Typography.heading,
    fontSize: 15,
    fontWeight: '700',
    color: Palette.ink,
  },
  monthHeaderMeta: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
    fontWeight: '500',
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
