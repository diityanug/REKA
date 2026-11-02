import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  Animated,
  Easing,
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
import {
  formatCurrency,
  parsePastedAmountInput,
  extractPastedSubstring,
} from '../utils/formatters';
import {
  formatExpressionDisplay,
  evaluateMathExpression,
  hasMathOperator,
  normalizeExpressionSpacing,
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

  const hasOperator = hasMathOperator(currentExpr);
  const liveEvaluated = evaluateMathExpression(currentExpr, currency);
  const presets = getQuickPresets(currency);

  const formattedExpr = useMemo(() => {
    return formatExpressionDisplay(currentExpr, currency);
  }, [currentExpr, currency]);

  const inputDisplayValue = currentExpr === '0' ? '' : formattedExpr;

  const inputRef = useRef<React.ElementRef<typeof TextInput>>(null);
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const selectionRef = useRef<{ start: number; end: number }>({
    start: inputDisplayValue.length,
    end: inputDisplayValue.length,
  });
  const isTextInputFocusedRef = useRef<boolean>(false);
  const pressStartTimeRef = useRef<number>(0);
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

  const isCardHighlighted = showKeypad !== undefined ? showKeypad : isFocused;

  const isKeypadActionRef = useRef<boolean>(false);

  // Synchronize cursor position: when value or currency changes externally, ensure cursor starts at the very end
  useEffect(() => {
    if (!isKeypadActionRef.current) {
      const formatted = currentExpr === '0' ? '' : formatExpressionDisplay(currentExpr, currency);
      selectionRef.current = { start: formatted.length, end: formatted.length };
    }
    isKeypadActionRef.current = false;
  }, [value, currency, currentExpr]);

  const handleSelectionChange = (e: TextInputSelectionChangeEvent) => {
    selectionRef.current = e.nativeEvent.selection;
  };

  const handleKeyPress = useCallback((key: string) => {
    isKeypadActionRef.current = true;
    setIsFocused(true);

    const sel = isTextInputFocusedRef.current
      ? {
          start: Math.min(selectionRef.current.start, formattedExpr.length),
          end: Math.min(selectionRef.current.end, formattedExpr.length),
        }
      : { start: formattedExpr.length, end: formattedExpr.length };

    const rawCursor = formattedToRawCursor(
      formattedExpr,
      currentExpr,
      sel.start,
      currency
    );

    // If user highlighted a range of text, delete that range first
    let activeExpr = currentExpr;
    let activeRawCursor = rawCursor;

    if (sel.start !== sel.end) {
      const rawEnd = formattedToRawCursor(
        formattedExpr,
        currentExpr,
        sel.end,
        currency
      );
      const minRaw = Math.min(rawCursor, rawEnd);
      const maxRaw = Math.max(rawCursor, rawEnd);
      activeExpr = normalizeExpressionSpacing(currentExpr.slice(0, minRaw) + currentExpr.slice(maxRaw));
      activeRawCursor = minRaw;
    }

    const { nextExpr, nextRawCursor } = calculateNextExpressionWithCursor(
      activeExpr,
      key,
      currency,
      activeRawCursor
    );

    if (nextExpr === currentExpr && nextRawCursor === rawCursor && sel.start === sel.end) {
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
    selectionRef.current = { start: nextFormattedPos, end: nextFormattedPos };
    isTextInputFocusedRef.current = false;
  }, [currentExpr, formattedExpr, currency, onChangeValue]);

  const handleQuickAdd = useCallback((amount: number) => {
    isKeypadActionRef.current = true;
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
    selectionRef.current = { start: nextFormatted.length, end: nextFormatted.length };
    isTextInputFocusedRef.current = false;
  }, [currentExpr, currency, onChangeValue]);

  const handlePrefixPress = useCallback(() => {
    isKeypadActionRef.current = true;
    AppHaptics.selection();
    selectionRef.current = { start: 0, end: 0 };
    onPressDisplay?.();
  }, [onPressDisplay]);

  const handleChangeText = useCallback(
    (nextText: string) => {
      if (nextText === inputDisplayValue) return;

      const inserted = extractPastedSubstring(
        inputDisplayValue,
        nextText,
        selectionRef.current
      );

      if (
        inserted.length === 1 &&
        /^[0-9.+\-×÷*/]$/.test(inserted) &&
        nextText.length === inputDisplayValue.length + 1
      ) {
        const mappedKey = inserted === '*' ? '×' : inserted === '/' ? '÷' : inserted;
        handleKeyPress(mappedKey);
        return;
      }

      const sourceText = inserted.length > 0 ? inserted : nextText;
      const maxDigits = currency === 'IDR' ? 13 : 9;
      const parsedRaw = parsePastedAmountInput(sourceText, currency, maxDigits);
      if (inserted.length > 0 && !parsedRaw && !/0/.test(sourceText)) {
        return;
      }

      isKeypadActionRef.current = true;
      AppHaptics.selection();
      const nextExpr = parsedRaw || '0';
      const nextFormatted = nextExpr === '0' ? '' : formatExpressionDisplay(nextExpr, currency);
      onChangeValue(nextExpr === '0' ? '' : nextExpr);
      selectionRef.current = { start: nextFormatted.length, end: nextFormatted.length };
      isTextInputFocusedRef.current = false;
      inputRef.current?.blur();
      runSmoothPasteTransition();
    },
    [inputDisplayValue, currency, handleKeyPress, onChangeValue, runSmoothPasteTransition]
  );

  const decimalOrThousandKey = currency === 'IDR' ? '000' : '.';
  const inputFontSize =
    inputDisplayValue.length > 22
      ? 17
      : inputDisplayValue.length > 15
      ? 21
      : 26;

  return (
    <View style={styles.container}>
      {/* Interactive Display Card with Native Cursor & Fixed Height Layout */}
      {showDisplay ? (
        <View
          style={[
            styles.displayCard,
            isCardHighlighted && styles.displayCardFocused,
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

            {/* Native TextInput with suppressed system soft keyboard & Paste support */}
            <TextInput
              ref={inputRef}
              style={[styles.textInput, { fontSize: inputFontSize }]}
              showSoftInputOnFocus={false}
              contextMenuHidden={false}
              selectTextOnFocus={true}
              value={inputDisplayValue}
              placeholder="0"
              placeholderTextColor={Palette.ink}
              onChangeText={handleChangeText}
              onSelectionChange={handleSelectionChange}
              onPressIn={() => {
                pressStartTimeRef.current = Date.now();
              }}
              onPressOut={() => {
                // Only open keypad on a short tap (< 260ms), never during a long-press for Paste
                if (Date.now() - pressStartTimeRef.current < 260) {
                  if (Keyboard.isVisible && Keyboard.isVisible()) {
                    Keyboard.dismiss();
                  }
                  onPressDisplay?.();
                }
              }}
              onFocus={() => {
                isTextInputFocusedRef.current = true;
                setIsFocused(true);
              }}
              onBlur={() => {
                isTextInputFocusedRef.current = false;
                setIsFocused(false);
              }}
              cursorColor={Palette.primary}
              selectionColor={Palette.primary + '33'}
              multiline={false}
              autoCorrect={false}
              autoCapitalize="none"
              scrollEnabled={true}
            />
          </Animated.View>

          {/* Reserved Fixed Result / Action Slot: Stays in layout permanently to prevent height jump */}
          <View style={styles.liveResultRow}>
            {hasOperator ? (
              <View style={styles.liveResultInner}>
                <Text
                  style={[
                    styles.liveResultAmount,
                    liveEvaluated < 0 && { color: Palette.error },
                  ]}
                  numberOfLines={1}
                >
                  = {formatCurrency(liveEvaluated, currency)}
                </Text>
                <TouchableOpacity
                  style={styles.evalInlineBtn}
                  onPress={() => handleKeyPress('=')}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel="Calculate result"
                >
                  <Text style={styles.evalInlineBtnText}>=</Text>
                </TouchableOpacity>
              </View>
            ) : currentExpr !== '0' ? (
              <View style={styles.liveResultInner}>
                <View />
                <TouchableOpacity
                  onPress={() => handleKeyPress('C')}
                  activeOpacity={0.7}
                  hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
                >
                  <Text style={styles.clearInlineText}>Clear</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </View>
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

      {/* 4x4 Calculator Keypad Grid (Digits + ÷, ×, −, +) */}
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
            accessibilityLabel="Divide"
            onPress={() => handleKeyPress('÷')}
          >
            <Text style={styles.opText}>÷</Text>
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
            accessibilityLabel="Multiply"
            onPress={() => handleKeyPress('×')}
          >
            <Text style={styles.opText}>×</Text>
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

        {/* Row 4 */}
        <View style={styles.row}>
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
              styles.funcBtn,
              styles.deleteBtn,
              pressed && styles.funcBtnPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Delete, long press to clear"
            onPress={() => handleKeyPress('⌫')}
            onLongPress={() => handleKeyPress('C')}
          >
            <Delete size={20} color={Palette.ink} />
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

        {/* Row 5: Clear (C) & Equals (=) */}
        <View style={styles.row}>
          <Pressable
            hitSlop={4}
            style={({ pressed }) => [
              styles.funcBtn,
              styles.clearBtn,
              pressed && styles.funcBtnPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Clear amount"
            onPress={() => handleKeyPress('C')}
          >
            <Text style={styles.clearText}>C</Text>
          </Pressable>
          <Pressable
            hitSlop={4}
            style={({ pressed }) => [
              styles.funcBtn,
              styles.equalBtn,
              hasOperator && styles.equalBtnActive,
              pressed && styles.funcBtnPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Calculate result"
            onPress={() => handleKeyPress('=')}
          >
            <Text style={[styles.equalText, hasOperator && styles.equalTextActive]}>=</Text>
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
    height: 24,
    justifyContent: 'center',
    marginTop: 2,
  },
  liveResultInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  liveResultAmount: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: '700',
    color: Palette.primary,
    flex: 1,
    marginRight: 8,
  },
  evalInlineBtn: {
    backgroundColor: Palette.primary,
    paddingHorizontal: 12,
    paddingVertical: 2,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  evalInlineBtnText: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: '700',
    color: Palette.white,
  },
  clearInlineText: {
    ...Typography.caption,
    fontSize: 11,
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
    gap: 7,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  digitBtn: {
    flex: 1,
    height: 46,
    backgroundColor: Palette.white,
    borderRadius: 13,
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
    height: 46,
    borderRadius: 13,
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
    backgroundColor: '#F6E5DD',
    borderColor: '#E8C5B6',
  },
  equalBtnActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  equalText: {
    ...Typography.body,
    fontSize: 22,
    fontWeight: '700',
    color: Palette.primary,
  },
  equalTextActive: {
    color: Palette.white,
  },
});
