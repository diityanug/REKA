import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Building2,
  Banknote,
  CreditCard,
  TrendingUp,
  Smartphone,
  Plus,
} from 'lucide-react-native';
import { ContactlessCardIcon } from '../icons/ContactlessCardIcon';
import { Palette, Typography } from '../../theme/tokens';
import { CurrencyType, AccountType } from '../../types';
import { ACCOUNT_PRESETS } from '../../constants/presets';
import { AppHaptics } from '../../utils/haptics';
import { ModalHeader } from '../ModalHeader';
import { KeyboardSafeContainer } from '../KeyboardSafeContainer';
import { BottomSheetModal } from '../BottomSheetModal';
import { AmountInputModal } from './AmountInputModal';

interface NewAccountModalProps {
  visible: boolean;
  name: string;
  type: AccountType | string;
  currency: CurrencyType;
  balance: string;
  accountNumber: string;
  onChangeName: (text: string) => void;
  onChangeType: (type: AccountType) => void;
  onChangeCurrency: (currency: CurrencyType) => void;
  onChangeBalance: (text: string) => void;
  onChangeAccountNumber: (text: string) => void;
  onCreate: () => void | Promise<void>;
  onClose: () => void;
}

// A preset fills name, type AND currency together so no stale value survives.
const PRESET_CONFIG: Record<string, { type: AccountType; currency: CurrencyType }> = {
  BCA: { type: 'Bank', currency: 'IDR' },
  Mandiri: { type: 'Bank', currency: 'IDR' },
  'Cash Wallet': { type: 'Cash', currency: 'IDR' },
  GoPay: { type: 'E-Wallet', currency: 'IDR' },
  'Credit Card': { type: 'Credit Card', currency: 'IDR' },
  'Flazz / E-Toll': { type: 'E-Money', currency: 'IDR' },
  'USD Vault': { type: 'Bank', currency: 'USD' },
};

