import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, Check, AlertCircle } from 'lucide-react-native';
import { Palette, Typography } from '../../theme/tokens';
import { AllocationPlan, Wallet, Pocket } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { AppHaptics } from '../../utils/haptics';
import { ModalHeader } from '../ModalHeader';
import { BottomSheetModal } from '../BottomSheetModal';
import { useSyncOnChange } from '../../hooks/useSyncOnChange';

interface ApplyAllocationPlanModalProps {
  visible: boolean;
  plan: AllocationPlan | null;
  wallets: Wallet[];
  pockets: Pocket[];
  getUnallocated: (walletId: string) => number;
  privacyMode: boolean;
  onApply: (
    walletId: string,
    distributions: { pocketId: string; amount: number }[]
  ) => Promise<boolean>;
  onClose: () => void;
}

export const ApplyAllocationPlanModal: React.FC<ApplyAllocationPlanModalProps> = ({
  visible,
  plan,
  wallets,
  pockets,
  getUnallocated,
  privacyMode,
  onApply,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const [selectedWalletId, setSelectedWalletId] = useState<string>('');
  const [pocketMappings, setPocketMappings] = useState<Record<string, string>>({});
  const [applying, setApplying] = useState<boolean>(false);

  const planCurrency = plan?.currency || 'IDR';

  // Wallets matching the plan currency
  const eligibleWallets = useMemo(() => {
    return wallets.filter((w) => w.currency === planCurrency);
  }, [wallets, planCurrency]);

  // Selected wallet object and its available unallocated funds
  const currentWallet = useMemo(() => {
    return eligibleWallets.find((w) => w.id === selectedWalletId) || eligibleWallets[0] || null;
  }, [eligibleWallets, selectedWalletId]);

  const unallocatedAmount = useMemo(() => {
    if (!currentWallet) return 0;
    return getUnallocated(currentWallet.id);
  }, [currentWallet, getUnallocated]);

  // Pockets under the selected wallet
  const walletPockets = useMemo(() => {
    if (!currentWallet) return [];
    return pockets.filter((p) => p.walletId === currentWallet.id);
  }, [pockets, currentWallet]);

  // Reset and auto-map on modal open or plan change
  useSyncOnChange([visible, plan?.id, currentWallet?.id], () => {
    if (visible && plan) {
      if (!selectedWalletId && eligibleWallets.length > 0) {
        setSelectedWalletId(eligibleWallets[0].id);
      }

      // Auto-match allocation item labels to pocket names (case-insensitive exact or substring match)
      const initialMap: Record<string, string> = {};
      const currentPockets = currentWallet
        ? pockets.filter((p) => p.walletId === currentWallet.id)
        : [];

      (plan.items || []).forEach((item) => {
        const itemLabelClean = item.label.trim().toLowerCase();
        const matched = currentPockets.find((p) => {
          const pocketNameClean = p.name.trim().toLowerCase();
          return (
            pocketNameClean === itemLabelClean ||
            itemLabelClean.includes(pocketNameClean) ||
            pocketNameClean.includes(itemLabelClean)
          );
        });
        if (matched) {
          initialMap[item.id] = matched.id;
        }
      });
      setPocketMappings(initialMap);
    }
  });

  const totalToAllocate = useMemo(() => {
    if (!plan) return 0;
    return (plan.items || []).reduce((sum, it) => {
      // Only count items that are mapped to a valid pocket
      if (pocketMappings[it.id]) {
        return sum + (it.amount || 0);
      }
      return sum;
    }, 0);
  }, [plan, pocketMappings]);

  const hasInsufficientFunds = currentWallet && totalToAllocate > unallocatedAmount + 0.005;
  const mappedCount = Object.keys(pocketMappings).filter((k) => !!pocketMappings[k]).length;

  const handleConfirm = async () => {
    if (!currentWallet || !plan || applying) return;
    if (hasInsufficientFunds || mappedCount === 0) return;

    const distributions = (plan.items || [])
      .map((it) => ({
        pocketId: pocketMappings[it.id] || '',
        amount: it.amount || 0,
      }))
      .filter((d) => d.pocketId && d.amount > 0);

    setApplying(true);
    try {
      const success = await onApply(currentWallet.id, distributions);
      if (success) {
        onClose();
      }
    } finally {
      setApplying(false);
    }
  };

  if (!plan) return null;

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      height="88%"
      maxHeight="92%"
    >
      <ModalHeader
        title="Apply Allocation Plan"
        subtitle={plan.title}
        onClose={onClose}
      />

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 20) + 70 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Source Account Selection */}
        <Text style={styles.sectionTitle}>Source Account</Text>
        <Text style={styles.sectionSubtitle}>Select the account to distribute unallocated funds from.</Text>

        {eligibleWallets.length === 0 ? (
          <View style={styles.noticeBox}>
            <AlertCircle size={15} color={Palette.error} />
            <Text style={styles.noticeText}>
              No accounts with {planCurrency} currency found.
            </Text>
          </View>
        ) : (
          <View style={styles.walletChipsContainer}>
            {eligibleWallets.map((w) => {
              const isSelected = (currentWallet?.id || '') === w.id;
              const unalloc = getUnallocated(w.id);
              return (
                <TouchableOpacity
                  key={w.id}
                  style={[
                    styles.walletChip,
                    isSelected && styles.walletChipSelected,
                  ]}
                  onPress={() => {
                    AppHaptics.selection();
                    setSelectedWalletId(w.id);
                  }}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={`Select account ${w.name?.trim() || 'Account'}`}
                >
                  <View style={styles.walletChipHeader}>
                    <Text
                      style={[
                        styles.walletChipName,
                        isSelected && styles.walletChipNameSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {w.name?.trim() || (w.type ? `${w.type} Account` : 'Account')}
                    </Text>
                    <View
                      style={[
                        styles.currencyTag,
                        isSelected && styles.currencyTagSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.currencyTagText,
                          isSelected && styles.currencyTagTextSelected,
                        ]}
                      >
                        {w.currency}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.walletUnallocatedLabel}>Unallocated Funds:</Text>
                  <Text
                    style={[
                      styles.walletUnallocatedValue,
                      isSelected && styles.walletUnallocatedValueSelected,
                    ]}
                  >
                    {formatCurrency(unalloc, w.currency, privacyMode)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Plan Items Mapping */}
        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Pocket Destinations</Text>
        <Text style={styles.sectionSubtitle}>
          Match each allocation item to a target pocket in {currentWallet?.name || 'this account'}.
        </Text>

        <View style={styles.mappingList}>
          {(plan.items || []).map((item) => {
            const mappedPocketId = pocketMappings[item.id] || '';
            const matchedPocket = walletPockets.find((p) => p.id === mappedPocketId);

            return (
              <View key={item.id} style={styles.mappingCard}>
                <View style={styles.itemHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemLabel}>{item.label}</Text>
                    <Text style={styles.itemAmount}>
                      {formatCurrency(item.amount, planCurrency, privacyMode)}
                    </Text>
                  </View>
                </View>

                {walletPockets.length === 0 ? (
                  <Text style={styles.noPocketsText}>No pockets exist in this account yet.</Text>
                ) : (
                  <View style={styles.pocketsSelectorRow}>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.pocketsSelectorContent}
                    >
                      {walletPockets.map((p) => {
                        const isAssigned = mappedPocketId === p.id;
                        return (
                          <TouchableOpacity
                            key={p.id}
                            style={[
                              styles.pocketSelectorChip,
                              isAssigned && {
                                backgroundColor: p.color || Palette.primary,
                                borderColor: p.color || Palette.primary,
                              },
                            ]}
                            onPress={() => {
                              AppHaptics.selection();
                              setPocketMappings((prev) => ({
                                ...prev,
                                [item.id]: isAssigned ? '' : p.id,
                              }));
                            }}
                            activeOpacity={0.75}
                          >
                            <Text
                              style={[
                                styles.pocketSelectorChipText,
                                isAssigned && styles.pocketSelectorChipTextActive,
                              ]}
                              numberOfLines={1}
                            >
                              {p.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

                {matchedPocket && (
                  <View style={styles.mappingSummaryRow}>
                    <ArrowRight size={13} color={Palette.muted} style={{ marginRight: 4 }} />
                    <Text style={styles.mappingSummaryText}>
                      Allocates to{' '}
                      <Text style={{ fontWeight: '700', color: Palette.ink }}>
                        {matchedPocket.name}
                      </Text>
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Total Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total to Distribute:</Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(totalToAllocate, planCurrency, privacyMode)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Available Unallocated:</Text>
            <Text
              style={[
                styles.summaryValue,
                { color: hasInsufficientFunds ? Palette.error : Palette.success },
              ]}
            >
              {formatCurrency(unallocatedAmount, planCurrency, privacyMode)}
            </Text>
          </View>

          {hasInsufficientFunds ? (
            <View style={styles.insufficientWarningBox}>
              <AlertCircle size={14} color={Palette.error} style={{ marginRight: 6 }} />
              <Text style={styles.insufficientWarningText}>
                Amount exceeds available unallocated funds by{' '}
                {formatCurrency(totalToAllocate - unallocatedAmount, planCurrency, privacyMode)}.
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Sticky Bottom Action */}
      <View style={[styles.stickyFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          style={[
            styles.confirmBtn,
            (hasInsufficientFunds || mappedCount === 0 || applying) && styles.confirmBtnDisabled,
          ]}
          onPress={handleConfirm}
          disabled={hasInsufficientFunds || mappedCount === 0 || applying}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Confirm and distribute funds to pockets"
        >
          {applying ? (
            <ActivityIndicator size="small" color={Palette.white} />
          ) : (
            <>
              <Check size={18} color={Palette.white} style={{ marginRight: 8 }} />
              <Text style={styles.confirmBtnText}>
                {mappedCount === 0 ? 'Select Target Pockets' : `Distribute (${mappedCount} Pockets)`}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  sectionTitle: {
    ...Typography.subheading,
    fontSize: 15,
    fontWeight: '700',
    color: Palette.ink,
  },
  sectionSubtitle: {
    ...Typography.caption,
    fontSize: 12,
    color: Palette.muted,
    marginTop: 2,
    marginBottom: 10,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  noticeText: {
    ...Typography.caption,
    fontSize: 12,
    color: Palette.error,
  },
  walletChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  walletChip: {
    flex: 1,
    minWidth: 140,
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: Palette.hairline,
  },
  walletChipSelected: {
    borderColor: Palette.primary,
    backgroundColor: '#F4F9F7',
  },
  walletChipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  walletChipName: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '700',
    color: Palette.ink,
    flex: 1,
  },
  walletChipNameSelected: {
    color: Palette.primary,
  },
  currencyTag: {
    backgroundColor: Palette.white,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Palette.hairline,
    marginLeft: 4,
  },
  currencyTagSelected: {
    borderColor: Palette.primary,
    backgroundColor: Palette.primary,
  },
  currencyTagText: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: '700',
    color: Palette.muted,
  },
  currencyTagTextSelected: {
    color: Palette.white,
  },
  walletUnallocatedLabel: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
  },
  walletUnallocatedValue: {
    ...Typography.mono,
    fontSize: 13,
    fontWeight: '700',
    color: Palette.ink,
    marginTop: 2,
  },
  walletUnallocatedValueSelected: {
    color: Palette.primary,
  },
  mappingList: {
    gap: 10,
  },
  mappingCard: {
    backgroundColor: Palette.white,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  itemHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemLabel: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '600',
    color: Palette.ink,
  },
  itemAmount: {
    ...Typography.mono,
    fontSize: 13,
    fontWeight: '700',
    color: Palette.primary,
    marginTop: 2,
  },
  noPocketsText: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
    fontStyle: 'italic',
  },
  pocketsSelectorRow: {
    marginTop: 2,
  },
  pocketsSelectorContent: {
    gap: 6,
    paddingVertical: 2,
  },
  pocketSelectorChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Palette.surfaceSoft,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  pocketSelectorChipText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '600',
    color: Palette.ink,
  },
  pocketSelectorChipTextActive: {
    color: Palette.white,
  },
  mappingSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.hairline,
  },
  mappingSummaryText: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
  },
  summaryCard: {
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 14,
    padding: 14,
    marginTop: 18,
    borderWidth: 1,
    borderColor: Palette.hairline,
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: Palette.muted,
  },
  summaryValue: {
    ...Typography.mono,
    fontSize: 14,
    fontWeight: '700',
    color: Palette.ink,
  },
  insufficientWarningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 10,
    borderRadius: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  insufficientWarningText: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.error,
    flex: 1,
  },
  stickyFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: Palette.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.hairline,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.primary,
    borderRadius: 14,
    paddingVertical: 13,
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
