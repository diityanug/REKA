import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  ActivityIndicator,
  Image,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Plus,
  Check,
  Pencil,
  Camera,
  X,
  Building2,
  Smartphone,
  Banknote,
  TrendingUp,
  CreditCard,
  Layers,
} from 'lucide-react-native';
import { ContactlessCardIcon } from '../icons/ContactlessCardIcon';
import { Palette, Typography } from '../../theme/tokens';
import { useSyncOnChange } from '../../hooks/useSyncOnChange';
import { useKeyboardHeight } from '../../hooks/useKeyboardHeight';
import { useLastDefined } from '../../hooks/useLastDefined';
import { useLocalAlert } from '../../hooks/useLocalAlert';
import { Category, Wallet, Pocket, ExtractedReceiptData, CurrencyType, TransactionType, filterSelectableCategories } from '../../types';
import { CategoryIcon } from '../CategoryIcon';
import { formatCurrency, formatCurrencyInput, formatDate } from '../../utils/formatters';
import { AppHaptics } from '../../utils/haptics';
import { ModalHeader } from '../ModalHeader';
import { KeyboardSafeContainer } from '../KeyboardSafeContainer';
import { BottomSheetModal } from '../BottomSheetModal';
import { AmountInputModal } from './AmountInputModal';
import { CustomAlertModal } from '../CustomAlertModal';

function chunkArray<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

function getAccountTypeIcon(rawType?: string) {
  const t = (rawType || '').toLowerCase();
  if (t === 'e-wallet' || t === 'ewallet') return Smartphone;
  if (t === 'cash') return Banknote;
  if (t === 'investment') return TrendingUp;
  if (t === 'credit card') return CreditCard;
  if (t === 'e-money' || t === 'emoney') return ContactlessCardIcon;
  return Building2;
}

interface ReviewReceiptModalProps {
  visible: boolean;
  extractedData: ExtractedReceiptData | null;
  receiptImageUri?: string;
  wallets: Wallet[];
  pockets: Pocket[];
  categories?: Category[];
  selectedWalletId: string;
  selectedPocketId: string;
  activeCurrency: CurrencyType;
  onSelectWallet: (id: string) => void;
  onSelectPocket: (id: string) => void;
  onOpenAddAccount: () => void;
  onOpenAddPocket: () => void;
  onConfirm: (
    notes?: string,
    merchant?: string,
    amountOverride?: number,
    categoryOverride?: string,
    typeOverride?: TransactionType,
    saveReceiptPhoto?: boolean
  ) => Promise<void>;
  onClose: () => void;
}

