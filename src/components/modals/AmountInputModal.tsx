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
  formatCurrency,
  formatCurrencyInput,
  parsePastedAmountInput,
  extractPastedSubstring,
} from '../../utils/formatters';
import {
  formatExpressionDisplay,
  evaluateMathExpression,
  hasMathOperator,
  normalizeExpressionSpacing,
  formattedToRawCursor,
  rawToFormattedCursor,
  calculateNextExpressionWithCursor,
} from '../../utils/calculator';
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
  const [rawExpr, setRawExpr] = useState<string>('0');
  const [isFocused, setIsFocused] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [selection, setSelection] = useState<{ start: number; end: number }>({
    start: 0,
    end: 0,
  });
  const selectionRef = useRef<{ start: number; end: number }>({
    start: 0,
    end: 0,
  });
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
      let nextRaw = '0';
      if (initialAmount) {
        const parsed = parsePastedAmountInput(initialAmount, currency, maxDigits);
        nextRaw = parsed && parsed !== '0' ? parsed : '0';
      }
      setRawExpr(nextRaw);
      const nextFormatted =
        nextRaw !== '0' ? formatExpressionDisplay(nextRaw, currency) : '';
      const initialPos = nextFormatted.length;
      selectionRef.current = { start: initialPos, end: initialPos };
      setSelection({ start: initialPos, end: initialPos });
      setIsFocused(true);
    }
  });

  const formattedExpr = useMemo(() => {
    return formatExpressionDisplay(rawExpr, currency);
  }, [rawExpr, currency]);

  const displayFormatted = rawExpr === '0' ? '' : formattedExpr;

  const hasOperator = useMemo(() => {
    return hasMathOperator(rawExpr);
  }, [rawExpr]);

  const numericValue = useMemo(() => {
    if (rawExpr === '0') return 0;
    return evaluateMathExpression(rawExpr, currency);
  }, [rawExpr, currency]);

  // Negative totals are never valid; zero is invalid unless the calling flow explicitly allows it
  const zeroBlocked = numericValue < 0 || (!allowZero && numericValue <= 0);

  const getActiveSelection = () => {
    const curLen = displayFormatted.length;
    return {
      start: Math.min(Math.max(0, selectionRef.current.start), curLen),
      end: Math.min(Math.max(0, selectionRef.current.end), curLen),
    };
  };

  const handleSelectionChange = (e: TextInputSelectionChangeEvent) => {
    const sel = e.nativeEvent.selection;
    selectionRef.current = sel;
    setSelection(sel);
  };

  const handleKeyPress = (key: string) => {
    setIsFocused(true);
    const sel = getActiveSelection();

    const rawCursor = formattedToRawCursor(
      formattedExpr,
      rawExpr,
      sel.start,
      currency
    );

    let activeExpr = rawExpr;
    let activeRawCursor = rawCursor;

    if (sel.start !== sel.end) {
      const rawEnd = formattedToRawCursor(
        formattedExpr,
        rawExpr,
        sel.end,
        currency
      );
      const minRaw = Math.min(rawCursor, rawEnd);
      const maxRaw = Math.max(rawCursor, rawEnd);
      activeExpr = normalizeExpressionSpacing(rawExpr.slice(0, minRaw) + rawExpr.slice(maxRaw));
      activeRawCursor = minRaw;
    }

    const { nextExpr, nextRawCursor } = calculateNextExpressionWithCursor(
      activeExpr,
      key,
      currency,
      activeRawCursor,
      maxDigits
    );

    if (nextExpr === rawExpr && nextRawCursor === rawCursor && sel.start === sel.end) {
      return;
    }

    AppHaptics.selection();
    const nextFormatted = nextExpr !== '0' ? formatExpressionDisplay(nextExpr, currency) : '';
    const nextFormattedPos =
      nextExpr === '0'
        ? 0
        : rawToFormattedCursor(
            nextFormatted,
            nextExpr,
            nextRawCursor,
            currency
          );

    setRawExpr(nextExpr);
    selectionRef.current = { start: nextFormattedPos, end: nextFormattedPos };
    setSelection({ start: nextFormattedPos, end: nextFormattedPos });
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
      /^[0-9.+\-×÷*/]$/.test(inserted) &&
      nextText.length === displayFormatted.length + 1
    ) {
      const mappedKey = inserted === '*' ? '×' : inserted === '/' ? '÷' : inserted;
      handleKeyPress(mappedKey);
      return;
    }

    const sourceText = inserted.length > 0 ? inserted : nextText;
    const parsedRaw = parsePastedAmountInput(sourceText, currency, maxDigits);
    if (inserted.length > 0 && !parsedRaw && !/0/.test(sourceText)) {
      return;
    }

    AppHaptics.selection();
    const nextRaw = parsedRaw && parsedRaw !== '0' ? parsedRaw : '0';
    setRawExpr(nextRaw);
    const nextFormatted =
      nextRaw !== '0' ? formatExpressionDisplay(nextRaw, currency) : '';
    const nextPos = nextFormatted.length;
    selectionRef.current = { start: nextPos, end: nextPos };
    setSelection({ start: nextPos, end: nextPos });
    // Blur native TextInput after paste so selection handles/toolbar dismiss cleanly without cursor jump
    inputRef.current?.blur();
    setIsFocused(true);
    runSmoothPasteTransition();
  };

  const handleClear = () => {
    setIsFocused(true);
    AppHaptics.light();
    setRawExpr('0');
    selectionRef.current = { start: 0, end: 0 };
    setSelection({ start: 0, end: 0 });
  };

  const handleQuickAdd = (addVal: number) => {
    setIsFocused(true);
    AppHaptics.selection();
    // Add to the evaluated numeric value so USD cents and active expressions resolve cleanly
    const cap = currency === 'USD' ? Math.pow(10, maxDigits) - 0.01 : Math.pow(10, maxDigits) - 1;
    const baseVal = Math.max(0, numericValue);
    const sum = Math.min(baseVal + addVal, cap);
    const rounded = currency === 'USD' ? Math.round(sum * 100) / 100 : Math.round(sum);
    const nextRaw = rounded > 0 ? String(rounded) : '0';
    const nextFormatted = nextRaw !== '0' ? formatExpressionDisplay(nextRaw, currency) : '';
    setRawExpr(nextRaw);
    const nextPos = nextFormatted.length;
    selectionRef.current = { start: nextPos, end: nextPos };
    setSelection({ start: nextPos, end: nextPos });
  };

  const handlePrefixPress = () => {
    AppHaptics.selection();
    inputRef.current?.focus();
    selectionRef.current = { start: 0, end: 0 };
    setSelection({ start: 0, end: 0 });
  };

  const handleConfirm = async () => {
    if (saving || zeroBlocked) return;
    AppHaptics.light();
    setSaving(true);
    try {
      const finalNumeric = Math.max(0, numericValue);
      const finalFormatted =
        finalNumeric > 0
          ? formatCurrencyInput(String(finalNumeric), currency, maxDigits)
          : '';
      await onConfirm(finalFormatted, finalNumeric);
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

  const inputFontSize =
    displayFormatted.length > 22
      ? 18
      : displayFormatted.length > 15
      ? 22
      : 28;

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
        {/* Interactive Display Card with Native Cursor, Paste & Live Math Preview */}
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
              style={[styles.textInput, { fontSize: inputFontSize }]}
              showSoftInputOnFocus={false}
              contextMenuHidden={false}
              selectTextOnFocus={false}
              value={displayFormatted}
              selection={selection}
              placeholder="0"
              placeholderTextColor={Palette.ink}
              onChangeText={handleChangeText}
              onSelectionChange={handleSelectionChange}
              onFocus={() => {
                setIsFocused(true);
              }}
              cursorColor={Palette.primary}
              selectionColor={Palette.primary + '33'}
              multiline={false}
              autoCorrect={false}
              autoCapitalize="none"
              scrollEnabled={true}
            />
          </Animated.View>

          <View style={styles.displayFooterRow}>
            {hasOperator ? (
              <View style={styles.livePreviewRow}>
                <Text
                  style={[
                    styles.livePreviewText,
                    numericValue < 0 && { color: Palette.error },
                  ]}
                  numberOfLines={1}
                >
                  = {formatCurrency(numericValue, currency)}
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
            ) : (
              <View style={styles.hintFooterInner}>
                <Text style={styles.digitLimitHint}>
                  Max {maxDigits} digits
                </Text>
                {rawExpr !== '0' ? (
                  <TouchableOpacity
                    onPress={handleClear}
                    activeOpacity={0.7}
                    hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
                  >
                    <Text style={styles.clearInlineText}>Clear</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}
          </View>
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

        {/* 4x4 Calculator Keypad Grid (Digits + ÷, ×, −, +) */}
        <View style={styles.keypadGrid}>
          {/* Row 1 */}
          <View style={styles.keypadRow}>
            <Pressable
              style={({ pressed }) => [styles.keypadBtn, pressed && styles.keypadBtnPressed]}
              onPress={() => handleKeyPress('1')}
            >
              <Text style={styles.keypadDigit}>1</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.keypadBtn, pressed && styles.keypadBtnPressed]}
              onPress={() => handleKeyPress('2')}
            >
              <Text style={styles.keypadDigit}>2</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.keypadBtn, pressed && styles.keypadBtnPressed]}
              onPress={() => handleKeyPress('3')}
            >
              <Text style={styles.keypadDigit}>3</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.keypadBtn, styles.opBtn, pressed && styles.opBtnPressed]}
              onPress={() => handleKeyPress('÷')}
              accessibilityRole="button"
              accessibilityLabel="Divide"
            >
              <Text style={styles.opText}>÷</Text>
            </Pressable>
          </View>

          {/* Row 2 */}
          <View style={styles.keypadRow}>
            <Pressable
              style={({ pressed }) => [styles.keypadBtn, pressed && styles.keypadBtnPressed]}
              onPress={() => handleKeyPress('4')}
            >
              <Text style={styles.keypadDigit}>4</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.keypadBtn, pressed && styles.keypadBtnPressed]}
              onPress={() => handleKeyPress('5')}
            >
              <Text style={styles.keypadDigit}>5</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.keypadBtn, pressed && styles.keypadBtnPressed]}
              onPress={() => handleKeyPress('6')}
            >
              <Text style={styles.keypadDigit}>6</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.keypadBtn, styles.opBtn, pressed && styles.opBtnPressed]}
              onPress={() => handleKeyPress('×')}
              accessibilityRole="button"
              accessibilityLabel="Multiply"
            >
              <Text style={styles.opText}>×</Text>
            </Pressable>
          </View>

          {/* Row 3 */}
          <View style={styles.keypadRow}>
            <Pressable
              style={({ pressed }) => [styles.keypadBtn, pressed && styles.keypadBtnPressed]}
              onPress={() => handleKeyPress('7')}
            >
              <Text style={styles.keypadDigit}>7</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.keypadBtn, pressed && styles.keypadBtnPressed]}
              onPress={() => handleKeyPress('8')}
            >
              <Text style={styles.keypadDigit}>8</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.keypadBtn, pressed && styles.keypadBtnPressed]}
              onPress={() => handleKeyPress('9')}
            >
              <Text style={styles.keypadDigit}>9</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.keypadBtn, styles.opBtn, pressed && styles.opBtnPressed]}
              onPress={() => handleKeyPress('-')}
              accessibilityRole="button"
              accessibilityLabel="Subtract"
            >
              <Text style={styles.opText}>−</Text>
            </Pressable>
          </View>

          {/* Row 4 */}
          <View style={styles.keypadRow}>
            {currency === 'IDR' ? (
              <Pressable
                style={({ pressed }) => [styles.keypadBtn, pressed && styles.keypadBtnPressed]}
                onPress={() => handleKeyPress('000')}
              >
                <Text style={styles.keypadThousand}>000</Text>
              </Pressable>
            ) : (
              <Pressable
                style={({ pressed }) => [styles.keypadBtn, pressed && styles.keypadBtnPressed]}
                onPress={() => handleKeyPress('.')}
              >
                <Text style={styles.keypadDigit}>.</Text>
              </Pressable>
            )}
            <Pressable
              style={({ pressed }) => [styles.keypadBtn, pressed && styles.keypadBtnPressed]}
              onPress={() => handleKeyPress('0')}
            >
              <Text style={styles.keypadDigit}>0</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.keypadBtn, styles.deleteBtn, pressed && styles.keypadBtnPressed]}
              onPress={() => handleKeyPress('⌫')}
              onLongPress={handleClear}
              accessibilityRole="button"
              accessibilityLabel="Delete, long press to clear"
            >
              <Delete size={21} color={Palette.ink} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.keypadBtn, styles.opBtn, pressed && styles.opBtnPressed]}
              onPress={() => handleKeyPress('+')}
              accessibilityRole="button"
              accessibilityLabel="Add"
            >
              <Text style={styles.opText}>+</Text>
            </Pressable>
          </View>

          {/* Row 5: Clear (C) & Equals (=) */}
          <View style={styles.keypadRow}>
            <Pressable
              style={({ pressed }) => [styles.keypadBtn, styles.clearBtn, pressed && styles.keypadBtnPressed]}
              onPress={handleClear}
              accessibilityRole="button"
              accessibilityLabel="Clear amount"
            >
              <Text style={styles.clearBtnText}>C</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.keypadBtn,
                styles.equalBtn,
                hasOperator && styles.equalBtnActive,
                pressed && styles.equalBtnPressed,
              ]}
              onPress={() => handleKeyPress('=')}
              accessibilityRole="button"
              accessibilityLabel="Calculate result"
            >
              <Text style={[styles.equalBtnText, hasOperator && styles.equalBtnTextActive]}>=</Text>
            </Pressable>
          </View>
        </View>

        {/* Dedicated fixed-height zero guard slot so keypad and button never shift */}
        <View style={styles.zeroHintSlot}>
          {numericValue < 0 ? (
            <Text style={styles.zeroHint}>Total amount cannot be negative.</Text>
          ) : zeroBlocked ? (
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
  displayFooterRow: {
    height: 24,
    justifyContent: 'center',
    marginTop: 4,
  },
  hintFooterInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  digitLimitHint: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
  },
  clearInlineText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: Palette.primary,
  },
  livePreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  livePreviewText: {
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
    gap: 7,
    marginBottom: 6,
  },
  keypadRow: {
    flexDirection: 'row',
    gap: 8,
  },
  keypadBtn: {
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
  keypadBtnPressed: {
    backgroundColor: '#EBEBE9',
    transform: [{ scale: 0.97 }],
  },
  deleteBtn: {
    backgroundColor: Palette.surfaceSoft,
  },
  clearBtn: {
    backgroundColor: Palette.surfaceSoft,
  },
  clearBtnText: {
    ...Typography.body,
    fontSize: 18,
    fontWeight: '700',
    color: Palette.muted,
  },
  opBtn: {
    backgroundColor: '#FBF2EE',
    borderColor: '#F2D7CD',
  },
  opBtnPressed: {
    backgroundColor: '#F4DFD6',
    transform: [{ scale: 0.97 }],
  },
  opText: {
    ...Typography.body,
    fontSize: 22,
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
  equalBtnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.97 }],
  },
  equalBtnText: {
    ...Typography.body,
    fontSize: 24,
    fontWeight: '700',
    color: Palette.primary,
  },
  equalBtnTextActive: {
    color: Palette.white,
  },
  keypadDigit: {
    ...Typography.body,
    fontSize: 22,
    fontWeight: '600',
    color: Palette.ink,
  },
  keypadThousand: {
    ...Typography.body,
    fontSize: 17,
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
