import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { Check, Trash2 } from 'lucide-react-native';
import { Palette, Typography } from '../../theme/tokens';
import { CurrencyType } from '../../types';
import { formatCurrency, formatMonthYear, formatCurrencyInput } from '../../utils/formatters';
import { AppHaptics } from '../../utils/haptics';
import { useLastDefined } from '../../hooks/useLastDefined';
import { ModalHeader } from '../ModalHeader';
import { KeyboardSafeContainer } from '../KeyboardSafeContainer';
import { BottomSheetModal } from '../BottomSheetModal';
import { AmountInputModal } from './AmountInputModal';
import { CustomAlertModal, AlertButton, AlertType } from '../CustomAlertModal';

interface SetBudgetModalProps {
  visible: boolean;
  activeCurrency: CurrencyType;
  selectedMonth: string;
  currentBudget: number;
  amount: string;
  onChangeAmount: (text: string) => void;
  onSave: () => void | Promise<void>;
  onRemove: () => void | Promise<void>;
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
  const [amountModalVisible, setAmountModalVisible] = useState(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [removing, setRemoving] = useState<boolean>(false);
  const effectiveBudget =
    useLastDefined(!saving && !removing && visible ? currentBudget : null) ?? currentBudget;

  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message?: string;
    buttons?: AlertButton[];
    type?: AlertType;
  }>({
    visible: false,
    title: '',
  });

  // The confirm handler runs before the alert closes; a newer alert must survive it.
  const alertSeq = useRef<number>(0);
  const renderedSeq = alertSeq.current;

  const showAlert = (
    title: string,
    message?: string,
    buttons?: AlertButton[],
    type: AlertType = 'info'
  ) => {
    alertSeq.current += 1;
    setAlertConfig({
      visible: true,
      title,
      message,
      buttons: buttons || [{ text: 'OK', style: 'default' }],
      type,
    });
  };

  const hideAlert = () => {
    if (alertSeq.current !== renderedSeq) return;
    setAlertConfig((prev) => ({ ...prev, visible: false }));
  };

  const monthLabel = selectedMonth === 'all' ? 'All Months' : formatMonthYear(selectedMonth);
  const periodLabel = `Limit for ${monthLabel} · ${activeCurrency}`;

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

  const submit = async () => {
    if (saving) return;
    AppHaptics.heavy();
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  };

  const runRemove = async () => {
    if (removing) return;
    setRemoving(true);
    try {
      await onRemove();
    } finally {
      setRemoving(false);
    }
  };

  // Removing the limit is destructive for the month, so it asks first.
  const requestRemove = () => {
    if (removing) return;
    AppHaptics.light();
    Keyboard.dismiss();
    showAlert(
      'Remove Budget Limit',
      "Remove this month's budget limit?",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: runRemove,
        },
      ],
      'confirm'
    );
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      height="84%"
      maxHeight="90%"
    >
      <ModalHeader
        title="Monthly Expense Budget"
        subtitle={periodLabel}
        onClose={onClose}
      />

          <KeyboardSafeContainer>
            {/* Current Active Budget Display */}
            {effectiveBudget > 0 && (
              <View style={styles.activeBudgetBadge}>
                <Text style={styles.activeBudgetLabel}>Current Limit:</Text>
                <Text style={styles.activeBudgetValue}>
                  {formatCurrency(effectiveBudget, activeCurrency)}
                </Text>
              </View>
            )}

            {/* Input Label */}
            <Text style={styles.inputLabel}>
              Enter Budget Limit <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TouchableOpacity
              style={styles.inputContainer}
              onPress={() => {
                AppHaptics.light();
                Keyboard.dismiss();
                setAmountModalVisible(true);
              }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Budget limit, ${amount || '0'} ${activeCurrency}`}
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
                  accessibilityRole="button"
                  accessibilityLabel={`Set budget ${p.label}`}
                >
                  <Text style={styles.presetChipText}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Action Buttons */}
            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                onPress={submit}
                disabled={saving}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Save budget"
              >
                {saving ? (
                  <>
                    <ActivityIndicator size="small" color={Palette.white} style={{ marginRight: 8 }} />
                    <Text style={styles.saveBtnText}>Saving...</Text>
                  </>
                ) : (
                  <>
                    <Check size={18} color={Palette.white} style={{ marginRight: 8 }} />
                    <Text style={styles.saveBtnText}>Save Budget</Text>
                  </>
                )}
              </TouchableOpacity>

              {effectiveBudget > 0 && (
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={requestRemove}
                  disabled={removing}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Remove budget limit"
                >
                  {removing ? (
                    <ActivityIndicator size="small" color={Palette.error} />
                  ) : (
                    <>
                      <Trash2 size={16} color={Palette.error} style={{ marginRight: 6 }} />
                      <Text style={styles.removeBtnText}>Remove Budget Limit</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </KeyboardSafeContainer>

      <AmountInputModal
        visible={amountModalVisible}
        title="Set Budget Limit"
        subtitle={periodLabel}
        initialAmount={amount}
        currency={activeCurrency}
        allowZero
        onConfirm={(formatted, numericVal) => {
          setAmountModalVisible(false);
          // A zero amount is an explicit "remove the limit" action.
          if (numericVal <= 0) {
            if (currentBudget > 0) {
              requestRemove();
            } else {
              onChangeAmount('0');
            }
            return;
          }
          onChangeAmount(formatted);
        }}
        onClose={() => setAmountModalVisible(false)}
      />

      <CustomAlertModal
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        type={alertConfig.type}
        onClose={hideAlert}
      />
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
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
  requiredStar: {
    color: Palette.primary,
    fontWeight: '700',
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
