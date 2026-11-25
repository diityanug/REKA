import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Check,
  RotateCcw,
  Calendar,
  X,
  Building2,
  Smartphone,
  Banknote,
  TrendingUp,
  CreditCard,
  Layers,
  LayoutGrid,
} from 'lucide-react-native';
import { Palette, Typography } from '../../theme/tokens';
import { FilterType, Wallet, Pocket, Transaction } from '../../types';
import { formatMonthShort, formatDate } from '../../utils/formatters';
import { AppHaptics } from '../../utils/haptics';
import { ModalHeader } from '../ModalHeader';
import { BottomSheetModal } from '../BottomSheetModal';
import { PaymentMethodIcon } from '../PaymentMethodIcon';
import { CategoryIcon } from '../CategoryIcon';
import { ContactlessCardIcon } from '../icons/ContactlessCardIcon';
import { triggerSmoothLayout } from '../MotionPrimitives';
import { DatePickerModal } from './DatePickerModal';

function chunkArray<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

function getAccountTypeIcon(rawType?: string) {
  const t = (rawType || '').toLowerCase();
  if (t === 'e-wallet' || t === 'ewallet') return Smartphone;
  if (t === 'cash') return Banknote;
  if (t === 'investment') return TrendingUp;
  if (t === 'credit card' || t === 'credit') return CreditCard;
  if (t === 'e-money' || t === 'emoney' || t === 'e-toll') return ContactlessCardIcon;
  return Building2;
}

export interface HistoryFilterModalProps {
  visible: boolean;
  filter: FilterType;
  category: string;
  month: string;
  lentFilter?: 'all' | 'outstanding' | 'settled';
  walletId?: string;
  pocketId?: string;
  paymentMethod?: string;
  dateFrom?: string;
  dateTo?: string;
  wallets?: Wallet[];
  pockets?: Pocket[];
  availablePaymentMethods?: string[];
  availableCategories: string[];
  availableExpenseCategories?: string[];
  availableIncomeCategories?: string[];
  availableMonths: string[];
  getCategoryIconName?: (category: string, type?: Transaction['type']) => string;
  onChangeFilter: (filter: FilterType) => void;
  onChangeCategory: (category: string) => void;
  onChangeMonth: (month: string) => void;
  onChangeLentFilter?: (filter: 'all' | 'outstanding' | 'settled') => void;
  onChangeWalletId?: (walletId: string) => void;
  onChangePocketId?: (pocketId: string) => void;
  onChangePaymentMethod?: (method: string) => void;
  onChangeDateFrom?: (dateStr: string) => void;
  onChangeDateTo?: (dateStr: string) => void;
  onReset: () => void;
  onClose: () => void;
}

