import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  TouchableOpacity,
  TextInputSelectionChangeEvent,
  StyleSheet,
  Keyboard,
} from 'react-native';
import { Delete } from 'lucide-react-native';
import { Palette, Typography } from '../theme/tokens';
import { CurrencyType } from '../types';
import { AppHaptics } from '../utils/haptics';
import { formatCurrency } from '../utils/formatters';
import {
  formatExpressionDisplay,
  evaluateMathExpression,
  sanitizeExpressionForCurrency,
  getQuickPresets,
  formattedToRawCursor,
  rawToFormattedCursor,
  calculateNextExpressionWithCursor,
} from '../utils/calculator';

interface CalculatorKeypadProps {
  value: string;
  currency: CurrencyType;
  onChangeValue: (val: string) => void;
  showDisplay?: boolean;
  /** When false, only the amount display is rendered (collapsible keypad). */
  showKeypad?: boolean;
  /** Fired when user taps specifically on the amount display card */
  onPressDisplay?: () => void;
  /** Fired when user finishes and requests closing/dismissing the keypad */
  onCloseKeypad?: () => void;
}

export const CalculatorKeypad = React.memo<CalculatorKeypadProps>(({
  value,
  currency,
  onChangeValue,
  showDisplay = true,
  showKeypad = true,
  onPressDisplay,
  onCloseKeypad,
}) => {
  // Synchronize and sanitize parent value whenever switching currency (e.g. from USD with decimals to IDR)
  useEffect(() => {
    if (currency === 'IDR' && value && value.includes('.')) {
      const clean = sanitizeExpressionForCurrency(value, 'IDR');
      if (clean !== value) {
        onChangeValue(clean);
      }
    }
  }, [currency, value, onChangeValue]);

  const currentExpr = useMemo(() => {
    const raw = value || '0';
    return currency === 'IDR' && raw.includes('.') ? sanitizeExpressionForCurrency(raw, 'IDR') : raw;
  }, [value, currency]);

  const hasOperator =
    currentExpr.includes(' + ') ||
    currentExpr.includes(' - ') ||
    currentExpr.includes(' × ') ||
    currentExpr.includes(' ÷ ');
  const liveEvaluated = evaluateMathExpression(currentExpr, currency);
  const presets = getQuickPresets(currency);

  const formattedExpr = useMemo(() => {
    return formatExpressionDisplay(currentExpr, currency);
  }, [currentExpr, currency]);

  const inputRef = useRef<React.ElementRef<typeof TextInput>>(null);
  const [isFocused, setIsFocused] = useState<boolean>(true);
  const [selection, setSelection] = useState<{ start: number; end: number }>(() => ({
    start: formattedExpr.length,
    end: formattedExpr.length,
  }));

  const isKeypadActionRef = useRef<boolean>(false);

  // Synchronize cursor position: when value or currency changes externally, ensure cursor starts at the very end
  useEffect(() => {
    if (!isKeypadActionRef.current) {
      const formatted = formatExpressionDisplay(currentExpr, currency);
      setSelection({ start: formatted.length, end: formatted.length });
    }
    isKeypadActionRef.current = false;
  }, [value, currency, currentExpr]);

  const activeSelection = useMemo(() => ({
    start: Math.min(selection.start, formattedExpr.length),
    end: Math.min(selection.end, formattedExpr.length),
  }), [selection.start, selection.end, formattedExpr.length]);

  const handleSelectionChange = (e: TextInputSelectionChangeEvent) => {
    setSelection(e.nativeEvent.selection);
    setIsFocused(true);
  };

  const handleKeyPress = useCallback((key: string) => {
    isKeypadActionRef.current = true;
    inputRef.current?.focus();
    setIsFocused(true);

    const rawCursor = formattedToRawCursor(
      formattedExpr,
      currentExpr,
      selection.start,
      currency
    );

    // If user highlighted a range of text, delete that range first
    let activeExpr = currentExpr;
    let activeRawCursor = rawCursor;

    if (selection.start !== selection.end) {
      const rawEnd = formattedToRawCursor(
        formattedExpr,
        currentExpr,
        selection.end,
        currency
      );
      const minRaw = Math.min(rawCursor, rawEnd);
      const maxRaw = Math.max(rawCursor, rawEnd);
      activeExpr = (currentExpr.slice(0, minRaw) + currentExpr.slice(maxRaw)).trim() || '0';
      activeRawCursor = minRaw;
    }

    const { nextExpr, nextRawCursor } = calculateNextExpressionWithCursor(
      activeExpr,
      key,
      currency,
      activeRawCursor
    );

    if (nextExpr === currentExpr && nextRawCursor === rawCursor && selection.start === selection.end) {
      return;
    }

    AppHaptics.selection();
    const nextFormatted = formatExpressionDisplay(nextExpr, currency);
    const nextFormattedPos = rawToFormattedCursor(
      nextFormatted,
      nextExpr,
      nextRawCursor,
      currency
    );

    onChangeValue(nextExpr);
    setSelection({ start: nextFormattedPos, end: nextFormattedPos });
  }, [currentExpr, formattedExpr, selection.start, selection.end, currency, onChangeValue]);

  const handleQuickAdd = useCallback((amount: number) => {
    isKeypadActionRef.current = true;
    inputRef.current?.focus();
    setIsFocused(true);
    const currentNum = evaluateMathExpression(currentExpr, currency);
    const result = Math.max(currentNum + amount, 0);
    if (result > 9999999999999) return;

    const nextNum = currency === 'IDR' ? Math.round(result) : result;
    const nextStr = nextNum.toString();
    if (nextStr === currentExpr) return;

    AppHaptics.light();
    const nextFormatted = formatExpressionDisplay(nextStr, currency);
    onChangeValue(nextStr);
    setSelection({ start: nextFormatted.length, end: nextFormatted.length });
  }, [currentExpr, currency, onChangeValue]);

  const handlePrefixPress = useCallback(() => {
    isKeypadActionRef.current = true;
    AppHaptics.selection();
    inputRef.current?.focus();
    setSelection({ start: 0, end: 0 });
  }, []);

  const decimalOrThousandKey = currency === 'IDR' ? '000' : '.';

  return (
    <View style={styles.container}>
      {/* Interactive Display Card with Native Cursor & Fixed Height Layout */}
      {showDisplay ? (
        <Pressable
          style={[
            styles.displayCard,
            isFocused && styles.displayCardFocused,
          ]}
          onPress={() => {
            Keyboard.dismiss();
            inputRef.current?.focus();
            setIsFocused(true);
            setSelection({ start: formattedExpr.length, end: formattedExpr.length });
            onPressDisplay?.();
          }}
        >
          <View style={styles.displayMainRow}>
            {/* Clickable Currency Prefix */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handlePrefixPress}
              style={styles.prefixTouch}
            >
              <Text style={styles.currencyPrefix}>
                {currency === 'IDR' ? 'Rp ' : '$ '}
              </Text>
            </TouchableOpacity>

            {/* Native TextInput with suppressed system soft keyboard */}
            <TextInput
              ref={inputRef}
              style={styles.textInput}
              showSoftInputOnFocus={false}
              value={formattedExpr}
              selection={activeSelection}
              onSelectionChange={handleSelectionChange}
              onFocus={() => {
                setIsFocused(true);
                if (selection.start <= 1 && formattedExpr.length > 1) {
                  setSelection({ start: formattedExpr.length, end: formattedExpr.length });
                }
                onPressDisplay?.();
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

          {/* Reserved Fixed Result Slot: Stays in layout permanently to prevent height jump / layout shift */}
          <View
            style={[
              styles.liveResultRow,
              { opacity: hasOperator ? 1 : 0 },
            ]}
            pointerEvents={hasOperator ? 'auto' : 'none'}
          >
            <Text style={styles.liveResultLabel}>=</Text>
            <Text style={styles.liveResultAmount}>
              {formatCurrency(liveEvaluated, currency)}
            </Text>
          </View>
        </Pressable>
      ) : null}

      {/* Quick Increment Preset Chips (keypad expanded only) */}
      {showKeypad && (
      <View style={styles.presetsRow}>
        {presets.map((p) => (
          <Pressable
            key={p.label}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={`Add ${p.amount}`}
            style={({ pressed }) => [
              styles.presetChip,
              pressed && styles.presetChipPressed,
            ]}
            onPress={() => handleQuickAdd(p.amount)}
          >
            <Text style={styles.presetChipText}>{p.label}</Text>
          </Pressable>
        ))}
        {onCloseKeypad ? (
          <Pressable
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel="Done entering amount"
            style={({ pressed }) => [
              styles.presetChip,
              styles.doneChip,
              pressed && styles.presetChipPressed,
            ]}
            onPress={() => {
              AppHaptics.selection();
              onCloseKeypad();
            }}
          >
            <Text style={styles.doneChipText}>Done</Text>
          </Pressable>
        ) : null}
      </View>
      )}

      {/* 4x4 Calculator Keypad Grid */}
      {showKeypad && (
      <View style={styles.grid}>
        {/* Row 1 */}
        <View style={styles.row}>
          <Pressable
            hitSlop={4}
            style={({ pressed }) => [
              styles.digitBtn,
              pressed && styles.digitBtnPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="7"
            onPress={() => handleKeyPress('7')}
          >
            <Text style={styles.digitText}>7</Text>
          </Pressable>
          <Pressable
            hitSlop={4}
            style={({ pressed }) => [
              styles.digitBtn,
              pressed && styles.digitBtnPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="8"
            onPress={() => handleKeyPress('8')}
          >
            <Text style={styles.digitText}>8</Text>
          </Pressable>
          <Pressable
            hitSlop={4}
            style={({ pressed }) => [
              styles.digitBtn,
              pressed && styles.digitBtnPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="9"
            onPress={() => handleKeyPress('9')}
          >
            <Text style={styles.digitText}>9</Text>
          </Pressable>
          <Pressable
            hitSlop={4}
            style={({ pressed }) => [
              styles.funcBtn,
              styles.deleteBtn,
              pressed && styles.funcBtnPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Delete"
            onPress={() => handleKeyPress('⌫')}
          >
            <Delete size={20} color={Palette.muted} />
          </Pressable>
        </View>

        {/* Row 2 */}
        <View style={styles.row}>
          <Pressable
            hitSlop={4}
            style={({ pressed }) => [
              styles.digitBtn,
              pressed && styles.digitBtnPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="4"
            onPress={() => handleKeyPress('4')}
          >
            <Text style={styles.digitText}>4</Text>
          </Pressable>
          <Pressable
            hitSlop={4}
            style={({ pressed }) => [
              styles.digitBtn,
              pressed && styles.digitBtnPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="5"
            onPress={() => handleKeyPress('5')}
          >
            <Text style={styles.digitText}>5</Text>
          </Pressable>
          <Pressable
            hitSlop={4}
            style={({ pressed }) => [
              styles.digitBtn,
              pressed && styles.digitBtnPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="6"
            onPress={() => handleKeyPress('6')}
          >
            <Text style={styles.digitText}>6</Text>
          </Pressable>
          <Pressable
            hitSlop={4}
            style={({ pressed }) => [
              styles.funcBtn,
              styles.opBtn,
              pressed && styles.funcBtnPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Subtract"
            onPress={() => handleKeyPress('-')}
          >
            <Text style={styles.opText}>−</Text>
          </Pressable>
        </View>

        {/* Row 3 */}
        <View style={styles.row}>
          <Pressable
            hitSlop={4}
            style={({ pressed }) => [
              styles.digitBtn,
              pressed && styles.digitBtnPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="1"
            onPress={() => handleKeyPress('1')}
          >
            <Text style={styles.digitText}>1</Text>
          </Pressable>
          <Pressable
            hitSlop={4}
            style={({ pressed }) => [
              styles.digitBtn,
              pressed && styles.digitBtnPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="2"
            onPress={() => handleKeyPress('2')}
          >
            <Text style={styles.digitText}>2</Text>
          </Pressable>
          <Pressable
            hitSlop={4}
            style={({ pressed }) => [
              styles.digitBtn,
              pressed && styles.digitBtnPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="3"
            onPress={() => handleKeyPress('3')}
          >
            <Text style={styles.digitText}>3</Text>
          </Pressable>
          <Pressable
            hitSlop={4}
            style={({ pressed }) => [
              styles.funcBtn,
              styles.opBtn,
              pressed && styles.funcBtnPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Add"
            onPress={() => handleKeyPress('+')}
          >
            <Text style={styles.opText}>+</Text>
          </Pressable>
        </View>

        {/* Row 4 */}
        <View style={styles.row}>
          <Pressable
            hitSlop={4}
            style={({ pressed }) => [
              styles.funcBtn,
              styles.clearBtn,
              pressed && styles.funcBtnPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Clear"
            onPress={() => handleKeyPress('C')}
          >
            <Text style={styles.clearText}>C</Text>
          </Pressable>
          <Pressable
            hitSlop={4}
            style={({ pressed }) => [
              styles.digitBtn,
              pressed && styles.digitBtnPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="0"
            onPress={() => handleKeyPress('0')}
          >
            <Text style={styles.digitText}>0</Text>
          </Pressable>
          <Pressable
            hitSlop={4}
            style={({ pressed }) => [
              styles.digitBtn,
              pressed && styles.digitBtnPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={currency === 'IDR' ? '000' : 'Decimal point'}
            onPress={() => handleKeyPress(decimalOrThousandKey)}
          >
            <Text style={styles.digitText}>{decimalOrThousandKey}</Text>
          </Pressable>
          <Pressable
            hitSlop={4}
            style={({ pressed }) => [
              styles.funcBtn,
              styles.equalBtn,
              pressed && styles.funcBtnPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Equals"
            onPress={() => handleKeyPress('=')}
          >
            <Text style={styles.equalText}>=</Text>
          </Pressable>
        </View>
      </View>
      )}
    </View>
  );
});

CalculatorKeypad.displayName = 'CalculatorKeypad';

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 4,
  },
  displayCard: {
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: Palette.hairline,
    marginBottom: 10,
    height: 82,
    justifyContent: 'center',
  },
  displayCardFocused: {
    borderColor: Palette.primary,
    backgroundColor: '#FAF5F2',
  },
  displayMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
  },
  prefixTouch: {
    paddingVertical: 2,
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
    fontSize: 26,
    fontWeight: '700',
    color: Palette.ink,
    letterSpacing: -0.2,
    padding: 0,
    margin: 0,
    fontVariant: ['tabular-nums'],
  },
  liveResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 20,
    marginTop: 2,
  },
  liveResultLabel: {
    ...Typography.caption,
    fontSize: 13,
    color: Palette.muted,
    fontWeight: '600',
  },
  liveResultAmount: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: '700',
    color: Palette.primary,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
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
  presetChipPressed: {
    backgroundColor: '#E4E4E2',
    transform: [{ scale: 0.97 }],
  },
  presetChipText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: Palette.ink,
  },
  doneChip: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  doneChipText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '700',
    color: Palette.white,
  },
  grid: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  digitBtn: {
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
  digitBtnPressed: {
    backgroundColor: '#EBEBE9',
    transform: [{ scale: 0.97 }],
  },
  digitText: {
    ...Typography.body,
    fontSize: 20,
    fontWeight: '600',
    color: Palette.ink,
  },
  funcBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  funcBtnPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.97 }],
  },
  deleteBtn: {
    backgroundColor: Palette.surfaceSoft,
  },
  clearBtn: {
    backgroundColor: Palette.surfaceSoft,
  },
  clearText: {
    ...Typography.body,
    fontSize: 17,
    fontWeight: '700',
    color: Palette.muted,
  },
  opBtn: {
    backgroundColor: '#FBF2EE',
    borderColor: '#F2D7CD',
  },
  opText: {
    ...Typography.body,
    fontSize: 20,
    fontWeight: '700',
    color: Palette.primary,
  },
  equalBtn: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  equalText: {
    ...Typography.body,
    fontSize: 20,
    fontWeight: '700',
    color: Palette.white,
  },
});
