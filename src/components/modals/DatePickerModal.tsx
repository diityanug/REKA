import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Check } from 'lucide-react-native';
import { Palette, Typography } from '../../theme/tokens';
import { AppHaptics } from '../../utils/haptics';
import { ModalHeader } from '../ModalHeader';
import { BottomSheetModal } from '../BottomSheetModal';

export interface DatePickerModalProps {
  visible: boolean;
  selectedDate: string; // 'YYYY-MM-DD'
  onSelectDate: (dateString: string) => void;
  onClose: () => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const DatePickerModal: React.FC<DatePickerModalProps> = ({
  visible,
  selectedDate,
  onSelectDate,
  onClose,
}) => {
  const insets = useSafeAreaInsets();

  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => {
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [today]);

  // Current view month & year in the calendar
  const [viewYear, setViewYear] = useState<number>(today.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(today.getMonth()); // 0-11
  const [tempSelectedDate, setTempSelectedDate] = useState<string>(selectedDate || todayStr);

  useEffect(() => {
    if (visible) {
      const target = selectedDate || todayStr;
      setTempSelectedDate(target);
      const parts = target.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        if (!isNaN(y) && !isNaN(m)) {
          setViewYear(y);
          setViewMonth(m);
        }
      }
    }
  }, [visible, selectedDate, todayStr]);

  const handlePrevMonth = () => {
    AppHaptics.selection();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    AppHaptics.selection();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    AppHaptics.selection();
    const mStr = String(viewMonth + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    const formatted = `${viewYear}-${mStr}-${dStr}`;
    setTempSelectedDate(formatted);
  };

  const handleConfirm = () => {
    AppHaptics.light();
    onSelectDate(tempSelectedDate);
    onClose();
  };

  const handleSelectToday = () => {
    AppHaptics.selection();
    setTempSelectedDate(todayStr);
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  };

  // Calendar matrix calculation
  const calendarCells = useMemo(() => {
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
    const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();

    const cells: Array<{ day: number | null; dateStr: string }> = [];
    // Leading blanks
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push({ day: null, dateStr: '' });
    }
    // Month days
    for (let d = 1; d <= totalDays; d++) {
      const mStr = String(viewMonth + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      cells.push({
        day: d,
        dateStr: `${viewYear}-${mStr}-${dStr}`,
      });
    }
    // Fixed 6-row matrix: pad trailing blanks so the grid always has 42 cells (6 rows * 7 cols)
    while (cells.length < 42) {
      cells.push({ day: null, dateStr: '' });
    }
    return cells;
  }, [viewYear, viewMonth]);

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
    >
      <ModalHeader
        title="Select Date"
        subtitle="Pick transaction date"
        onClose={onClose}
      />

          <View style={[styles.contentBody, { paddingBottom: Math.max(insets.bottom, 20) + 12 }]}>
            {/* Month & Year Navigator */}
            <View style={styles.navigatorRow}>
              <TouchableOpacity
                style={styles.navBtn}
                onPress={handlePrevMonth}
                activeOpacity={0.7}
              >
                <ChevronLeft size={20} color={Palette.ink} />
              </TouchableOpacity>

              <View style={styles.monthYearBox}>
                <CalendarIcon size={16} color={Palette.primary} />
                <Text style={styles.monthYearText}>
                  {MONTH_NAMES[viewMonth]} {viewYear}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.navBtn}
                onPress={handleNextMonth}
                activeOpacity={0.7}
              >
                <ChevronRight size={20} color={Palette.ink} />
              </TouchableOpacity>
            </View>

            {/* Weekday headers */}
            <View style={styles.weekdaysRow}>
              {WEEKDAYS.map((wd) => (
                <View key={wd} style={styles.weekdayCol}>
                  <Text style={styles.weekdayText}>{wd}</Text>
                </View>
              ))}
            </View>

            {/* Calendar Days Grid */}
            <View style={styles.daysGrid}>
              {calendarCells.map((cell, idx) => {
                if (cell.day === null) {
                  return (
                    <View key={`blank_${idx}`} style={styles.dayCellWrapper}>
                      <View style={styles.dayCellBlank} />
                    </View>
                  );
                }

                const isSelected = cell.dateStr === tempSelectedDate;
                const isTodayDate = cell.dateStr === todayStr;

                return (
                  <View key={cell.dateStr} style={styles.dayCellWrapper}>
                    <TouchableOpacity
                      style={[
                        styles.dayCell,
                        isSelected && styles.dayCellSelected,
                        !isSelected && isTodayDate && styles.dayCellToday,
                      ]}
                      onPress={() => handleSelectDay(cell.day!)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          isSelected && styles.dayTextSelected,
                          !isSelected && isTodayDate && styles.dayTextToday,
                        ]}
                      >
                        {cell.day}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>

            {/* Quick Actions */}
            <View style={styles.bottomBar}>
              <TouchableOpacity
                style={styles.todayBtn}
                onPress={handleSelectToday}
                activeOpacity={0.7}
              >
                <Text style={styles.todayBtnText}>Today</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleConfirm}
                activeOpacity={0.8}
              >
                <Check size={16} color={Palette.white} style={{ marginRight: 6 }} />
                <Text style={styles.confirmBtnText}>Confirm Date</Text>
              </TouchableOpacity>
            </View>
          </View>
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
    overflow: 'hidden',
  },
  contentBody: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  navigatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Palette.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthYearBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  monthYearText: {
    ...Typography.body,
    fontSize: 16,
    fontWeight: '700',
    color: Palette.ink,
  },
  weekdaysRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekdayCol: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: Palette.muted,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCellWrapper: {
    width: `${100 / 7}%`,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 1,
  },
  dayCellBlank: {
    width: 38,
    height: 38,
  },
  dayCell: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellSelected: {
    backgroundColor: Palette.primary,
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: Palette.primary,
  },
  dayText: {
    ...Typography.body,
    fontSize: 14,
    color: Palette.ink,
    fontWeight: '500',
  },
  dayTextSelected: {
    color: Palette.white,
    fontWeight: '700',
  },
  dayTextToday: {
    color: Palette.primary,
    fontWeight: '700',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Palette.hairline,
    gap: 12,
  },
  todayBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: Palette.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayBtnText: {
    ...Typography.caption,
    fontSize: 13,
    fontWeight: '700',
    color: Palette.ink,
  },
  confirmBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Palette.primary,
  },
  confirmBtnText: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: '700',
    color: Palette.white,
  },
});
