import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Building2,
  Banknote,
  Plus,
  Trash2,
  ArrowUpDown,
  CreditCard,
  Layers,
  Edit3,
  SlidersHorizontal,
  Check,
} from 'lucide-react-native';
import { Palette, Typography } from '../../theme/tokens';
import { Wallet, Pocket, Transaction } from '../../types';
import { formatCurrency, parseAmount, formatCurrencyInput } from '../../utils/formatters';
import { AppHaptics } from '../../utils/haptics';
import { ModalHeader } from '../ModalHeader';
import { CategoryIcon } from '../CategoryIcon';
import { TransactionItemRow } from '../TransactionItemRow';
import { BottomSheetModal } from '../BottomSheetModal';

interface AccountDetailModalProps {
  wallet: Wallet | null;
  pockets: Pocket[];
  transactions: Transaction[];
  privacyMode: boolean;
  onRenameWallet: (walletId: string, newName: string) => Promise<void> | void;
  onAdjustWalletBalance: (walletId: string, newBalance: number) => Promise<void> | void;
  onOpenAddPocket: (w: Wallet) => void;
  onAdjustPocket: (pocket: Pocket, w: Wallet) => void;
  onDeletePocket: (pocket: Pocket) => void;
  onSelectTransaction: (tx: Transaction) => void;
  onDeleteWallet: (w: Wallet) => void;
  getCategoryIconName: (category: string) => string;
  getPocketName: (pocketId?: string) => string;
  onClose: () => void;
}

