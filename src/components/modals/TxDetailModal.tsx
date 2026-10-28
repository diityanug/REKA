import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Trash2,
  Pencil,
  Copy,
  ArrowDown,
  Building2,
  Smartphone,
  Banknote,
  TrendingUp,
  CreditCard,
} from 'lucide-react-native';
import { ContactlessCardIcon } from '../icons/ContactlessCardIcon';
import { Palette, Typography } from '../../theme/tokens';
import { Transaction, TransactionItem, Wallet } from '../../types';
import { getTransactionItems } from '../../services/database';
import { useLastDefined } from '../../hooks/useLastDefined';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { ModalHeader } from '../ModalHeader';
import { CategoryIcon } from '../CategoryIcon';
import { BottomSheetModal } from '../BottomSheetModal';

interface TxDetailModalProps {
  transaction: Transaction | null;
  categoryIcon: string;
  pocketName?: string;
  wallets?: Wallet[];
  privacyMode: boolean;
  onEdit: (tx: Transaction) => void;
  onDuplicate: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
  onClose: () => void;
}

const AccountIcon: React.FC<{ type?: string; size: number; color: string }> = ({
  type,
  size,
  color,
}) => {
  const t = (type || '').toLowerCase();
  if (t === 'e-wallet' || t === 'ewallet') return <Smartphone size={size} color={color} />;
  if (t === 'cash') return <Banknote size={size} color={color} />;
  if (t === 'investment') return <TrendingUp size={size} color={color} />;
  if (t === 'credit card' || t === 'creditcard') return <CreditCard size={size} color={color} />;
  if (t === 'e-money' || t === 'emoney') return <ContactlessCardIcon size={size} color={color} />;
  return <Building2 size={size} color={color} />;
};