export const NewAccountModal: React.FC<NewAccountModalProps> = ({
  visible,
  name,
  type,
  currency,
  balance,
  accountNumber,
  onChangeName,
  onChangeType,
  onChangeCurrency,
  onChangeBalance,
  onChangeAccountNumber,
  onCreate,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const [amountModalVisible, setAmountModalVisible] = useState(false);
  const [saving, setSaving] = useState<boolean>(false);

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
      height="92%"
      maxHeight="94%"
    >
      <ModalHeader
        title="New Account"
        subtitle="Add a bank, cash, or e-wallet vault"
        onClose={onClose}
      />

          <KeyboardSafeContainer extraBottomSpace={48}>
              <Text style={styles.inputLabel}>
                Account Name <Text style={styles.requiredStar}>*</Text>
              </Text>
              <TextInput
                style={styles.textInputBox}
                placeholder="e.g. BCA, Cash Wallet, Chase"
                placeholderTextColor={Palette.mutedSoft}
                value={name}
                onChangeText={onChangeName}
                returnKeyType="next"
                maxLength={40}
              />

              {/* Presets */}
              <View style={styles.chipsRow}>
                {ACCOUNT_PRESETS.map((preset) => (
                  <TouchableOpacity
                    key={preset}
                    style={[
                      styles.presetChip,
                      name === preset && styles.presetChipActive,
                    ]}
                    onPress={() => {
                      AppHaptics.selection();
                      const config = PRESET_CONFIG[preset];
                      onChangeName(preset);
                      if (config) {
                        onChangeType(config.type);
                        onChangeCurrency(config.currency);
                      }
                    }}
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

              {/* Account Type */}
              <Text style={[styles.inputLabel, { marginTop: 14 }]}>
                Account Type <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View style={styles.bentoGrid2Col}>
                {(
                  [
                    { key: 'Bank' as const, label: 'Bank', Icon: Building2 },
                    { key: 'E-Wallet' as const, label: 'E-Wallet', Icon: Smartphone },
                    { key: 'Cash' as const, label: 'Cash', Icon: Banknote },
                    { key: 'Investment' as const, label: 'Investment', Icon: TrendingUp },
                    { key: 'Credit Card' as const, label: 'Credit Card', Icon: CreditCard },
                    { key: 'E-Money' as const, label: 'E-Money', Icon: ContactlessCardIcon },
                  ] as const
                ).map(({ key, label, Icon }) => {
                  const isSelected =
                    type.toLowerCase() === key.toLowerCase() ||
                    (key === 'Bank' && type === 'bank') ||
                    (key === 'Cash' && type === 'cash') ||
                    (key === 'E-Wallet' && type === 'ewallet') ||
                    (key === 'Investment' && type === 'investment');
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[
                        styles.categoryCard,
                        isSelected && {
                          borderColor: Palette.primary,
                          backgroundColor: '#FDF0ED',
                        },
                      ]}
                      onPress={() => {
                        AppHaptics.selection();
                        onChangeType(key);
                      }}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel={`${label} account type`}
                      accessibilityState={{ selected: isSelected }}
                    >
                      <View
                        style={[
                          styles.iconBox,
                          {
                            backgroundColor: isSelected
                              ? Palette.primary
                              : Palette.surfaceSoft,
                          },
                        ]}
                      >
                        <Icon
                          size={16}
                          color={isSelected ? Palette.white : Palette.primary}
                        />
                      </View>
                      <Text
                        style={[
                          styles.categoryLabel,
                          isSelected && { color: Palette.ink, fontWeight: '700' },
                        ]}
                        numberOfLines={1}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Currency */}
              <Text style={[styles.inputLabel, { marginTop: 14 }]}>
                Currency <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View style={styles.segmentedControl}>
                <TouchableOpacity
                  style={[
                    styles.segmentBtn,
                    currency === 'IDR' && styles.segmentBtnActiveExpense,
                  ]}
                  onPress={() => {
                    AppHaptics.selection();
                    onChangeCurrency('IDR');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Currency IDR, Indonesian Rupiah"
                  accessibilityState={{ selected: currency === 'IDR' }}
                >
                  <Text
                    style={[
                      styles.segmentBtnText,
                      currency === 'IDR' && styles.segmentBtnTextActive,
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                  >
                    IDR (Indonesian Rupiah)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.segmentBtn,
                    currency === 'USD' && styles.segmentBtnActiveIncome,
                  ]}
                  onPress={() => {
                    AppHaptics.selection();
                    onChangeCurrency('USD');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Currency USD, US Dollar"
                  accessibilityState={{ selected: currency === 'USD' }}
                >
                  <Text
                    style={[
                      styles.segmentBtnText,
                      currency === 'USD' && styles.segmentBtnTextActive,
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                  >
                    USD (US Dollar)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Starting Balance */}
              <Text style={[styles.inputLabel, { marginTop: 10 }]}>
                Starting Balance <Text style={styles.optionalTag}>(optional)</Text>
              </Text>
              <TouchableOpacity
                style={styles.amountPickerBox}
                onPress={() => {
                  AppHaptics.light();
                  Keyboard.dismiss();
                  setAmountModalVisible(true);
                }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Starting balance, ${balance || '0'} ${currency}`}
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

              {/* Account Number */}
              <Text style={[styles.inputLabel, { marginTop: 14 }]}>
                Account Number <Text style={styles.optionalTag}>(optional)</Text>
              </Text>
              <TextInput
                style={styles.textInputBox}
                placeholder="e.g. 1234 5678"
                placeholderTextColor={Palette.mutedSoft}
                value={accountNumber}
                onChangeText={onChangeAccountNumber}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
                maxLength={30}
                accessibilityLabel="Account number"
                accessibilityHint="Optional account or card number ending"
              />
            </KeyboardSafeContainer>

            <View style={[styles.stickyFooter, { paddingBottom: Math.max(insets.bottom, 14) }]}>
              <TouchableOpacity
                style={[styles.confirmBtn, saving && { opacity: 0.7 }]}
                onPress={submit}
                disabled={saving}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Save account"
              >
                {saving ? (
                  <>
                    <ActivityIndicator size="small" color={Palette.white} style={{ marginRight: 8 }} />
                    <Text style={styles.confirmBtnText}>Saving...</Text>
                  </>
                ) : (
                  <>
                    <Plus size={18} color={Palette.white} style={{ marginRight: 8 }} />
                    <Text style={styles.confirmBtnText}>Save Account</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

      <AmountInputModal
        visible={amountModalVisible}
        title="Set Starting Balance"
        subtitle={`Account balance in ${currency}`}
        initialAmount={balance}
        currency={currency}
        allowZero
        onConfirm={(formatted) => onChangeBalance(formatted)}
        onClose={() => setAmountModalVisible(false)}
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
  optionalTag: {
    color: Palette.mutedSoft,
    fontWeight: '500',
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
  bentoGrid2Col: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryCard: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: Palette.white,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  categoryLabel: {
    ...Typography.body,
    fontSize: 12,
    color: Palette.ink,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  segmentBtn: {
    flex: 1,
    height: 38,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  segmentBtnActiveExpense: {
    backgroundColor: Palette.primary,
  },
  segmentBtnActiveIncome: {
    backgroundColor: Palette.accentTeal,
  },
  segmentBtnText: {
    ...Typography.body,
    fontSize: 12,
    fontWeight: '600',
    color: Palette.muted,
    textAlign: 'center',
  },
  segmentBtnTextActive: {
    color: Palette.white,
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