export const AccountDetailModal: React.FC<AccountDetailModalProps> = ({
  wallet: propWallet,
  pockets,
  transactions,
  privacyMode,
  onRenameWallet,
  onAdjustWalletBalance,
  onOpenAddPocket,
  onAdjustPocket,
  onDeletePocket,
  onSelectTransaction,
  onDeleteWallet,
  getCategoryIconName,
  getPocketName,
  onClose,
}) => {
  const insets = useSafeAreaInsets();

  const lastWalletRef = React.useRef<Wallet | null>(propWallet);
  if (propWallet) {
    lastWalletRef.current = propWallet;
  }
  const wallet = propWallet || lastWalletRef.current;

  const [isRenaming, setIsRenaming] = useState<boolean>(false);
  const [editName, setEditName] = useState<string>('');
  const [isAdjusting, setIsAdjusting] = useState<boolean>(false);
  const [adjustedBalanceText, setAdjustedBalanceText] = useState<string>('');

  useEffect(() => {
    if (propWallet) {
      setEditName(propWallet.name);
      setAdjustedBalanceText(formatCurrencyInput(String(propWallet.balance), propWallet.currency));
      setIsRenaming(false);
      setIsAdjusting(false);
    }
  }, [propWallet]);

  if (!wallet) return null;

  const allocatedSum = pockets.reduce((sum, p) => sum + p.balance, 0);
  const unallocatedBal = Math.max(wallet.balance - allocatedSum, 0);

  const handleSaveRename = async () => {
    const trimmed = editName.trim();
    if (!trimmed) {
      Alert.alert('Invalid Name', 'Account name cannot be empty.');
      return;
    }
    await onRenameWallet(wallet.id, trimmed);
    setIsRenaming(false);
  };

  const parsedAdjustedBalance = parseAmount(adjustedBalanceText, wallet.currency);
  const diffAmount = parsedAdjustedBalance - wallet.balance;

  const handleSaveAdjustment = async () => {
    if (isNaN(parsedAdjustedBalance) || parsedAdjustedBalance < 0) {
      Alert.alert('Invalid Balance', 'Please enter a valid non-negative amount.');
      return;
    }
    await onAdjustWalletBalance(wallet.id, parsedAdjustedBalance);
    setIsAdjusting(false);
  };

  return (
    <BottomSheetModal
      visible={!!propWallet}
      onClose={onClose}
      height="92%"
      maxHeight="94%"
    >
      <ModalHeader
        title={wallet.name}
        subtitle={`${wallet.currency} • ${wallet.type.toUpperCase()}${wallet.accountNumber ? ` • ${wallet.accountNumber}` : ''}`}
        onClose={onClose}
      />

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                styles.scrollContent,
                { paddingBottom: Math.max(insets.bottom, 20) + 20 },
              ]}
              keyboardShouldPersistTaps="handled"
            >
              {/* Master Account Balance Breakdown Card */}
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Total Balance</Text>
                <Text style={styles.summaryAmount}>
                  {formatCurrency(wallet.balance, wallet.currency, privacyMode)}
                </Text>

                <View style={styles.divider} />

                <View style={styles.splitRow}>
                  <View style={styles.splitCol}>
                    <Text style={styles.splitLabel}>Main</Text>
                    <Text style={[styles.splitValue, { color: Palette.ink }]}>
                      {formatCurrency(unallocatedBal, wallet.currency, privacyMode)}
                    </Text>
                  </View>

                  <View style={styles.splitDivider} />

                  <View style={styles.splitCol}>
                    <Text style={styles.splitLabel}>Allocated</Text>
                    <Text style={[styles.splitValue, { color: Palette.accentTeal }]}>
                      {formatCurrency(allocatedSum, wallet.currency, privacyMode)}
                    </Text>
                    <Text style={styles.splitSub}>
                      {pockets.length} Pocket{pockets.length === 1 ? '' : 's'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Account Management Actions (Rename & Adjust Balance) */}
              <View style={styles.accountActionRow}>
                <TouchableOpacity
                  style={[styles.accountActionBtn, isRenaming && styles.accountActionBtnActive]}
                  onPress={() => {
                    AppHaptics.light();
                    setIsAdjusting(false);
                    setIsRenaming((prev) => !prev);
                  }}
                  activeOpacity={0.7}
                >
                  <Edit3 size={15} color={isRenaming ? Palette.primary : Palette.ink} />
                  <Text
                    style={[
                      styles.accountActionBtnText,
                      isRenaming && styles.accountActionBtnTextActive,
                    ]}
                  >
                    Rename Account
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.accountActionBtn, isAdjusting && styles.accountActionBtnActive]}
                  onPress={() => {
                    AppHaptics.light();
                    setIsRenaming(false);
                    setIsAdjusting((prev) => !prev);
                  }}
                  activeOpacity={0.7}
                >
                  <SlidersHorizontal
                    size={15}
                    color={isAdjusting ? Palette.primary : Palette.ink}
                  />
                  <Text
                    style={[
                      styles.accountActionBtnText,
                      isAdjusting && styles.accountActionBtnTextActive,
                    ]}
                  >
                    Adjust Balance
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Inline Form: Rename Account */}
              {isRenaming && (
                <View style={styles.editCard}>
                  <View style={styles.editCardHeader}>
                    <Edit3 size={15} color={Palette.primary} />
                    <Text style={styles.editCardTitle}>Rename Account</Text>
                  </View>
                  <TextInput
                    style={styles.editInput}
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="Enter new account name"
                    placeholderTextColor={Palette.mutedSoft}
                    autoFocus={true}
                    returnKeyType="done"
                    onSubmitEditing={handleSaveRename}
                  />
                  <View style={styles.editActionRow}>
                    <TouchableOpacity
                      style={styles.cancelEditBtn}
                      onPress={() => setIsRenaming(false)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.cancelEditBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.saveEditBtn}
                      onPress={handleSaveRename}
                      activeOpacity={0.8}
                    >
                      <Check size={14} color={Palette.white} />
                      <Text style={styles.saveEditBtnText}>Save Name</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Inline Form: Adjust Balance */}
              {isAdjusting && (
                <View style={styles.editCard}>
                  <View style={styles.editCardHeader}>
                    <SlidersHorizontal size={15} color={Palette.primary} />
                    <Text style={styles.editCardTitle}>Adjust Account Balance</Text>
                  </View>
                  <Text style={styles.editCardDesc}>
                    Reconcile actual balance for {wallet.name}.
                  </Text>
                  <TextInput
                    style={styles.editInput}
                    value={adjustedBalanceText}
                    maxLength={wallet.currency === 'IDR' ? 17 : 20}
                    onChangeText={(t) => {
                      const formatted = formatCurrencyInput(t, wallet.currency);
                      if (formatted !== adjustedBalanceText) {
                        setAdjustedBalanceText(formatted);
                      }
                    }}
                    placeholder={wallet.currency === 'IDR' ? '0' : '0.00'}
                    placeholderTextColor={Palette.mutedSoft}
                    keyboardType={wallet.currency === 'IDR' ? 'number-pad' : 'decimal-pad'}
                    autoFocus={true}
                  />

                  {diffAmount !== 0 && (
                    <View style={styles.reconcileRow}>
                      <Text style={styles.reconcileLabel}>Adjustment Difference:</Text>
                      <Text
                        style={[
                          styles.reconcileValue,
                          { color: diffAmount > 0 ? Palette.success : Palette.error },
                        ]}
                      >
                        {diffAmount > 0 ? '+' : ''}
                        {formatCurrency(diffAmount, wallet.currency, privacyMode)}
                      </Text>
                    </View>
                  )}

                  {parsedAdjustedBalance < allocatedSum && (
                    <Text style={styles.warningText}>
                      Warning: New balance is less than allocated sub-accounts (
                      {formatCurrency(allocatedSum, wallet.currency)}).
                    </Text>
                  )}

                  <View style={styles.editActionRow}>
                    <TouchableOpacity
                      style={styles.cancelEditBtn}
                      onPress={() => setIsAdjusting(false)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.cancelEditBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.saveEditBtn}
                      onPress={handleSaveAdjustment}
                      activeOpacity={0.8}
                    >
                      <Check size={14} color={Palette.white} />
                      <Text style={styles.saveEditBtnText}>Save Balance</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Sub-Accounts / Pockets Header & Action */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  Pockets ({pockets.length})
                </Text>
              </View>

              <TouchableOpacity
                style={styles.addPocketBtn}
                onPress={() => onOpenAddPocket(wallet)}
                activeOpacity={0.85}
              >
                <Plus size={18} color={Palette.white} style={{ marginRight: 8 }} />
                <Text style={styles.addPocketBtnText}>
                  Add Pocket in {wallet.name}
                </Text>
              </TouchableOpacity>

              {/* Pockets List */}
              {pockets.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Layers size={28} color={Palette.mutedSoft} />
                  <Text style={styles.emptyTitle}>No Pocket Yet</Text>
                  <Text style={styles.emptyDesc}>
                    Allocate funds from {wallet.name} for budgets etc.
                  </Text>
                </View>
              ) : (
                pockets.map((p) => {
                  const progressPct =
                    p.targetAmount > 0
                      ? (p.balance / p.targetAmount) * 100
                      : wallet.balance > 0
                        ? (p.balance / wallet.balance) * 100
                        : 0;

                  return (
                    <View key={p.id} style={styles.pocketCard}>
                      <View style={styles.pocketTopRow}>
                        <View style={styles.pocketLeft}>
                          <View style={[styles.pocketIconBox, { backgroundColor: p.color }]}>
                            <CategoryIcon name={p.icon} size={18} color={Palette.white} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.pocketTitle}>{p.name}</Text>
                            <Text style={styles.pocketMeta}>
                              {p.targetAmount > 0
                                ? `Goal: ${formatCurrency(p.targetAmount, wallet.currency, privacyMode)}`
                                : `${progressPct.toFixed(0)}% of account`}
                            </Text>
                          </View>
                        </View>

                        <TouchableOpacity
                          style={styles.deletePocketBtn}
                          onPress={() => onDeletePocket(p)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Trash2 size={16} color={Palette.error} />
                        </TouchableOpacity>
                      </View>

                      <View style={styles.pocketMiddleRow}>
                        <Text style={styles.pocketCaption}>
                          {p.targetAmount > 0
                            ? `${Math.min(progressPct, 100).toFixed(0)}% reached`
                            : 'Allocated Balance'}
                        </Text>
                        <Text style={styles.pocketBalanceText}>
                          {formatCurrency(p.balance, wallet.currency, privacyMode)}
                        </Text>
                      </View>

                      <View style={styles.track}>
                        <View
                          style={[
                            styles.fill,
                            {
                              width: `${Math.min(Math.max(progressPct, 4), 100)}%`,
                              backgroundColor: p.color,
                            },
                          ]}
                        />
                      </View>

                      <TouchableOpacity
                        style={styles.adjustFundsBtn}
                        onPress={() => onAdjustPocket(p, wallet)}
                        activeOpacity={0.8}
                      >
                        <ArrowUpDown size={15} color={Palette.primary} style={{ marginRight: 6 }} />
                        <Text style={styles.adjustFundsText}>
                          Allocate or Release Funds
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}

              {/* Account Activity / Transactions */}
              <View style={[styles.sectionHeader, { marginTop: 20 }]}>
                <Text style={styles.sectionTitle}>
                  Activity ({transactions.length})
                </Text>
              </View>

              {transactions.length === 0 ? (
                <View style={styles.emptyCard}>
                  <CreditCard size={28} color={Palette.mutedSoft} />
                  <Text style={styles.emptyTitle}>No Transactions Yet</Text>
                  <Text style={styles.emptyDesc}>
                    Transactions linked to {wallet.name} will appear here.
                  </Text>
                </View>
              ) : (
                transactions.slice(0, 10).map((tx) => (
                  <TransactionItemRow
                    key={tx.id}
                    transaction={tx}
                    categoryIcon={getCategoryIconName(tx.category)}
                    pocketName={getPocketName(tx.pocketId)}
                    privacyMode={privacyMode}
                    onPress={onSelectTransaction}
                  />
                ))
              )}

              {/* Delete Account */}
              <TouchableOpacity
                style={styles.deleteAccountBtn}
                onPress={() => onDeleteWallet(wallet)}
                activeOpacity={0.8}
              >
                <Trash2 size={16} color={Palette.error} style={{ marginRight: 6 }} />
                <Text style={styles.deleteAccountText}>Delete Account</Text>
              </TouchableOpacity>
            </ScrollView>
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
    height: '92%',
    maxHeight: '94%',
    overflow: 'hidden',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  summaryCard: {
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  summaryLabel: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryAmount: {
    ...Typography.mono,
    fontSize: 22,
    fontWeight: '700',
    color: Palette.ink,
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: Palette.hairline,
    marginVertical: 12,
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  splitCol: {
    flex: 1,
  },
  splitDivider: {
    width: 1,
    height: 36,
    backgroundColor: Palette.hairline,
    marginHorizontal: 12,
  },
  splitLabel: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
  },
  splitValue: {
    ...Typography.mono,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  splitSub: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.mutedSoft,
    marginTop: 1,
  },
  sectionHeader: {
    marginBottom: 8,
  },
  sectionTitle: {
    ...Typography.subheading,
    fontSize: 15,
    fontWeight: '600',
    color: Palette.ink,
  },
  addPocketBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.primary,
    paddingVertical: 12,
    borderRadius: 14,
    marginBottom: 14,
  },
  addPocketBtnText: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: '600',
    color: Palette.white,
  },
  emptyCard: {
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginVertical: 8,
  },
  emptyTitle: {
    ...Typography.subheading,
    fontSize: 14,
    color: Palette.ink,
    marginTop: 8,
  },
  emptyDesc: {
    ...Typography.caption,
    fontSize: 12,
    color: Palette.muted,
    textAlign: 'center',
    marginTop: 4,
  },
  pocketCard: {
    backgroundColor: Palette.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  pocketTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  pocketLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  pocketIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  pocketTitle: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: '600',
    color: Palette.ink,
  },
  pocketMeta: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
    marginTop: 1,
  },
  deletePocketBtn: {
    padding: 6,
  },
  pocketMiddleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  pocketCaption: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
  },
  pocketBalanceText: {
    ...Typography.mono,
    fontSize: 14,
    fontWeight: '600',
    color: Palette.ink,
  },
  track: {
    height: 4,
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 10,
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
  adjustFundsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Palette.surfaceSoft,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  adjustFundsText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: Palette.primary,
  },
  deleteAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#FDF0ED',
    marginTop: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F9DCD5',
  },
  deleteAccountText: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: '600',
    color: Palette.error,
  },
  accountActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  accountActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Palette.white,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  accountActionBtnActive: {
    borderColor: Palette.primary,
    backgroundColor: '#EDF5FF',
  },
  accountActionBtnText: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '600',
    color: Palette.ink,
  },
  accountActionBtnTextActive: {
    color: Palette.primary,
  },
  editCard: {
    backgroundColor: Palette.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  editCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  editCardTitle: {
    ...Typography.heading,
    fontSize: 14,
    fontWeight: '700',
    color: Palette.ink,
  },
  editCardDesc: {
    ...Typography.caption,
    fontSize: 12,
    color: Palette.muted,
    marginBottom: 10,
  },
  editInput: {
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...Typography.body,
    fontSize: 15,
    color: Palette.ink,
    borderWidth: 1,
    borderColor: Palette.hairline,
    marginBottom: 10,
  },
  reconcileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  reconcileLabel: {
    ...Typography.caption,
    fontSize: 12,
    color: Palette.muted,
  },
  reconcileValue: {
    ...Typography.mono,
    fontSize: 13,
    fontWeight: '700',
  },
  warningText: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.error,
    marginBottom: 10,
  },
  editActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelEditBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Palette.surfaceSoft,
  },
  cancelEditBtnText: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '600',
    color: Palette.muted,
  },
  saveEditBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Palette.primary,
  },
  saveEditBtnText: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '700',
    color: Palette.white,
  },
});
