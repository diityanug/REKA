import React, { useState, useMemo } from 'react';
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

export interface PocketIconCategory {
  key: string;
  name: string;
  icons: string[];
}

export const POCKET_ICON_CATEGORIES: PocketIconCategory[] = [
  {
    key: 'savings',
    name: 'Savings & Goals',
    icons: [
      'PiggyBank',
      'Landmark',
      'TrendingUp',
      'DollarSign',
      'CircleDollarSign',
      'Coins',
      'HandCoins',
      'Wallet',
      'Award',
      'CreditCard',
      'Banknote',
      'Building2',
      'Percent',
      'Receipt',
    ],
  },
  {
    key: 'bills',
    name: 'Bills & Living',
    icons: [
      'Home',
      'Zap',
      'Droplet',
      'Flame',
      'Lightbulb',
      'Wifi',
      'Tv',
      'Smartphone',
      'Trash2',
      'Armchair',
      'Bed',
      'BedDouble',
    ],
  },
  {
    key: 'safety',
    name: 'Safety & Health',
    icons: [
      'ShieldCheck',
      'Shield',
      'Lock',
      'Key',
      'Umbrella',
      'HeartPulse',
      'Stethoscope',
      'Pill',
      'Activity',
      'Syringe',
    ],
  },
  {
    key: 'travel',
    name: 'Travel & Transport',
    icons: [
      'Plane',
      'Luggage',
      'Hotel',
      'Car',
      'Fuel',
      'CircleParking',
      'Bus',
      'Bike',
      'Compass',
      'MapPin',
    ],
  },
  {
    key: 'shopping',
    name: 'Shopping & Goods',
    icons: [
      'ShoppingBag',
      'ShoppingCart',
      'Tag',
      'Shirt',
      'Watch',
      'Sparkles',
      'Package',
      'Glasses',
      'Scissors',
    ],
  },
  {
    key: 'food',
    name: 'Food & Drinks',
    icons: [
      'Utensils',
      'Coffee',
      'Pizza',
      'Sandwich',
      'Cake',
      'Soup',
      'Apple',
      'Beer',
      'Wine',
    ],
  },
  {
    key: 'work',
    name: 'Work & Education',
    icons: [
      'Briefcase',
      'GraduationCap',
      'Laptop',
      'Monitor',
      'Book',
      'BookOpen',
      'PenTool',
      'Newspaper',
      'Calendar',
      'Clock',
    ],
  },
  {
    key: 'leisure',
    name: 'Entertainment & Fun',
    icons: [
      'Film',
      'Gamepad2',
      'Camera',
      'Palette',
      'Ticket',
      'Music2',
      'Headphones',
      'Mic',
      'PartyPopper',
      'Gift',
      'Dumbbell',
      'Trophy',
    ],
  },
  {
    key: 'family',
    name: 'Family & Pets',
    icons: [
      'Users',
      'User',
      'Baby',
      'Heart',
      'HeartHandshake',
      'SmilePlus',
      'PawPrint',
      'Footprints',
    ],
  },
];

