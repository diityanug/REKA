import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Plus, CreditCard, Layers, ArrowUpDown } from 'lucide-react-native';
import { Palette, Typography } from '../../theme/tokens';
import { Wallet, Pocket, CurrencyType, AllocationPlan } from '../../types';
import { AppHaptics } from '../../utils/haptics';
import { AccountCardItem } from '../AccountCardItem';
import { AllocationPlanCard } from '../AllocationPlanCard';

interface AccountsTabProps {
  wallets: Wallet[];
  pockets: Pocket[];
  activeCurrency: CurrencyType;
  positiveLiquidityTotal: number;
  privacyMode: boolean;
  selectedWalletId: string;
  allocationPlans: AllocationPlan[];
  onOpenAccountDetail: (w: Wallet) => void;
  onOpenAddAccount: () => void;
  onOpenManageOrder?: () => void;
  onCreateAllocationPlan: () => void;
  onEditAllocationPlan: (plan: AllocationPlan) => void;
}

export const AccountsTab: React.FC<AccountsTabProps> = ({
  wallets,
  pockets,
  activeCurrency,
  positiveLiquidityTotal,
  privacyMode,
  selectedWalletId,
  allocationPlans = [],
  onOpenAccountDetail,
  onOpenAddAccount,
  onOpenManageOrder,
  onCreateAllocationPlan,
  onEditAllocationPlan,
}) => {
  const currencyWallets = wallets.filter((w) => w.currency === activeCurrency);

  return (
    <View>
      <View style={styles.bannerHeader}>
        <Text style={styles.bannerTitle}>Accounts</Text>
      </View>

      {/* Liquidity Allocation Card */}
      {currencyWallets.length > 0 ? (
        <View style={styles.allocationCard}>
          <Text style={styles.allocationCardLabel}>
            Liquidity Allocation ({activeCurrency})
          </Text>
          <View style={styles.stackedBarTrack}>
            {currencyWallets.map((w) => {
              const share =
                positiveLiquidityTotal > 0 && w.balance > 0
                  ? (w.balance / positiveLiquidityTotal) * 100
                  : 100 / currencyWallets.length;
              return (
                <View
                  key={w.id}
                  style={[
                    styles.stackedBarSegment,
                    {
                      flex: Math.max(share, 5),
                      backgroundColor: w.color,
                    },
                  ]}
                />
              );
            })}
          </View>
          <View style={styles.allocationLegendWrap}>
            {currencyWallets.map((w) => {
              const share =
                positiveLiquidityTotal > 0 && w.balance > 0
                  ? (w.balance / positiveLiquidityTotal) * 100
                  : 0;
              return (
                <View key={w.id} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: w.color }]} />
                  <Text style={styles.legendText}>
                    {w.name} ({share.toFixed(0)}%)
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : (
        <View style={styles.emptyAllocationCard}>
          <Text style={styles.allocationCardLabel}>
            Liquidity Allocation ({activeCurrency})
          </Text>
          <Text style={styles.emptyAllocationText}>
            No active {activeCurrency} accounts found.
          </Text>
        </View>
      )}

      {/* Allocation Plans Section */}
      <View style={styles.sectionHeaderRow}>
        <View style={styles.titleWithIcon}>
          <Layers size={16} color={Palette.primary} style={{ marginRight: 6 }} />
          <Text style={styles.sectionHeaderTitle}>Allocation Plans</Text>
        </View>
      </View>

      {allocationPlans.length === 0 ? (
        <TouchableOpacity
          style={styles.emptyPlanBox}
          onPress={() => {
            AppHaptics.light();
            onCreateAllocationPlan();
          }}
          activeOpacity={0.8}
        >
          <View style={styles.emptyPlanIconCircle}>
            <Layers size={22} color={Palette.primary} />
          </View>
          <Text style={styles.emptyPlanTitle}>No Allocation Plans Yet</Text>
          <Text style={styles.emptyPlanDesc}>
            Create an allocation card to organize budget breakdown across needs and savings.
          </Text>
          <View style={styles.createPlanBadge}>
            <Plus size={14} color={Palette.white} style={{ marginRight: 6 }} />
            <Text style={styles.createPlanBadgeText}>Create Allocation Plan</Text>
          </View>
        </TouchableOpacity>
      ) : (
        <View style={{ marginBottom: 14 }}>
          {allocationPlans.map((plan) => (
            <AllocationPlanCard
              key={plan.id}
              plan={plan}
              activeCurrency={activeCurrency}
              privacyMode={privacyMode}
              onEdit={onEditAllocationPlan}
            />
          ))}
          <TouchableOpacity
            style={styles.addPlanBottomBtn}
            onPress={() => {
              AppHaptics.light();
              onCreateAllocationPlan();
            }}
            activeOpacity={0.8}
          >
            <Plus size={15} color={Palette.primary} style={{ marginRight: 6 }} />
            <Text style={styles.addPlanBottomBtnText}>Add Allocation Plan</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Add New Account & Manage Order Row */}
      <View style={styles.actionButtonGroup}>
        <TouchableOpacity
          style={styles.addAccountBtn}
          onPress={onOpenAddAccount}
          activeOpacity={0.85}
        >
          <Plus size={18} color={Palette.white} style={{ marginRight: 8 }} />
          <Text style={styles.addAccountBtnText}>Add New Account</Text>
        </TouchableOpacity>

        {wallets.length > 1 && onOpenManageOrder && (
          <TouchableOpacity
            style={styles.manageOrderBtn}
            onPress={() => {
              AppHaptics.light();
              onOpenManageOrder();
            }}
            activeOpacity={0.8}
          >
            <ArrowUpDown size={16} color={Palette.ink} />
          </TouchableOpacity>
        )}
      </View>

      {/* Wallets List */}
      {currencyWallets.length === 0 ? (
        <View style={styles.emptyCard}>
          <CreditCard size={36} color={Palette.mutedSoft} />
          <Text style={styles.emptyTitle}>No {activeCurrency} accounts yet</Text>
          <Text style={styles.emptyDesc}>
            Tap &quot;Add New Account&quot; above to create your first {activeCurrency} bank or cash vault.
          </Text>
        </View>
      ) : (
        currencyWallets.map((w) => (
          <AccountCardItem
            key={w.id}
            wallet={w}
            pockets={pockets}
            totalLiquidity={positiveLiquidityTotal}
            privacyMode={privacyMode}
            onPress={onOpenAccountDetail}
            variant="full"
          />
        ))
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  bannerHeader: {
    marginBottom: 12,
  },
  bannerTitle: {
    ...Typography.heading,
    fontSize: 22,
    fontWeight: '700',
    color: Palette.ink,
  },
  allocationCard: {
    backgroundColor: Palette.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  emptyAllocationCard: {
    backgroundColor: Palette.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Palette.hairline,
    borderStyle: 'dashed',
  },
  emptyAllocationText: {
    ...Typography.caption,
    fontSize: 13,
    color: Palette.muted,
    lineHeight: 18,
  },
  allocationCardLabel: {
    ...Typography.caption,
    fontSize: 12,
    color: Palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  stackedBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Palette.surfaceSoft,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 12,
  },
  stackedBarSegment: {
    height: '100%',
  },
  allocationLegendWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    ...Typography.caption,
    fontSize: 12,
    color: Palette.muted,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionHeaderTitle: {
    ...Typography.subheading,
    fontSize: 15,
    fontWeight: '700',
    color: Palette.ink,
  },
  addPlanBottomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FDF0ED',
    borderWidth: 1,
    borderColor: '#F2C9BD',
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 12,
    marginTop: 4,
  },
  addPlanBottomBtnText: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '600',
    color: Palette.primary,
  },
  emptyPlanBox: {
    backgroundColor: Palette.white,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Palette.hairline,
    borderStyle: 'dashed',
    marginBottom: 14,
  },
  emptyPlanIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FDF0ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyPlanTitle: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: '700',
    color: Palette.ink,
    marginBottom: 4,
  },
  emptyPlanDesc: {
    ...Typography.caption,
    fontSize: 12,
    color: Palette.muted,
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 14,
    paddingHorizontal: 8,
  },
  createPlanBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.primary,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  createPlanBadgeText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: Palette.white,
  },
  actionButtonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    marginBottom: 14,
  },
  addAccountBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.primary,
    paddingVertical: 14,
    borderRadius: 16,
  },
  manageOrderBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: Palette.white,
    borderWidth: 1,
    borderColor: Palette.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addAccountBtnText: {
    ...Typography.body,
    fontSize: 15,
    fontWeight: '600',
    color: Palette.white,
  },
  emptyCard: {
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 18,
    padding: 28,
    alignItems: 'center',
  },
  emptyTitle: {
    ...Typography.subheading,
    fontSize: 16,
    color: Palette.ink,
    marginTop: 10,
  },
  emptyDesc: {
    ...Typography.caption,
    fontSize: 13,
    color: Palette.muted,
    textAlign: 'center',
    marginTop: 4,
  },
});
