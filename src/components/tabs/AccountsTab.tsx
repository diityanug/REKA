import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Plus, CreditCard, Layers, ArrowUpDown } from 'lucide-react-native';
import { Palette, Typography } from '../../theme/tokens';
import { Wallet, CurrencyType, AllocationPlan } from '../../types';
import { AppHaptics } from '../../utils/haptics';
import { AccountCardItem } from '../AccountCardItem';
import { AllocationPlanCard } from '../AllocationPlanCard';

interface AccountsTabProps {
  wallets: Wallet[];
  activeCurrency: CurrencyType;
  privacyMode: boolean;
  allocationPlans: AllocationPlan[];
  onOpenAccountDetail: (w: Wallet) => void;
  onOpenAddAccount: () => void;
  onOpenManageOrder?: () => void;
  onCreateAllocationPlan: () => void;
  onEditAllocationPlan: (plan: AllocationPlan) => void;
}

export const AccountsTab = React.memo<AccountsTabProps>(({
  wallets,
  activeCurrency,
  privacyMode,
  allocationPlans = [],
  onOpenAccountDetail,
  onOpenAddAccount,
  onOpenManageOrder,
  onCreateAllocationPlan,
  onEditAllocationPlan,
}) => {
  return (
    <View>
      <View style={styles.bannerHeader}>
        <Text style={styles.bannerTitle}>Accounts</Text>
      </View>

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

      {/* Add New Account & Manage Order Row (hidden when the empty state owns the CTA) */}
      {wallets.length > 0 ? (
        <View style={styles.actionButtonGroup}>
          <TouchableOpacity
            style={styles.addAccountBtn}
            onPress={onOpenAddAccount}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Add new account"
          >
            <Plus size={18} color={Palette.white} style={{ marginRight: 8 }} />
            <Text style={styles.addAccountBtnText}>Add New Account</Text>
          </TouchableOpacity>

          {wallets.length > 1 && onOpenManageOrder ? (
            <TouchableOpacity
              style={styles.manageOrderBtn}
              onPress={() => {
                AppHaptics.light();
                onOpenManageOrder();
              }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Reorder accounts"
            >
              <ArrowUpDown size={16} color={Palette.ink} />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {/* Wallets List — single empty state with one CTA */}
      {wallets.length === 0 ? (
        <View style={styles.emptyCard}>
          <CreditCard size={36} color={Palette.mutedSoft} />
          <Text style={styles.emptyTitle}>No accounts yet</Text>
          <Text style={styles.emptyDesc}>
            Create your first bank, cash, or e-wallet account to start tracking.
          </Text>
          <TouchableOpacity
            style={styles.emptyCtaBtn}
            onPress={() => {
              AppHaptics.light();
              onOpenAddAccount();
            }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Add account"
          >
            <Plus size={15} color={Palette.white} style={{ marginRight: 6 }} />
            <Text style={styles.emptyCtaBtnText}>Add Account</Text>
          </TouchableOpacity>
        </View>
      ) : (
        wallets.map((w) => (
          <AccountCardItem
            key={w.id}
            wallet={w}
            privacyMode={privacyMode}
            onPress={onOpenAccountDetail}
            variant="full"
          />
        ))
      )}
    </View>
  );
});

AccountsTab.displayName = 'AccountsTab';

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
    marginTop: 4,
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
  emptyCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 14,
  },
  emptyCtaBtnText: {
    ...Typography.caption,
    fontSize: 13,
    fontWeight: '700',
    color: Palette.white,
  },
});
