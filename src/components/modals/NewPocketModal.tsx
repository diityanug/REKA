import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus } from 'lucide-react-native';
import { Palette, Typography } from '../../theme/tokens';
import { Wallet, CurrencyType } from '../../types';
import { POCKET_PRESETS } from '../../constants/presets';
import { formatCurrency, parseAmount } from '../../utils/formatters';
import { AppHaptics } from '../../utils/haptics';
import { ModalHeader } from '../ModalHeader';
import { KeyboardSafeContainer } from '../KeyboardSafeContainer';
import { CategoryIcon, AVAILABLE_ICONS } from '../CategoryIcon';
import { BottomSheetModal } from '../BottomSheetModal';
import { AmountInputModal } from './AmountInputModal';

interface NewPocketModalProps {
  visible: boolean;
  wallets: Wallet[];
  selectedWalletId: string;
  name: string;
  balance: string;
  target: string;
  icon: string;
  availableAmount: number;
  currency: CurrencyType;
  onSelectWallet: (id: string) => void;
  onChangeName: (text: string) => void;
  onChangeBalance: (text: string) => void;
  onChangeTarget: (text: string) => void;
  onChangeIcon: (icon: string) => void;
  onCreate: () => void | Promise<void>;
  onClose: () => void;
}

export const NewPocketModal: React.FC<NewPocketModalProps> = ({
  visible,
  wallets,
  selectedWalletId,
  name,
  balance,
  target,
  icon,
  availableAmount,
  currency,
  onSelectWallet,
  onChangeName,
  onChangeBalance,
  onChangeTarget,
  onChangeIcon,
  onCreate,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const [amountModalType, setAmountModalType] = useState<'balance' | 'target' | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const selectedWallet = wallets.find((w) => w.id === selectedWalletId);

  // Warn before submit; the hook still validates on its own.
  const allocatedValue = parseAmount(balance, currency);
  const exceedsAvailable = !!balance && !isNaN(allocatedValue) && allocatedValue > availableAmount;

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onCreate();
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      height="82%"
      maxHeight="86%"
    >
      <ModalHeader
        title="New Pocket"
        subtitle="Allocate funds for specific goals"
        onClose={onClose}
      />

          <KeyboardSafeContainer extraBottomSpace={16}>
              <Text style={styles.inputLabel}>
                Main Account <Text style={styles.requiredStar}>*</Text>
              </Text>
              {wallets.length === 0 ? (
                <Text style={styles.emptyText}>Create an account first.</Text>
              ) : (
                <View style={styles.chipsRow}>
                  {wallets.map((w) => (
                    <TouchableOpacity
                      key={w.id}
                      style={[
                        styles.presetChip,
                        selectedWalletId === w.id && styles.presetChipActive,
                      ]}
                      onPress={() => {
                        AppHaptics.selection();
                        onSelectWallet(w.id);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`${w.name}, ${w.currency}`}
                      accessibilityState={{ selected: selectedWalletId === w.id }}
                    >
                      <Text
                        style={[
                          styles.presetChipText,
                          selectedWalletId === w.id && styles.presetChipTextActive,
                        ]}
                      >
                        {w.name} ({w.currency})
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={[styles.inputLabel, { marginTop: 14 }]}>
                Pocket Name <Text style={styles.requiredStar}>*</Text>
              </Text>
              <TextInput
                style={styles.textInputBox}
                placeholder="e.g. Emergency Fund, Trip"
                placeholderTextColor={Palette.mutedSoft}
                value={name}
                onChangeText={onChangeName}
                returnKeyType="next"
                maxLength={30}
              />

              <View style={styles.chipsRow}>
                {POCKET_PRESETS.map((preset) => (
                  <TouchableOpacity
                    key={preset}
                    style={[
                      styles.presetChip,
                      name === preset && styles.presetChipActive,
                    ]}
                    onPress={() => {
                      AppHaptics.selection();
                      onChangeName(preset);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Pocket preset ${preset}`}
                    accessibilityState={{ selected: name === preset }}
                  >
                    <Text
                      style={[
                        styles.presetChipText,
                        name === preset && styles.presetChipTextActive,
                      ]}
                    >
                      {preset}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.inputLabel, { marginTop: 14 }]}>
                Allocated Balance
              </Text>
              <TouchableOpacity
                style={styles.amountPickerBox}
                onPress={() => {
                  AppHaptics.light();
                  Keyboard.dismiss();
                  setAmountModalType('balance');
                }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Allocated balance, ${balance || '0'} ${currency}`}
              >
                <View style={styles.amountPrefixTag}>
                  <Text style={styles.amountPrefixTagText}>
                    {currency === 'IDR' ? 'Rp' : '$'}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.amountPickerValue,
                    !balance && styles.amountPickerPlaceholder,
                  ]}
                  numberOfLines={1}
                >
                  {balance || (currency === 'IDR' ? '0' : '0.00')}
                </Text>
              </TouchableOpacity>

              {/* The legal allocation ceiling, shown before submit */}
              <Text style={styles.availableHint}>
                Available to allocate: {formatCurrency(availableAmount, currency)}
              </Text>
              {exceedsAvailable ? (
                <Text style={styles.inlineError}>More than the available unallocated funds.</Text>
              ) : null}

              <Text style={[styles.inputLabel, { marginTop: 14 }]}>
                Target Goal
              </Text>
              <TouchableOpacity
                style={styles.amountPickerBox}
                onPress={() => {
                  AppHaptics.light();
                  Keyboard.dismiss();
                  setAmountModalType('target');
                }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Target goal, ${target || 'none'} ${currency}`}
              >
                <View style={styles.amountPrefixTag}>
                  <Text style={styles.amountPrefixTagText}>
                    {currency === 'IDR' ? 'Rp' : '$'}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.amountPickerValue,
                    !target && styles.amountPickerPlaceholder,
                  ]}
                  numberOfLines={1}
                >
                  {target || (currency === 'IDR' ? '0 (no target)' : '0.00 (no target)')}
                </Text>
              </TouchableOpacity>

              <Text style={[styles.inputLabel, { marginTop: 14 }]}>
                Pocket Icon <Text style={styles.requiredStar}>*</Text> ({AVAILABLE_ICONS.length} available)
              </Text>
              <View style={styles.iconScrollBox}>
                <ScrollView
                  style={styles.iconScrollView}
                  contentContainerStyle={styles.iconGrid}
                  nestedScrollEnabled={true}
                  showsVerticalScrollIndicator={false}
                >
                  {AVAILABLE_ICONS.map((ic) => {
                    const active = icon === ic;
                    return (
                      <TouchableOpacity
                        key={ic}
                        style={[
                          styles.iconCell,
                          active && {
                            backgroundColor: Palette.accentTeal,
                            borderColor: Palette.accentTeal,
                          },
                        ]}
                        onPress={() => {
                          AppHaptics.selection();
                          onChangeIcon(ic);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Icon ${ic}`}
                        accessibilityState={{ selected: active }}
                      >
                        <CategoryIcon
                          name={ic}
                          size={20}
                          color={active ? Palette.white : Palette.body}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </KeyboardSafeContainer>

            <View style={[styles.stickyFooter, { paddingBottom: Math.max(insets.bottom, 14) }]}>
              <TouchableOpacity
                style={[styles.confirmBtn, saving && { opacity: 0.7 }]}
                onPress={submit}
                disabled={saving}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Save pocket"
              >
                {saving ? (
                  <>
                    <ActivityIndicator size="small" color={Palette.white} style={{ marginRight: 8 }} />
                    <Text style={styles.confirmBtnText}>Saving...</Text>
                  </>
                ) : (
                  <>
                    <Plus size={18} color={Palette.white} style={{ marginRight: 8 }} />
                    <Text style={styles.confirmBtnText}>Save Pocket</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

      <AmountInputModal
        visible={!!amountModalType}
        title={amountModalType === 'balance' ? 'Set Allocated Balance' : 'Set Target Goal'}
        subtitle={amountModalType === 'balance' ? `Allocated from ${selectedWallet?.name || 'Account'}` : 'Savings goal target'}
        initialAmount={amountModalType === 'balance' ? balance : target}
        currency={currency}
        allowZero
        onConfirm={(formatted) => {
          if (amountModalType === 'balance') {
            onChangeBalance(formatted);
          } else if (amountModalType === 'target') {
            onChangeTarget(formatted);
          }
          setAmountModalType(null);
        }}
        onClose={() => setAmountModalType(null)}
      />
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  inputLabel: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: Palette.ink,
    marginBottom: 5,
  },
  requiredStar: {
    color: Palette.primary,
    fontWeight: '700',
  },
  textInputBox: {
    ...Typography.body,
    fontSize: 14,
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Palette.hairline,
    color: Palette.ink,
  },
  emptyText: {
    ...Typography.caption,
    fontSize: 12,
    color: Palette.muted,
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Palette.hairline,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: Palette.surfaceSoft,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  presetChipActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  presetChipText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '500',
    color: Palette.ink,
  },
  presetChipTextActive: {
    color: Palette.white,
  },
  availableHint: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
    marginTop: 6,
  },
  inlineError: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '500',
    color: Palette.error,
    marginTop: 3,
  },
  iconScrollBox: {
    maxHeight: 160,
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Palette.hairline,
    padding: 10,
    marginBottom: 10,
  },
  iconScrollView: {
    flexGrow: 0,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 4,
  },
  iconCell: {
    width: 46,
    height: 46,
    minWidth: 44,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: Palette.white,
    borderWidth: 1,
    borderColor: Palette.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickyFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.hairline,
    backgroundColor: Palette.white,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.primary,
    paddingVertical: 13,
    borderRadius: 14,
  },
  confirmBtnText: {
    ...Typography.body,
    fontSize: 15,
    fontWeight: '600',
    color: Palette.white,
  },
  amountPickerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Palette.hairline,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  amountPrefixTag: {
    backgroundColor: Palette.surfaceSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginRight: 10,
  },
  amountPrefixTagText: {
    ...Typography.body,
    fontWeight: '700',
    color: Palette.ink,
    fontSize: 14,
  },
  amountPickerValue: {
    ...Typography.body,
    fontWeight: '600',
    color: Palette.ink,
    fontSize: 16,
    flex: 1,
  },
  amountPickerPlaceholder: {
    color: Palette.mutedSoft,
    fontWeight: '400',
  },
});
