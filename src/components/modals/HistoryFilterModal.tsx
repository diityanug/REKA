import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, RotateCcw } from 'lucide-react-native';
import { Palette, Typography } from '../../theme/tokens';
import { FilterType } from '../../types';
import { formatMonthShort } from '../../utils/formatters';
import { AppHaptics } from '../../utils/haptics';
import { ModalHeader } from '../ModalHeader';
import { BottomSheetModal } from '../BottomSheetModal';

export interface HistoryFilterModalProps {
  visible: boolean;
  filter: FilterType;
  category: string;
  month: string;
  availableCategories: string[];
  availableExpenseCategories?: string[];
  availableIncomeCategories?: string[];
  availableMonths: string[];
  onChangeFilter: (filter: FilterType) => void;
  onChangeCategory: (category: string) => void;
  onChangeMonth: (month: string) => void;
  onReset: () => void;
  onClose: () => void;
}

export const HistoryFilterModal: React.FC<HistoryFilterModalProps> = ({
  visible,
  filter,
  category,
  month,
  availableCategories,
  availableExpenseCategories = [],
  availableIncomeCategories = [],
  availableMonths,
  onChangeFilter,
  onChangeCategory,
  onChangeMonth,
  onReset,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const isAnyFilterActive = filter !== 'all' || category !== 'all' || month !== 'all';

  // Determine which categories to show depending on transaction type
  const displayedCategories = useMemo(() => {
    if (filter === 'expense') {
      return availableExpenseCategories.length > 0
        ? availableExpenseCategories
        : availableCategories;
    }
    if (filter === 'income') {
      return availableIncomeCategories.length > 0
        ? availableIncomeCategories
        : availableCategories;
    }
    return availableCategories;
  }, [filter, availableCategories, availableExpenseCategories, availableIncomeCategories]);

  // Dynamic "All" category label scoped to the active type
  const allCategoryLabel =
    filter === 'expense'
      ? 'All Expense Categories'
      : filter === 'income'
      ? 'All Income Categories'
      : 'All Categories';

  // Handle switching transaction type and safely resetting category if needed
  const handleSelectFilterType = (newFilter: FilterType) => {
    AppHaptics.selection();
    onChangeFilter(newFilter);

    if (category !== 'all') {
      let allowedList = availableCategories;
      if (newFilter === 'expense' && availableExpenseCategories.length > 0) {
        allowedList = availableExpenseCategories;
      } else if (newFilter === 'income' && availableIncomeCategories.length > 0) {
        allowedList = availableIncomeCategories;
      }
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
      maxHeight="85%"
    >
      <ModalHeader
        title="Filter Transactions"
        subtitle="Refine by transaction type, month, or category"
        onClose={onClose}
      />

          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={{
              paddingBottom: Math.max(insets.bottom, 20) + 80,
            }}
            showsVerticalScrollIndicator={false}
          >
            {/* Section 1: Transaction Type */}
            <View style={styles.filterSection}>
              <Text style={styles.sectionTitle}>Transaction Type</Text>
              <View style={styles.chipsRow}>
                {(['all', 'expense', 'income'] as FilterType[]).map((f) => {
                  const isActive = filter === f;
                  const label =
                    f === 'all'
                      ? 'All Types'
                      : f === 'expense'
                      ? 'Expenses'
                      : 'Income';
                  return (
                    <TouchableOpacity
                      key={f}
                      style={[styles.typeChip, isActive && styles.typeChipActive]}
                      onPress={() => handleSelectFilterType(f)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.typeChipText,
                          isActive && styles.typeChipTextActive,
                        ]}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Section 2: Month / Period */}
            {availableMonths.length > 0 && (
              <View style={styles.filterSection}>
                <Text style={styles.sectionTitle}>Month / Period</Text>
                <View style={styles.wrapGrid}>
                  <TouchableOpacity
                    style={[
                      styles.pillOption,
                      month === 'all' && styles.pillOptionActive,
                    ]}
                    onPress={() => {
                      AppHaptics.selection();
                      onChangeMonth('all');
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.pillOptionText,
                        month === 'all' && styles.pillOptionTextActive,
                      ]}
                    >
                      All Months
                    </Text>
                  </TouchableOpacity>

                  {availableMonths.map((m) => {
                    const isActive = month === m;
                    return (
                      <TouchableOpacity
                        key={m}
                        style={[
                          styles.pillOption,
                          isActive && styles.pillOptionActive,
                        ]}
                        onPress={() => {
                          AppHaptics.selection();
                          onChangeMonth(m);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.pillOptionText,
                            isActive && styles.pillOptionTextActive,
                          ]}
                        >
                          {formatMonthShort(m)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Section 3: Categories */}
            {displayedCategories.length > 0 && (
              <View style={styles.filterSection}>
                <Text style={styles.sectionTitle}>
                  {filter === 'expense'
                    ? 'Expense Categories'
                    : filter === 'income'
                    ? 'Income Categories'
                    : 'Category'}
                </Text>
                <View style={styles.wrapGrid}>
                  <TouchableOpacity
                    style={[
                      styles.pillOption,
                      category === 'all' && styles.pillOptionActive,
                    ]}
                    onPress={() => {
                      AppHaptics.selection();
                      onChangeCategory('all');
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.pillOptionText,
                        category === 'all' && styles.pillOptionTextActive,
                      ]}
                    >
                      {allCategoryLabel}
                    </Text>
                  </TouchableOpacity>

                  {displayedCategories.map((c) => {
                    const isActive = category.toLowerCase() === c.toLowerCase();
                    return (
                      <TouchableOpacity
                        key={c}
                        style={[
                          styles.pillOption,
                          isActive && styles.pillOptionActive,
                        ]}
                        onPress={() => {
                          AppHaptics.selection();
                          onChangeCategory(c);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.pillOptionText,
                            isActive && styles.pillOptionTextActive,
                          ]}
                        >
                          {c}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Sticky Bottom Action Bar */}
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
                  onReset();
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Reset all filters"
              >
                <RotateCcw size={15} color={Palette.muted} />
                <Text style={styles.resetBtnText}>Reset</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={styles.applyBtn}
              onPress={() => {
                AppHaptics.light();
                onClose();
              }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Done, close filters"
            >
              <Check size={16} color={Palette.white} />
              <Text style={styles.applyBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  filterSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    ...Typography.subheading,
    fontSize: 13,
    fontWeight: '700',
    color: Palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typeChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Palette.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  typeChipActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  typeChipText: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '600',
    color: Palette.ink,
  },
  typeChipTextActive: {
    color: Palette.white,
  },
  wrapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pillOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: Palette.surfaceSoft,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  pillOptionActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  pillOptionText: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '500',
    color: Palette.ink,
  },
  pillOptionTextActive: {
    color: Palette.white,
    fontWeight: '600',
  },
  bottomActionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
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
    paddingVertical: 12,
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
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: Palette.primary,
  },
  applyBtnText: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: '700',
    color: Palette.white,
  },
});
