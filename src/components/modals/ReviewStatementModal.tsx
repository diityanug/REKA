import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Check,
  FileText,
  Plus,
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Wallet as WalletIcon,
  RefreshCw,
  History,
} from 'lucide-react-native';
import { Palette, Typography } from '../../theme/tokens';
import { Category, CurrencyType, Transaction, Wallet } from '../../types';
import {
  ExtractedStatementData,
  ExtractedStatementTx,
  markDuplicateStatementTransactions,
} from '../../services/statementScanner';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { AppHaptics } from '../../utils/haptics';
import { useSyncOnChange } from '../../hooks/useSyncOnChange';
import { useFooterKeyboardOffset } from '../../hooks/useKeyboardHeight';
import { KeyboardSafeContainer } from '../KeyboardSafeContainer';
import { BottomSheetModal } from '../BottomSheetModal';
import { ModalHeader } from '../ModalHeader';
import { CategoryIcon } from '../CategoryIcon';

interface ReviewStatementModalProps {
  visible: boolean;
  statementData: ExtractedStatementData | null;
  wallets: Wallet[];
  categories: Category[];
  existingTransactions: Transaction[];
  selectedWalletId: string;
  isAutoMatched: boolean;
  privacyMode: boolean;
  onSelectWallet: (walletId: string) => void;
  onOpenAddAccount: (prefillName?: string, prefillCurrency?: CurrencyType, prefillNumber?: string) => void;
  onConfirmImport: (
    selectedTxs: ExtractedStatementTx[],
    targetWalletId: string,
    updateWalletBalance: boolean
  ) => Promise<void>;
  onClose: () => void;
  getCategoryIconName: (category: string, type?: 'expense' | 'income') => string;
}

