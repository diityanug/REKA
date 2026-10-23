import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Target, Check, Trash2 } from 'lucide-react-native';
import { Palette, Typography } from '../../theme/tokens';
import { CurrencyType } from '../../types';
import { formatCurrency, formatMonthYear, formatCurrencyInput } from '../../utils/formatters';
import { AppHaptics } from '../../utils/haptics';
import { ModalHeader } from '../ModalHeader';
import { KeyboardSafeContainer } from '../KeyboardSafeContainer';
import { BottomSheetModal } from '../BottomSheetModal';
import { AmountInputModal } from './AmountInputModal';

interface SetBudgetModalProps {
  visible: boolean;
  activeCurrency: CurrencyType;
  selectedMonth: string;
  currentBudget: number;
  amount: string;
  onChangeAmount: (text: string) => void;
  onSave: () => void;
  onRemove: () => void;
  onClose: () => void;
}

export const SetBudgetModal: React.FC<SetBudgetModalProps> = ({
  visible,
  activeCurrency,
  selectedMonth,
  currentBudget,
  amount,
  onChangeAmount,
  onSave,
  onRemove,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const [amountModalVisible, setAmountModalVisible] = useState(false);

  const periodLabel =
    selectedMonth === 'all'
      ? 'Default Monthly'
      : formatMonthYear(selectedMonth);

  const presets =
    activeCurrency === 'IDR'
      ? [
          { label: '2M', val: formatCurrencyInput('2000000', 'IDR') },
          { label: '5M', val: formatCurrencyInput('5000000', 'IDR') },
          { label: '10M', val: formatCurrencyInput('10000000', 'IDR') },
          { label: '15M', val: formatCurrencyInput('15000000', 'IDR') },
        ]
      : [
          { label: '$500', val: formatCurrencyInput('500', 'USD') },
          { label: '$1,000', val: formatCurrencyInput('1000', 'USD') },
          { label: '$2,500', val: formatCurrencyInput('2500', 'USD') },
          { label: '$5,000', val: formatCurrencyInput('5000', 'USD') },
        ];

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      height="84%"
      maxHeight="90%"
    >
      <ModalHeader
        title="Monthly Expense Budget"
        subtitle={`${periodLabel} Limit (${activeCurrency})`}
        onClose={onClose}
      />

          <KeyboardSafeContainer>
            {/* Current Active Budget Display */}
            {currentBudget > 0 && (
              <View style={styles.activeBudgetBadge}>
                <Text style={styles.activeBudgetLabel}>Current Limit:</Text>
                <Text style={styles.activeBudgetValue}>
                  {formatCurrency(currentBudget, activeCurrency)}
                </Text>
              </View>
            )}

            {/* Input Label */}
            <Text style={styles.inputLabel}>Enter Budget Limit</Text>
            <TouchableOpacity
              style={styles.inputContainer}
              onPress={() => {
                AppHaptics.light();
                Keyboard.dismiss();
                setAmountModalVisible(true);
              }}
              activeOpacity={0.8}
            >
              <View style={styles.currencyPrefixBadge}>
                <Text style={styles.currencyPrefixText}>
                  {activeCurrency === 'IDR' ? 'Rp' : '$'}
                </Text>
              </View>
              <Text
                style={[
                  styles.amountDisplayText,
                  !amount && styles.amountPlaceholderText,
                ]}
                numberOfLines={1}
              >
                {amount || '0'}
              </Text>
            </TouchableOpacity>

            {/* Quick Suggestion Chips */}
            <View style={styles.presetRow}>
              {presets.map((p) => (
                <TouchableOpacity
                  key={p.val}
                  style={styles.presetChip}
                  onPress={() => {
                    AppHaptics.selection();
                    onChangeAmount(p.val);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.presetChipText}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Action Buttons */}
            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={() => {
                  AppHaptics.heavy();
                  onSave();
                }}
                activeOpacity={0.85}
              >
                <Check size={18} color={Palette.white} style={{ marginRight: 8 }} />
                <Text style={styles.saveBtnText}>Save Budget</Text>
              </TouchableOpacity>

              {currentBudget > 0 && (
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => {
                    AppHaptics.light();
                    onRemove();
                  }}
                  activeOpacity={0.8}
                >
                  <Trash2 size={16} color={Palette.error} style={{ marginRight: 6 }} />
                  <Text style={styles.removeBtnText}>Remove Budget Limit</Text>
                </TouchableOpacity>
              )}
            </View>
          </KeyboardSafeContainer>

      <AmountInputModal
        visible={amountModalVisible}
        title="Set Budget Limit"
        subtitle={`${periodLabel} Limit (${activeCurrency})`}
        initialAmount={amount}
        currency={activeCurrency}
        onConfirm={(formatted) => onChangeAmount(formatted)}
        onClose={() => setAmountModalVisible(false)}
      />
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Palette.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '84%',
    maxHeight: '90%',
    overflow: 'hidden',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  infoIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FDF0ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoTextWrap: {
    flex: 1,
  },
  infoTitle: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '700',
    color: Palette.ink,
    marginBottom: 2,
  },
  infoDesc: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
    lineHeight: 16,
  },
  activeBudgetBadge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  activeBudgetLabel: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: '#0369A1',
  },
  activeBudgetValue: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '700',
    color: '#0284C7',
  },
  inputLabel: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: Palette.muted,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Palette.hairline,
    marginBottom: 12,
    overflow: 'hidden',
  },
  currencyPrefixBadge: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#EBE5DF',
    borderRightWidth: 1,
    borderRightColor: Palette.hairline,
  },
  currencyPrefixText: {
    ...Typography.body,
    fontSize: 15,
    fontWeight: '700',
    color: Palette.ink,
  },
  textInput: {
    flex: 1,
    ...Typography.heading,
    fontSize: 18,
    fontWeight: '700',
    color: Palette.ink,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  amountDisplayText: {
    flex: 1,
    ...Typography.heading,
    fontSize: 18,
    fontWeight: '700',
    color: Palette.ink,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  amountPlaceholderText: {
    color: Palette.muted,
    fontWeight: '400',
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  presetChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  presetChipText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: Palette.ink,
  },
  actionsContainer: {
    marginTop: 8,
    marginBottom: 20,
    gap: 10,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.primary,
    borderRadius: 14,
    paddingVertical: 14,
  },
  saveBtnText: {
    ...Typography.body,
    fontSize: 15,
    fontWeight: '700',
    color: Palette.white,
  },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FDF2F2',
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#FCD8D8',
  },
  removeBtnText: {
    ...Typography.caption,
    fontSize: 13,
    fontWeight: '600',
    color: Palette.error,
  },
});
