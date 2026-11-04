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
import { useFooterKeyboardOffset } from '../../hooks/useKeyboardHeight';

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
  const footerKeyboardOffset = useFooterKeyboardOffset();
  const [amountModalVisible, setAmountModalVisible] = useState(false);
  const [saving, setSaving] = useState<boolean>(false);

  const submit = async () => {
    if (saving || !name.trim()) return;
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
      height="90%"
      maxHeight="94%"
    >
      <ModalHeader
        title="New Account"
        subtitle="Add a bank, cash, or e-wallet vault"
        onClose={onClose}
      />

      <KeyboardSafeContainer
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        extraBottomSpace={28}
      >
        {/* Section 1: Account Name & Quick Presets */}
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>
            Account Name <Text style={styles.requiredStar}>*</Text>
          </Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInputBox}
              placeholder="e.g. BCA, Cash Wallet, Wise..."
              placeholderTextColor={Palette.mutedSoft}
              value={name}
              onChangeText={onChangeName}
              returnKeyType="next"
              maxLength={40}
            />
          </View>

          {/* Quick Presets */}
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
                activeOpacity={0.75}
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
        </View>

        {/* Section 2: Account Type */}
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>
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
                    isSelected && styles.categoryCardSelected,
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
                      isSelected && styles.categoryLabelSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Section 3: Currency */}
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>
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
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.segmentBtnText,
                  currency === 'IDR' && styles.segmentBtnTextActive,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
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
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.segmentBtnText,
                  currency === 'USD' && styles.segmentBtnTextActive,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
              >
                USD (US Dollar)
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Section 4: Starting Balance */}
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Starting Balance</Text>
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
        </View>

        {/* Section 5: Note / Account Number (Optional) */}
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Note / Account Number</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInputBox}
              placeholder="e.g. 1234 5678 or main account note..."
              placeholderTextColor={Palette.mutedSoft}
              value={accountNumber}
              onChangeText={onChangeAccountNumber}
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
              maxLength={40}
              accessibilityLabel="Note or account number"
            />
          </View>
        </View>
      </KeyboardSafeContainer>

      {/* Sticky Bottom Action */}
      <View
        style={[
          styles.stickyFooter,
          {
            paddingBottom: Math.max(insets.bottom, 14) + footerKeyboardOffset,
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.confirmBtn, (!name.trim() || saving) && styles.confirmBtnDisabled]}
          onPress={submit}
          disabled={!name.trim() || saving}
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
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  formSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: Palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  requiredStar: {
    color: Palette.primary,
    fontWeight: '700',
  },
  inputContainer: {
    backgroundColor: Palette.white,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Palette.hairline,
    height: 52,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  textInputBox: {
    ...Typography.body,
    fontSize: 15,
    color: Palette.ink,
    padding: 0,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
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
    fontWeight: '600',
    color: Palette.ink,
  },
  presetChipTextActive: {
    color: Palette.white,
  },
  bentoGrid2Col: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryCard: {
    flex: 1,
    minWidth: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: Palette.white,
    borderWidth: 1.5,
    borderColor: Palette.hairline,
  },
  categoryCardSelected: {
    borderColor: Palette.primary,
    backgroundColor: Palette.surfaceSoft,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  categoryLabel: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '600',
    color: Palette.ink,
    flexShrink: 1,
  },
  categoryLabelSelected: {
    color: Palette.primary,
    fontWeight: '700',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  segmentBtn: {
    flex: 1,
    height: 38,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  segmentBtnActiveExpense: {
    backgroundColor: Palette.primary,
  },
  segmentBtnActiveIncome: {
    backgroundColor: Palette.accentTeal,
  },
  segmentBtnText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: Palette.muted,
    textAlign: 'center',
  },
  segmentBtnTextActive: {
    color: Palette.white,
    fontWeight: '700',
  },
  amountPickerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.white,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Palette.hairline,
    paddingHorizontal: 12,
    height: 52,
  },
  amountPrefixTag: {
    backgroundColor: Palette.surfaceSoft,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    marginRight: 10,
  },
  amountPrefixTagText: {
    ...Typography.body,
    fontWeight: '700',
    color: Palette.primary,
    fontSize: 14,
  },
  amountPickerValue: {
    ...Typography.body,
    fontWeight: '700',
    color: Palette.ink,
    fontSize: 17,
    flex: 1,
  },
  amountPickerPlaceholder: {
    color: Palette.mutedSoft,
    fontWeight: '400',
  },
  stickyFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Palette.hairline,
    backgroundColor: Palette.white,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.primary,
    paddingVertical: 14,
    borderRadius: 14,
  },
  confirmBtnDisabled: {
    opacity: 0.5,
  },
  confirmBtnText: {
    ...Typography.body,
    fontSize: 15,
    fontWeight: '700',
    color: Palette.white,
  },
});
