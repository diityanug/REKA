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
  FileText,
} from 'lucide-react-native';
import { Palette, Typography } from '../../theme/tokens';
import { Wallet, Transaction, CurrencyType, BillingCycleConfig } from '../../types';
import { formatCurrency, formatMonthYear, getPrevMonthKey, getNextMonthKey } from '../../utils/formatters';
import {
  DEFAULT_BILLING_CYCLE,
  getCurrentPeriodKey,
  isTimestampInPeriod,
  formatCycleRangeShort,
} from '../../utils/billingCycle';
import { useCurrentDate } from '../../hooks/useCurrentDate';
import { AppHaptics } from '../../utils/haptics';
import { AccountCardItem } from '../AccountCardItem';
import { TransactionItemRow } from '../TransactionItemRow';
import { ScalePressable } from '../MotionPrimitives';

interface OverviewTabProps {
  wallets: Wallet[];
  transactions: Transaction[];
  activeCurrency: CurrencyType;
  privacyMode: boolean;
  selectedMonth: string; // 'YYYY-MM' or 'all'
  billingCycle?: BillingCycleConfig;
  availableMonths?: string[];
  scanning: boolean;
  onNavigateToAccounts?: () => void;
  onNavigateToHistory?: () => void;
  onSelectMonth: (month: string) => void;
  onOpenMonthPicker: () => void;
  onOpenTransferModal: () => void;
  onOpenManualModal: () => void;
  onScanReceipt: () => void;
  onPickFromGallery: () => void;
  onImportStatement?: () => void;
  onOpenAccountDetail: (w: Wallet) => void;
  onOpenAddAccount: () => void;
  onSelectTransaction: (tx: Transaction) => void;
  onCurrencyChange?: (currency: CurrencyType) => void;
  getCategoryIconName: (category: string, type?: Transaction['type']) => string;
  getPocketName: (pocketId?: string) => string;
}