export const HistoryFilterModal: React.FC<HistoryFilterModalProps> = ({
  visible,
  filter,
  category,
  month,
  lentFilter = 'all',
  walletId = 'all',
  pocketId = 'all',
  paymentMethod = 'all',
  dateFrom = '',
  dateTo = '',
  wallets = [],
  pockets = [],
  availablePaymentMethods = [],
  availableCategories,
  availableExpenseCategories = [],
  availableIncomeCategories = [],
  availableMonths,
  getCategoryIconName,
  onChangeFilter,
  onChangeCategory,
  onChangeMonth,
  onChangeLentFilter,
  onChangeWalletId,
  onChangePocketId,
  onChangePaymentMethod,
  onChangeDateFrom,
  onChangeDateTo,
  onReset,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const [datePickerTarget, setDatePickerTarget] = useState<'from' | 'to' | null>(null);

  const selectedWalletPockets = useMemo(() => {
    if (walletId === 'all') return [];
    return pockets.filter((p) => p.walletId === walletId);
  }, [pockets, walletId]);

  const activeFilterCount =
    (filter !== 'all' ? 1 : 0) +
    (category !== 'all' ? 1 : 0) +
    (month !== 'all' ? 1 : 0) +
    (lentFilter !== 'all' ? 1 : 0) +
    (walletId !== 'all' ? 1 : 0) +
    (pocketId !== 'all' ? 1 : 0) +
    (paymentMethod !== 'all' ? 1 : 0) +
    (dateFrom || dateTo ? 1 : 0);

  const isAnyFilterActive = activeFilterCount > 0;

  // Determine which categories to show depending on transaction type (only those with transactions)
  const displayedCategories = useMemo(() => {
    if (filter === 'expense') return availableExpenseCategories;
    if (filter === 'income') return availableIncomeCategories;
    return availableCategories;
  }, [filter, availableCategories, availableExpenseCategories, availableIncomeCategories]);

  // Dynamic "All" category label scoped to the active type
  const allCategoryLabel =
    filter === 'expense'
      ? 'All Expenses'
      : filter === 'income'
        ? 'All Income'
        : 'All Categories';

  // Symmetrical row matrices
  const monthRows = useMemo(
    () =>
      chunkArray(
        [
          { id: 'all', label: 'All Months' },
          ...availableMonths.map((m) => ({ id: m, label: formatMonthShort(m) })),
        ],
        3
      ),
    [availableMonths]
  );

  const accountItems = useMemo(
    () => [
      { id: 'all', isAll: true as const, name: 'All Accounts', type: '', currency: '' },
      ...wallets.map((w) => ({
        id: w.id,
        isAll: false as const,
        name: w.name?.trim() || w.type || 'Account',
        type: w.type,
        currency: w.currency,
      })),
    ],
    [wallets]
  );

  const pocketItems = useMemo(
    () => [
      { id: 'all', label: 'All Pockets', icon: 'LayoutGrid', isSpecial: true as const },
      { id: '__main__', label: 'Main Balance', icon: 'Layers', isSpecial: true as const },
      ...selectedWalletPockets.map((p) => ({
        id: p.id,
        label: p.name,
        icon: p.icon || 'Briefcase',
        isSpecial: false as const,
      })),
    ],
    [selectedWalletPockets]
  );

  const methodRows = useMemo(
    () =>
      chunkArray(
        [
          { id: 'all', label: 'All Methods', isAll: true as const },
          ...availablePaymentMethods.map((m) => ({ id: m, label: m, isAll: false as const })),
        ],
        2
      ),
    [availablePaymentMethods]
  );

  const categoryRows = useMemo(
    () =>
      chunkArray(
        [
          { id: 'all', label: allCategoryLabel, isAll: true as const },
          ...displayedCategories.map((c) => ({ id: c, label: c, isAll: false as const })),
        ],
        2
      ),
    [allCategoryLabel, displayedCategories]
  );

  // Handle switching transaction type and safely resetting category if needed
  const handleSelectFilterType = (newFilter: FilterType) => {
    AppHaptics.selection();
    onChangeFilter(newFilter);

    if (category !== 'all') {
      const allowedList =
        newFilter === 'expense'
          ? availableExpenseCategories
          : newFilter === 'income'
            ? availableIncomeCategories
            : availableCategories;
      const isStillAllowed = allowedList.some(
        (c) => c.toLowerCase() === category.toLowerCase()
      );
      if (!isStillAllowed) {
        onChangeCategory('all');
      }
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      fullPage={true}
    >
      <ModalHeader
        title="Filter Transactions"
        subtitle={
          activeFilterCount > 0
            ? `${activeFilterCount} active filter${activeFilterCount > 1 ? 's' : ''}`
            : 'Refine by type, period, account, or category'
        }
        onClose={onClose}
        leadingIcon="close"
      />

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollBody}
        showsVerticalScrollIndicator={false}
      >
        {/* Section 1: Transaction Type — 3-Column Segmented Control */}
        <View style={styles.filterSection}>
          <Text style={styles.sectionTitle}>Transaction Type</Text>
          <View style={styles.segmentedBar}>
            {(['all', 'expense', 'income'] as FilterType[]).map((f) => {
              const isActive = filter === f;
              const label =
                f === 'all' ? 'All' : f === 'expense' ? 'Expenses' : 'Income';
              return (
                <TouchableOpacity
                  key={f}
                  style={[styles.segmentBtn, isActive && styles.segmentBtnActive]}
                  onPress={() => handleSelectFilterType(f)}
                  activeOpacity={0.78}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                >
                  <Text
                    style={[
                      styles.segmentBtnText,
                      isActive && styles.segmentBtnTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Section 2: Lent & Borrowed — 3-Column Segmented Control */}
        <View style={styles.filterSection}>
          <Text style={styles.sectionTitle}>Lent & Borrowed</Text>
          <View style={styles.segmentedBar}>
            {[
              { id: 'all', label: 'All' },
              { id: 'outstanding', label: 'Outstanding' },
              { id: 'settled', label: 'Settled' },
            ].map((item) => {
              const isActive = lentFilter === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.segmentBtn, isActive && styles.segmentBtnActive]}
                  onPress={() => {
                    AppHaptics.selection();
                    onChangeLentFilter?.(item.id as 'all' | 'outstanding' | 'settled');
                  }}
                  activeOpacity={0.78}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                >
                  <Text
                    style={[
                      styles.segmentBtnText,
                      isActive && styles.segmentBtnTextActive,
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Section 3: Month / Period — Strict 3-Column Grid */}
        {availableMonths.length > 0 && (
          <View style={styles.filterSection}>
            <Text style={styles.sectionTitle}>Month / Period</Text>
            <View style={styles.gridBlock}>
              {monthRows.map((row, rowIdx) => (
                <View key={`m-row-${rowIdx}`} style={styles.gridRow}>
                  {row.map((item) => {
                    const isActive = month === item.id;
                    return (
                      <View key={item.id} style={styles.gridCol}>
                        <TouchableOpacity
                          style={[
                            styles.compactTile,
                            isActive && styles.compactTileActive,
                          ]}
                          onPress={() => {
                            AppHaptics.selection();
                            onChangeMonth(item.id);
                            if (item.id !== 'all') {
                              onChangeDateFrom?.('');
                              onChangeDateTo?.('');
                            }
                          }}
                          activeOpacity={0.78}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isActive }}
                        >
                          <Text
                            style={[
                              styles.compactTileText,
                              isActive && styles.compactTileTextActive,
                            ]}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.82}
                          >
                            {item.label}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                  {row.length < 3
                    ? Array.from({ length: 3 - row.length }).map((_, emptyIdx) => (
                        <View
                          key={`m-empty-${rowIdx}-${emptyIdx}`}
                          style={styles.gridSlotEmpty}
                        />
                      ))
                    : null}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Section 4: Custom Date Range — Fixed 50/50 Symmetrical Cards */}
        {onChangeDateFrom && onChangeDateTo ? (
          <View style={styles.filterSection}>
            <Text style={styles.sectionTitle}>Custom Date Range</Text>
            <View style={styles.gridRow}>
              {/* From Date */}
              <View style={styles.gridCol}>
                <TouchableOpacity
                  style={[styles.dateCard, !!dateFrom && styles.dateCardActive]}
                  onPress={() => {
                    AppHaptics.selection();
                    setDatePickerTarget('from');
                  }}
                  activeOpacity={0.78}
                  accessibilityRole="button"
                  accessibilityLabel="Pick start date"
                >
                  <View style={styles.dateCardTop}>
                    <Calendar
                      size={12}
                      color={dateFrom ? Palette.primary : Palette.muted}
                    />
                    <Text
                      style={[
                        styles.dateCardLabel,
                        !!dateFrom && styles.dateCardLabelActive,
                      ]}
                    >
                      From
                    </Text>
                    {dateFrom ? (
                      <TouchableOpacity
                        style={styles.dateClearBtn}
                        onPress={() => {
                          AppHaptics.selection();
                          onChangeDateFrom('');
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityRole="button"
                        accessibilityLabel="Clear start date"
                      >
                        <X size={11} color={Palette.primary} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.dateCardValue,
                      !dateFrom && styles.dateCardPlaceholder,
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                  >
                    {dateFrom ? formatDate(dateFrom) : 'Select date'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* To Date */}
              <View style={styles.gridCol}>
                <TouchableOpacity
                  style={[styles.dateCard, !!dateTo && styles.dateCardActive]}
                  onPress={() => {
                    AppHaptics.selection();
                    setDatePickerTarget('to');
                  }}
                  activeOpacity={0.78}
                  accessibilityRole="button"
                  accessibilityLabel="Pick end date"
                >
                  <View style={styles.dateCardTop}>
                    <Calendar
                      size={12}
                      color={dateTo ? Palette.primary : Palette.muted}
                    />
                    <Text
                      style={[
                        styles.dateCardLabel,
                        !!dateTo && styles.dateCardLabelActive,
                      ]}
                    >
                      To
                    </Text>
                    {dateTo ? (
                      <TouchableOpacity
                        style={styles.dateClearBtn}
                        onPress={() => {
                          AppHaptics.selection();
                          onChangeDateTo('');
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityRole="button"
                        accessibilityLabel="Clear end date"
                      >
                        <X size={11} color={Palette.primary} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.dateCardValue,
                      !dateTo && styles.dateCardPlaceholder,
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                  >
                    {dateTo ? formatDate(dateTo) : 'Select date'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}

        {/* Section 5: Account & Pocket — Fixed Full-Width Ledger List */}
        {wallets.length > 0 && onChangeWalletId ? (
          <View style={styles.filterSection}>
            <Text style={styles.sectionTitle}>Account</Text>
            <View style={styles.listCard}>
              {accountItems.map((item, idx) => {
                const isActive = walletId === item.id;
                const isLast = idx === accountItems.length - 1;
                const AccIcon = item.isAll ? LayoutGrid : getAccountTypeIcon(item.type);
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.listRow,
                      !isLast && styles.listRowBorder,
                      isActive && styles.listRowActive,
                    ]}
                    onPress={() => {
                      AppHaptics.selection();
                      triggerSmoothLayout();
                      onChangeWalletId(item.id);
                      onChangePocketId?.('all');
                    }}
                    activeOpacity={0.78}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                  >
                    <View
                      style={[
                        styles.listIconBox,
                        isActive && styles.optionIconBoxActive,
                      ]}
                    >
                      <AccIcon
                        size={15}
                        color={isActive ? Palette.white : Palette.primary}
                      />
                    </View>
                    <View style={styles.optionTextCol}>
                      <Text
                        style={[
                          styles.listRowTitle,
                          isActive && styles.optionTitleActive,
                        ]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.85}
                      >
                        {item.name}
                      </Text>
                      {!item.isAll && item.currency ? (
                        <Text
                          style={[
                            styles.optionSub,
                            isActive && styles.optionSubActive,
                          ]}
                          numberOfLines={1}
                        >
                          {item.type ? `${item.type} · ${item.currency}` : item.currency}
                        </Text>
                      ) : null}
                    </View>
                    <View
                      style={[
                        styles.radioDot,
                        isActive && styles.radioDotActive,
                      ]}
                    >
                      {isActive ? (
                        <Check size={9} color={Palette.white} strokeWidth={3} />
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {selectedWalletPockets.length > 0 && onChangePocketId ? (
              <View style={styles.subSectionBlock}>
                <Text style={styles.sectionTitle}>Pocket</Text>
                <View style={styles.listCard}>
                  {pocketItems.map((item, idx) => {
                    const isActive = pocketId === item.id;
                    const isLast = idx === pocketItems.length - 1;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[
                          styles.listRow,
                          styles.listRowCompact,
                          !isLast && styles.listRowBorder,
                          isActive && styles.listRowActive,
                        ]}
                        onPress={() => {
                          AppHaptics.selection();
                          onChangePocketId(item.id);
                        }}
                        activeOpacity={0.78}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isActive }}
                      >
                        <View
                          style={[
                            styles.listIconBox,
                            isActive && styles.optionIconBoxActive,
                          ]}
                        >
                          {item.id === 'all' ? (
                            <LayoutGrid
                              size={14}
                              color={isActive ? Palette.white : Palette.primary}
                            />
                          ) : item.id === '__main__' ? (
                            <Layers
                              size={14}
                              color={isActive ? Palette.white : Palette.primary}
                            />
                          ) : (
                            <CategoryIcon
                              name={item.icon}
                              size={14}
                              color={isActive ? Palette.white : Palette.primary}
                            />
                          )}
                        </View>
                        <Text
                          style={[
                            styles.listRowTitle,
                            styles.optionTitleFlex,
                            isActive && styles.optionTitleActive,
                          ]}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.85}
                        >
                          {item.label}
                        </Text>
                        <View
                          style={[
                            styles.radioDot,
                            isActive && styles.radioDotActive,
                          ]}
                        >
                          {isActive ? (
                            <Check size={9} color={Palette.white} strokeWidth={3} />
                          ) : null}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Section 6: Payment Method — Strict 2-Column Symmetrical Icon Grid */}
        {availablePaymentMethods.length > 0 && onChangePaymentMethod ? (
          <View style={styles.filterSection}>
            <Text style={styles.sectionTitle}>Payment Method</Text>
            <View style={styles.gridBlock}>
              {methodRows.map((row, rowIdx) => (
                <View key={`pm-row-${rowIdx}`} style={styles.gridRow}>
                  {row.map((item) => {
                    const isActive = item.isAll
                      ? paymentMethod === 'all'
                      : paymentMethod.toLowerCase() === item.id.toLowerCase();
                    return (
                      <View key={item.id} style={styles.gridCol}>
                        <TouchableOpacity
                          style={[
                            styles.optionCard,
                            styles.optionCardCompact,
                            isActive && styles.optionCardActive,
                          ]}
                          onPress={() => {
                            AppHaptics.selection();
                            onChangePaymentMethod(item.id);
                          }}
                          activeOpacity={0.78}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isActive }}
                        >
                          <View
                            style={[
                              styles.optionIconBox,
                              isActive && styles.optionIconBoxActive,
                            ]}
                          >
                            {item.isAll ? (
                              <LayoutGrid
                                size={13}
                                color={isActive ? Palette.white : Palette.ink}
                              />
                            ) : (
                              <PaymentMethodIcon
                                method={item.id}
                                size={14}
                                color={isActive ? Palette.white : Palette.ink}
                              />
                            )}
                          </View>
                          <Text
                            style={[
                              styles.optionTitle,
                              styles.optionTitleFlex,
                              isActive && styles.optionTitleActive,
                            ]}
                          >
                            {item.label}
                          </Text>
                          <View
                            style={[
                              styles.radioDot,
                              isActive && styles.radioDotActive,
                            ]}
                          >
                            {isActive ? (
                              <Check size={9} color={Palette.white} strokeWidth={3} />
                            ) : null}
                          </View>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                  {row.length < 2 ? <View style={styles.gridSlotEmpty} /> : null}
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Section 7: Categories — Strict 2-Column Symmetrical Icon Grid */}
        {displayedCategories.length > 0 && (
          <View style={styles.filterSection}>
            <Text style={styles.sectionTitle}>
              {filter === 'expense'
                ? 'Expense Categories'
                : filter === 'income'
                  ? 'Income Categories'
                  : 'Category'}
            </Text>
            <View style={styles.gridBlock}>
              {categoryRows.map((row, rowIdx) => (
                <View key={`cat-row-${rowIdx}`} style={styles.gridRow}>
                  {row.map((item) => {
                    const isActive = item.isAll
                      ? category === 'all'
                      : category.toLowerCase() === item.id.toLowerCase();
                    const catIconName = !item.isAll && getCategoryIconName
                      ? getCategoryIconName(
                          item.id,
                          filter === 'income' ? 'income' : 'expense'
                        )
                      : 'Tag';
                    return (
                      <View key={item.id} style={styles.gridCol}>
                        <TouchableOpacity
                          style={[
                            styles.optionCard,
                            styles.optionCardCompact,
                            isActive && styles.optionCardActive,
                          ]}
                          onPress={() => {
                            AppHaptics.selection();
                            onChangeCategory(item.id);
                          }}
                          activeOpacity={0.78}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isActive }}
                        >
                          <View
                            style={[
                              styles.optionIconBox,
                              isActive && styles.optionIconBoxActive,
                            ]}
                          >
                            {item.isAll ? (
                              <LayoutGrid
                                size={13}
                                color={isActive ? Palette.white : Palette.primary}
                              />
                            ) : (
                              <CategoryIcon
                                name={catIconName}
                                size={13.5}
                                color={isActive ? Palette.white : Palette.primary}
                              />
                            )}
                          </View>
                          <Text
                            style={[
                              styles.optionTitle,
                              styles.optionTitleFlex,
                              isActive && styles.optionTitleActive,
                            ]}
                          >
                            {item.label}
                          </Text>
                          <View
                            style={[
                              styles.radioDot,
                              isActive && styles.radioDotActive,
                            ]}
                          >
                            {isActive ? (
                              <Check size={9} color={Palette.white} strokeWidth={3} />
                            ) : null}
                          </View>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                  {row.length < 2 ? <View style={styles.gridSlotEmpty} /> : null}
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Sticky Bottom Action Bar (Proper Flex Footer) */}
      <View
        style={[
          styles.bottomActionBar,
          { paddingBottom: Math.max(insets.bottom, 16) },
        ]}
      >
        {isAnyFilterActive ? (
          <TouchableOpacity
            style={styles.resetBtn}
            onPress={() => {
              AppHaptics.light();
              triggerSmoothLayout();
              onReset();
            }}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Reset all filters"
          >
            <RotateCcw size={15} color={Palette.bodyStrong} />
            <Text style={styles.resetBtnText}>Reset</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={styles.applyBtn}
          onPress={() => {
            AppHaptics.light();
            onClose();
          }}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Apply filters"
        >
          <Check size={16} color={Palette.white} strokeWidth={2.4} />
          <Text style={styles.applyBtnText}>
            {activeFilterCount > 0 ? `Apply Filters (${activeFilterCount})` : 'Done'}
          </Text>
        </TouchableOpacity>
      </View>

      <DatePickerModal
        visible={datePickerTarget !== null}
        selectedDate={datePickerTarget === 'from' ? dateFrom : dateTo}
        onSelectDate={(dateStr) => {
          if (datePickerTarget === 'from') {
            onChangeDateFrom?.(dateStr);
            if (dateTo && dateStr > dateTo) {
              onChangeDateTo?.(dateStr);
            }
          } else if (datePickerTarget === 'to') {
            onChangeDateTo?.(dateStr);
            if (dateFrom && dateStr < dateFrom) {
              onChangeDateFrom?.(dateStr);
            }
          }
          onChangeMonth('all');
          setDatePickerTarget(null);
        }}
        onClose={() => setDatePickerTarget(null)}
      />
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    flex: 1,
  },
  scrollBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  filterSection: {
    marginBottom: 22,
  },
  subSectionBlock: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.hairline,
  },
  sectionTitle: {
    ...Typography.label,
    fontSize: 11,
    color: Palette.muted,
    marginBottom: 10,
  },
  // 3-Column Segmented Control (Transaction Type & Lent)
  segmentedBar: {
    flexDirection: 'row',
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 14,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  segmentBtn: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  segmentBtnActive: {
    backgroundColor: Palette.primary,
  },
  segmentBtnText: {
    ...Typography.caption,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '600',
    color: Palette.muted,
  },
  segmentBtnTextActive: {
    color: Palette.white,
    fontWeight: '700',
  },
  // Bulletproof Symmetrical Grid Primitives
  gridBlock: {
    gap: 8,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 8,
  },
  gridCol: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
  },
  gridSlotEmpty: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
  },
  // 3-Column Compact Period Tiles
  compactTile: {
    flex: 1,
    width: '100%',
    minHeight: 40,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 11,
    backgroundColor: Palette.white,
    borderWidth: 1,
    borderColor: Palette.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactTileActive: {
    backgroundColor: Palette.tintExpense,
    borderColor: Palette.primary,
  },
  compactTileText: {
    ...Typography.caption,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: Palette.ink,
    textAlign: 'center',
  },
  compactTileTextActive: {
    color: Palette.primary,
    fontWeight: '700',
  },
  // 2-Column Custom Date Range Cards
  dateCard: {
    flex: 1,
    width: '100%',
    backgroundColor: Palette.white,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: Palette.hairline,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 58,
    justifyContent: 'space-between',
  },
  dateCardActive: {
    backgroundColor: Palette.tintExpense,
    borderColor: Palette.primary,
  },
  dateCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  dateCardLabel: {
    ...Typography.caption,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    color: Palette.muted,
    flex: 1,
  },
  dateCardLabelActive: {
    color: Palette.primary,
  },
  dateClearBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Palette.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateCardValue: {
    ...Typography.mono,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '700',
    color: Palette.ink,
  },
  dateCardPlaceholder: {
    fontWeight: '500',
    color: Palette.mutedSoft,
  },
  // Full-Width Fixed Ledger List (Account & Pocket)
  listCard: {
    backgroundColor: Palette.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Palette.hairline,
    overflow: 'hidden',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 54,
    paddingHorizontal: 13,
    gap: 10,
    backgroundColor: Palette.white,
  },
  listRowCompact: {
    height: 48,
  },
  listRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.hairline,
  },
  listRowActive: {
    backgroundColor: Palette.tintExpense,
  },
  listIconBox: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: Palette.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  listRowTitle: {
    ...Typography.body,
    fontSize: 13.5,
    lineHeight: 17,
    fontWeight: '600',
    color: Palette.ink,
  },
  // 2-Column Fixed-Height Icon Option Cards (Payment Method, Category)
  optionCard: {
    flex: 1,
    width: '100%',
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 13,
    backgroundColor: Palette.white,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  optionCardCompact: {
    height: 50,
    paddingVertical: 6,
  },
  optionCardActive: {
    backgroundColor: Palette.tintExpense,
    borderColor: Palette.primary,
  },
  optionIconBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: Palette.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  optionIconBoxActive: {
    backgroundColor: Palette.primary,
  },
  optionTextCol: {
    flex: 1,
    minWidth: 0,
  },
  optionTitle: {
    ...Typography.caption,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '600',
    color: Palette.ink,
  },
  optionTitleFlex: {
    flex: 1,
  },
  optionTitleActive: {
    color: Palette.primary,
    fontWeight: '700',
  },
  optionSub: {
    ...Typography.caption,
    fontSize: 10.5,
    lineHeight: 13,
    color: Palette.muted,
    marginTop: 1,
  },
  optionSubActive: {
    color: Palette.primaryActive,
  },
  radioDot: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    borderWidth: 1.5,
    borderColor: Palette.hairline,
    backgroundColor: Palette.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  radioDotActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  // Proper Flex Sticky Bottom Action Bar
  bottomActionBar: {
    backgroundColor: Palette.white,
    borderTopWidth: 1,
    borderTopColor: Palette.hairline,
    paddingTop: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    gap: 10,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    height: 48,
    borderRadius: 14,
    backgroundColor: Palette.surfaceSoft,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  resetBtnText: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '600',
    color: Palette.bodyStrong,
  },
  applyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 14,
    backgroundColor: Palette.primary,
  },
  applyBtnText: {
    ...Typography.body,
    fontSize: 14.5,
    fontWeight: '700',
    color: Palette.white,
  },
});
