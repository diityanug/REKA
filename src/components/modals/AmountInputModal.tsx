import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  TextInputSelectionChangeEvent,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Delete, Check } from 'lucide-react-native';
import { Palette, Typography } from '../../theme/tokens';
import { useSyncOnChange } from '../../hooks/useSyncOnChange';
import { CurrencyType } from '../../types';
import { AppHaptics } from '../../utils/haptics';
import { formatCurrencyInput, parseAmount } from '../../utils/formatters';
import { formattedToRawCursor, rawToFormattedCursor } from '../../utils/calculator';
import { ModalHeader } from '../ModalHeader';
import { BottomSheetModal } from '../BottomSheetModal';

export interface AmountInputModalProps {
  visible: boolean;
  title?: string;
  subtitle?: string;
  initialAmount?: string;
  currency: CurrencyType;
  maxDigits?: number;
  onConfirm: (formattedStr: string, numericVal: number) => void;
  onClose: () => void;
}

export const AmountInputModal: React.FC<AmountInputModalProps> = ({
  visible,
  title = 'Set Amount',
  subtitle,
  initialAmount = '',
  currency,
  maxDigits = currency === 'IDR' ? 13 : 9,
  onConfirm,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const [rawDigits, setRawDigits] = useState<string>('');

  useSyncOnChange([visible, initialAmount, maxDigits, currency], () => {
    if (visible) {
      let nextRaw = '';
      if (!initialAmount) {
        nextRaw = '';
      } else if (currency === 'USD') {
        const cleaned = initialAmount.replace(/[^0-9.]/g, '');
        nextRaw = cleaned === '0' ? '' : cleaned;
      } else {
        const intOnly = initialAmount.replace(/[.,]\d{1,2}$/, '');
        const clean = intOnly.replace(/\D/g, '').slice(0, maxDigits);
        nextRaw = clean === '0' ? '' : clean;
      }
      setRawDigits(nextRaw);
      const nextFormatted = nextRaw && nextRaw !== '0'
        ? formatCurrencyInput(nextRaw, currency, maxDigits)
        : '0';
      setSelection({ start: nextFormatted.length, end: nextFormatted.length });
    }
  });

  const displayFormatted = useMemo(() => {
    if (!rawDigits || rawDigits === '0') return '0';
    return formatCurrencyInput(rawDigits, currency, maxDigits);
  }, [rawDigits, currency, maxDigits]);

  const numericValue = useMemo(() => {
    return parseAmount(displayFormatted, currency);
  }, [displayFormatted, currency]);

  const inputRef = useRef<React.ElementRef<typeof TextInput>>(null);
  const [isFocused, setIsFocused] = useState<boolean>(true);
  const [selection, setSelection] = useState<{ start: number; end: number }>({
    start: displayFormatted.length,
    end: displayFormatted.length,
  });

  const activeSelection = useMemo(() => ({
    start: Math.min(selection.start, displayFormatted.length),
    end: Math.min(selection.end, displayFormatted.length),
  }), [selection.start, selection.end, displayFormatted.length]);

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const handleSelectionChange = (e: TextInputSelectionChangeEvent) => {
    setSelection(e.nativeEvent.selection);
    setIsFocused(true);
  };

  const handleDigitPress = (d: string) => {
    inputRef.current?.focus();
    setIsFocused(true);

    const rawCursor = formattedToRawCursor(
      displayFormatted,
      rawDigits,
      selection.start,
      currency
    );

    let activeRaw = rawDigits;
    let activeRawCursor = rawCursor;

    if (selection.start !== selection.end) {
      const rawEnd = formattedToRawCursor(
        displayFormatted,
        rawDigits,
        selection.end,
        currency
      );
      const minRaw = Math.min(rawCursor, rawEnd);
      const maxRaw = Math.max(rawCursor, rawEnd);
      activeRaw = rawDigits.slice(0, minRaw) + rawDigits.slice(maxRaw);
      activeRawCursor = minRaw;
    }

    const left = activeRaw.slice(0, activeRawCursor);
    const right = activeRaw.slice(activeRawCursor);

    if (d === '.') {
      if (currency !== 'USD') return;
      if (activeRaw.includes('.')) return;
      AppHaptics.selection();
      const nextRaw = (left || '0') + '.' + right;
      const nextFormatted = formatCurrencyInput(nextRaw, currency, maxDigits);
      const nextRawPos = (left || '0').length + 1;
      const nextFormattedPos = rawToFormattedCursor(nextFormatted, nextRaw, nextRawPos, currency);
      setRawDigits(nextRaw);
      setSelection({ start: nextFormattedPos, end: nextFormattedPos });
      return;
    }

    // Decimal precision & max digits validation
    if (currency === 'USD' && (left + right).includes('.')) {
      const parts = (left + right).split('.');
      if (parts[1] && parts[1].length >= 2) return;
    } else {
      const intPart = (left + right).split('.')[0] || '';
      if (intPart.length >= maxDigits) return;
    }

    AppHaptics.selection();
    let nextRaw = '';
    let nextRawPos = activeRawCursor + 1;

    if (activeRaw === '' || activeRaw === '0') {
      if (d === '0') return;
      nextRaw = d;
      nextRawPos = 1;
    } else {
      nextRaw = left + d + right;
    }

    const nextFormatted = formatCurrencyInput(nextRaw, currency, maxDigits);
    const nextFormattedPos = rawToFormattedCursor(nextFormatted, nextRaw, nextRawPos, currency);

    setRawDigits(nextRaw);
    setSelection({ start: nextFormattedPos, end: nextFormattedPos });
  };

  const handleThousandPress = () => {
    if (!rawDigits || rawDigits === '0') return;
    if (rawDigits.length >= maxDigits) return;
    inputRef.current?.focus();
    setIsFocused(true);
    AppHaptics.selection();

    const rawCursor = formattedToRawCursor(
      displayFormatted,
      rawDigits,
      selection.start,
      currency
    );
    const left = rawDigits.slice(0, rawCursor);
    const right = rawDigits.slice(rawCursor);
    const allowed = Math.min(3, maxDigits - (left + right).length);
    if (allowed <= 0) return;

    const zeros = '0'.repeat(allowed);
    const nextRaw = left + zeros + right;
    const nextRawPos = rawCursor + allowed;
    const nextFormatted = formatCurrencyInput(nextRaw, currency, maxDigits);
    const nextFormattedPos = rawToFormattedCursor(nextFormatted, nextRaw, nextRawPos, currency);

    setRawDigits(nextRaw);
    setSelection({ start: nextFormattedPos, end: nextFormattedPos });
  };

  const handleDelete = () => {
    if (!rawDigits) return;
    inputRef.current?.focus();
    setIsFocused(true);
    AppHaptics.light();

    if (selection.start !== selection.end) {
      const rawStart = formattedToRawCursor(displayFormatted, rawDigits, selection.start, currency);
      const rawEnd = formattedToRawCursor(displayFormatted, rawDigits, selection.end, currency);
      const minRaw = Math.min(rawStart, rawEnd);
      const maxRaw = Math.max(rawStart, rawEnd);
      const nextRaw = rawDigits.slice(0, minRaw) + rawDigits.slice(maxRaw);
      const nextFormatted = formatCurrencyInput(nextRaw, currency, maxDigits);
      const nextFormattedPos = rawToFormattedCursor(nextFormatted, nextRaw, minRaw, currency);
      setRawDigits(nextRaw);
      setSelection({ start: nextFormattedPos, end: nextFormattedPos });
      return;
    }

    const rawCursor = formattedToRawCursor(
      displayFormatted,
      rawDigits,
      selection.start,
      currency
    );
    if (rawCursor <= 0) return;

    const left = rawDigits.slice(0, rawCursor - 1);
    const right = rawDigits.slice(rawCursor);
    const nextRaw = left + right;
    const nextRawPos = Math.max(0, rawCursor - 1);
    const nextFormatted = formatCurrencyInput(nextRaw, currency, maxDigits);
    const nextFormattedPos = rawToFormattedCursor(nextFormatted, nextRaw, nextRawPos, currency);

    setRawDigits(nextRaw);
    setSelection({ start: nextFormattedPos, end: nextFormattedPos });
  };

  const handleClear = () => {
    inputRef.current?.focus();
    setIsFocused(true);
    AppHaptics.light();
    setRawDigits('');
    setSelection({ start: 0, end: 0 });
  };

  const handleQuickAdd = (addVal: number) => {
    inputRef.current?.focus();
    setIsFocused(true);
    AppHaptics.selection();
    const current = parseInt(rawDigits || '0', 10);
    const sum = Math.min(current + addVal, Math.pow(10, maxDigits) - 1);
    const nextRaw = sum > 0 ? String(sum) : '';
    const nextFormatted = formatCurrencyInput(nextRaw, currency, maxDigits);
    setRawDigits(nextRaw);
    setSelection({ start: nextFormatted.length, end: nextFormatted.length });
  };

  const handlePrefixPress = () => {
    AppHaptics.selection();
    inputRef.current?.focus();
    setSelection({ start: 0, end: 0 });
  };

  const handleConfirm = () => {
    AppHaptics.light();
    onConfirm(displayFormatted === '0' ? '' : displayFormatted, numericValue);
    onClose();
  };

  const presets = useMemo(() => {
    if (currency === 'IDR') {
      return [
        { label: '+100K', amount: 100000 },
        { label: '+500K', amount: 500000 },
        { label: '+1M', amount: 1000000 },
        { label: '+5M', amount: 5000000 },
      ];
    }
    return [
      { label: '+$10', amount: 10 },
      { label: '+$50', amount: 50 },
      { label: '+$100', amount: 100 },
      { label: '+$500', amount: 500 },
    ];
  }, [currency]);

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
    >
      <ModalHeader
        title={title}
        subtitle={subtitle || `Max ${maxDigits} digits`}
        onClose={onClose}
      />

      <View style={[styles.sheetContent, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        {/* Interactive Display Card with Native Cursor */}
        <Pressable
          style={[
            styles.displayCard,
            isFocused && styles.displayCardFocused,
          ]}
          onPress={() => {
            inputRef.current?.focus();
            setIsFocused(true);
            setSelection({ start: displayFormatted.length, end: displayFormatted.length });
          }}
        >
          <View style={styles.displayMainRow}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handlePrefixPress}
              style={styles.prefixTouch}
            >
              <Text style={styles.currencyPrefix}>
                {currency === 'IDR' ? 'Rp' : '$'}
              </Text>
            </TouchableOpacity>

            <TextInput
              ref={inputRef}
              style={styles.textInput}
              showSoftInputOnFocus={false}
              value={displayFormatted}
              selection={activeSelection}
              onSelectionChange={handleSelectionChange}
              onFocus={() => {
                setIsFocused(true);
                if (selection.start <= 1 && displayFormatted.length > 1) {
                  setSelection({ start: displayFormatted.length, end: displayFormatted.length });
                }
              }}
              onBlur={() => setIsFocused(false)}
              cursorColor={Palette.primary}
              selectionColor={Palette.primary + '33'}
              multiline={false}
              autoCorrect={false}
              autoCapitalize="none"
              scrollEnabled={true}
            />
          </View>

          <Text style={styles.digitLimitHint}>
            Max {maxDigits} digits
          </Text>
        </Pressable>

        {/* Quick Presets */}
        <View style={styles.presetsRow}>
          {presets.map((p) => (
            <TouchableOpacity
              key={p.label}
              style={styles.presetChip}
              onPress={() => handleQuickAdd(p.amount)}
              activeOpacity={0.7}
            >
              <Text style={styles.presetChipText}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 4x3 Keypad Grid */}
        <View style={styles.keypadGrid}>
          {/* Row 1 */}
          <View style={styles.keypadRow}>
            <Pressable
              style={({ pressed }) => [styles.keypadBtn, pressed && styles.keypadBtnPressed]}
              onPress={() => handleDigitPress('1')}
            >
              <Text style={styles.keypadDigit}>1</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.keypadBtn, pressed && styles.keypadBtnPressed]}
              onPress={() => handleDigitPress('2')}
            >
              <Text style={styles.keypadDigit}>2</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.keypadBtn, pressed && styles.keypadBtnPressed]}
              onPress={() => handleDigitPress('3')}
            >
              <Text style={styles.keypadDigit}>3</Text>
            </Pressable>
          </View>

          {/* Row 2 */}
          <View style={styles.keypadRow}>
            <Pressable
              style={({ pressed }) => [styles.keypadBtn, pressed && styles.keypadBtnPressed]}
              onPress={() => handleDigitPress('4')}
            >
              <Text style={styles.keypadDigit}>4</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.keypadBtn, pressed && styles.keypadBtnPressed]}
              onPress={() => handleDigitPress('5')}
            >
              <Text style={styles.keypadDigit}>5</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.keypadBtn, pressed && styles.keypadBtnPressed]}
              onPress={() => handleDigitPress('6')}
            >
              <Text style={styles.keypadDigit}>6</Text>
            </Pressable>
          </View>

          {/* Row 3 */}
          <View style={styles.keypadRow}>
            <Pressable
              style={({ pressed }) => [styles.keypadBtn, pressed && styles.keypadBtnPressed]}
              onPress={() => handleDigitPress('7')}
            >
              <Text style={styles.keypadDigit}>7</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.keypadBtn, pressed && styles.keypadBtnPressed]}
              onPress={() => handleDigitPress('8')}
            >
              <Text style={styles.keypadDigit}>8</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.keypadBtn, pressed && styles.keypadBtnPressed]}
              onPress={() => handleDigitPress('9')}
            >
              <Text style={styles.keypadDigit}>9</Text>
            </Pressable>
          </View>

          {/* Row 4 */}
          <View style={styles.keypadRow}>
            {currency === 'IDR' ? (
              <Pressable
                style={({ pressed }) => [styles.keypadBtn, pressed && styles.keypadBtnPressed]}
                onPress={handleThousandPress}
              >
                <Text style={styles.keypadThousand}>000</Text>
              </Pressable>
            ) : (
              <Pressable
                style={({ pressed }) => [styles.keypadBtn, pressed && styles.keypadBtnPressed]}
                onPress={() => handleDigitPress('.')}
              >
                <Text style={styles.keypadDigit}>.</Text>
              </Pressable>
            )}
            <Pressable
              style={({ pressed }) => [styles.keypadBtn, pressed && styles.keypadBtnPressed]}
              onPress={() => handleDigitPress('0')}
            >
              <Text style={styles.keypadDigit}>0</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.keypadBtn, styles.deleteBtn, pressed && styles.keypadBtnPressed]}
              onPress={handleDelete}
              onLongPress={handleClear}
            >
              <Delete size={22} color={Palette.ink} />
            </Pressable>
          </View>
        </View>

        {/* Action Button */}
        <TouchableOpacity
          style={styles.confirmBtn}
          onPress={handleConfirm}
          activeOpacity={0.85}
        >
          <Check size={20} color={Palette.white} style={{ marginRight: 8 }} />
          <Text style={styles.confirmBtnText}>Save Amount</Text>
        </TouchableOpacity>
      </View>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  sheetContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  displayCard: {
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: Palette.hairline,
    marginBottom: 14,
  },
  displayCardFocused: {
    borderColor: Palette.primary,
    backgroundColor: '#FAF5F2',
  },
  displayMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 46,
  },
  prefixTouch: {
    paddingVertical: 4,
    paddingRight: 6,
    justifyContent: 'center',
  },
  currencyPrefix: {
    ...Typography.body,
    fontSize: 20,
    fontWeight: '700',
    color: Palette.muted,
  },
  textInput: {
    ...Typography.display,
    flex: 1,
    fontSize: 28,
    fontWeight: '700',
    color: Palette.ink,
    letterSpacing: -0.3,
    padding: 0,
    margin: 0,
    fontVariant: ['tabular-nums'],
  },
  digitLimitHint: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
    marginTop: 6,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  presetChip: {
    flex: 1,
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  presetChipText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: Palette.ink,
  },
  keypadGrid: {
    gap: 8,
    marginBottom: 16,
  },
  keypadRow: {
    flexDirection: 'row',
    gap: 8,
  },
  keypadBtn: {
    flex: 1,
    height: 52,
    backgroundColor: Palette.white,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Palette.hairline,
    shadowColor: Palette.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  keypadBtnPressed: {
    backgroundColor: '#EBEBE9',
    transform: [{ scale: 0.97 }],
  },
  deleteBtn: {
    backgroundColor: Palette.surfaceSoft,
  },
  keypadDigit: {
    ...Typography.body,
    fontSize: 22,
    fontWeight: '600',
    color: Palette.ink,
  },
  keypadThousand: {
    ...Typography.body,
    fontSize: 18,
    fontWeight: '700',
    color: Palette.ink,
  },
  confirmBtn: {
    height: 52,
    backgroundColor: Palette.primary,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Palette.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  confirmBtnText: {
    ...Typography.body,
    fontSize: 16,
    fontWeight: '700',
    color: Palette.white,
  },
});