export const OverviewTab = React.memo<OverviewTabProps>(({
  wallets,
  transactions,
  activeCurrency,
  privacyMode,
  selectedMonth,
  billingCycle = DEFAULT_BILLING_CYCLE,
  availableMonths = [],
  scanning,
  onNavigateToAccounts,
  onNavigateToHistory,
  onSelectMonth,
  onOpenMonthPicker,
  onOpenTransferModal,
  onOpenManualModal,
  onScanReceipt,
  onPickFromGallery,
  onImportStatement,
  onOpenAccountDetail,
  onOpenAddAccount,
  onSelectTransaction,
  onCurrencyChange,
  getCategoryIconName,
  getPocketName,
}) => {
  const idrWallets = useMemo(
    () => wallets.filter((w) => w.currency === 'IDR'),
    [wallets]
  );
  const walletById = useMemo(() => {
    const map = new Map<string, Wallet>();
    wallets.forEach((w) => map.set(w.id, w));
    return map;
  }, [wallets]);
  const usdWallets = useMemo(
    () => wallets.filter((w) => w.currency === 'USD'),
    [wallets]
  );
  const idrTotalBalance = useMemo(
    () => idrWallets.reduce((sum, w) => sum + w.balance, 0),
    [idrWallets]
  );
  const usdTotalBalance = useMemo(
    () => usdWallets.reduce((sum, w) => sum + w.balance, 0),
    [usdWallets]
  );
  const activeTotalBalance =
    activeCurrency === 'USD' ? usdTotalBalance : idrTotalBalance;

  // Same period-key rule the finance hook uses, updated live so the stepper can be bounded
  const { todayStr } = useCurrentDate();
  const currentPeriodKey = useMemo(() => {
    const parts = todayStr.split('-');
    const nowDate =
      parts.length === 3
        ? new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10))
        : new Date();
    return getCurrentPeriodKey(billingCycle, nowDate);
  }, [todayStr, billingCycle]);

  // Oldest month with recorded activity (availableMonths is sorted newest first)
  const oldestMonthKey = availableMonths.length > 0
    ? availableMonths[availableMonths.length - 1]
    : null;

  // Deduplicate paired transfers (both same-currency and cross-currency) so transfers appear as 1 clean unified card
  const unifiedTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (
        tx.type === 'income' &&
        tx.transferPairId &&
        (tx.category === 'Transfer' || tx.merchantName.toLowerCase().startsWith('transfer '))
      ) {
        const counterpart = transactions.find((c) => c.id === tx.transferPairId);
        if (counterpart) {
          return false;
        }
      }
      return true;
    });
  }, [transactions]);

  // Filter unified transactions for the selected period (respecting Payday Cycle)
  const monthTransactions = useMemo(() => {
    if (selectedMonth === 'all') return unifiedTransactions;
    return unifiedTransactions.filter((tx) =>
      isTimestampInPeriod(tx.timestamp, selectedMonth, billingCycle)
    );
  }, [unifiedTransactions, selectedMonth, billingCycle]);

  // Monthly stats for the active currency in the Hero Card (excluding internal transfers from In vs Out)
  const currentMonthlyStats = useMemo(() => {
    let income = 0;
    let expense = 0;
    monthTransactions.forEach((tx) => {
      if (tx.category === 'Transfer' || tx.transferPairId) return;
      if (tx.currency === activeCurrency) {
        if (tx.type === 'income') income += tx.amount;
        if (tx.type === 'expense') expense += tx.amount;
      }
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
  }, [monthTransactions, activeCurrency]);

  const recentTransactions = useMemo(() => {
    return monthTransactions.slice(0, 10);
  }, [monthTransactions]);

  // Stepper navigation logic (Clean period math, bounded to active payday cycle)
  const isNextDisabled = selectedMonth === 'all' || selectedMonth >= currentPeriodKey;
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
  const cycleRangeSubtitle = formatCycleRangeShort(selectedMonth, billingCycle);

  return (
    <View style={styles.container}>
      {/* Total Balance Hero Card */}
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <Text style={styles.heroLabel}>Total Balance</Text>
          {onCurrencyChange ? (
            <View style={styles.heroCurrencySwitch}>
              {(['IDR', 'USD'] as const).map((curr) => {
                const isSelected = activeCurrency === curr;
                return (
                  <TouchableOpacity
                    key={curr}
                    style={[
                      styles.heroCurrencyBtn,
                      isSelected && styles.heroCurrencyBtnActive,
                    ]}
                    onPress={() => {
                      AppHaptics.selection();
                      onCurrencyChange(curr);
                    }}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.heroCurrencyBtnText,
                        isSelected && styles.heroCurrencyBtnTextActive,
                      ]}
                    >
                      {curr}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.currencyBadge}>
              <Text style={styles.currencyBadgeText}>{activeCurrency}</Text>
            </View>
          )}
        </View>

        <Text style={styles.heroAmount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {formatCurrency(activeTotalBalance, activeCurrency, privacyMode)}
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
              <Text style={styles.periodTitleText} numberOfLines={1}>{periodTitle}</Text>
            </View>
            <Text
              style={styles.periodSubtitleText}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {selectedMonth === 'all'
                ? 'All-Time Flow'
                : cycleRangeSubtitle
                  ? `${cycleRangeSubtitle}  •  Payday cycle`
                  : 'Tap to change month'}
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
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.flowLabel} numberOfLines={1}>Inflow</Text>
              <Text
                style={[styles.flowValue, { color: Palette.success }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.72}
              >
                {formatCurrency(currentMonthlyStats.income, activeCurrency, privacyMode)}
              </Text>
            </View>
          </View>

          <View style={[styles.flowPill, { backgroundColor: '#FDF2F2' }]}>
            <View style={[styles.flowIndicator, { backgroundColor: '#FCD8D8' }]}>
              <TrendingDown size={14} color={Palette.error} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.flowLabel} numberOfLines={1}>Outflow</Text>
              <Text
                style={[styles.flowValue, { color: Palette.error }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.72}
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
            <Text
              style={[styles.flowRatioMetaText, styles.flowRatioNetText]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              Net:{' '}
              <Text
                style={{
                  fontWeight: '700',
                  color: currentMonthlyStats.net >= 0 ? Palette.success : Palette.error,
                }}
              >
                {formatCurrency(currentMonthlyStats.net, activeCurrency, privacyMode)}
              </Text>
            </Text>
            <Text style={[styles.flowRatioMetaText, styles.flowRatioPctText]} numberOfLines={1}>
              {currentMonthlyStats.totalVolume > 0
                ? `${currentMonthlyStats.incomePct.toFixed(0)}% In / ${currentMonthlyStats.expensePct.toFixed(0)}% Out`
                : 'No monthly flow'}
            </Text>
          </View>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
      </View>

      <View style={styles.actionRow4Col}>
        {/* Transfer Button */}
        <ScalePressable
          style={styles.actionTileOuter}
          contentStyle={styles.actionTile}
          scaleTo={0.93}
          onPress={() => {
            AppHaptics.light();
            onOpenTransferModal();
          }}
        >
          <View style={[styles.actionIconBadge, { backgroundColor: Palette.surfaceDark }]}>
            <ArrowLeftRight size={17} color={Palette.white} />
          </View>
          <Text style={styles.actionTileTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>Transfer</Text>
          <Text style={styles.actionTileSub} numberOfLines={1}>Move</Text>
        </ScalePressable>

        {/* Manual Entry Button */}
        <ScalePressable
          style={styles.actionTileOuter}
          contentStyle={styles.actionTile}
          scaleTo={0.93}
          onPress={() => {
            AppHaptics.light();
            onOpenManualModal();
          }}
        >
          <View style={[styles.actionIconBadge, { backgroundColor: Palette.primary }]}>
            <Edit3 size={17} color={Palette.white} />
          </View>
          <Text style={styles.actionTileTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>Manual</Text>
          <Text style={styles.actionTileSub} numberOfLines={1}>Entry</Text>
        </ScalePressable>

        {/* Scan Slip Button */}
        <ScalePressable
          style={styles.actionTileOuter}
          contentStyle={styles.actionTile}
          scaleTo={0.93}
          onPress={() => {
            AppHaptics.light();
            onScanReceipt();
          }}
          disabled={scanning}
        >
          <View style={[styles.actionIconBadge, { backgroundColor: Palette.accentTeal }]}>
            <Camera size={17} color={Palette.white} />
          </View>
          <Text style={styles.actionTileTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>Scan</Text>
          <Text style={styles.actionTileSub} numberOfLines={1}>Camera</Text>
        </ScalePressable>

        {/* Upload Button */}
        <ScalePressable
          style={styles.actionTileOuter}
          contentStyle={styles.actionTile}
          scaleTo={0.93}
          onPress={() => {
            AppHaptics.light();
            onPickFromGallery();
          }}
          disabled={scanning}
        >
          <View style={[styles.actionIconBadge, { backgroundColor: '#7B61FF' }]}>
            <ImageIcon size={17} color={Palette.white} />
          </View>
          <Text style={styles.actionTileTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>Upload</Text>
          <Text style={styles.actionTileSub} numberOfLines={1}>Gallery</Text>
        </ScalePressable>

        {/* e-Statement Button */}
        {onImportStatement ? (
          <ScalePressable
            style={styles.actionTileOuter}
            contentStyle={styles.actionTile}
            scaleTo={0.93}
            onPress={() => {
              AppHaptics.light();
              onImportStatement();
            }}
            disabled={scanning}
            accessibilityRole="button"
            accessibilityLabel="Import e-Statement PDF or mutation"
          >
            <View style={[styles.actionIconBadge, { backgroundColor: '#D97706' }]}>
              <FileText size={17} color={Palette.white} />
            </View>
            <Text style={styles.actionTileTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>Import</Text>
            <Text style={styles.actionTileSub} numberOfLines={1}>e-Bank</Text>
          </ScalePressable>
        ) : null}
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
          contentContainerStyle={styles.accountsScrollContent}
        >
          {wallets.map((w) => (
            <AccountCardItem
              key={w.id}
              wallet={w}
              privacyMode={privacyMode}
              onPress={onOpenAccountDetail}
              variant="horizontal"
            />
          ))}

          <TouchableOpacity
            style={styles.addAccountCardHorizontal}
            onPress={onOpenAddAccount}
            activeOpacity={0.8}
          >
            <View style={styles.addAccountIconCircle}>
              <Plus size={20} color={Palette.primary} />
            </View>
            <Text style={styles.addAccountCardTitle} numberOfLines={1}>
              Add Account
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Monthly Transactions */}
      <View style={styles.txSectionHeader}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <Text style={styles.txSectionPeriod}>
            {selectedMonth === 'all' ? 'All Time' : periodTitle}
          </Text>
        </View>
        {onNavigateToHistory ? (
          <TouchableOpacity
            onPress={() => {
              AppHaptics.light();
              onNavigateToHistory();
            }}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="See all transactions in history"
          >
            <Text style={styles.viewAllPlansLink}>See all</Text>
          </TouchableOpacity>
        ) : null}
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
        <>
          {recentTransactions.map((tx) => {
            const w = tx.walletId ? walletById.get(tx.walletId) : undefined;
            return (
              <TransactionItemRow
                key={tx.id}
                transaction={tx}
                categoryIcon={getCategoryIconName(tx.category, tx.type)}
                walletName={w ? w.name?.trim() || w.type : undefined}
                walletType={w?.type}
                pocketName={getPocketName(tx.pocketId)}
                privacyMode={privacyMode}
                onPress={onSelectTransaction}
              />
            );
          })}

          {monthTransactions.length > recentTransactions.length && onNavigateToHistory ? (
            <TouchableOpacity
              style={styles.seeAllBottomBtn}
              onPress={() => {
                AppHaptics.light();
                onNavigateToHistory();
              }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`See all ${monthTransactions.length} transactions in history`}
            >
              <Text style={styles.seeAllBottomBtnText}>
                See All {monthTransactions.length} Transactions
              </Text>
              <ChevronRight size={15} color={Palette.primary} />
            </TouchableOpacity>
          ) : null}
        </>
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
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 32,
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
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencyBadgeText: {
    ...Typography.caption,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    color: Palette.ink,
    includeFontPadding: false,
  },
  heroAmount: {
    ...Typography.display,
    fontSize: 28,
    lineHeight: 34,
    minHeight: 36,
    fontWeight: '700',
    color: Palette.ink,
    marginTop: 10,
    marginBottom: 6,
    includeFontPadding: false,
  },
  heroCurrencySwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  heroCurrencyBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    minHeight: 26,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCurrencyBtnActive: {
    backgroundColor: Palette.white,
  },
  heroCurrencyBtnText: {
    ...Typography.caption,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    color: Palette.muted,
    includeFontPadding: false,
  },
  heroCurrencyBtnTextActive: {
    color: Palette.ink,
    fontWeight: '700',
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
    paddingHorizontal: 10,
    paddingVertical: 9,
    minHeight: 56,
    marginBottom: 12,
  },
  stepperBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: Palette.white,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepperBtnDisabled: {
    opacity: 0.35,
  },
  periodCenterBtn: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  periodCenterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  periodTitleText: {
    ...Typography.heading,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: Palette.ink,
    includeFontPadding: false,
  },
  periodSubtitleText: {
    ...Typography.caption,
    fontSize: 10.5,
    lineHeight: 14,
    color: Palette.muted,
    marginTop: 4,
    textAlign: 'center',
  },
  flowMetricsRow: {
    flexDirection: 'row',
    gap: 10,
    minHeight: 56,
    marginBottom: 12,
  },
  flowPill: {
    flex: 1,
    minWidth: 0,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    gap: 8,
  },
  flowIndicator: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
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
    lineHeight: 18,
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
    gap: 8,
  },
  flowRatioMetaText: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
  },
  flowRatioNetText: {
    flex: 1,
    minWidth: 0,
  },
  flowRatioPctText: {
    flexShrink: 0,
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
  txSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 16,
    marginBottom: 10,
    gap: 10,
  },
  txSectionPeriod: {
    ...Typography.caption,
    fontSize: 11.5,
    color: Palette.muted,
    marginTop: 1,
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
    gap: 6,
    minHeight: 82,
    marginBottom: 14,
  },
  actionTileOuter: {
    flex: 1,
    minWidth: 0,
  },
  actionTile: {
    width: '100%',
    minWidth: 0,
    backgroundColor: Palette.white,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 82,
    overflow: 'hidden',
  },
  actionIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  actionTileTitle: {
    ...Typography.caption,
    fontSize: 10.5,
    fontWeight: '600',
    color: Palette.ink,
    textAlign: 'center',
    width: '100%',
  },
  actionTileSub: {
    ...Typography.caption,
    fontSize: 9,
    color: Palette.muted,
    marginTop: 1,
    textAlign: 'center',
  },
  accountsScroll: {
    marginHorizontal: -20,
    height: 142,
    marginBottom: 6,
  },
  accountsScrollContent: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  addAccountCardHorizontal: {
    width: 144,
    height: 136,
    backgroundColor: Palette.white,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  addAccountIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.tintExpense,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  addAccountCardTitle: {
    ...Typography.caption,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '600',
    color: Palette.primary,
    textAlign: 'center',
  },
  emptyAddCard: {
    backgroundColor: Palette.white,
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
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
  seeAllBottomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Palette.white,
    borderWidth: 1,
    borderColor: Palette.hairline,
    borderRadius: 14,
    paddingVertical: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  seeAllBottomBtnText: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '700',
    color: Palette.primary,
  },
});
