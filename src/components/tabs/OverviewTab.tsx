import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import {
  TrendingUp,
  TrendingDown,
  Edit3,
  Camera,
  ImageIcon,
  ArrowLeftRight,
  Plus,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Receipt,
} from 'lucide-react-native';
import { Palette, Typography } from '../../theme/tokens';
import { Wallet, Pocket, Transaction, CurrencyType } from '../../types';
import { formatCurrency, formatMonthYear, getPrevMonthKey, getNextMonthKey } from '../../utils/formatters';
import { AppHaptics } from '../../utils/haptics';
import { AccountCardItem } from '../AccountCardItem';
import { TransactionItemRow } from '../TransactionItemRow';

interface OverviewTabProps {
  wallets: Wallet[];
  pockets: Pocket[];
  transactions: Transaction[];
  activeCurrency: CurrencyType;
  privacyMode: boolean;
  totalBalance: number;
  positiveLiquidityTotal: number;
  selectedMonth: string; // 'YYYY-MM' or 'all'
  availableMonths?: string[];
  last7DaysFlow: {
    days: { key: string; label: string; income: number; expense: number }[];
    maxVal: number;
  };
  scanning: boolean;
  selectedWalletId: string;
  onNavigateToAccounts?: () => void;
  onSelectMonth: (month: string) => void;
  onOpenMonthPicker: () => void;
  onOpenTransferModal: () => void;
  onOpenManualModal: () => void;
  onScanReceipt: () => void;
  onPickFromGallery: () => void;
  onOpenAccountDetail: (w: Wallet) => void;
  onOpenAddAccount: () => void;
  onSelectTransaction: (tx: Transaction) => void;
  getCategoryIconName: (category: string, type?: Transaction['type']) => string;
  getPocketName: (pocketId?: string) => string;
}

