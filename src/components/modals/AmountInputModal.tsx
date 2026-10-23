import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Delete, Check } from 'lucide-react-native';
import { Palette, Typography } from '../../theme/tokens';
import { CurrencyType } from '../../types';
import { AppHaptics } from '../../utils/haptics';
import { formatCurrencyInput, parseAmount } from '../../utils/formatters';
import { ModalHeader } from '../ModalHeader';
import { BottomSheetModal } from '../BottomSheetModal';

export interface AmountInputModalProps {
  visible: boolean;
  title?: string;
  subtitle?: string;
  initialAmount?: string;
  currency: CurrencyType;
  maxDigits?: number; // Default 9 digits
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

  useEffect(() => {
    if (visible) {
      const clean = (initialAmount || '').replace(/\D/g, '').slice(0, maxDigits);
      setRawDigits(clean === '0' ? '' : clean);
    }
  }, [visible, initialAmount, maxDigits]);

  const displayFormatted = useMemo(() => {
    if (!rawDigits || rawDigits === '0') return '0';
    return formatCurrencyInput(rawDigits, currency, maxDigits);
  }, [rawDigits, currency, maxDigits]);

  const numericValue = useMemo(() => {
    return parseAmount(displayFormatted, currency);
  }, [displayFormatted, currency]);

  const handleDigitPress = (d: string) => {
    if (rawDigits.length >= maxDigits) {
      // Reached hard digit cap: silent block, no re-render, no blinking
      return;
    }
    AppHaptics.selection();
    if (rawDigits === '' || rawDigits === '0') {
      if (d === '0') return;
      setRawDigits(d);
    } else {
      setRawDigits((prev) => (prev + d).slice(0, maxDigits));
    }
  };

  const handleThousandPress = () => {
    if (!rawDigits || rawDigits === '0') return;
    if (rawDigits.length >= maxDigits) return;
    AppHaptics.selection();
    const allowed = Math.min(3, maxDigits - rawDigits.length);
    if (allowed > 0) {
      setRawDigits((prev) => prev + '0'.repeat(allowed));
    }
  };

  const handleDelete = () => {
    AppHaptics.light();
    setRawDigits((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    AppHaptics.light();
    setRawDigits('');
  };

  const handleQuickAdd = (addVal: number) => {
    AppHaptics.selection();
    const current = parseInt(rawDigits || '0', 10);
    const sum = Math.min(current + addVal, Math.pow(10, maxDigits) - 1);
    setRawDigits(sum > 0 ? String(sum) : '');
  };

  const handleConfirm = () => {
    AppHaptics.light();
    onConfirm(displayFormatted === '0' ? '' : displayFormatted, numericValue);
    onClose();
  };

  // Quick preset chips
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
            {/* Display Box */}
            <View style={styles.displayCard}>
              <View style={styles.displayRow}>
                <Text style={styles.currencyPrefix}>
                  {currency === 'IDR' ? 'Rp' : '$'}
                </Text>
                <Text style={styles.displayAmount} numberOfLines={1} adjustsFontSizeToFit>
                  {displayFormatted}
                </Text>
              </View>
              <Text style={styles.digitLimitHint}>
                Max {maxDigits} digits (up to {currency === 'IDR' ? 'Rp 999.999.999' : '$999,999,999'})
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
                <Pressable
                  style={({ pressed }) => [styles.keypadBtn, styles.funcKeyBtn, pressed && styles.keypadBtnPressed]}
                  onPress={handleClear}
                >
                  <Text style={styles.funcKeyText}>C</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.keypadBtn, pressed && styles.keypadBtnPressed]}
                  onPress={() => handleDigitPress('0')}
                >
                  <Text style={styles.keypadDigit}>0</Text>
                </Pressable>
                {currency === 'IDR' ? (
                  <Pressable
                    style={({ pressed }) => [styles.keypadBtn, pressed && styles.keypadBtnPressed]}
                    onPress={handleThousandPress}
                  >
                    <Text style={styles.keypadDigit}>000</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={({ pressed }) => [styles.keypadBtn, pressed && styles.keypadBtnPressed]}
                    onPress={() => handleDigitPress('00')}
                  >
                    <Text style={styles.keypadDigit}>00</Text>
                  </Pressable>
                )}
                <Pressable
                  style={({ pressed }) => [styles.keypadBtn, styles.funcKeyBtn, pressed && styles.keypadBtnPressed]}
                  onPress={handleDelete}
                >
                  <Delete size={20} color={Palette.muted} />
                </Pressable>
              </View>
            </View>

            {/* Confirm Action Button */}
            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={handleConfirm}
              activeOpacity={0.85}
            >
              <Check size={18} color={Palette.white} style={{ marginRight: 8 }} />
              <Text style={styles.confirmBtnText}>Confirm Amount</Text>
            </TouchableOpacity>
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
  sheetContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  displayCard: {
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Palette.hairline,
    marginBottom: 12,
  },
  displayRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  currencyPrefix: {
    ...Typography.body,
    fontSize: 20,
    fontWeight: '700',
    color: Palette.muted,
  },
  displayAmount: {
    ...Typography.display,
    flex: 1,
    fontSize: 28,
    fontWeight: '700',
    color: Palette.ink,
    letterSpacing: -0.5,
  },
  digitLimitHint: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
    marginTop: 4,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
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
    height: 48,
    backgroundColor: Palette.white,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  keypadBtnPressed: {
    backgroundColor: '#EBEBE9',
    transform: [{ scale: 0.97 }],
  },
  keypadDigit: {
    ...Typography.body,
    fontSize: 19,
    fontWeight: '600',
    color: Palette.ink,
  },
  funcKeyBtn: {
    backgroundColor: Palette.surfaceSoft,
  },
  funcKeyText: {
    ...Typography.body,
    fontSize: 16,
    fontWeight: '700',
    color: Palette.muted,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.primary,
    borderRadius: 14,
    paddingVertical: 14,
  },
  confirmBtnText: {
    ...Typography.body,
    fontSize: 15,
    fontWeight: '700',
    color: Palette.white,
  },
});
