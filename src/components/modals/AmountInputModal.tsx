import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
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
import {
  formatCurrencyInput,
  parseAmount,
  parsePastedAmountInput,
  extractPastedSubstring,
} from '../../utils/formatters';
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
  /** Allow confirming a zero amount (budget / remove flows). Defaults to false. */
  allowZero?: boolean;
  onConfirm: (formattedStr: string, numericVal: number) => void | Promise<void>;
  onClose: () => void;
}

export const AmountInputModal: React.FC<AmountInputModalProps> = ({
  visible,
  title = 'Set Amount',
  subtitle,
  initialAmount = '',
  currency,
  maxDigits = currency === 'IDR' ? 13 : 9,
  allowZero = false,
  onConfirm,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const [rawDigits, setRawDigits] = useState<string>('');
  const [isFocused, setIsFocused] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const selectionRef = useRef<{ start: number; end: number }>({
    start: 0,
    end: 0,
  });
  const isTextInputFocusedRef = useRef<boolean>(false);
  const inputRef = useRef<React.ElementRef<typeof TextInput>>(null);
  const [pasteAnim] = useState(() => new Animated.Value(1));

  const runSmoothPasteTransition = useCallback(() => {
    pasteAnim.setValue(0.65);
    Animated.timing(pasteAnim, {
      toValue: 1,
      duration: 160,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [pasteAnim]);

  useSyncOnChange([visible], () => {
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
        : '';
      selectionRef.current = { start: nextFormatted.length, end: nextFormatted.length };
      isTextInputFocusedRef.current = false;
      setIsFocused(true);
    }
  });

  const displayFormatted = useMemo(() => {
    if (!rawDigits || rawDigits === '0') return '';
    return formatCurrencyInput(rawDigits, currency, maxDigits);
  }, [rawDigits, currency, maxDigits]);

  const numericValue = useMemo(() => {
    return parseAmount(displayFormatted || '0', currency);
  }, [displayFormatted, currency]);

  // Zero is invalid unless the calling flow explicitly allows it
  const zeroBlocked = !allowZero && numericValue <= 0;

  const getActiveSelection = () => {
    if (!isTextInputFocusedRef.current) {
      return { start: displayFormatted.length, end: displayFormatted.length };
    }
    return {
      start: Math.min(selectionRef.current.start, displayFormatted.length),
      end: Math.min(selectionRef.current.end, displayFormatted.length),
    };
  };

  const handleSelectionChange = (e: TextInputSelectionChangeEvent) => {
    selectionRef.current = e.nativeEvent.selection;
  };

  const handleChangeText = (nextText: string) => {
    if (nextText === displayFormatted) return;

    const inserted = extractPastedSubstring(
      displayFormatted,
      nextText,
      selectionRef.current
    );

    if (
      inserted.length === 1 &&
      /^[0-9.]$/.test(inserted) &&
      nextText.length === displayFormatted.length + 1
    ) {
      handleDigitPress(inserted);
      return;
    }

    const sourceText = inserted.length > 0 ? inserted : nextText;
    const parsedRaw = parsePastedAmountInput(sourceText, currency, maxDigits);
    if (inserted.length > 0 && !parsedRaw && !/0/.test(sourceText)) {
      return;
    }

    AppHaptics.selection();
    setRawDigits(parsedRaw);
    const nextFormatted =
      parsedRaw && parsedRaw !== '0'
        ? formatCurrencyInput(parsedRaw, currency, maxDigits)
        : '';
    selectionRef.current = { start: nextFormatted.length, end: nextFormatted.length };
    // Blur native TextInput after paste so selection handles/toolbar dismiss cleanly without cursor jump
    isTextInputFocusedRef.current = false;
    inputRef.current?.blur();
    setIsFocused(true);
    runSmoothPasteTransition();
  };

  const handleDigitPress = (d: string) => {
    setIsFocused(true);
    const sel = getActiveSelection();

    const rawCursor = formattedToRawCursor(
      displayFormatted,
      rawDigits,
      sel.start,
      currency
    );

    let activeRaw = rawDigits;
    let activeRawCursor = rawCursor;

    if (sel.start !== sel.end) {
      const rawEnd = formattedToRawCursor(
        displayFormatted,
        rawDigits,
        sel.end,
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
      selectionRef.current = { start: nextFormattedPos, end: nextFormattedPos };
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
    selectionRef.current = { start: nextFormattedPos, end: nextFormattedPos };
  };

  const handleThousandPress = () => {
    if (!rawDigits || rawDigits === '0') return;
    if (rawDigits.length >= maxDigits) return;
    setIsFocused(true);
    AppHaptics.selection();

    const sel = getActiveSelection();
    const rawCursor = formattedToRawCursor(
      displayFormatted,
      rawDigits,
      sel.start,
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
    selectionRef.current = { start: nextFormattedPos, end: nextFormattedPos };
  };

  const handleDelete = () => {
    if (!rawDigits) return;
    setIsFocused(true);
    AppHaptics.light();

    const sel = getActiveSelection();
    if (sel.start !== sel.end) {
      const rawStart = formattedToRawCursor(displayFormatted, rawDigits, sel.start, currency);
      const rawEnd = formattedToRawCursor(displayFormatted, rawDigits, sel.end, currency);
      const minRaw = Math.min(rawStart, rawEnd);
      const maxRaw = Math.max(rawStart, rawEnd);
      const nextRaw = rawDigits.slice(0, minRaw) + rawDigits.slice(maxRaw);
      const nextFormatted = formatCurrencyInput(nextRaw, currency, maxDigits);
      const nextFormattedPos = rawToFormattedCursor(nextFormatted, nextRaw, minRaw, currency);
      setRawDigits(nextRaw);
      selectionRef.current = { start: nextFormattedPos, end: nextFormattedPos };
      isTextInputFocusedRef.current = false;
      return;
    }

    const rawCursor = formattedToRawCursor(
      displayFormatted,
      rawDigits,
      sel.start,
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
    selectionRef.current = { start: nextFormattedPos, end: nextFormattedPos };
  };

  const handleClear = () => {
    setIsFocused(true);
    AppHaptics.light();
    setRawDigits('');
    selectionRef.current = { start: 0, end: 0 };
    isTextInputFocusedRef.current = false;
  };

  const handleQuickAdd = (addVal: number) => {
    setIsFocused(true);
    AppHaptics.selection();
    // Add to the parsed numeric value so USD cents are never truncated
    const cap = currency === 'USD' ? Math.pow(10, maxDigits) - 0.01 : Math.pow(10, maxDigits) - 1;
    const sum = Math.min(numericValue + addVal, cap);
    const rounded = currency === 'USD' ? Math.round(sum * 100) / 100 : Math.round(sum);
    const nextRaw = rounded > 0 ? String(rounded) : '';
    const nextFormatted = formatCurrencyInput(nextRaw, currency, maxDigits);
    setRawDigits(nextRaw);
    selectionRef.current = { start: nextFormatted.length, end: nextFormatted.length };
    isTextInputFocusedRef.current = false;
  };

  const handlePrefixPress = () => {
    AppHaptics.selection();
    inputRef.current?.focus();
    selectionRef.current = { start: 0, end: 0 };
  };

  const handleConfirm = async () => {
    if (saving || zeroBlocked) return;
    AppHaptics.light();
    setSaving(true);
    try {
      await onConfirm(displayFormatted === '0' ? '' : displayFormatted, numericValue);
      onClose();
    } finally {
      setSaving(false);
    }
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
        {/* Interactive Display Card with Native Cursor & Paste Support */}
        <View
          style={[
            styles.displayCard,
            isFocused && styles.displayCardFocused,
          ]}
        >
          <Animated.View
            style={[
              styles.displayMainRow,
              {
                opacity: pasteAnim,
                transform: [
                  {
                    scale: pasteAnim.interpolate({
                      inputRange: [0.65, 1],
                      outputRange: [0.985, 1],
                    }),
                  },
                ],
              },
            ]}
          >
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
              contextMenuHidden={false}
              selectTextOnFocus={true}
              value={displayFormatted}
              placeholder="0"
              placeholderTextColor={Palette.ink}
              onChangeText={handleChangeText}
              onSelectionChange={handleSelectionChange}
              onFocus={() => {
                isTextInputFocusedRef.current = true;
                setIsFocused(true);
              }}
              onBlur={() => {
                isTextInputFocusedRef.current = false;
              }}
              cursorColor={Palette.primary}
              selectionColor={Palette.primary + '33'}
              multiline={false}
              autoCorrect={false}
              autoCapitalize="none"
              scrollEnabled={false}
            />
          </Animated.View>

          <Text style={styles.digitLimitHint}>
            Max {maxDigits} digits
          </Text>
        </View>

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

        {/* Dedicated fixed-height zero guard slot so keypad and button never shift */}
        <View style={styles.zeroHintSlot}>
          {zeroBlocked ? (
            <Text style={styles.zeroHint}>Enter an amount greater than zero.</Text>
          ) : null}
        </View>

        {/* Action Button */}
        <TouchableOpacity
          style={[
            styles.confirmBtn,
            (saving || zeroBlocked) && styles.confirmBtnDisabled,
          ]}
          onPress={handleConfirm}
          disabled={saving || zeroBlocked}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Save amount"
          accessibilityState={{ disabled: saving || zeroBlocked, busy: saving }}
        >
          {saving ? (
            <>
              <ActivityIndicator
                size="small"
                color={Palette.white}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.confirmBtnText}>Saving...</Text>
            </>
          ) : (
            <>
              <Check size={20} color={Palette.white} style={{ marginRight: 8 }} />
              <Text style={styles.confirmBtnText}>Save Amount</Text>
            </>
          )}
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
    marginBottom: 8,
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
  zeroHintSlot: {
    height: 20,
    justifyContent: 'center',
    marginBottom: 8,
  },
  zeroHint: {
    ...Typography.caption,
    fontSize: 12,
    color: Palette.error,
  },
  confirmBtnDisabled: {
    opacity: 0.5,
  },
  confirmBtnText: {
    ...Typography.body,
    fontSize: 16,
    fontWeight: '700',
    color: Palette.white,
  },
});