export const OverviewTab = React.memo<OverviewTabProps>(({
  wallets,
  pockets,
  transactions,
  activeCurrency,
  privacyMode,
  totalBalance,
  positiveLiquidityTotal,
  selectedMonth,
  availableMonths = [],
  last7DaysFlow,
  scanning,
  selectedWalletId,
  onNavigateToAccounts,
  onSelectMonth,
  onOpenMonthPicker,
  onOpenTransferModal,
  onOpenManualModal,
  onScanReceipt,
  onPickFromGallery,
  onOpenAccountDetail,
  onOpenAddAccount,
  onSelectTransaction,
  getCategoryIconName,
  getPocketName,
}) => {
  const currencyWallets = useMemo(
    () => wallets.filter((w) => w.currency === activeCurrency),
    [wallets, activeCurrency]
  );

  // Same month-key rule the finance hook uses, computed locally so the stepper can be bounded
  const currentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  // Oldest month with recorded activity (availableMonths is sorted newest first)
  const oldestMonthKey = availableMonths.length > 0
    ? availableMonths[availableMonths.length - 1]
    : null;

  // Filter transactions for active currency (deduplicating same-currency paired transfers so only 1 card is displayed)
  const currencyTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Exclude incoming mirror leg only if the paired counterpart shares the exact same currency
      if (
        tx.type === 'income' &&
        tx.transferPairId &&
        (tx.category === 'Transfer' || tx.merchantName.toLowerCase().startsWith('transfer '))
      ) {
        const counterpart = transactions.find((c) => c.id === tx.transferPairId);
        if (counterpart && counterpart.currency === tx.currency) {
          return false;
        }
      }
      return tx.currency === activeCurrency;
    });
  }, [transactions, activeCurrency]);

  // Filter transactions for the selected month
  const monthTransactions = useMemo(() => {
    if (selectedMonth === 'all') return currencyTransactions;
    return currencyTransactions.filter((tx) => {
      const d = new Date(tx.timestamp);
      if (isNaN(d.getTime())) return false;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return key === selectedMonth;
    });
  }, [currencyTransactions, selectedMonth]);

  // Monthly stats for the selected month (excluding internal transfers from In vs Out)
  const currentMonthlyStats = useMemo(() => {
    let income = 0;
    let expense = 0;
    monthTransactions.forEach((tx) => {
      if (tx.category === 'Transfer' || tx.transferPairId) return;
      if (tx.type === 'income') income += tx.amount;
      if (tx.type === 'expense') expense += tx.amount;
    });
    const totalVolume = income + expense;
    const incomePct = totalVolume > 0 ? (income / totalVolume) * 100 : 50;
    const expensePct = totalVolume > 0 ? (expense / totalVolume) * 100 : 50;
    const net = income - expense;
    const savingsRate = income > 0 ? Math.max((net / income) * 100, -100) : 0;
    return {
      income,
      expense,
      net,
      totalVolume,
      incomePct,
      expensePct,
      savingsRate,
    };
  }, [monthTransactions]);

  const recentTransactions = useMemo(() => {
    return monthTransactions.slice(0, 10);
  }, [monthTransactions]);

  // Stepper navigation logic (Clean calendar month math, no skipping or jumping)
  const isNextDisabled = selectedMonth === 'all' || selectedMonth >= currentMonthKey;
  const isPrevDisabled =
    selectedMonth !== 'all' && oldestMonthKey !== null && selectedMonth <= oldestMonthKey;

  const handlePrevMonth = () => {
    if (isPrevDisabled) return;
    AppHaptics.selection();
    onSelectMonth(getPrevMonthKey(selectedMonth));
  };

  const handleNextMonth = () => {
    if (isNextDisabled) return;
    AppHaptics.selection();
    onSelectMonth(getNextMonthKey(selectedMonth));
  };

  const periodTitle =
    selectedMonth === 'all'
      ? 'All Time'
      : formatMonthYear(selectedMonth);

  return (
    <View style={styles.container}>
      {/* Total Balance Hero Card */}
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <Text style={styles.heroLabel}>Total Balance</Text>
          <View style={styles.currencyBadge}>
            <Text style={styles.currencyBadgeText}>{activeCurrency}</Text>
          </View>
        </View>

        <Text style={styles.heroAmount} numberOfLines={1} adjustsFontSizeToFit>
          {formatCurrency(totalBalance, activeCurrency, privacyMode)}
        </Text>

        <View style={styles.heroDivider} />

        {/* Monthly Period Navigator */}
        <View style={styles.periodBar}>
          <TouchableOpacity
            style={[styles.stepperBtn, isPrevDisabled && styles.stepperBtnDisabled]}
            onPress={handlePrevMonth}
            activeOpacity={0.7}
            disabled={isPrevDisabled}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            accessibilityState={{ disabled: isPrevDisabled }}
          >
            <ChevronLeft size={16} color={Palette.ink} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.periodCenterBtn}
            onPress={() => {
              AppHaptics.light();
              onOpenMonthPicker();
            }}
            activeOpacity={0.7}
          >
            <View style={styles.periodCenterRow}>
              <Calendar size={13} color={Palette.primary} />
              <Text style={styles.periodTitleText}>{periodTitle}</Text>
            </View>
            <Text style={styles.periodSubtitleText}>
              {selectedMonth === 'all' ? 'All-Time Flow' : 'Tap to change month'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.stepperBtn, isNextDisabled && styles.stepperBtnDisabled]}
            onPress={handleNextMonth}
            activeOpacity={0.7}
            disabled={isNextDisabled}
            accessibilityRole="button"
            accessibilityLabel="Next month"
            accessibilityState={{ disabled: isNextDisabled }}
          >
            <ChevronRight size={16} color={Palette.ink} />
          </TouchableOpacity>
        </View>

        {/* Dual Flow Metric Tiles for Selected Month */}
        <View style={styles.flowMetricsRow}>
          <View style={[styles.flowPill, { backgroundColor: '#EAF8ED' }]}>
            <View style={[styles.flowIndicator, { backgroundColor: '#D1F4D9' }]}>
              <TrendingUp size={14} color={Palette.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.flowLabel}>Inflow</Text>
              <Text
                style={[styles.flowValue, { color: Palette.success }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {formatCurrency(currentMonthlyStats.income, activeCurrency, privacyMode)}
              </Text>
            </View>
          </View>

          <View style={[styles.flowPill, { backgroundColor: '#FDF2F2' }]}>
            <View style={[styles.flowIndicator, { backgroundColor: '#FCD8D8' }]}>
              <TrendingDown size={14} color={Palette.error} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.flowLabel}>Outflow</Text>
              <Text
                style={[styles.flowValue, { color: Palette.error }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {formatCurrency(currentMonthlyStats.expense, activeCurrency, privacyMode)}
              </Text>
            </View>
          </View>
        </View>

        {/* Minimalist Flow Ratio Track */}
        <View style={styles.flowRatioSection}>
          <View style={styles.dualFlowTrack}>
            {currentMonthlyStats.totalVolume > 0 ? (
              <>
                {currentMonthlyStats.income > 0 ? (
                  <View
                    style={[
                      styles.dualFlowSegment,
                      {
                        flex: currentMonthlyStats.income,
                        backgroundColor: Palette.success,
                      },
                    ]}
                  />
                ) : null}
                {currentMonthlyStats.expense > 0 ? (
                  <View
                    style={[
                      styles.dualFlowSegment,
                      {
                        flex: currentMonthlyStats.expense,
                        backgroundColor: Palette.error,
                      },
                    ]}
                  />
                ) : null}
              </>
            ) : (
              <View style={styles.dualFlowNeutral} />
            )}
          </View>
          <View style={styles.flowRatioMetaRow}>
            <Text style={styles.flowRatioMetaText}>
              Net Flow:{' '}
              <Text
                style={{
                  fontWeight: '700',
                  color: currentMonthlyStats.net >= 0 ? Palette.success : Palette.error,
                }}
              >
                {formatCurrency(currentMonthlyStats.net, activeCurrency, privacyMode)}
              </Text>
            </Text>
            <Text style={styles.flowRatioMetaText}>
              {currentMonthlyStats.totalVolume > 0
                ? `${currentMonthlyStats.incomePct.toFixed(0)}% In / ${currentMonthlyStats.expensePct.toFixed(0)}% Out`
                : 'No monthly flow'}
            </Text>
          </View>
        </View>
      </View>

      {/* Quick Actions (4-Column Layout) */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
      </View>

      <View style={styles.actionRow4Col}>
        {/* Transfer Button */}
        <TouchableOpacity
          style={styles.actionTile}
          onPress={() => {
            AppHaptics.light();
            onOpenTransferModal();
          }}
          activeOpacity={0.8}
        >
          <View style={[styles.actionIconBadge, { backgroundColor: Palette.surfaceDark }]}>
            <ArrowLeftRight size={17} color={Palette.white} />
          </View>
          <Text style={styles.actionTileTitle}>Transfer</Text>
          <Text style={styles.actionTileSub}>Move</Text>
        </TouchableOpacity>

        {/* Manual Entry Button */}
        <TouchableOpacity
          style={styles.actionTile}
          onPress={() => {
            AppHaptics.light();
            onOpenManualModal();
          }}
          activeOpacity={0.8}
        >
          <View style={[styles.actionIconBadge, { backgroundColor: Palette.primary }]}>
            <Edit3 size={17} color={Palette.white} />
          </View>
          <Text style={styles.actionTileTitle}>Manual</Text>
          <Text style={styles.actionTileSub}>Entry</Text>
        </TouchableOpacity>

        {/* Scan Slip Button */}
        <TouchableOpacity
          style={styles.actionTile}
          onPress={() => {
            AppHaptics.light();
            onScanReceipt();
          }}
          disabled={scanning}
          activeOpacity={0.8}
        >
          <View style={[styles.actionIconBadge, { backgroundColor: Palette.accentTeal }]}>
            <Camera size={17} color={Palette.white} />
          </View>
          <Text style={styles.actionTileTitle}>Scan Slip</Text>
          <Text style={styles.actionTileSub}>Camera</Text>
        </TouchableOpacity>

        {/* Upload Button */}
        <TouchableOpacity
          style={styles.actionTile}
          onPress={() => {
            AppHaptics.light();
            onPickFromGallery();
          }}
          disabled={scanning}
          activeOpacity={0.8}
        >
          <View style={[styles.actionIconBadge, { backgroundColor: '#7B61FF' }]}>
            <ImageIcon size={17} color={Palette.white} />
          </View>
          <Text style={styles.actionTileTitle}>Upload</Text>
          <Text style={styles.actionTileSub}>Gallery</Text>
        </TouchableOpacity>
      </View>

      {/* 7-Day Cash Flow Bar Chart */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>7-Day Cash Flow</Text>
      </View>

      <View style={styles.weeklyChartCard}>
        <View style={styles.weeklyBarsContainer}>
          {last7DaysFlow.days.map((d) => {
            const incHeight = Math.max(
              (d.income / last7DaysFlow.maxVal) * 72,
              d.income > 0 ? 8 : 3
            );
            const expHeight = Math.max(
              (d.expense / last7DaysFlow.maxVal) * 72,
              d.expense > 0 ? 8 : 3
            );
            return (
              <View key={d.key} style={styles.dayBarColumn}>
                <View style={styles.dayBarPair}>
                  <View
                    style={[
                      styles.verticalBar,
                      {
                        height: incHeight,
                        backgroundColor:
                          d.income > 0 ? Palette.success : Palette.surfaceSoft,
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.verticalBar,
                      {
                        height: expHeight,
                        backgroundColor:
                          d.expense > 0 ? Palette.error : Palette.surfaceSoft,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.dayBarLabel}>{d.label}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.chartLegendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: Palette.success }]} />
            <Text style={styles.legendText}>Inflow</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: Palette.error }]} />
            <Text style={styles.legendText}>Outflow</Text>
          </View>
        </View>
      </View>

      {/* Accounts & Wallets */}
      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitle}>Accounts & Wallets</Text>
        {onNavigateToAccounts ? (
          <TouchableOpacity
            onPress={() => {
              AppHaptics.selection();
              onNavigateToAccounts();
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="See all accounts"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.viewAllPlansLink}>See all</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {wallets.length === 0 ? (
        <TouchableOpacity
          style={styles.emptyAddCard}
          onPress={onOpenAddAccount}
          activeOpacity={0.8}
        >
          <View style={styles.emptyAddIconCircle}>
            <Plus size={22} color={Palette.primary} />
          </View>
          <Text style={styles.emptyAddTitle}>Create Your First Account</Text>
          <Text style={styles.emptyAddDesc}>
            Add a bank account, cash wallet, or e-wallet to start tracking.
          </Text>
        </TouchableOpacity>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.accountsScroll}
        >
          {currencyWallets.length === 0 ? (
            <TouchableOpacity
              style={styles.emptyAddCardCompact}
              onPress={onOpenAddAccount}
              activeOpacity={0.8}
            >
              <View style={styles.emptyAddIconCircleSmall}>
                <Plus size={18} color={Palette.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.emptyAddTitleSmall}>No {activeCurrency} accounts yet</Text>
                <Text style={styles.emptyAddDescSmall}>Tap to create your first {activeCurrency} account</Text>
              </View>
            </TouchableOpacity>
          ) : (
            currencyWallets.map((w) => (
              <AccountCardItem
                key={w.id}
                wallet={w}
                pockets={pockets}
                totalLiquidity={positiveLiquidityTotal}
                privacyMode={privacyMode}
                selected={w.id === selectedWalletId}
                onPress={onOpenAccountDetail}
                variant="horizontal"
              />
            ))
          )}

          {currencyWallets.length > 0 && (
            <TouchableOpacity
              style={styles.addAccountCardHorizontal}
              onPress={onOpenAddAccount}
              activeOpacity={0.8}
            >
              <View style={styles.emptyAddIconCircle}>
                <Plus size={20} color={Palette.primary} />
              </View>
              <Text style={styles.addAccountCardTitle}>Add Account</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {/* Monthly Transactions */}
      <View style={[styles.sectionHeader, { marginTop: 16 }]}>
        <Text style={styles.sectionTitle}>
          {selectedMonth === 'all'
            ? 'Recent Transactions'
            : `Transactions • ${periodTitle}`}
        </Text>
      </View>

      {monthTransactions.length === 0 ? (
        <View style={styles.emptyTransactionsCard}>
          <View style={styles.emptyTransactionsIconCircle}>
            <Receipt size={20} color={Palette.primary} />
          </View>
          <Text style={styles.emptyTitle}>
            {selectedMonth === 'all'
              ? 'No transactions yet'
              : `No transactions in ${periodTitle}`}
          </Text>
          <Text style={styles.emptyDesc}>Add your first expense or income for this period.</Text>
          <TouchableOpacity
            style={styles.emptyPrimaryBtn}
            onPress={() => {
              AppHaptics.light();
              onOpenManualModal();
            }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Add transaction"
          >
            <Plus size={15} color={Palette.white} style={{ marginRight: 6 }} />
            <Text style={styles.emptyPrimaryBtnText}>Add Transaction</Text>
          </TouchableOpacity>
        </View>
      ) : (
        recentTransactions.map((tx) => (
          <TransactionItemRow
            key={tx.id}
            transaction={tx}
            categoryIcon={getCategoryIconName(tx.category, tx.type)}
            pocketName={getPocketName(tx.pocketId)}
            privacyMode={privacyMode}
            onPress={onSelectTransaction}
          />
        ))
      )}
    </View>
  );
});

OverviewTab.displayName = 'OverviewTab';

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  heroCard: {
    backgroundColor: Palette.white,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroLabel: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: Palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  currencyBadge: {
    backgroundColor: Palette.surfaceSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  currencyBadgeText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: Palette.ink,
  },
  heroAmount: {
    ...Typography.display,
    fontSize: 30,
    fontWeight: '700',
    color: Palette.ink,
    marginTop: 12,
    marginBottom: 6,
  },
  heroDivider: {
    height: 1,
    backgroundColor: Palette.hairline,
    marginVertical: 12,
  },
  periodBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 12,
  },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Palette.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  stepperBtnDisabled: {
    opacity: 0.35,
  },
  periodCenterBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  periodCenterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  periodTitleText: {
    ...Typography.heading,
    fontSize: 14,
    fontWeight: '700',
    color: Palette.ink,
  },
  periodSubtitleText: {
    ...Typography.caption,
    fontSize: 10,
    color: Palette.muted,
    marginTop: 1,
  },
  flowMetricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  flowPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 14,
    gap: 8,
  },
  flowIndicator: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flowLabel: {
    ...Typography.caption,
    fontSize: 10,
    color: Palette.muted,
    fontWeight: '500',
  },
  flowValue: {
    ...Typography.mono,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 1,
  },
  flowRatioSection: {
    marginTop: 2,
  },
  dualFlowTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Palette.surfaceSoft,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  dualFlowSegment: {
    height: '100%',
  },
  dualFlowNeutral: {
    flex: 1,
    height: '100%',
    backgroundColor: Palette.hairline,
  },
  flowRatioMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  flowRatioMetaText: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
  },
  sectionHeader: {
    marginBottom: 10,
    marginTop: 4,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 10,
  },
  sectionTitle: {
    ...Typography.subheading,
    fontSize: 15,
    fontWeight: '600',
    color: Palette.ink,
  },
  viewAllPlansLink: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: Palette.primary,
  },
  actionRow4Col: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  actionTile: {
    flex: 1,
    backgroundColor: Palette.white,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  actionIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  actionTileTitle: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: Palette.ink,
  },
  actionTileSub: {
    ...Typography.caption,
    fontSize: 9,
    color: Palette.muted,
    marginTop: 1,
  },
  weeklyChartCard: {
    backgroundColor: Palette.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  weeklyBarsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 94,
    paddingBottom: 6,
  },
  dayBarColumn: {
    alignItems: 'center',
    flex: 1,
  },
  dayBarPair: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 74,
  },
  verticalBar: {
    width: 7,
    borderRadius: 3.5,
  },
  dayBarLabel: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
    marginTop: 6,
  },
  chartLegendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.hairline,
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
    fontSize: 11,
    color: Palette.muted,
  },
  accountsScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
    marginBottom: 6,
  },
  addAccountCardHorizontal: {
    width: 140,
    backgroundColor: Palette.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Palette.hairline,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    minHeight: 140,
  },
  addAccountCardTitle: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: Palette.primary,
    marginTop: 8,
  },
  emptyAddCardCompact: {
    width: 250,
    backgroundColor: Palette.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Palette.hairline,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    minHeight: 140,
  },
  emptyAddIconCircleSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FDF0ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyAddTitleSmall: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '700',
    color: Palette.ink,
    marginBottom: 2,
  },
  emptyAddDescSmall: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
    lineHeight: 15,
  },
  emptyAddCard: {
    backgroundColor: Palette.white,
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Palette.hairline,
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  emptyAddIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FDF0ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyAddTitle: {
    ...Typography.subheading,
    fontSize: 15,
    fontWeight: '600',
    color: Palette.ink,
    marginBottom: 4,
  },
  emptyAddDesc: {
    ...Typography.body,
    fontSize: 12,
    color: Palette.muted,
    textAlign: 'center',
  },
  emptyTransactionsCard: {
    backgroundColor: Palette.white,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Palette.hairline,
    marginBottom: 16,
  },
  emptyTransactionsIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FDF0ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 12,
  },
  emptyPrimaryBtnText: {
    ...Typography.caption,
    fontSize: 13,
    fontWeight: '700',
    color: Palette.white,
  },
  emptyTitle: {
    ...Typography.subheading,
    fontSize: 14,
    fontWeight: '600',
    color: Palette.ink,
    marginBottom: 4,
  },
  emptyDesc: {
    ...Typography.body,
    fontSize: 12,
    color: Palette.muted,
    textAlign: 'center',
  },
});