export const ReviewStatementModal: React.FC<ReviewStatementModalProps> = ({
  visible,
  statementData,
  wallets,
  categories,
  existingTransactions,
  selectedWalletId,
  isAutoMatched,
  privacyMode,
  onSelectWallet,
  onOpenAddAccount,
  onConfirmImport,
  onClose,
  getCategoryIconName,
}) => {
  const insets = useSafeAreaInsets();
  const footerKeyboardOffset = useFooterKeyboardOffset();
  const [items, setItems] = useState<ExtractedStatementTx[]>([]);
  const [updateBalance, setUpdateBalance] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [editingCatItemId, setEditingCatItemId] = useState<string | null>(null);

  useSyncOnChange([visible, statementData, selectedWalletId], () => {
    if (visible && statementData) {
      const marked = markDuplicateStatementTransactions(
        statementData.transactions,
        existingTransactions,
        selectedWalletId
      );
      setItems(marked);
      setEditingCatItemId(null);
    }
  });

  useSyncOnChange([visible], () => {
    if (visible) {
      setUpdateBalance(true);
      setSaving(false);
    }
  });

  const currency: CurrencyType = statementData?.currency || 'IDR';

  const eligibleWallets = useMemo(
    () => wallets.filter((w) => w.currency === currency),
    [wallets, currency]
  );

  const selectedWallet = useMemo(
    () => eligibleWallets.find((w) => w.id === selectedWalletId) || null,
    [eligibleWallets, selectedWalletId]
  );

  const selectedItems = useMemo(
    () => items.filter((it) => it.selected),
    [items]
  );

  const summary = useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;
    selectedItems.forEach((it) => {
      if (it.type === 'income') totalIncome += it.amount;
      else totalExpense += it.amount;
    });
    const netDelta = totalIncome - totalExpense;
    const duplicateCount = items.filter((it) => it.isDuplicate).length;
    return {
      totalIncome,
      totalExpense,
      netDelta,
      duplicateCount,
    };
  }, [selectedItems, items]);

  if (!statementData) return null;

  const toggleItemSelected = (id: string) => {
    AppHaptics.selection();
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, selected: !it.selected } : it))
    );
  };

  const toggleAllSelected = () => {
    AppHaptics.selection();
    const allSelected = items.every((it) => it.selected);
    setItems((prev) => prev.map((it) => ({ ...it, selected: !allSelected })));
  };

  const toggleItemType = (id: string) => {
    AppHaptics.selection();
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const nextType = it.type === 'expense' ? 'income' : 'expense';
        const matchingCats = categories.filter((c) => c.type === nextType);
        const nextCat = matchingCats[0]?.name || (nextType === 'income' ? 'Salary' : 'Shopping');
        return {
          ...it,
          type: nextType,
          category: nextCat,
        };
      })
    );
  };

  const updateItemMerchant = (id: string, merchantName: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, merchantName } : it))
    );
  };

  const updateItemCategory = (id: string, category: string) => {
    AppHaptics.selection();
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, category } : it))
    );
    setEditingCatItemId(null);
  };

  const handleConfirm = async () => {
    if (saving || selectedItems.length === 0 || !selectedWallet) return;
    try {
      setSaving(true);
      AppHaptics.heavy();
      await onConfirmImport(selectedItems, selectedWallet.id, updateBalance);
    } finally {
      setSaving(false);
    }
  };

  const projectedBalance = selectedWallet
    ? selectedWallet.balance + summary.netDelta
    : 0;

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      height="93%"
      maxHeight="95%"
    >
      <ModalHeader
        title={`e-Statement ${statementData.bankName}`}
        subtitle={
          statementData.periodLabel
            ? `${statementData.periodLabel} • ${items.length} Transactions`
            : `${items.length} Transactions Found (${currency})`
        }
        onClose={onClose}
      />

      <KeyboardSafeContainer
        contentContainerStyle={styles.scrollContent}
        extraBottomSpace={28}
        keyboardDismissMode="on-drag"
      >
        {/* 1. Target Account & Auto-Match Card */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionTopRow}>
            <View style={styles.sectionTitleRow}>
              <WalletIcon size={15} color={Palette.primary} />
              <Text style={styles.sectionTitle}>Target Account</Text>
            </View>
            {isAutoMatched && selectedWallet ? (
              <View style={styles.autoMatchBadge}>
                <Sparkles size={11} color={Palette.accentTeal} />
                <Text style={styles.autoMatchText} numberOfLines={1} textBreakStrategy="simple">
                  {`Auto-Matched:\u00A0${selectedWallet.name}\u00A0`}
                </Text>
              </View>
            ) : null}
          </View>

          {eligibleWallets.length === 0 ? (
            <View style={styles.noAccountBox}>
              <Text style={styles.noAccountText} textBreakStrategy="simple">
                {`No ${currency} account found to receive ${statementData.bankName} statement.`}
              </Text>
              <TouchableOpacity
                style={styles.createAccBtn}
                onPress={() => {
                  AppHaptics.light();
                  onOpenAddAccount(
                    statementData.bankName,
                    currency,
                    statementData.accountNumber
                  );
                }}
                activeOpacity={0.85}
              >
                <Plus size={15} color={Palette.white} />
                <Text style={styles.createAccBtnText} numberOfLines={1} textBreakStrategy="simple">
                  {`Create\u00A0${(statementData.bankName || 'Bank').replace(/\s+/g, '\u00A0')}\u00A0Account\u00A0`}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.walletChipsRow}
            >
              {eligibleWallets.map((w) => {
                const isSelected = w.id === selectedWalletId;
                return (
                  <TouchableOpacity
                    key={w.id}
                    style={[
                      styles.walletChip,
                      isSelected && styles.walletChipActive,
                    ]}
                    onPress={() => {
                      AppHaptics.selection();
                      onSelectWallet(w.id);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.walletChipName,
                        isSelected && styles.walletChipTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {w.name}
                    </Text>
                    <Text
                      style={[
                        styles.walletChipBal,
                        isSelected && styles.walletChipTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {formatCurrency(w.balance, w.currency, privacyMode)}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                style={styles.addWalletChip}
                onPress={() => {
                  AppHaptics.light();
                  onOpenAddAccount(
                    statementData.bankName,
                    currency,
                    statementData.accountNumber
                  );
                }}
                activeOpacity={0.8}
              >
                <Plus size={14} color={Palette.primary} />
                <Text style={styles.addWalletChipText}>New Account</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>

        {/* 2. Balance Adjustment Mode Toggle */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Account Balance Effect</Text>
          <View style={styles.modeSegmentRow}>
            <TouchableOpacity
              style={[
                styles.modeSegmentBtn,
                updateBalance && styles.modeSegmentBtnActive,
              ]}
              onPress={() => {
                AppHaptics.selection();
                setUpdateBalance(true);
              }}
              activeOpacity={0.8}
            >
              <RefreshCw
                size={14}
                color={updateBalance ? Palette.white : Palette.ink}
              />
              <Text
                style={[
                  styles.modeSegmentText,
                  updateBalance && styles.modeSegmentTextActive,
                ]}
              >
                Adjust Balance
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modeSegmentBtn,
                !updateBalance && styles.modeSegmentBtnActive,
              ]}
              onPress={() => {
                AppHaptics.selection();
                setUpdateBalance(false);
              }}
              activeOpacity={0.8}
            >
              <History
                size={14}
                color={!updateBalance ? Palette.white : Palette.ink}
              />
              <Text
                style={[
                  styles.modeSegmentText,
                  !updateBalance && styles.modeSegmentTextActive,
                ]}
              >
                History Only
              </Text>
            </TouchableOpacity>
          </View>

          {selectedWallet ? (
            <View style={styles.balancePreviewBar}>
              {updateBalance ? (
                <>
                  <Text style={styles.balancePreviewLabel}>
                    {selectedWallet.name} Balance:{' '}
                    <Text style={styles.balancePreviewBold}>
                      {formatCurrency(selectedWallet.balance, currency, privacyMode)}
                    </Text>
                    {'  →  '}
                    <Text
                      style={[
                        styles.balancePreviewBold,
                        {
                          color:
                            projectedBalance < 0
                              ? Palette.error
                              : Palette.accentTeal,
                        },
                      ]}
                    >
                      {formatCurrency(projectedBalance, currency, privacyMode)}
                    </Text>
                  </Text>
                </>
              ) : (
                <Text style={styles.balancePreviewLabel}>
                  {selectedWallet.name} balance remains{' '}
                  <Text style={styles.balancePreviewBold}>
                    {formatCurrency(selectedWallet.balance, currency, privacyMode)}
                  </Text>{' '}
                  (only records {selectedItems.length} transactions to history).
                </Text>
              )}
            </View>
          ) : null}
        </View>

        {/* 3. Summary Flow Metrics */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryBox, { backgroundColor: '#EAF8ED' }]}>
            <View style={styles.summaryBoxHeader}>
              <TrendingUp size={13} color={Palette.success} />
              <Text style={styles.summaryBoxLabel}>Inflow</Text>
            </View>
            <Text style={[styles.summaryBoxVal, { color: Palette.success }]} numberOfLines={1}>
              +{formatCurrency(summary.totalIncome, currency)}
            </Text>
          </View>

          <View style={[styles.summaryBox, { backgroundColor: '#FDF2F2' }]}>
            <View style={styles.summaryBoxHeader}>
              <TrendingDown size={13} color={Palette.error} />
              <Text style={styles.summaryBoxLabel}>Outflow</Text>
            </View>
            <Text style={[styles.summaryBoxVal, { color: Palette.error }]} numberOfLines={1}>
              -{formatCurrency(summary.totalExpense, currency)}
            </Text>
          </View>
        </View>

        {/* 4. Transactions List Header */}
        <View style={styles.listHeaderRow}>
          <View style={styles.listHeaderLeft}>
            <FileText size={15} color={Palette.ink} />
            <Text style={styles.listHeaderTitle}>
              Transactions ({selectedItems.length}/{items.length} selected)
            </Text>
          </View>
          <TouchableOpacity onPress={toggleAllSelected} activeOpacity={0.7}>
            <Text style={styles.selectAllText}>
              {items.every((it) => it.selected) ? 'Deselect All' : 'Select All'}
            </Text>
          </TouchableOpacity>
        </View>

        {summary.duplicateCount > 0 ? (
          <View style={styles.duplicateNotice}>
            <AlertCircle size={14} color="#B45309" />
            <Text style={styles.duplicateNoticeText}>
              {summary.duplicateCount} transactions already exist in history and are unchecked by default.
            </Text>
          </View>
        ) : null}

        {/* 5. Individual Transaction Cards */}
        {items.map((item, idx) => {
          const isEditingCat = editingCatItemId === item.id;
          const typeCategories = categories.filter((c) => c.type === item.type);
          const iconName = getCategoryIconName(item.category, item.type);

          return (
            <View
              key={item.id}
              style={[
                styles.txCard,
                !item.selected && styles.txCardUnselected,
              ]}
            >
              {/* Row 1: Checkbox, Category Icon, Merchant Name & Amount */}
              <View style={styles.txCardTopRow}>
                {/* Checkbox */}
                <TouchableOpacity
                  style={[
                    styles.checkbox,
                    item.selected && styles.checkboxChecked,
                  ]}
                  onPress={() => toggleItemSelected(item.id)}
                  activeOpacity={0.75}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: item.selected }}
                >
                  {item.selected ? (
                    <Check size={14} color={Palette.white} strokeWidth={2.6} />
                  ) : null}
                </TouchableOpacity>

                {/* Category Icon */}
                <TouchableOpacity
                  style={styles.catIconBox}
                  onPress={() => {
                    AppHaptics.selection();
                    setEditingCatItemId(isEditingCat ? null : item.id);
                  }}
                  activeOpacity={0.75}
                >
                  <CategoryIcon
                    name={iconName}
                    size={18}
                    color={
                      item.type === 'income' ? Palette.success : Palette.primary
                    }
                  />
                </TouchableOpacity>

                {/* Merchant Name & Date */}
                <View style={styles.txMainCol}>
                  <TextInput
                    style={styles.merchantInput}
                    value={item.merchantName}
                    onChangeText={(txt) => updateItemMerchant(item.id, txt)}
                    placeholder="Transaction Name"
                    placeholderTextColor={Palette.mutedSoft}
                  />
                  <Text style={styles.txDateText}>
                    #{idx + 1} • {formatDate(item.transactionDate)}
                  </Text>
                </View>

                {/* Amount on the right */}
                <View style={styles.txRightCol}>
                  <Text
                    style={[
                      styles.txAmountText,
                      {
                        color:
                          item.type === 'income'
                            ? Palette.success
                            : Palette.error,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {item.type === 'income' ? '+' : '-'}
                    {formatCurrency(item.amount, currency)}
                  </Text>
                </View>
              </View>

              {/* Row 2: Category Pill & Inflow/Outflow Toggle */}
              <View style={styles.txMetaPillRow}>
                <TouchableOpacity
                  style={styles.categoryPill}
                  onPress={() => {
                    AppHaptics.selection();
                    setEditingCatItemId(isEditingCat ? null : item.id);
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={styles.categoryPillLabel}>Category: </Text>
                  <Text style={styles.categoryPillText} numberOfLines={1}>
                    {item.category} ▾
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.typeBadge,
                    item.type === 'income'
                      ? styles.typeBadgeIncome
                      : styles.typeBadgeExpense,
                  ]}
                  onPress={() => toggleItemType(item.id)}
                  activeOpacity={0.75}
                >
                  <View
                    style={[
                      styles.typeDot,
                      {
                        backgroundColor:
                          item.type === 'income'
                            ? Palette.success
                            : Palette.error,
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.typeBadgeText,
                      {
                        color:
                          item.type === 'income'
                            ? Palette.success
                            : Palette.error,
                      },
                    ]}
                  >
                    {item.type === 'income' ? 'Inflow' : 'Outflow'}
                  </Text>
                </TouchableOpacity>
              </View>

              {item.isDuplicate ? (
                <View style={styles.dupRowBadge}>
                  <AlertCircle size={13} color="#B45309" />
                  <Text style={styles.dupRowText}>
                    Similar transaction already exists for this date and amount
                  </Text>
                </View>
              ) : null}

              {/* Inline Category Picker when user taps Category Pill */}
              {isEditingCat ? (
                <View style={styles.inlineCatPickerContainer}>
                  <Text style={styles.inlineCatPickerTitle}>Select Category:</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.inlineCatList}
                  >
                    {typeCategories.map((cat) => {
                      const active =
                        cat.name.toLowerCase() === item.category.toLowerCase();
                      return (
                        <TouchableOpacity
                          key={cat.id}
                          style={[
                            styles.inlineCatChip,
                            active && styles.inlineCatChipActive,
                          ]}
                          onPress={() => updateItemCategory(item.id, cat.name)}
                          activeOpacity={0.8}
                        >
                          <Text
                            style={[
                              styles.inlineCatChipText,
                              active && styles.inlineCatChipTextActive,
                            ]}
                          >
                            {cat.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}
            </View>
          );
        })}
      </KeyboardSafeContainer>

      {/* Sticky Footer Action */}
      <View
        style={[
          styles.stickyFooter,
          { paddingBottom: Math.max(insets.bottom, 14) + footerKeyboardOffset },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.confirmBtn,
            (saving || selectedItems.length === 0 || !selectedWallet) &&
              styles.confirmBtnDisabled,
          ]}
          disabled={saving || selectedItems.length === 0 || !selectedWallet}
          onPress={handleConfirm}
          activeOpacity={0.85}
        >
          {saving ? (
            <>
              <ActivityIndicator
                size="small"
                color={Palette.white}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.confirmBtnText}>Saving Transactions...</Text>
            </>
          ) : (
            <>
              <Check size={18} color={Palette.white} style={{ marginRight: 8 }} />
              <Text style={styles.confirmBtnText} numberOfLines={1}>
                {selectedWallet
                  ? `Save ${selectedItems.length} Transaction${selectedItems.length === 1 ? '' : 's'} to ${selectedWallet.name}`
                  : 'Select Target Account First'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  sectionCard: {
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: Palette.hairline,
    marginBottom: 16,
  },
  sectionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    flexWrap: 'wrap',
    gap: 8,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  sectionTitle: {
    ...Typography.subheading,
    fontSize: 14,
    fontWeight: '700',
    color: Palette.ink,
  },
  autoMatchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#E6F5F3',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#B8E2DC',
  },
  autoMatchText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: Palette.accentTeal,
  },
  walletChipsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
  },
  walletChip: {
    backgroundColor: Palette.white,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: Palette.hairline,
    minWidth: 135,
  },
  walletChipActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  walletChipName: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: '700',
    color: Palette.ink,
  },
  walletChipBal: {
    ...Typography.caption,
    fontSize: 12,
    color: Palette.muted,
    marginTop: 3,
  },
  walletChipTextActive: {
    color: Palette.white,
  },
  addWalletChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#FDF0ED',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Palette.primary,
  },
  addWalletChipText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '700',
    color: Palette.primary,
  },
  noAccountBox: {
    alignItems: 'flex-start',
    gap: 10,
  },
  noAccountText: {
    ...Typography.body,
    fontSize: 13,
    lineHeight: 18,
    color: Palette.muted,
  },
  createAccBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Palette.primary,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    marginTop: 2,
  },
  createAccBtnText: {
    ...Typography.caption,
    fontSize: 13,
    fontWeight: '700',
    color: Palette.white,
  },
  modeSegmentRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  modeSegmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 13,
    backgroundColor: Palette.white,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  modeSegmentBtnActive: {
    backgroundColor: Palette.surfaceDark,
    borderColor: Palette.surfaceDark,
  },
  modeSegmentText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '700',
    color: Palette.ink,
  },
  modeSegmentTextActive: {
    color: Palette.white,
  },
  balancePreviewBar: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Palette.hairline,
  },
  balancePreviewLabel: {
    ...Typography.caption,
    fontSize: 13,
    lineHeight: 19,
    color: Palette.muted,
  },
  balancePreviewBold: {
    fontWeight: '700',
    color: Palette.ink,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  summaryBox: {
    flex: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  summaryBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  summaryBoxLabel: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: Palette.muted,
  },
  summaryBoxVal: {
    ...Typography.body,
    fontSize: 16,
    fontWeight: '800',
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  listHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  listHeaderTitle: {
    ...Typography.subheading,
    fontSize: 15,
    fontWeight: '700',
    color: Palette.ink,
  },
  selectAllText: {
    ...Typography.caption,
    fontSize: 13,
    fontWeight: '700',
    color: Palette.primary,
  },
  duplicateNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  duplicateNoticeText: {
    ...Typography.caption,
    fontSize: 12,
    lineHeight: 16,
    color: '#92400E',
    flex: 1,
  },
  txCard: {
    backgroundColor: Palette.white,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: Palette.hairline,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  txCardUnselected: {
    opacity: 0.55,
    backgroundColor: Palette.surfaceSoft,
  },
  txCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Palette.mutedSoft,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.white,
  },
  checkboxChecked: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  catIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Palette.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txMainCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  merchantInput: {
    ...Typography.body,
    fontSize: 15,
    fontWeight: '700',
    color: Palette.ink,
    padding: 0,
    margin: 0,
    minHeight: 22,
  },
  txDateText: {
    ...Typography.caption,
    fontSize: 12,
    color: Palette.muted,
    marginTop: 3,
  },
  txRightCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingLeft: 6,
  },
  txAmountText: {
    ...Typography.body,
    fontSize: 15,
    fontWeight: '800',
  },
  txMetaPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Palette.hairlineSoft,
    gap: 8,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.surfaceSoft,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Palette.hairline,
    maxWidth: '65%',
  },
  categoryPillLabel: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
  },
  categoryPillText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: Palette.ink,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  typeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  typeBadgeIncome: {
    backgroundColor: '#EAF8ED',
  },
  typeBadgeExpense: {
    backgroundColor: '#FDF2F2',
  },
  typeBadgeText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '700',
  },
  dupRowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  dupRowText: {
    ...Typography.caption,
    fontSize: 11,
    color: '#92400E',
    flex: 1,
  },
  inlineCatPickerContainer: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Palette.hairline,
  },
  inlineCatPickerTitle: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: Palette.muted,
    marginBottom: 8,
  },
  inlineCatList: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  inlineCatChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor: Palette.surfaceSoft,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  inlineCatChipActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  inlineCatChipText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: Palette.ink,
  },
  inlineCatChipTextActive: {
    color: Palette.white,
  },
  stickyFooter: {
    backgroundColor: Palette.white,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.hairline,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 8,
  },
  confirmBtn: {
    height: 52,
    borderRadius: 16,
    backgroundColor: Palette.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
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