export const TxDetailModal: React.FC<TxDetailModalProps> = ({
  transaction: tx,
  categoryIcon,
  pocketName,
  wallets = [],
  privacyMode,
  onEdit,
  onDuplicate,
  onDelete,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const currentTx = useLastDefined(tx);
  const currentCategoryIcon = useLastDefined(
    categoryIcon && categoryIcon !== 'HelpCircle' ? categoryIcon : undefined
  ) ?? (categoryIcon && categoryIcon !== 'HelpCircle' ? categoryIcon : 'CircleEllipsis');
  const currentPocketName = useLastDefined(pocketName);

  // Receipt line items are loaded on demand (kept out of the global transaction list to save memory)
  const [loadedItems, setLoadedItems] = useState<{ txId: string; items: TransactionItem[] } | null>(
    null
  );
  const activeTxId = tx?.id;
  useEffect(() => {
    if (!activeTxId) return;
    let cancelled = false;
    getTransactionItems(activeTxId)
      .then((items) => {
        if (!cancelled) setLoadedItems({ txId: activeTxId, items });
      })
      .catch(() => {
        if (!cancelled) setLoadedItems({ txId: activeTxId, items: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [activeTxId]);

  if (!currentTx) return null;

  const txItems = loadedItems && loadedItems.txId === currentTx.id ? loadedItems.items : [];

  const isExpense = currentTx.type === 'expense';
  const isTransfer =
    currentTx.category === 'Transfer' ||
    currentTx.paymentMethod === 'Transfer' ||
    /^Transfer (to|from)\s+/i.test(currentTx.merchantName);

  const currentWallet = wallets.find((w) => w.id === currentTx.walletId);
  const currentWalletName = currentWallet?.name || 'Account';

  let fromAccountName = '';
  let toAccountName = '';
  let fromWallet: Wallet | undefined;
  let toWallet: Wallet | undefined;

  if (isTransfer) {
    const toMatch = currentTx.merchantName.match(/^(.+?)\s+to\s+(.+)$/i);
    if (toMatch && !currentTx.merchantName.toLowerCase().startsWith('transfer to')) {
      fromAccountName = toMatch[1].trim();
      toAccountName = toMatch[2].trim();
      fromWallet =
        wallets.find((w) => w.name.toLowerCase() === fromAccountName.toLowerCase()) ||
        (currentTx.type === 'expense' ? currentWallet : undefined);
      toWallet =
        wallets.find((w) => w.name.toLowerCase() === toAccountName.toLowerCase()) ||
        (currentTx.type === 'income' ? currentWallet : undefined);
    } else if (currentTx.type === 'expense') {
      fromAccountName = currentWalletName;
      fromWallet = currentWallet;
      toAccountName = currentTx.merchantName.replace(/^Transfer to\s+/i, '').trim();
      toWallet = wallets.find(
        (w) => w.name.toLowerCase() === toAccountName.toLowerCase()
      );
    } else {
      toAccountName = currentWalletName;
      toWallet = currentWallet;
      fromAccountName = currentTx.merchantName.replace(/^Transfer from\s+/i, '').trim();
      fromWallet = wallets.find(
        (w) => w.name.toLowerCase() === fromAccountName.toLowerCase()
      );
    }
  }

  const isCrossCurrency = !!(fromWallet && toWallet && fromWallet.currency !== toWallet.currency);

  return (
    <BottomSheetModal
      visible={!!tx}
      onClose={onClose}
      maxHeight="88%"
    >
      <ModalHeader
        title={
          isTransfer
            ? (fromAccountName && toAccountName
                ? `${fromAccountName} to ${toAccountName}`
                : 'Fund Transfer')
            : currentTx.merchantName
        }
        subtitle={formatDateTime(currentTx.timestamp)}
        onClose={onClose}
      />

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) + 12 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Hero Amount Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryTopRow}>
            <Text style={styles.summaryLabel}>
              {isTransfer
                ? (isExpense ? 'Transferred Out' : 'Transferred In')
                : 'Total Amount'}
            </Text>
          </View>

          <Text
            style={[
              styles.summaryAmount,
              {
                color: isTransfer
                  ? Palette.ink
                  : isExpense
                    ? Palette.error
                    : Palette.success,
              },
            ]}
          >
            {privacyMode
              ? '••••••'
              : `${isExpense ? '- ' : '+ '}${formatCurrency(Math.abs(currentTx.amount), currentTx.currency, false)}`}
          </Text>
        </View>

        {/* 2. Transfer Route (Clean Vertical Timeline Step - Full Width) */}
        {isTransfer && (
          <View style={styles.routeCard}>
            {/* Step 1: Source (From) */}
            <View style={styles.routeStep}>
              <View style={[styles.routeIconBox, { backgroundColor: '#FDF0ED' }]}>
                <AccountIcon type={fromWallet?.type} size={18} color={Palette.primary} />
              </View>
              <View style={styles.routeInfo}>
                <Text style={styles.routeRole}>From Account</Text>
                <Text style={styles.routeName} numberOfLines={1}>
                  {fromAccountName || 'Source Account'}
                </Text>
                <Text style={styles.routeMeta}>
                  {fromWallet ? `${fromWallet.type} • ${fromWallet.currency}` : 'Account'}
                  {fromWallet?.accountNumber ? ` • ${fromWallet.accountNumber}` : ''}
                </Text>
              </View>
            </View>

            {/* Vertical Connector Track with Downward Arrow */}
            <View style={styles.connectorRow}>
              <View style={styles.connectorTrack}>
                <View style={styles.connectorLine} />
                <View style={styles.connectorArrowPill}>
                  <ArrowDown size={11} color={Palette.muted} />
                </View>
                <View style={styles.connectorLine} />
              </View>
              {isCrossCurrency && (
                <View style={styles.fxBadge}>
                  <Text style={styles.fxBadgeText}>Cross-Currency FX</Text>
                </View>
              )}
            </View>

            {/* Step 2: Destination (To) */}
            <View style={styles.routeStep}>
              <View style={[styles.routeIconBox, { backgroundColor: '#EBF7F4' }]}>
                <AccountIcon type={toWallet?.type} size={18} color={Palette.accentTeal} />
              </View>
              <View style={styles.routeInfo}>
                <Text style={styles.routeRole}>To Account</Text>
                <Text style={styles.routeName} numberOfLines={1}>
                  {toAccountName || 'Destination Account'}
                </Text>
                <Text style={styles.routeMeta}>
                  {toWallet ? `${toWallet.type} • ${toWallet.currency}` : 'Account'}
                  {toWallet?.accountNumber ? ` • ${toWallet.accountNumber}` : ''}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* 3. Transaction Details Card */}
        <View style={styles.detailsCard}>
          {isTransfer ? (
            <>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Transfer Type</Text>
                <Text style={styles.metaValue}>
                  {isCrossCurrency
                    ? `Cross-Currency (${fromWallet?.currency} → ${toWallet?.currency})`
                    : 'Internal Account Transfer'}
                </Text>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Date & Time</Text>
                <Text style={styles.metaValue}>{formatDateTime(currentTx.timestamp)}</Text>
              </View>

              {currentTx.notes ? (
                <View style={[styles.metaRow, { alignItems: 'flex-start' }]}>
                  <Text style={[styles.metaLabel, { marginTop: 1 }]}>Notes</Text>
                  <Text style={styles.metaValue}>
                    {currentTx.notes}
                  </Text>
                </View>
              ) : null}
            </>
          ) : (
            <>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Date & Time</Text>
                <Text style={styles.metaValue}>{formatDateTime(currentTx.timestamp)}</Text>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Account</Text>
                <Text style={styles.metaValue}>
                  {currentWalletName}{currentWallet ? ` (${currentWallet.currency})` : ''}
                </Text>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Category</Text>
                <View style={styles.categoryInline}>
                  <CategoryIcon name={currentCategoryIcon} size={15} color={Palette.ink} />
                  <Text style={styles.metaValue}>{currentTx.category}</Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Payment Method</Text>
                <Text style={styles.metaValue}>{currentTx.paymentMethod}</Text>
              </View>

              {currentPocketName ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Pocket</Text>
                  <Text style={styles.metaValue}>{currentPocketName}</Text>
                </View>
              ) : null}

              {currentTx.notes ? (
                <View style={[styles.metaRow, { alignItems: 'flex-start' }]}>
                  <Text style={[styles.metaLabel, { marginTop: 1 }]}>Notes</Text>
                  <Text style={styles.metaValue}>
                    {currentTx.notes}
                  </Text>
                </View>
              ) : null}
            </>
          )}
        </View>

        {/* 4. Optional Purchased Items List */}
        {txItems.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              Items ({txItems.length})
            </Text>
            {txItems.map((it) => (
              <View key={it.id} style={styles.itemCard}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.itemName}>{it.name}</Text>
                  <Text style={styles.itemQty}>
                    Qty: {it.quantity} ×{' '}
                    {formatCurrency(it.unitPrice, currentTx.currency, privacyMode)}
                  </Text>
                </View>
                <Text style={styles.itemTotal}>
                  {formatCurrency(it.totalPrice, currentTx.currency, privacyMode)}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* 5. Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          {!isTransfer ? (
            <View style={styles.topActionsRow}>
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => onEdit(currentTx)}
                activeOpacity={0.8}
              >
                <Pencil size={15} color={Palette.white} style={{ marginRight: 6 }} />
                <Text style={styles.editText}>Edit</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.duplicateBtn}
                onPress={() => onDuplicate(currentTx)}
                activeOpacity={0.8}
              >
                <Copy size={15} color={Palette.primary} style={{ marginRight: 6 }} />
                <Text style={styles.duplicateText}>Duplicate</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => onDelete(currentTx)}
            activeOpacity={0.8}
          >
            <Trash2 size={16} color={Palette.error} style={{ marginRight: 6 }} />
            <Text style={styles.deleteText}>
              {isTransfer ? 'Delete Transfer' : 'Delete Transaction'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  summaryCard: {
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
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
    fontSize: 24,
    fontWeight: '700',
  },
  routeCard: {
    backgroundColor: Palette.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  routeStep: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeIconBox: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  routeInfo: {
    flex: 1,
  },
  routeRole: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: '700',
    color: Palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  routeName: {
    ...Typography.body,
    fontSize: 15,
    fontWeight: '700',
    color: Palette.ink,
  },
  routeMeta: {
    ...Typography.caption,
    fontSize: 12,
    color: Palette.muted,
    marginTop: 1,
  },
  connectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
    marginVertical: 3,
  },
  connectorTrack: {
    width: 18,
    alignItems: 'center',
  },
  connectorLine: {
    width: 2,
    height: 6,
    backgroundColor: Palette.hairline,
  },
  connectorArrowPill: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Palette.surfaceSoft,
    borderWidth: 1,
    borderColor: Palette.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 1,
  },
  fxBadge: {
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FEF3C7',
    marginLeft: 14,
  },
  fxBadgeText: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: '700',
    color: '#92400E',
  },
  detailsCard: {
    backgroundColor: Palette.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
  },
  metaLabel: {
    ...Typography.caption,
    fontSize: 13,
    color: Palette.muted,
    width: 124,
    paddingRight: 8,
  },
  metaValue: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '600',
    color: Palette.ink,
    flex: 1,
    textAlign: 'left',
  },
  categoryInline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    ...Typography.subheading,
    fontSize: 14,
    fontWeight: '600',
    color: Palette.ink,
    marginBottom: 8,
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
  actionButtonsContainer: {
    marginTop: 10,
    gap: 10,
  },
  topActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  editBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: Palette.primary,
  },
  editText: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: '700',
    color: Palette.white,
  },
  duplicateBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: Palette.surfaceSoft,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  duplicateText: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: '700',
    color: Palette.primary,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: '#FDF0ED',
    borderWidth: 1,
    borderColor: '#F9DCD5',
  },
  deleteText: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: '600',
    color: Palette.error,
  },
});