const getCategoryForIcon = (iconName: string): string => {
  const found = POCKET_ICON_CATEGORIES.find((grp) => grp.icons.includes(iconName));
  return found ? found.name : 'General';
};

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
  onSelectWallet?: (id: string) => void;
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
  onSelectWallet: _onSelectWallet,
  onChangeName,
  onChangeBalance,
  onChangeTarget,
  onChangeIcon,
  onCreate,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const [amountModalType, setAmountModalType] = useState<'balance' | 'target' | null>(null);
  const [selectedGroupKey, setSelectedGroupKey] = useState<string>('all');
  const [saving, setSaving] = useState<boolean>(false);
  const selectedWallet = wallets.find((w) => w.id === selectedWalletId);

  const displayedIcons = useMemo(() => {
    if (selectedGroupKey === 'all') {
      return AVAILABLE_ICONS;
    }
    const group = POCKET_ICON_CATEGORIES.find((g) => g.key === selectedGroupKey);
    return group ? group.icons : AVAILABLE_ICONS;
  }, [selectedGroupKey]);

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
      height="92%"
      maxHeight="95%"
    >
      <ModalHeader
        title="New Pocket"
        subtitle={selectedWallet ? `Inside ${selectedWallet.name}` : 'Allocate funds for specific goals'}
        onClose={onClose}
      />

          <KeyboardSafeContainer extraBottomSpace={16}>
              <Text style={styles.inputLabel}>
                Account
              </Text>
              <View style={styles.targetAccountCard}>
                <View style={styles.targetAccountLeft}>
                  <View
                    style={[
                      styles.targetAccountColorDot,
                      { backgroundColor: selectedWallet?.color || Palette.primary },
                    ]}
                  />
                  <Text style={styles.targetAccountName} numberOfLines={1}>
                    {selectedWallet?.name || 'Selected Account'}
                  </Text>
                </View>
                <View style={styles.targetAccountBadge}>
                  <Text style={styles.targetAccountBadgeText}>
                    {selectedWallet?.currency || currency}
                  </Text>
                </View>
              </View>

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

              <View style={styles.iconSectionHeader}>
                <Text style={styles.inputLabel}>
                  Pocket Icon <Text style={styles.requiredStar}>*</Text>
                </Text>
                <Text style={styles.iconCountTag}>
                  {displayedIcons.length} available
                </Text>
              </View>

              {/* Selected Icon Detail Card */}
              <View style={styles.selectedIconCard}>
                <View style={styles.selectedIconBadge}>
                  <CategoryIcon name={icon} size={22} color={Palette.white} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.selectedIconName}>{icon}</Text>
                  <Text style={styles.selectedIconCategory}>
                    Category: {getCategoryForIcon(icon)}
                  </Text>
                </View>
              </View>

              {/* Category Filter Chips */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoryChipsScroll}
                contentContainerStyle={styles.categoryChipsContent}
              >
                <TouchableOpacity
                  style={[
                    styles.categoryFilterChip,
                    selectedGroupKey === 'all' && styles.categoryFilterChipActive,
                  ]}
                  onPress={() => {
                    AppHaptics.selection();
                    setSelectedGroupKey('all');
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.categoryFilterChipText,
                      selectedGroupKey === 'all' && styles.categoryFilterChipTextActive,
                    ]}
                  >
                    All
                  </Text>
                </TouchableOpacity>

                {POCKET_ICON_CATEGORIES.map((cat) => {
                  const isCatActive = selectedGroupKey === cat.key;
                  return (
                    <TouchableOpacity
                      key={cat.key}
                      style={[
                        styles.categoryFilterChip,
                        isCatActive && styles.categoryFilterChipActive,
                      ]}
                      onPress={() => {
                        AppHaptics.selection();
                        setSelectedGroupKey(cat.key);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.categoryFilterChipText,
                          isCatActive && styles.categoryFilterChipTextActive,
                        ]}
                      >
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Icon Grid Box */}
              <View style={styles.iconScrollBox}>
                <ScrollView
                  style={styles.iconScrollView}
                  contentContainerStyle={styles.iconGrid}
                  nestedScrollEnabled={true}
                  showsVerticalScrollIndicator={false}
                >
                  {displayedIcons.map((ic) => {
                    const active = icon === ic;
                    return (
                      <TouchableOpacity
                        key={ic}
                        style={[
                          styles.iconCell,
                          active && styles.iconCellActive,
                        ]}
                        onPress={() => {
                          AppHaptics.selection();
                          onChangeIcon(ic);
                        }}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`${ic}, ${getCategoryForIcon(ic)}`}
                        accessibilityState={{ selected: active }}
                      >
                        <CategoryIcon
                          name={ic}
                          size={22}
                          color={active ? Palette.white : Palette.ink}
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
  targetAccountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  targetAccountLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  targetAccountColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  targetAccountName: {
    ...Typography.body,
    fontSize: 15,
    fontWeight: '700',
    color: Palette.ink,
  },
  targetAccountBadge: {
    backgroundColor: Palette.white,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  targetAccountBadgeText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: Palette.muted,
  },
  iconSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 6,
  },
  iconCountTag: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
  },
  selectedIconCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 14,
    padding: 10,
    marginBottom: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  selectedIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedIconName: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: '700',
    color: Palette.ink,
  },
  selectedIconCategory: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
    marginTop: 1,
  },
  categoryChipsScroll: {
    marginBottom: 10,
  },
  categoryChipsContent: {
    gap: 6,
  },
  categoryFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: Palette.surfaceSoft,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  categoryFilterChipActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  categoryFilterChipText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: Palette.body,
  },
  categoryFilterChipTextActive: {
    color: Palette.white,
  },
  iconScrollBox: {
    height: 240,
    maxHeight: 280,
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Palette.hairline,
    padding: 10,
    marginBottom: 10,
  },
  iconScrollView: {
    flex: 1,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 10,
  },
  iconCell: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Palette.white,
    borderWidth: 1,
    borderColor: Palette.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCellActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
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