export const ReviewReceiptModal: React.FC<ReviewReceiptModalProps> = ({
  visible,
  extractedData,
  receiptImageUri = '',
  wallets,
  pockets,
  categories = [],
  selectedWalletId,
  selectedPocketId,
  activeCurrency,
  onSelectWallet,
  onSelectPocket,
  onOpenAddAccount,
  onOpenAddPocket,
  onConfirm,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const isKeyboardVisible = useKeyboardHeight() > 0;
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [merchantName, setMerchantName] = useState<string>('');
  const [selectedType, setSelectedType] = useState<TransactionType>('expense');
  const [selectedCategory, setSelectedCategory] = useState<string>('Others');
  const [showCatPicker, setShowCatPicker] = useState<boolean>(false);
  const [saveReceiptPhoto, setSaveReceiptPhoto] = useState<boolean>(true);
  const [photoPreviewVisible, setPhotoPreviewVisible] = useState<boolean>(false);
  const [amountOverride, setAmountOverride] = useState<number | null>(null);
  const [amountModalVisible, setAmountModalVisible] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const { alertConfig, showAlert, hideAlert } = useLocalAlert();

  const currentData = useLastDefined(extractedData);

  const selectableCategories = useMemo(
    () => filterSelectableCategories(categories, selectedType),
    [categories, selectedType]
  );

  // Only wallets matching the receipt currency are safe to save into
  const displayWallets = useMemo(() => {
    if (!currentData) return [];
    return wallets.filter((w) => w.currency === currentData.currency);
  }, [wallets, currentData]);

  const walletPockets = useMemo(() => {
    return pockets.filter((p) => p.walletId === selectedWalletId);
  }, [pockets, selectedWalletId]);

  const categoryRows = useMemo(
    () => chunkArray(selectableCategories, 3),
    [selectableCategories]
  );

  useSyncOnChange([visible], () => {
    if (visible && currentData) {
      setMerchantName(currentData.merchantName || '');
      setSelectedType(currentData.type || 'expense');
      setSelectedCategory(currentData.category || 'Others');
      setShowCatPicker(false);
      setSaveReceiptPhoto(true);
      setPhotoPreviewVisible(false);
      setReviewNotes('');
      setAmountOverride(null);
      setSaving(false);
    }
  });

  useEffect(() => {
    if (visible && displayWallets.length > 0) {
      if (!selectedWalletId || !displayWallets.some((w) => w.id === selectedWalletId)) {
        onSelectWallet(displayWallets[0].id);
      }
    }
  }, [visible, displayWallets, selectedWalletId, onSelectWallet]);

  if (!currentData) return null;

  const receiptCurrency = currentData.currency;
  const selectedDisplayWallet = displayWallets.find((w) => w.id === selectedWalletId);
  const hasWalletForCurrency = displayWallets.length > 0;
  const finalAmount = amountOverride ?? currentData.totalAmount;
  const amountUnreadable = currentData.totalAmount <= 0;
  const itemCount = currentData.items ? currentData.items.length : 0;
  const canConfirm = hasWalletForCurrency && !!selectedDisplayWallet && finalAmount > 0 && !saving;

  const handleConfirm = async () => {
    if (!hasWalletForCurrency || !selectedDisplayWallet) {
      showAlert(
        'Account Required',
        `Create a ${receiptCurrency} account first to record this receipt.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Create Account', onPress: onOpenAddAccount },
        ],
        'warning'
      );
      return;
    }
    if (saving) return;

    const finalMerchant = merchantName.trim() || currentData.merchantName || 'Receipt Transaction';
    try {
      setSaving(true);
      await onConfirm(
        reviewNotes,
        finalMerchant,
        finalAmount,
        selectedCategory,
        selectedType,
        saveReceiptPhoto
      );
    } catch (err: any) {
      showAlert('Save Failed', err?.message || 'Could not save this transaction.', undefined, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      fullPage={true}
      dismissOnBackdropPress={false}
    >
      <ModalHeader
        title="Review Receipt"
        subtitle="Check the details before saving"
        onClose={onClose}
        leadingIcon="close"
      />

            <KeyboardSafeContainer>
              {receiptImageUri ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: Palette.surfaceSoft,
                    borderRadius: 14,
                    padding: 10,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: Palette.hairline,
                  }}
                >
                  <TouchableOpacity
                    onPress={() => {
                      AppHaptics.light();
                      setPhotoPreviewVisible(true);
                    }}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Preview scanned receipt photo"
                  >
                    <Image
                      source={{ uri: receiptImageUri }}
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 10,
                        backgroundColor: Palette.hairline,
                      }}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                  <View style={{ flex: 1, marginLeft: 10, marginRight: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Camera size={13} color={Palette.primary} />
                      <Text style={{ ...Typography.body, fontSize: 13, fontWeight: '600', color: Palette.ink }}>
                        Receipt Photo
                      </Text>
                    </View>
                    <Text style={{ ...Typography.caption, fontSize: 11, color: Palette.muted, marginTop: 2 }}>
                      {saveReceiptPhoto ? 'Will be saved locally with this record' : 'Photo will not be stored'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.chip,
                      { paddingHorizontal: 10, paddingVertical: 6 },
                      saveReceiptPhoto && styles.chipActive,
                    ]}
                    onPress={() => {
                      AppHaptics.selection();
                      setSaveReceiptPhoto((prev) => !prev);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, saveReceiptPhoto && styles.chipTextActive]}>
                      {saveReceiptPhoto ? 'Saved' : 'Skip'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              <View style={styles.summaryCard}>
                <View style={styles.amountLabelRow}>
                  <Text style={styles.summaryLabel}>Nominal Amount</Text>
                  <View style={styles.currencyTag}>
                    <Text style={styles.currencyTagText}>{receiptCurrency}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.amountTapRow}
                  onPress={() => {
                    AppHaptics.light();
                    Keyboard.dismiss();
                    setAmountModalVisible(true);
                  }}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`Amount ${formatCurrency(finalAmount, receiptCurrency)}. Tap to edit.`}
                >
                  <Text style={styles.summaryAmount} numberOfLines={1}>
                    {formatCurrency(finalAmount, receiptCurrency)}
                  </Text>
                  <View style={styles.tapToEditRow}>
                    <Pencil size={11} color={Palette.primary} style={{ marginRight: 3 }} />
                    <Text style={styles.tapToEditHint}>Tap to edit</Text>
                  </View>
                </TouchableOpacity>

                {amountUnreadable && amountOverride === null ? (
                  <Text style={styles.amountErrorNote}>
                    The amount could not be read — tap the amount to enter it.
                  </Text>
                ) : null}

                <View style={styles.divider} />

                {/* Editable Merchant Name */}
                <View style={styles.merchantEditBox}>
                  <View style={styles.merchantLabelRow}>
                    <Text style={styles.metaLabel}>Merchant / Store</Text>
                    <View style={styles.tapToEditRow}>
                      <Pencil size={11} color={Palette.primary} style={{ marginRight: 3 }} />
                      <Text style={styles.tapToEditHint}>Tap to edit</Text>
                    </View>
                  </View>
                  <TextInput
                    style={styles.merchantInput}
                    value={merchantName}
                    onChangeText={setMerchantName}
                    placeholder="Merchant / store name"
                    placeholderTextColor={Palette.mutedSoft}
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                    autoCapitalize="words"
                    maxLength={50}
                  />
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Type</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {(['expense', 'income'] as TransactionType[]).map((t) => {
                      const active = selectedType === t;
                      return (
                        <TouchableOpacity
                          key={t}
                          style={[
                            styles.chip,
                            { paddingHorizontal: 10, paddingVertical: 4 },
                            active && styles.chipActive,
                          ]}
                          onPress={() => {
                            AppHaptics.selection();
                            setSelectedType(t);
                            const nextList = filterSelectableCategories(categories, t);
                            if (
                              nextList.length > 0 &&
                              !nextList.some((c) => c.name.toLowerCase() === selectedCategory.toLowerCase())
                            ) {
                              setSelectedCategory(nextList[0].name);
                            }
                          }}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>
                            {t === 'expense' ? 'Expense' : 'Income'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.metaRow}
                  onPress={() => {
                    AppHaptics.selection();
                    setShowCatPicker((prev) => !prev);
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={styles.metaLabel}>Category</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.metaValue, { color: Palette.primary, fontWeight: '600' }]}>
                      {selectedCategory}
                    </Text>
                    <Pencil size={11} color={Palette.primary} />
                  </View>
                </TouchableOpacity>

                {showCatPicker && categoryRows.length > 0 ? (
                  <View style={[styles.gridBlock, { marginTop: 8, marginBottom: 12 }]}>
                    {categoryRows.map((row, rowIdx) => {
                      const tint =
                        selectedType === 'expense' ? Palette.primary : Palette.accentTeal;
                      const softBg =
                        selectedType === 'expense'
                          ? Palette.tintExpense
                          : Palette.tintIncome;
                      return (
                        <View key={`rc-cat-row-${rowIdx}`} style={styles.gridRow3Col}>
                          {row.map((cat) => {
                            const active =
                              cat.name.toLowerCase() === selectedCategory.toLowerCase();
                            return (
                              <View key={cat.id} style={styles.gridCol}>
                                <TouchableOpacity
                                  style={[
                                    styles.categorySquareTile,
                                    active && {
                                      borderColor: tint,
                                      backgroundColor: softBg,
                                    },
                                  ]}
                                  onPress={() => {
                                    AppHaptics.selection();
                                    setSelectedCategory(cat.name);
                                    setShowCatPicker(false);
                                  }}
                                  activeOpacity={0.8}
                                >
                                  <View
                                    style={[
                                      styles.categorySquareIconBox,
                                      {
                                        backgroundColor: active ? tint : Palette.surfaceSoft,
                                      },
                                    ]}
                                  >
                                    <CategoryIcon
                                      name={cat.icon}
                                      size={17}
                                      color={active ? Palette.white : tint}
                                    />
                                  </View>
                                  <Text
                                    style={[
                                      styles.categorySquareLabel,
                                      active && styles.categorySquareLabelActive,
                                    ]}
                                    numberOfLines={2}
                                    adjustsFontSizeToFit
                                    minimumFontScale={0.84}
                                  >
                                    {cat.name}
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            );
                          })}
                          {row.length < 3
                            ? Array.from({ length: 3 - row.length }).map((_, emptyIdx) => (
                                <View
                                  key={`rc-cat-empty-${rowIdx}-${emptyIdx}`}
                                  style={styles.gridSlotEmpty}
                                />
                              ))
                            : null}
                        </View>
                      );
                    })}
                  </View>
                ) : null}
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Date</Text>
                  <Text style={styles.metaValue}>{formatDate(currentData.transactionDate)}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Payment Method</Text>
                  <Text style={styles.metaValue}>
                    {currentData.paymentMethod || 'QRIS'}
                  </Text>
                </View>
              </View>

              {/* Line items are informational, the amount stays editable */}
              <Text style={styles.sectionTitle}>
                {itemCount} items detected
              </Text>
              {currentData.items && currentData.items.length > 0 ? (
                <View style={{ marginBottom: 14 }}>
                  {currentData.items.map((it, idx) => (
                    <View key={`item_${idx}`} style={styles.itemCard}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={styles.itemName}>{it.name}</Text>
                        <Text style={styles.itemQty}>
                          Qty: {it.quantity} × {formatCurrency(it.unitPrice, currentData.currency)}
                        </Text>
                      </View>
                      <Text style={styles.itemTotal}>
                        {formatCurrency(it.totalPrice, currentData.currency)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeaderLabel}>
                  Account <Text style={styles.requiredStar}>*</Text>
                </Text>
                {hasWalletForCurrency ? (
                  <TouchableOpacity
                    style={styles.sectionHeaderAction}
                    onPress={() => {
                      AppHaptics.light();
                      onOpenAddAccount();
                    }}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="New account"
                  >
                    <Plus size={12} color={Palette.primary} strokeWidth={2.4} />
                    <Text style={styles.sectionHeaderActionText}>New</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {hasWalletForCurrency ? (
                <View style={[styles.selectorListCard, { marginBottom: 14 }]}>
                  {displayWallets.map((w, idx) => {
                    const isSelected = selectedWalletId === w.id;
                    const isLast = idx === displayWallets.length - 1;
                    const AccIcon = getAccountTypeIcon(w.type);
                    const accDisplayName =
                      w.name?.trim() || (w.type ? `${w.type} Account` : 'Account');
                    return (
                      <TouchableOpacity
                        key={w.id}
                        style={[
                          styles.selectorListRow,
                          !isLast && styles.selectorListRowBorder,
                          isSelected && styles.selectorListRowActive,
                        ]}
                        onPress={() => {
                          AppHaptics.selection();
                          if (w.id !== selectedWalletId) {
                            onSelectWallet(w.id);
                            onSelectPocket('');
                          }
                        }}
                        activeOpacity={0.78}
                        accessibilityRole="button"
                        accessibilityLabel={`${accDisplayName}, ${w.currency} account`}
                        accessibilityState={{ selected: isSelected }}
                      >
                        <View
                          style={[
                            styles.selectorRowIconBox,
                            isSelected && styles.selectorRowIconBoxActive,
                          ]}
                        >
                          <AccIcon
                            size={16}
                            color={isSelected ? Palette.white : Palette.primary}
                          />
                        </View>
                        <View style={styles.selectorRowCenter}>
                          <Text
                            style={[
                              styles.selectorRowName,
                              isSelected && styles.selectorRowNameActive,
                            ]}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.84}
                          >
                            {accDisplayName}
                          </Text>
                          <Text style={styles.selectorRowMeta} numberOfLines={1}>
                            {w.type ? `${w.type} · ${w.currency}` : w.currency}
                          </Text>
                        </View>
                        <View style={styles.selectorRowRight}>
                          <Text
                            style={[
                              styles.selectorRowBalance,
                              isSelected && styles.selectorRowBalanceActive,
                            ]}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.8}
                          >
                            {formatCurrency(w.balance, w.currency)}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.selectorRowRadio,
                            isSelected && styles.selectorRowRadioActive,
                          ]}
                        >
                          {isSelected ? (
                            <Check size={10} color={Palette.white} strokeWidth={3} />
                          ) : null}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.noWalletNotice}>
                  <Text style={styles.noWalletNoticeText}>
                    No {receiptCurrency} account yet. Create one to save this receipt.
                  </Text>
                  <TouchableOpacity
                    style={styles.noWalletBtn}
                    onPress={() => {
                      AppHaptics.light();
                      onOpenAddAccount();
                    }}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={`Create ${receiptCurrency} Account`}
                  >
                    <Plus size={16} color={Palette.white} style={{ marginRight: 6 }} />
                    <Text style={styles.noWalletBtnText}>
                      Create {receiptCurrency} Account
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {selectedDisplayWallet ? (() => {
                const allocatedSum = walletPockets.reduce((sum, p) => sum + p.balance, 0);
                const mainBal = Math.max(selectedDisplayWallet.balance - allocatedSum, 0);
                const pocketChoices = [
                  {
                    id: '',
                    name: 'Main Balance',
                    balance: mainBal,
                    icon: 'Wallet',
                    color: Palette.primary,
                    isMain: true,
                  },
                  ...walletPockets.map((p) => ({
                    id: p.id,
                    name: p.name,
                    balance: p.balance,
                    icon: p.icon || 'Briefcase',
                    color: p.color || Palette.accentTeal,
                    isMain: false,
                  })),
                ];
                return (
                  <>
                    <View style={styles.sectionHeaderRow}>
                      <Text style={styles.sectionHeaderLabel}>Pocket</Text>
                      <TouchableOpacity
                        style={styles.sectionHeaderAction}
                        onPress={() => {
                          AppHaptics.light();
                          onOpenAddPocket();
                        }}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel="New pocket"
                      >
                        <Plus size={12} color={Palette.primary} strokeWidth={2.4} />
                        <Text style={styles.sectionHeaderActionText}>New</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={[styles.selectorListCard, { marginBottom: 14 }]}>
                      {pocketChoices.map((choice, idx) => {
                        const isSelected = selectedPocketId === choice.id;
                        const isLast = idx === pocketChoices.length - 1;
                        const accentColor = choice.isMain ? Palette.primary : choice.color;
                        return (
                          <TouchableOpacity
                            key={choice.id || 'main-balance'}
                            style={[
                              styles.selectorListRow,
                              !isLast && styles.selectorListRowBorder,
                              isSelected && styles.selectorListRowActive,
                            ]}
                            onPress={() => {
                              AppHaptics.selection();
                              onSelectPocket(choice.id);
                            }}
                            activeOpacity={0.78}
                            accessibilityRole="button"
                            accessibilityLabel={`${choice.name} pocket`}
                            accessibilityState={{ selected: isSelected }}
                          >
                            <View
                              style={[
                                styles.selectorRowIconBox,
                                {
                                  backgroundColor: isSelected
                                    ? accentColor
                                    : Palette.surfaceSoft,
                                },
                              ]}
                            >
                              {choice.isMain ? (
                                <Layers
                                  size={15}
                                  color={isSelected ? Palette.white : Palette.primary}
                                />
                              ) : (
                                <CategoryIcon
                                  name={choice.icon}
                                  size={15}
                                  color={isSelected ? Palette.white : accentColor}
                                />
                              )}
                            </View>
                            <View style={styles.selectorRowCenter}>
                              <Text
                                style={[
                                  styles.selectorRowName,
                                  isSelected && styles.selectorRowNameActive,
                                ]}
                                numberOfLines={1}
                                adjustsFontSizeToFit
                                minimumFontScale={0.84}
                              >
                                {choice.name}
                              </Text>
                              <Text style={styles.selectorRowMeta} numberOfLines={1}>
                                {choice.isMain ? 'Unallocated balance' : 'Pocket'}
                              </Text>
                            </View>
                            <View style={styles.selectorRowRight}>
                              <Text
                                style={[
                                  styles.selectorRowBalance,
                                  isSelected && styles.selectorRowBalanceActive,
                                ]}
                                numberOfLines={1}
                                adjustsFontSizeToFit
                                minimumFontScale={0.8}
                              >
                                {formatCurrency(choice.balance, selectedDisplayWallet.currency)}
                              </Text>
                            </View>
                            <View
                              style={[
                                styles.selectorRowRadio,
                                isSelected && styles.selectorRowRadioActive,
                              ]}
                            >
                              {isSelected ? (
                                <Check size={10} color={Palette.white} strokeWidth={3} />
                              ) : null}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                );
              })() : null}

              <Text style={styles.sectionTitle}>Notes</Text>
              <TextInput
                style={styles.textInputBox}
                placeholder="e.g. Lunch with team, monthly wifi"
                placeholderTextColor={Palette.mutedSoft}
                value={reviewNotes}
                onChangeText={setReviewNotes}
                maxLength={100}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
            </KeyboardSafeContainer>

            {!isKeyboardVisible && (
              <View
                style={[
                  styles.stickyFooter,
                  {
                    paddingBottom: Math.max(insets.bottom, 14),
                  },
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.confirmBtn,
                    !canConfirm && styles.confirmBtnDisabled,
                  ]}
                  onPress={handleConfirm}
                  disabled={!canConfirm}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={`Save transaction of ${formatCurrency(finalAmount, receiptCurrency)}`}
                  accessibilityState={{ disabled: !canConfirm, busy: saving }}
                >
                  {saving ? (
                    <ActivityIndicator
                      size="small"
                      color={Palette.white}
                      style={{ marginRight: 8 }}
                    />
                  ) : (
                    <Check size={18} color={Palette.white} style={{ marginRight: 8 }} />
                  )}
                  <Text style={styles.confirmBtnText}>
                    {saving ? 'Saving...' : 'Save Transaction'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

      <AmountInputModal
        visible={amountModalVisible}
        title="Edit Amount"
        subtitle={`Receipt total in ${receiptCurrency}`}
        initialAmount={formatCurrencyInput(String(finalAmount), receiptCurrency)}
        currency={receiptCurrency}
        allowZero={false}
        onConfirm={(_formatted, numericVal) => {
          setAmountOverride(numericVal);
          setAmountModalVisible(false);
        }}
        onClose={() => setAmountModalVisible(false)}
      />

      <CustomAlertModal
        visible={alertConfig.visible}
        alertId={alertConfig.id}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        type={alertConfig.type}
        onClose={hideAlert}
      />

      {receiptImageUri ? (
        <Modal
          visible={photoPreviewVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setPhotoPreviewVisible(false)}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.92)',
              justifyContent: 'center',
              alignItems: 'center',
              padding: 20,
            }}
          >
            <TouchableOpacity
              style={{
                position: 'absolute',
                top: Math.max(insets.top, 20) + 10,
                right: 20,
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: 'rgba(255,255,255,0.18)',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
              }}
              onPress={() => setPhotoPreviewVisible(false)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Close photo preview"
            >
              <X size={20} color={Palette.white} />
            </TouchableOpacity>
            <Image
              source={{ uri: receiptImageUri }}
              style={{ width: '100%', height: '80%' }}
              resizeMode="contain"
            />
          </View>
        </Modal>
      ) : null}
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  summaryCard: {
    backgroundColor: Palette.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  summaryLabel: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryAmount: {
    ...Typography.display,
    fontSize: 26,
    fontWeight: '700',
    color: Palette.ink,
    flexShrink: 1,
  },
  amountLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  currencyTag: {
    backgroundColor: Palette.surfaceCard,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  currencyTagText: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: '700',
    color: Palette.muted,
  },
  amountTapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    minHeight: 44,
    marginTop: 2,
    marginBottom: 10,
  },
  amountErrorNote: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '600',
    color: Palette.error,
    marginBottom: 8,
  },
  noWalletNotice: {
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Palette.hairline,
    marginBottom: 16,
  },
  noWalletNoticeText: {
    ...Typography.body,
    fontSize: 13,
    color: Palette.muted,
    lineHeight: 18,
    marginBottom: 12,
  },
  noWalletBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.primary,
    paddingVertical: 12,
    borderRadius: 12,
    minHeight: 44,
  },
  noWalletBtnText: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: '600',
    color: Palette.white,
  },
  confirmBtnDisabled: {
    opacity: 0.45,
  },
  divider: {
    height: 1,
    backgroundColor: Palette.hairline,
    marginBottom: 12,
  },
  merchantEditBox: {
    marginBottom: 12,
  },
  merchantLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  tapToEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tapToEditHint: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.primary,
    fontWeight: '600',
  },
  merchantInput: {
    backgroundColor: Palette.white,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Palette.hairline,
    ...Typography.body,
    fontSize: 15,
    fontWeight: '600',
    color: Palette.ink,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  metaLabel: {
    ...Typography.caption,
    fontSize: 13,
    color: Palette.muted,
  },
  metaValue: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '500',
    color: Palette.ink,
  },
  sectionTitle: {
    ...Typography.label,
    color: Palette.muted,
    marginBottom: 8,
    marginTop: 6,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 8,
  },
  sectionHeaderLabel: {
    ...Typography.label,
    color: Palette.muted,
  },
  sectionHeaderAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: Palette.tintExpense,
    borderWidth: 1,
    borderColor: Palette.tintExpenseBorder,
  },
  sectionHeaderActionText: {
    ...Typography.caption,
    fontSize: 11.5,
    fontWeight: '600',
    color: Palette.primary,
  },
  gridBlock: {
    gap: 8,
  },
  gridRow2Col: {
    flexDirection: 'row',
    gap: 8,
  },
  gridRow3Col: {
    flexDirection: 'row',
    gap: 8,
  },
  gridCol: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
  },
  gridSlotEmpty: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
  },
  selectorListCard: {
    backgroundColor: Palette.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Palette.hairline,
    overflow: 'hidden',
  },
  selectorListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 58,
    paddingHorizontal: 13,
    gap: 10,
    backgroundColor: Palette.white,
  },
  selectorListRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.hairline,
  },
  selectorListRowActive: {
    backgroundColor: Palette.tintExpense,
  },
  selectorRowIconBox: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: Palette.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  selectorRowIconBoxActive: {
    backgroundColor: Palette.primary,
  },
  selectorRowCenter: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  selectorRowName: {
    ...Typography.body,
    fontSize: 13.5,
    lineHeight: 17,
    fontWeight: '600',
    color: Palette.ink,
  },
  selectorRowNameActive: {
    color: Palette.primary,
    fontWeight: '700',
  },
  selectorRowMeta: {
    ...Typography.caption,
    fontSize: 11,
    lineHeight: 14,
    color: Palette.muted,
    marginTop: 1,
  },
  selectorRowRight: {
    maxWidth: '42%',
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexShrink: 0,
  },
  selectorRowBalance: {
    ...Typography.mono,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '600',
    color: Palette.bodyStrong,
    textAlign: 'right',
  },
  selectorRowBalanceActive: {
    color: Palette.primaryActive,
    fontWeight: '700',
  },
  selectorRowRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: Palette.hairline,
    backgroundColor: Palette.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  selectorRowRadioActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  categorySquareTile: {
    flex: 1,
    width: '100%',
    minWidth: 0,
    minHeight: 74,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: Palette.white,
    borderWidth: 1,
    borderColor: Palette.hairline,
    overflow: 'hidden',
  },
  categorySquareIconBox: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
  },
  categorySquareLabel: {
    ...Typography.caption,
    fontSize: 11,
    lineHeight: 13.5,
    fontWeight: '500',
    color: Palette.bodyStrong,
    textAlign: 'center',
    width: '100%',
  },
  categorySquareLabelActive: {
    color: Palette.ink,
    fontWeight: '700',
  },
  requiredStar: {
    color: Palette.primary,
    fontWeight: '700',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: Palette.surfaceSoft,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  chipActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  chipText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '500',
    color: Palette.ink,
  },
  chipTextActive: {
    color: Palette.white,
  },
  addChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Palette.hairline,
    borderStyle: 'dashed',
  },
  addChipText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '500',
    color: Palette.primary,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.hairline,
  },
  itemName: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '500',
    color: Palette.ink,
  },
  itemQty: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
    marginTop: 2,
  },
  itemTotal: {
    ...Typography.mono,
    fontSize: 13,
    fontWeight: '600',
    color: Palette.ink,
  },
  textInputBox: {
    ...Typography.body,
    fontSize: 14,
    backgroundColor: Palette.white,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Palette.hairline,
    color: Palette.ink,
    marginTop: 6,
    marginBottom: 8,
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
});
