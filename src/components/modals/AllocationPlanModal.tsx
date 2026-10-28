import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, Trash2, Check, Layers, Edit3 } from 'lucide-react-native';
import { Palette, Typography } from '../../theme/tokens';
import { useSyncOnChange } from '../../hooks/useSyncOnChange';
import { CurrencyType, AllocationPlan, AllocationItem } from '../../types';
import { formatCurrency, parseAmount, formatCurrencyInput } from '../../utils/formatters';
import { AppHaptics } from '../../utils/haptics';
import { ModalHeader } from '../ModalHeader';
import { KeyboardSafeContainer } from '../KeyboardSafeContainer';
import { AmountInputModal } from './AmountInputModal';
import { BottomSheetModal } from '../BottomSheetModal';
import { CustomAlertModal, AlertButton, AlertType } from '../CustomAlertModal';

interface AllocationPlanModalProps {
  visible: boolean;
  activeCurrency: CurrencyType;
  plan: AllocationPlan | null;
  onSave: (plan: AllocationPlan) => void;
  onDelete?: (planId: string) => void;
  onClose: () => void;
}

interface DraftRow {
  id: string;
  label: string;
  amountStr: string;
}

export const AllocationPlanModal: React.FC<AllocationPlanModalProps> = ({
  visible,
  activeCurrency,
  plan,
  onSave,
  onDelete,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState<string>('');
  const [rows, setRows] = useState<DraftRow[]>([
    { id: '1', label: '', amountStr: '' },
  ]);
  const [activeAmountRowId, setActiveAmountRowId] = useState<string | null>(null);
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

  const showAlert = (
    title: string,
    message?: string,
    buttons?: AlertButton[],
    type: AlertType = 'info'
  ) => {
    setAlertConfig({
      visible: true,
      title,
      message,
      buttons,
      type,
    });
  };

  const hideAlert = () => {
    setAlertConfig((prev) => ({ ...prev, visible: false }));
  };

  const activeRow = useMemo(() => {
    return rows.find((r) => r.id === activeAmountRowId) || null;
  }, [rows, activeAmountRowId]);

  useSyncOnChange([visible, plan, activeCurrency], () => {
    if (visible) {
      if (plan) {
        setTitle(plan.title);
        if (plan.items && plan.items.length > 0) {
          setRows(
            plan.items.map((it) => ({
              id: it.id,
              label: it.label,
              amountStr: it.amount > 0 ? formatCurrencyInput(String(it.amount), activeCurrency, 9) : '',
            }))
          );
        } else {
          setRows([{ id: '1', label: '', amountStr: '' }]);
        }
      } else {
        setTitle('');
        setRows([
          { id: '1', label: '', amountStr: '' },
          { id: '2', label: '', amountStr: '' },
        ]);
      }
    }
  });

  const handleAddRow = () => {
    AppHaptics.selection();
    setRows((prev) => [
      ...prev,
      { id: Date.now().toString() + Math.random().toString(36).slice(2, 6), label: '', amountStr: '' },
    ]);
  };

  const handleRemoveRow = (id: string) => {
    AppHaptics.light();
    setRows((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((r) => r.id !== id);
    });
  };

  const handleUpdateRowLabel = (id: string, text: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, label: text } : r))
    );
  };

  const handleUpdateRowAmount = (id: string, text: string) => {
    // Specifically for Allocation Plans: strictly capped at 9 digits max
    const digitsOnly = text.replace(/\D/g, '');
    if (digitsOnly.length > 9) {
      return;
    }
    const formatted = formatCurrencyInput(text, activeCurrency, 9);
    setRows((prev) => {
      const current = prev.find((r) => r.id === id);
      if (current && current.amountStr === formatted) {
        return prev;
      }
      return prev.map((r) => (r.id === id ? { ...r, amountStr: formatted } : r));
    });
  };

  const applyTemplate = (items: { label: string; amountStr: string }[]) => {
    AppHaptics.selection();
    setRows(
      items.map((it, idx) => ({
        id: String(idx + 1),
        label: it.label,
        amountStr: it.amountStr,
      }))
    );
  };

  const totalAllocated = rows.reduce((sum, r) => {
    const val = parseAmount(r.amountStr, activeCurrency);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const handleSave = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      showAlert('Missing Title', 'Please enter a name for this income allocation (e.g. Primary Salary, Freelance).', undefined, 'warning');
      return;
    }

    const validItems: AllocationItem[] = rows
      .filter((r) => r.label.trim().length > 0 || r.amountStr.trim().length > 0)
      .map((r) => {
        const amt = parseAmount(r.amountStr, activeCurrency);
        return {
          id: r.id,
          label: r.label.trim() || 'Untitled Allocation',
          amount: isNaN(amt) ? 0 : amt,
        };
      });

    if (validItems.length === 0) {
      showAlert('Missing Allocations', 'Please add at least one allocation row with a description.', undefined, 'warning');
      return;
    }

    AppHaptics.heavy();
    Keyboard.dismiss();

    const planToSave: AllocationPlan = {
      id: plan ? plan.id : `plan_${Date.now()}`,
      title: trimmedTitle,
      currency: activeCurrency,
      items: validItems,
    };

    onSave(planToSave);
  };

  const handleDelete = () => {
    if (!plan || !onDelete) return;
    showAlert(
      'Delete Allocation Plan',
      `Delete "${plan.title}"? This allocation breakdown will be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Plan',
          style: 'destructive',
          onPress: () => {
            AppHaptics.light();
            onDelete(plan.id);
          },
        },
      ],
      'confirm'
    );
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      height="92%"
      maxHeight="94%"
    >
      <ModalHeader
        title={plan ? 'Edit Allocation Plan' : 'New Allocation Plan'}
        subtitle={`(${activeCurrency})`}
        onClose={onClose}
      />

          <KeyboardSafeContainer extraBottomSpace={28}>
            {/* Plan Title */}
            <Text style={styles.sectionTitle}>
              Name <Text style={styles.requiredStar}>*</Text>
            </Text>
            <View style={styles.titleInputWrap}>
              <Layers size={17} color={Palette.primary} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.titleInput}
                placeholder="e.g. Primary Salary, Freelance Projects"
                placeholderTextColor={Palette.muted}
                value={title}
                onChangeText={setTitle}
                returnKeyType="next"
              />
            </View>

            {/* Quick Templates */}
            <View style={styles.templateRow}>
              <TouchableOpacity
                style={styles.templateChip}
                onPress={() => {
                  if (!title) setTitle('Monthly Salary');
                  applyTemplate([
                    { label: 'Needs (50%)', amountStr: '' },
                    { label: 'Wants (30%)', amountStr: '' },
                    { label: 'Savings (20%)', amountStr: '' },
                  ]);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.templateChipText}>+ 50/30/20 Rule</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.templateChip}
                onPress={() => {
                  if (!title) setTitle('Side Income');
                  applyTemplate([
                    { label: 'Fixed Bills', amountStr: '' },
                    { label: 'Emergency Fund', amountStr: '' },
                    { label: 'Investments', amountStr: '' },
                    { label: 'Personal', amountStr: '' },
                  ]);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.templateChipText}>+ 4 Buckets Rule</Text>
              </TouchableOpacity>
            </View>

            {/* Column Headers */}
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.colHeader, { flex: 1.1 }]}>DESCRIPTION</Text>
              <Text style={[styles.colHeader, { flex: 1.1, textAlign: 'right', paddingRight: 36 }]}>
                AMOUNT
              </Text>
            </View>

            {/* Dynamic Rows */}
            {rows.map((row) => (
              <View key={row.id} style={styles.allocationRow}>
                <View style={styles.leftColInputWrap}>
                  <TextInput
                    style={styles.leftInput}
                    placeholder="e.g. Rent"
                    maxLength={20}
                    placeholderTextColor={Palette.muted}
                    value={row.label}
                    onChangeText={(t) => handleUpdateRowLabel(row.id, t)}
                    returnKeyType="next"
                  />
                </View>

                <TouchableOpacity
                  style={styles.rightColInputWrap}
                  onPress={() => {
                    AppHaptics.light();
                    Keyboard.dismiss();
                    setActiveAmountRowId(row.id);
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={styles.currencyPrefixText}>
                    {activeCurrency === 'IDR' ? 'Rp' : '$'}
                  </Text>
                  <Text
                    style={[
                      styles.rightAmountText,
                      !row.amountStr && styles.rightAmountPlaceholder,
                    ]}
                    numberOfLines={1}
                  >
                    {row.amountStr || '0'}
                  </Text>
                  <Edit3 size={13} color={Palette.muted} style={{ marginLeft: 6 }} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.deleteRowBtn,
                    rows.length <= 1 && { opacity: 0.3 },
                  ]}
                  onPress={() => handleRemoveRow(row.id)}
                  disabled={rows.length <= 1}
                  activeOpacity={0.7}
                >
                  <Trash2 size={16} color={rows.length > 1 ? Palette.error : Palette.muted} />
                </TouchableOpacity>
              </View>
            ))}

            {/* Add Row Button */}
            <TouchableOpacity
              style={styles.addRowBtn}
              onPress={handleAddRow}
              activeOpacity={0.8}
            >
              <Plus size={16} color={Palette.primary} style={{ marginRight: 6 }} />
              <Text style={styles.addRowBtnText}>Add Allocation Row</Text>
            </TouchableOpacity>

            {/* Total Allocated Card */}
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>Total Allocated ({rows.length} items):</Text>
              <Text style={styles.totalValue}>
                {formatCurrency(totalAllocated, activeCurrency)}
              </Text>
            </View>
          </KeyboardSafeContainer>

          {/* Sticky Action Footer */}
          <View style={[styles.stickyFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSave}
              activeOpacity={0.85}
            >
              <Check size={18} color={Palette.white} style={{ marginRight: 8 }} />
              <Text style={styles.saveBtnText}>Save Plan</Text>
            </TouchableOpacity>

            {plan && onDelete && (
              <TouchableOpacity
                style={styles.deletePlanBtn}
                onPress={handleDelete}
                activeOpacity={0.8}
              >
                <Trash2 size={16} color={Palette.error} style={{ marginRight: 6 }} />
                <Text style={styles.deletePlanBtnText}>Delete This Plan</Text>
              </TouchableOpacity>
            )}
          </View>

      {/* Dedicated Numeric Keypad Modal for setting row amount (Max 9 Digits, Zero Flicker) */}
      <AmountInputModal
        visible={!!activeAmountRowId}
        title="Set Allocation Amount"
        subtitle={activeRow ? `For "${activeRow.label || 'Allocation Item'}"` : undefined}
        initialAmount={activeRow ? activeRow.amountStr : ''}
        currency={activeCurrency}
        maxDigits={9}
        onConfirm={(formatted) => {
          if (activeAmountRowId) {
            handleUpdateRowAmount(activeAmountRowId, formatted);
          }
          setActiveAmountRowId(null);
        }}
        onClose={() => setActiveAmountRowId(null)}
      />

      {/* Custom Alert Modal for Allocation Plan */}
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Palette.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '92%',
    maxHeight: '94%',
    overflow: 'hidden',
  },
  sectionTitle: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '700',
    color: Palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  requiredStar: {
    color: Palette.primary,
    fontWeight: '700',
  },
  titleInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Palette.hairline,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  titleInput: {
    ...Typography.body,
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Palette.ink,
    paddingVertical: 11,
  },
  templateRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  templateChip: {
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  templateChipText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '600',
    color: Palette.primary,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  colHeader: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: Palette.muted,
    letterSpacing: 0.4,
  },
  allocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  leftColInputWrap: {
    flex: 1.1,
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Palette.hairline,
    paddingHorizontal: 10,
  },
  leftInput: {
    ...Typography.body,
    fontSize: 13,
    color: Palette.ink,
    paddingVertical: 9,
  },
  rightColInputWrap: {
    flex: 1.1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Palette.hairline,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  currencyPrefixText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '700',
    color: Palette.muted,
    marginRight: 4,
  },
  rightAmountText: {
    ...Typography.body,
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: Palette.ink,
    textAlign: 'right',
  },
  rightAmountPlaceholder: {
    color: Palette.muted,
    fontWeight: '400',
  },
  deleteRowBtn: {
    width: 32,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FDF0ED',
    borderRadius: 12,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: '#F9DED7',
    borderStyle: 'dashed',
    marginTop: 4,
    marginBottom: 16,
  },
  addRowBtnText: {
    ...Typography.caption,
    fontSize: 13,
    fontWeight: '600',
    color: Palette.primary,
  },
  totalCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Palette.hairline,
    marginBottom: 10,
  },
  totalLabel: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: Palette.muted,
  },
  totalValue: {
    ...Typography.heading,
    fontSize: 16,
    fontWeight: '700',
    color: Palette.ink,
  },
  stickyFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.hairline,
    backgroundColor: Palette.white,
    gap: 8,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.primary,
    borderRadius: 14,
    paddingVertical: 13,
  },
  saveBtnText: {
    ...Typography.body,
    fontSize: 15,
    fontWeight: '700',
    color: Palette.white,
  },
  deletePlanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF8F8',
    borderRadius: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#F8D7DA',
  },
  deletePlanBtnText: {
    ...Typography.caption,
    fontSize: 13,
    fontWeight: '600',
    color: Palette.error,
  },
});
