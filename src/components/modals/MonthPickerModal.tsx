import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Check } from 'lucide-react-native';
import { Palette, Typography } from '../../theme/tokens';
import { AppHaptics } from '../../utils/haptics';
import { ModalHeader } from '../ModalHeader';
import { BottomSheetModal } from '../BottomSheetModal';

export interface MonthPickerModalProps {
  visible: boolean;
  selectedMonth: string; // 'YYYY-MM' or 'all'
  availableMonths?: string[]; // Array of 'YYYY-MM' that have transactions
  showAllOption?: boolean;
  onSelectMonth: (monthKey: string) => void;
  onClose: () => void;
}

const MONTH_DATA = [
  { key: '01', short: 'Jan', full: 'January' },
  { key: '02', short: 'Feb', full: 'February' },
  { key: '03', short: 'Mar', full: 'March' },
  { key: '04', short: 'Apr', full: 'April' },
  { key: '05', short: 'May', full: 'May' },
  { key: '06', short: 'Jun', full: 'June' },
  { key: '07', short: 'Jul', full: 'July' },
  { key: '08', short: 'Aug', full: 'August' },
  { key: '09', short: 'Sep', full: 'September' },
  { key: '10', short: 'Oct', full: 'October' },
  { key: '11', short: 'Nov', full: 'November' },
  { key: '12', short: 'Dec', full: 'December' },
];

export const MonthPickerModal: React.FC<MonthPickerModalProps> = ({
  visible,
  selectedMonth,
  availableMonths = [],
  showAllOption = true,
  onSelectMonth,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthKey = `${currentYear}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Year being navigated in the picker
  const [viewYear, setViewYear] = useState<number>(() => {
    if (selectedMonth && selectedMonth !== 'all') {
      const parts = selectedMonth.split('-');
      const y = parseInt(parts[0], 10);
      if (!isNaN(y)) return y;
    }
    return currentYear;
  });

  // Sync view year when modal opens or selectedMonth changes
  useEffect(() => {
    if (visible) {
      if (selectedMonth && selectedMonth !== 'all') {
        const parts = selectedMonth.split('-');
        const y = parseInt(parts[0], 10);
        if (!isNaN(y)) {
          setViewYear(y);
          return;
        }
      }
      setViewYear(currentYear);
    }
  }, [visible, selectedMonth, currentYear]);

  const handlePrevYear = () => {
    AppHaptics.selection();
    setViewYear((prev) => prev - 1);
  };

  const handleNextYear = () => {
    AppHaptics.selection();
    setViewYear((prev) => prev + 1);
  };

  const handlePickMonth = (monthCode: string) => {
    AppHaptics.selection();
    const targetKey = `${viewYear}-${monthCode}`;
    onSelectMonth(targetKey);
    onClose();
  };

  const handleSelectCurrentMonth = () => {
    AppHaptics.selection();
    onSelectMonth(currentMonthKey);
    onClose();
  };

  const handleSelectAllTime = () => {
    AppHaptics.selection();
    onSelectMonth('all');
    onClose();
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      maxHeight="85%"
    >
      <ModalHeader
        title="Select Month"
        subtitle="Choose a period to inspect finances"
        onClose={onClose}
      />

          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={{
              paddingBottom: Math.max(insets.bottom, 20) + 16,
            }}
            showsVerticalScrollIndicator={false}
          >
            {/* Year Stepper Bar */}
            <View style={styles.yearBar}>
              <TouchableOpacity
                style={styles.yearNavBtn}
                onPress={handlePrevYear}
                activeOpacity={0.7}
              >
                <ChevronLeft size={20} color={Palette.ink} />
              </TouchableOpacity>

              <View style={styles.yearDisplay}>
                <CalendarIcon size={16} color={Palette.primary} />
                <Text style={styles.yearText}>{viewYear}</Text>
              </View>

              <TouchableOpacity
                style={styles.yearNavBtn}
                onPress={handleNextYear}
                activeOpacity={0.7}
              >
                <ChevronRight size={20} color={Palette.ink} />
              </TouchableOpacity>
            </View>

            {/* 12-Month Grid (3 cols x 4 rows) */}
            <View style={styles.monthsGrid}>
              {MONTH_DATA.map((item) => {
                const monthKey = `${viewYear}-${item.key}`;
                const isSelected = selectedMonth === monthKey;
                const isThisCurrentMonth = monthKey === currentMonthKey;
                const hasData = availableMonths.includes(monthKey);

                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[
                      styles.monthTile,
                      isSelected && styles.monthTileSelected,
                      isThisCurrentMonth && !isSelected && styles.monthTileCurrent,
                    ]}
                    onPress={() => handlePickMonth(item.key)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.monthHeaderRow}>
                      <Text
                        style={[
                          styles.monthShortText,
                          isSelected && styles.monthShortTextSelected,
                        ]}
                      >
                        {item.short}
                      </Text>
                      {isSelected ? (
                        <Check size={14} color={Palette.white} />
                      ) : hasData ? (
                        <View style={styles.dataIndicatorDot} />
                      ) : null}
                    </View>

                    <Text
                      style={[
                        styles.monthFullText,
                        isSelected && styles.monthFullTextSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {item.full}
                    </Text>

                    {isThisCurrentMonth && !isSelected ? (
                      <View style={styles.currentMonthBadge}>
                        <Text style={styles.currentMonthBadgeText}>Current</Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Quick Period Action Shortcuts */}
            <View style={styles.actionsBox}>
              <TouchableOpacity
                style={[
                  styles.shortcutBtn,
                  selectedMonth === currentMonthKey && styles.shortcutBtnActive,
                ]}
                onPress={handleSelectCurrentMonth}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.shortcutBtnText,
                    selectedMonth === currentMonthKey && styles.shortcutBtnTextActive,
                  ]}
                >
                  This Month
                </Text>
              </TouchableOpacity>

              {showAllOption && (
                <TouchableOpacity
                  style={[
                    styles.shortcutBtn,
                    selectedMonth === 'all' && styles.shortcutBtnActive,
                  ]}
                  onPress={handleSelectAllTime}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.shortcutBtnText,
                      selectedMonth === 'all' && styles.shortcutBtnTextActive,
                    ]}
                  >
                    All Months
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Palette.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  yearBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  yearNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Palette.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  yearText: {
    ...Typography.heading,
    fontSize: 18,
    fontWeight: '700',
    color: Palette.ink,
  },
  monthsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  monthTile: {
    width: '31%',
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 68,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  monthTileSelected: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  monthTileCurrent: {
    borderColor: Palette.primary,
  },
  monthHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  monthShortText: {
    ...Typography.heading,
    fontSize: 15,
    fontWeight: '700',
    color: Palette.ink,
  },
  monthShortTextSelected: {
    color: Palette.white,
  },
  monthFullText: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
    marginTop: 2,
  },
  monthFullTextSelected: {
    color: 'rgba(255,255,255,0.85)',
  },
  dataIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Palette.accentTeal,
  },
  currentMonthBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EDF5FF',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginTop: 4,
  },
  currentMonthBadgeText: {
    ...Typography.caption,
    fontSize: 9,
    fontWeight: '600',
    color: Palette.primary,
  },
  actionsBox: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  shortcutBtn: {
    flex: 1,
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  shortcutBtnActive: {
    backgroundColor: '#EDF5FF',
    borderColor: Palette.primary,
  },
  shortcutBtnText: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '600',
    color: Palette.ink,
  },
  shortcutBtnTextActive: {
    color: Palette.primary,
  },
});
