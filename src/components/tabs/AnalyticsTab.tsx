import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  ChevronLeft,
  ChevronRight,
  FolderTree,
  Receipt,
  TrendingUp,
  TrendingDown,
  Calendar,
  Percent,
  Activity,
  Wallet,
  Target,
  Plus,
  ShieldCheck,
  Compass,
} from 'lucide-react-native';
import { Palette, Typography } from '../../theme/tokens';
import { Transaction, TransactionType, CurrencyType } from '../../types';
import { formatCurrency, formatMonthYear, getPrevMonthKey, getNextMonthKey } from '../../utils/formatters';
import { AppHaptics } from '../../utils/haptics';
import { CHART_PALETTE } from '../../constants/presets';
import { CategoryIcon } from '../CategoryIcon';
import { DonutChart } from '../DonutChart';

const EXPENSE_PALETTE = [
  '#E11D48', // Crimson / Rose
  '#EA580C', // Orange / Rust
  '#D97706', // Amber
  '#7C3AED', // Violet
  '#2563EB', // Royal Blue
  '#DB2777', // Magenta
  '#0284C7', // Sky Blue
  '#92400E', // Earth Brown
];

const INCOME_PALETTE = [
  '#059669', // Emerald Green
  '#0D9488', // Teal
  '#16A34A', // Leaf Green
  '#0284C7', // Cyan / Sky
  '#2563EB', // Cobalt Blue
  '#65A30D', // Olive / Lime
  '#10B981', // Mint Green
  '#06B6D4', // Aquamarine
];

interface AnalyticsTabProps {
  transactions: Transaction[];
  activeCurrency: CurrencyType;
  privacyMode: boolean;
  totalBalance: number;
  selectedMonth: string;
  monthlyBudget?: number;
  onSelectMonth: (month: string) => void;
  onOpenMonthPicker: () => void;
  onOpenCategoryManager: (type?: TransactionType) => void;
  onOpenSetBudget: () => void;
  getCategoryIconName: (category: string) => string;
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({
  transactions,
  activeCurrency,
  privacyMode,
  totalBalance,
  selectedMonth,
  monthlyBudget = 0,
  onSelectMonth,
  onOpenMonthPicker,
  onOpenCategoryManager,
  onOpenSetBudget,
  getCategoryIconName,
}) => {
  const [analyticsType, setAnalyticsType] = useState<TransactionType>('expense');

  // Filter transactions matching active currency
  const currencyTransactions = useMemo(() => {
    return transactions.filter((tx) => tx.currency === activeCurrency);
  }, [transactions, activeCurrency]);

  // Filter transactions for the selected month or all time
  const periodTransactions = useMemo(() => {
    if (selectedMonth === 'all') return currencyTransactions;
    return currencyTransactions.filter((tx) => {
      const d = new Date(tx.timestamp);
      if (isNaN(d.getTime())) return false;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return key === selectedMonth;
    });
  }, [currencyTransactions, selectedMonth]);

  // Comprehensive Financial Health Intelligence (Best Practice Benchmarks)
  const financialHealth = useMemo(() => {
    let income = 0;
    let expense = 0;
    const categoryExpenseMap: Record<string, number> = {};

    periodTransactions.forEach((tx) => {
      if (tx.type === 'income') income += tx.amount;
      if (tx.type === 'expense') {
        expense += tx.amount;
        categoryExpenseMap[tx.category] = (categoryExpenseMap[tx.category] || 0) + tx.amount;
      }
    });

    const net = income - expense;
    const hasData = income > 0 || expense > 0;

    // Savings Rate (50/30/20 Standard: >= 20%)
    let savingsRate = 0;
    if (income > 0) {
      savingsRate = (net / income) * 100;
    } else if (expense > 0) {
      savingsRate = -100;
    }

    // Burn Rate (Standard: <= 80%)
    let burnRate = 0;
    if (income > 0) {
      burnRate = (expense / income) * 100;
    } else if (expense > 0) {
      burnRate = 100;
    }

    // Emergency Buffer Runway = Total Liquid Balance / Month Expense (Standard: 3 - 6 months)
    let runwayMonths: number | null = null;
    if (expense > 0 && totalBalance > 0) {
      runwayMonths = totalBalance / expense;
    } else if (expense === 0 && totalBalance > 0) {
      runwayMonths = 99;
    }

    // Top Expense Category & Concentration
    let topExpenseCategory = '';
    let topExpenseAmount = 0;
    let topExpenseShare = 0;
    Object.entries(categoryExpenseMap).forEach(([cat, amt]) => {
      if (amt > topExpenseAmount) {
        topExpenseAmount = amt;
        topExpenseCategory = cat;
      }
    });
    if (expense > 0 && topExpenseAmount > 0) {
      topExpenseShare = (topExpenseAmount / expense) * 100;
    }

    // Determine Health Tier & Color
    type HealthTier = 'excellent' | 'healthy' | 'stable' | 'fragile' | 'deficit' | 'nodata';
    let tier: HealthTier = 'nodata';
    let statusTitle = 'No Financial Data';
    let statusBadgeColor = Palette.muted;
    let statusBgColor = Palette.surfaceSoft;
    let diagnosisSummary = 'No transactions recorded in this period to evaluate financial health.';
    let recommendations: string[] = [];

    if (!hasData) {
      tier = 'nodata';
      statusTitle = 'No Period Activity';
      statusBadgeColor = Palette.muted;
      statusBgColor = Palette.surfaceSoft;
      diagnosisSummary = 'Add income or expense transactions to view your health diagnosis.';
      recommendations = ['Record your daily transactions to generate financial health insights.'];
    } else if (net < 0 || savingsRate < 0) {
      tier = 'deficit';
      statusTitle = 'Financial Deficit';
      statusBadgeColor = Palette.error;
      statusBgColor = '#FDF0ED';
      diagnosisSummary = `Outflows exceed inflows by ${formatCurrency(Math.abs(net), activeCurrency, privacyMode)} (${burnRate.toFixed(0)}% burn rate). Current spending is depleting cash reserves.`;
      recommendations = [
        `Cash burn exceeds income. Trim discretionary spending in ${topExpenseCategory || 'high-expense categories'}.`,
        runwayMonths !== null && runwayMonths < 3
          ? `Emergency buffer stands at ${runwayMonths.toFixed(1)} months, below the recommended 3–6 month safety baseline.`
          : 'Preserve existing liquid balances until positive monthly cash flow is restored.',
      ];
    } else if (savingsRate >= 0 && savingsRate < 10) {
      tier = 'fragile';
      statusTitle = 'Fragile / Break-Even';
      statusBadgeColor = '#F59E0B';
      statusBgColor = '#FFFBEB';
      diagnosisSummary = `Net surplus is slim at +${formatCurrency(net, activeCurrency, privacyMode)} (${savingsRate.toFixed(1)}% savings rate). You are spending ${burnRate.toFixed(0)}% of earned income.`;
      recommendations = [
        'Savings margin is below the 20% golden benchmark. Unexpected expenses could cause cash flow deficit.',
        `Review ${topExpenseCategory} which accounts for ${topExpenseShare.toFixed(0)}% of total outflow this month.`,
      ];
    } else if (savingsRate >= 10 && savingsRate < 20) {
      tier = 'stable';
      statusTitle = 'Stable Cash Flow';
      statusBadgeColor = Palette.accentTeal;
      statusBgColor = '#EBF7F4';
      diagnosisSummary = `Solid positive surplus of +${formatCurrency(net, activeCurrency, privacyMode)} (${savingsRate.toFixed(1)}% savings rate). Spending is contained at ${burnRate.toFixed(0)}% of income.`;
      recommendations = [
        'Good financial control. Aim to increase savings by 5–10% to reach the recommended 20% 50/30/20 target.',
        runwayMonths !== null && runwayMonths >= 3
          ? `Adequate emergency runway (${runwayMonths.toFixed(1)} months). Continue building toward 6 months.`
          : 'Direct current monthly surplus into an emergency pocket.',
      ];
    } else {
      tier = savingsRate >= 35 ? 'excellent' : 'healthy';
      statusTitle = tier === 'excellent' ? 'Exceptional Health' : 'Financially Healthy';
      statusBadgeColor = Palette.success;
      statusBgColor = '#EAF8ED';
      diagnosisSummary = `Outstanding cash retention with +${formatCurrency(net, activeCurrency, privacyMode)} saved (${savingsRate.toFixed(1)}% savings rate). Well above the 20% personal finance benchmark.`;
      recommendations = [
        `Savings rate exceeds the 20% 50/30/20 standard. High financial resilience and capital accumulation.`,
        runwayMonths !== null && runwayMonths >= 6
          ? `Robust safety net: liquid balances can support ${runwayMonths > 12 ? 'over 12' : runwayMonths.toFixed(1)} months of current living costs.`
          : 'Consider allocating surplus funds into designated goal pockets or investments.',
      ];
    }

    return {
      income,
      expense,
      net,
      savingsRate,
      burnRate,
      runwayMonths,
      topExpenseCategory,
      topExpenseAmount,
      topExpenseShare,
      tier,
      statusTitle,
      statusBadgeColor,
      statusBgColor,
      diagnosisSummary,
      recommendations,
      hasData,
    };
  }, [periodTransactions, totalBalance, activeCurrency, privacyMode]);

  // Month-over-Month (MoM) Journey Comparison with previous period
  const prevMonthKey = useMemo(() => {
    if (selectedMonth === 'all') return null;
    return getPrevMonthKey(selectedMonth);
  }, [selectedMonth]);

  const momStats = useMemo(() => {
    if (!prevMonthKey || selectedMonth === 'all') return null;
    // If the current period has no transactions at all, MoM comparison is not applicable
    if (periodTransactions.length === 0) return null;

    let prevExpense = 0;
    let prevIncome = 0;

    currencyTransactions.forEach((tx) => {
      const d = new Date(tx.timestamp);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (key === prevMonthKey) {
        if (tx.type === 'expense') prevExpense += tx.amount;
        if (tx.type === 'income') prevIncome += tx.amount;
      }
    });

    const currentExpense = financialHealth.expense;
    const currentIncome = financialHealth.income;

    // Both periods MUST have positive activity (> 0) to produce a meaningful percentage delta.
    // If current is 0, displaying "-100%" is mathematically literal but semantically misleading/absurd.
    let expenseDeltaPct: number | null = null;
    if (prevExpense > 0 && currentExpense > 0) {
      expenseDeltaPct = Math.round(((currentExpense - prevExpense) / prevExpense) * 100);
    }

    let incomeDeltaPct: number | null = null;
    if (prevIncome > 0 && currentIncome > 0) {
      incomeDeltaPct = Math.round(((currentIncome - prevIncome) / prevIncome) * 100);
    }

    if (expenseDeltaPct === null && incomeDeltaPct === null) {
      return null;
    }

    return {
      prevExpense,
      prevIncome,
      expenseDeltaPct,
      incomeDeltaPct,
    };
  }, [currencyTransactions, prevMonthKey, selectedMonth, periodTransactions.length, financialHealth.expense, financialHealth.income]);

  // Monthly Budget & Safe Daily Spend calculations (Krom Bank Pacing)
  const budgetSpent = financialHealth.expense;
  const budgetPercentage = monthlyBudget > 0 ? (budgetSpent / monthlyBudget) * 100 : 0;
  const remainingBudget = monthlyBudget - budgetSpent;
  const budgetColor =
    budgetPercentage > 100
      ? Palette.error
      : budgetPercentage >= 75
      ? Palette.accentAmber
      : Palette.success;
  const budgetStatusLabel =
    budgetPercentage > 100
      ? 'Over Budget'
      : budgetPercentage >= 75
      ? 'Approaching Limit'
      : 'Well within limit';
  const budgetBadgeBg =
    budgetPercentage > 100
      ? '#FDF0ED'
      : budgetPercentage >= 75
      ? '#FFFBEB'
      : '#EBF7F4';

  const safeDailySpend = useMemo(() => {
    if (monthlyBudget <= 0) return null;
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    let daysRemaining = 1;

    if (selectedMonth === currentMonthKey) {
      const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      daysRemaining = Math.max(1, totalDays - now.getDate());
    } else if (selectedMonth !== 'all') {
      const parts = selectedMonth.split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      daysRemaining = new Date(y, m, 0).getDate();
    } else {
      daysRemaining = 30;
    }

    const remaining = monthlyBudget - financialHealth.expense;
    if (remaining <= 0) return 0;
    return Math.round(remaining / daysRemaining);
  }, [monthlyBudget, financialHealth.expense, selectedMonth]);

  // Category breakdown for selected period & type
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, { amount: number; count: number }> = {};
    let total = 0;

    periodTransactions
      .filter((tx) => tx.type === analyticsType)
      .forEach((tx) => {
        if (!map[tx.category]) {
          map[tx.category] = { amount: 0, count: 0 };
        }
        map[tx.category].amount += tx.amount;
        map[tx.category].count += 1;
        total += tx.amount;
      });

    const palette = analyticsType === 'expense' ? EXPENSE_PALETTE : INCOME_PALETTE;

    return Object.entries(map)
      .sort((a, b) => b[1].amount - a[1].amount)
      .map(([cat, data], idx) => ({
        category: cat,
        amount: data.amount,
        count: data.count,
        percentage: total > 0 ? (data.amount / total) * 100 : 0,
        color: palette[idx % palette.length],
      }));
  }, [periodTransactions, analyticsType]);

  const { totalBreakdownAmount, totalBreakdownTxCount } = useMemo(() => {
    let sum = 0;
    let count = 0;
    categoryBreakdown.forEach((item) => {
      sum += item.amount;
      count += item.count;
    });
    return { totalBreakdownAmount: sum, totalBreakdownTxCount: count };
  }, [categoryBreakdown]);

  const donutData = useMemo(() => {
    return categoryBreakdown.map((item) => ({
      label: item.category,
      value: item.amount,
      percentage: item.percentage,
      color: item.color,
    }));
  }, [categoryBreakdown]);

  // Stepper navigation logic (Clean calendar month math, no skipping or jumping)
  const handlePrevMonth = () => {
    AppHaptics.selection();
    onSelectMonth(getPrevMonthKey(selectedMonth));
  };

  const handleNextMonth = () => {
    AppHaptics.selection();
    onSelectMonth(getNextMonthKey(selectedMonth));
  };

  // Formatted period title
  const periodTitle =
    selectedMonth === 'all'
      ? 'All Time'
      : formatMonthYear(selectedMonth);

  return (
    <View style={styles.container}>
      {/* Title Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerTitle}>Money Journey</Text>
        </View>
        <View style={styles.currencyBadge}>
          <Text style={styles.currencyBadgeText}>{activeCurrency}</Text>
        </View>
      </View>

      {/* Monthly Period Navigator */}
      <View style={styles.periodBar}>
        <TouchableOpacity
          style={styles.stepperBtn}
          onPress={handlePrevMonth}
          activeOpacity={0.7}
        >
          <ChevronLeft
            size={18}
            color={Palette.ink}
          />
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
            <Calendar size={15} color={Palette.primary} />
            <Text style={styles.periodTitleText}>{periodTitle}</Text>
          </View>
          <Text style={styles.periodSubtitleText}>
            {selectedMonth === 'all'
              ? 'Showing all-time flow • Tap to change'
              : 'Tap to pick month'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.stepperBtn}
          onPress={handleNextMonth}
          activeOpacity={0.7}
        >
          <ChevronRight
            size={18}
            color={Palette.ink}
          />
        </TouchableOpacity>
      </View>

      {/* 1. Net Worth Hero Card (Clean, Symmetrical, Uncluttered) */}
      <View style={styles.journeyHeroCard}>
        <Text style={styles.journeyHeroLabel}>Total Net Worth</Text>

        <Text style={styles.journeyHeroAmount} numberOfLines={1} adjustsFontSizeToFit>
          {formatCurrency(totalBalance, activeCurrency, privacyMode)}
        </Text>

        <View style={styles.journeyCardDivider} />

        {/* Symmetrical Two-Column Status Footer */}
        <View style={styles.journeyHeroFooterRow}>
          <View style={styles.journeyFooterCol}>
            <Text style={styles.journeyFooterSubLabel}>Financial Health</Text>
            <Text
              style={[
                styles.journeyFooterVal,
                { color: financialHealth.statusBadgeColor },
              ]}
              numberOfLines={1}
            >
              {financialHealth.statusTitle}
            </Text>
          </View>

          <View style={[styles.journeyFooterCol, { alignItems: 'flex-end' }]}>
            <Text style={styles.journeyFooterSubLabel}>Safety Runway</Text>
            <Text
              style={[
                styles.journeyFooterVal,
                { color: Palette.accentTeal },
              ]}
              numberOfLines={1}
            >
              {financialHealth.runwayMonths === null
                ? 'No active burn'
                : financialHealth.runwayMonths >= 99
                ? '> 12 Months'
                : `${financialHealth.runwayMonths.toFixed(1)} Months`}
            </Text>
          </View>
        </View>
      </View>

      {/* 2. Krom Bank Pillar 2 & 3: Cash Flow Momentum & Month-over-Month Delta */}
      <View style={styles.cashFlowCard}>
        <View style={styles.cashFlowHeader}>
          <Text style={styles.cashFlowTitle}>Cash Flow Momentum</Text>
          <Text
            style={[
              styles.cashFlowNetVal,
              { color: financialHealth.net >= 0 ? Palette.success : Palette.error },
            ]}
          >
            {financialHealth.net >= 0 ? '+ ' : '- '}
            {formatCurrency(Math.abs(financialHealth.net), activeCurrency, privacyMode)}
          </Text>
        </View>

        <View style={styles.cfBarRow}>
          <View style={styles.cfBarCol}>
            <Text style={styles.cfBarLabel}>Inflow (Earned)</Text>
            <Text style={[styles.cfBarAmount, { color: Palette.success }]}>
              {formatCurrency(financialHealth.income, activeCurrency, privacyMode)}
            </Text>
          </View>
          <View style={[styles.cfBarCol, { alignItems: 'flex-end' }]}>
            <Text style={styles.cfBarLabel}>Outflow (Spent)</Text>
            <Text style={[styles.cfBarAmount, { color: Palette.error }]}>
              {formatCurrency(financialHealth.expense, activeCurrency, privacyMode)}
            </Text>
          </View>
        </View>

        <View style={styles.cfTrack}>
          {financialHealth.income === 0 && financialHealth.expense === 0 ? (
            <View style={{ flex: 1, backgroundColor: Palette.hairline }} />
          ) : (
            <>
              {financialHealth.income > 0 && (
                <View
                  style={[
                    styles.cfSegment,
                    {
                      flex: financialHealth.income,
                      backgroundColor: Palette.success,
                    },
                  ]}
                />
              )}
              {financialHealth.expense > 0 && (
                <View
                  style={[
                    styles.cfSegment,
                    {
                      flex: financialHealth.expense,
                      backgroundColor: Palette.error,
                    },
                  ]}
                />
              )}
            </>
          )}
        </View>

        {/* Month-over-Month Journey Progress Badges */}
        {momStats && (momStats.expenseDeltaPct !== null || momStats.incomeDeltaPct !== null) && (
          <View style={styles.momContainer}>
            <Text style={styles.momTitle}>Month-over-Month Progress</Text>
            <View style={styles.momChipsRow}>
              {momStats.expenseDeltaPct !== null && (
                <View
                  style={[
                    styles.momChip,
                    {
                      backgroundColor:
                        momStats.expenseDeltaPct < 0
                          ? '#EAF8ED'
                          : momStats.expenseDeltaPct === 0
                          ? Palette.surfaceSoft
                          : '#FFFBEB',
                    },
                  ]}
                >
                  {momStats.expenseDeltaPct < 0 ? (
                    <TrendingDown size={13} color={Palette.success} style={{ marginRight: 4 }} />
                  ) : momStats.expenseDeltaPct > 0 ? (
                    <TrendingUp size={13} color="#F59E0B" style={{ marginRight: 4 }} />
                  ) : null}
                  <Text
                    style={[
                      styles.momChipText,
                      {
                        color:
                          momStats.expenseDeltaPct < 0
                            ? Palette.success
                            : momStats.expenseDeltaPct === 0
                            ? Palette.muted
                            : '#B45309',
                      },
                    ]}
                  >
                    Spending {momStats.expenseDeltaPct > 0 ? '+' : ''}
                    {momStats.expenseDeltaPct}% vs prev mo
                  </Text>
                </View>
              )}

              {momStats.incomeDeltaPct !== null && (
                <View
                  style={[
                    styles.momChip,
                    {
                      backgroundColor:
                        momStats.incomeDeltaPct > 0
                          ? '#EAF8ED'
                          : momStats.incomeDeltaPct === 0
                          ? Palette.surfaceSoft
                          : '#FDF0ED',
                    },
                  ]}
                >
                  {momStats.incomeDeltaPct > 0 ? (
                    <TrendingUp size={13} color={Palette.success} style={{ marginRight: 4 }} />
                  ) : momStats.incomeDeltaPct < 0 ? (
                    <TrendingDown size={13} color={Palette.error} style={{ marginRight: 4 }} />
                  ) : null}
                  <Text
                    style={[
                      styles.momChipText,
                      {
                        color:
                          momStats.incomeDeltaPct > 0
                            ? Palette.success
                            : momStats.incomeDeltaPct === 0
                            ? Palette.muted
                            : Palette.error,
                      },
                    ]}
                  >
                    Income {momStats.incomeDeltaPct > 0 ? '+' : ''}
                    {momStats.incomeDeltaPct}% vs prev mo
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
      </View>

      {/* Health Assessment Status & Fixed Meter Card */}
      <View style={styles.healthStatusCard}>
        <View style={styles.healthHeaderTitleBox}>
          <Activity size={18} color={financialHealth.statusBadgeColor} />
          <Text style={styles.healthHeaderTitle}>Health Assessment</Text>
        </View>

        {/* Stable Fixed Health Meter (No jumping / no height shift) */}
        <View style={styles.meterContainer}>
          <View
            style={[
              styles.meterSegment,
              {
                backgroundColor:
                  financialHealth.tier === 'deficit' ? Palette.error : '#FCE8E8',
                opacity: financialHealth.tier === 'deficit' ? 1 : 0.45,
              },
            ]}
          />
          <View
            style={[
              styles.meterSegment,
              {
                backgroundColor:
                  financialHealth.tier === 'fragile' ? '#F59E0B' : '#FEF3C7',
                opacity: financialHealth.tier === 'fragile' ? 1 : 0.45,
              },
            ]}
          />
          <View
            style={[
              styles.meterSegment,
              {
                backgroundColor:
                  financialHealth.tier === 'stable' ? Palette.accentTeal : '#D8F1EB',
                opacity: financialHealth.tier === 'stable' ? 1 : 0.45,
              },
            ]}
          />
          <View
            style={[
              styles.meterSegment,
              {
                backgroundColor:
                  financialHealth.tier === 'healthy' || financialHealth.tier === 'excellent'
                    ? Palette.success
                    : '#D1F4D9',
                opacity:
                  financialHealth.tier === 'healthy' || financialHealth.tier === 'excellent'
                    ? 1
                    : 0.45,
              },
            ]}
          />
        </View>

        <View style={styles.meterLabelsRow}>
          <Text
            style={[
              styles.meterLabelText,
              financialHealth.tier === 'deficit' && styles.meterLabelActiveDeficit,
            ]}
          >
            Deficit
          </Text>
          <Text
            style={[
              styles.meterLabelText,
              financialHealth.tier === 'fragile' && styles.meterLabelActiveFragile,
            ]}
          >
            Fragile
          </Text>
          <Text
            style={[
              styles.meterLabelText,
              financialHealth.tier === 'stable' && styles.meterLabelActiveStable,
            ]}
          >
            Stable
          </Text>
          <Text
            style={[
              styles.meterLabelText,
              (financialHealth.tier === 'healthy' || financialHealth.tier === 'excellent') &&
                styles.meterLabelActiveHealthy,
            ]}
          >
            Healthy
          </Text>
        </View>

        {/* Diagnostic Takeaway */}
        <View style={styles.diagnosisBox}>
          <Text
            style={[
              styles.diagnosisStatusHeadline,
              { color: financialHealth.statusBadgeColor },
            ]}
          >
            Verdict: {financialHealth.statusTitle}
          </Text>
          <Text style={styles.diagnosisText}>
            {financialHealth.diagnosisSummary}
          </Text>
        </View>
      </View>

      {/* 2. Key Financial Benchmarks (4 Distinct Cards) */}
      <View style={styles.sectionHeaderBox}>
        <Text style={styles.sectionHeaderTitle}>Key Financial Ratios</Text>
      </View>

      <View style={styles.pillarsGrid}>
        {/* Pillar 1: Savings Rate */}
        <View style={styles.pillarTile}>
          <View style={styles.pillarHeaderRow}>
            <Percent size={14} color={Palette.muted} />
            <Text style={styles.pillarLabel}>Savings Rate</Text>
          </View>
          <Text
            style={[
              styles.pillarValue,
              {
                color:
                  financialHealth.savingsRate >= 20
                    ? Palette.success
                    : financialHealth.savingsRate >= 0
                    ? '#F59E0B'
                    : Palette.error,
              },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {privacyMode
              ? '••••'
              : `${financialHealth.savingsRate >= 0 ? '+' : ''}${financialHealth.savingsRate.toFixed(1)}%`}
          </Text>
          <Text style={styles.pillarBenchmark}>
            {financialHealth.savingsRate >= 20 ? 'Target: ≥ 20% (Passed)' : 'Target: ≥ 20% standard'}
          </Text>
        </View>

        {/* Pillar 2: Burn Rate */}
        <View style={styles.pillarTile}>
          <View style={styles.pillarHeaderRow}>
            <TrendingDown size={14} color={Palette.muted} />
            <Text style={styles.pillarLabel}>Burn Rate</Text>
          </View>
          <Text
            style={[
              styles.pillarValue,
              {
                color:
                  financialHealth.burnRate <= 80
                    ? Palette.success
                    : financialHealth.burnRate <= 100
                    ? '#F59E0B'
                    : Palette.error,
              },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {financialHealth.burnRate.toFixed(0)}%
          </Text>
          <Text style={styles.pillarBenchmark}>
            {financialHealth.burnRate <= 80 ? 'Target: ≤ 80% (Within)' : 'Target: ≤ 80% budget'}
          </Text>
        </View>

        {/* Pillar 3: Safety Runway */}
        <View style={styles.pillarTile}>
          <View style={styles.pillarHeaderRow}>
            <Wallet size={14} color={Palette.muted} />
            <Text style={styles.pillarLabel}>Safety Runway</Text>
          </View>
          <Text
            style={[
              styles.pillarValue,
              {
                color:
                  financialHealth.runwayMonths !== null && financialHealth.runwayMonths >= 3
                    ? Palette.success
                    : Palette.ink,
              },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {privacyMode
              ? '••••'
              : financialHealth.runwayMonths === null
              ? 'N/A'
              : financialHealth.runwayMonths > 12
              ? '> 12 Mo'
              : `${financialHealth.runwayMonths.toFixed(1)} Mo`}
          </Text>
          <Text style={styles.pillarBenchmark}>
            {financialHealth.runwayMonths !== null && financialHealth.runwayMonths >= 3
              ? 'Standard: 3–6 Mo (Safe)'
              : 'Standard: 3–6 Mo buffer'}
          </Text>
        </View>

        {/* Pillar 4: Top Outflow Category */}
        <View style={styles.pillarTile}>
          <View style={styles.pillarHeaderRow}>
            <TrendingUp size={14} color={Palette.muted} />
            <Text style={styles.pillarLabel}>Top Expense</Text>
          </View>
          <Text style={styles.pillarValue} numberOfLines={1}>
            {financialHealth.topExpenseCategory || 'None'}
          </Text>
          <Text style={styles.pillarBenchmark}>
            {financialHealth.topExpenseShare > 0
              ? `${financialHealth.topExpenseShare.toFixed(0)}% of month outflow`
              : 'No recorded outflows'}
          </Text>
        </View>
      </View>

      {/* 3. Actionable Financial Guidance Card */}
      {financialHealth.recommendations.length > 0 && (
        <View style={styles.guidanceCard}>
          <Text style={styles.guidanceTitle}>Financial Guidance</Text>
          {financialHealth.recommendations.map((rec, idx) => (
            <View key={idx} style={styles.guidanceRow}>
              <View
                style={[
                  styles.guidanceDot,
                  { backgroundColor: financialHealth.statusBadgeColor },
                ]}
              />
              <Text style={styles.guidanceText}>{rec}</Text>
            </View>
          ))}
        </View>
      )}

      {/* 4. Monthly Budget Section */}
      <View style={styles.sectionHeaderBox}>
        <Text style={styles.sectionHeaderTitle}>Monthly Budget</Text>
      </View>

      <View style={styles.budgetCard}>
        {monthlyBudget > 0 ? (
          <>
            {/* Symmetrical Card Header */}
            <View style={styles.budgetHeaderRow}>
              <View style={styles.budgetHeaderLeft}>
                <Target size={15} color={Palette.primary} style={{ marginRight: 6 }} />
                <Text style={styles.budgetHeaderTitle}>Budget Status</Text>
              </View>
              <View style={[styles.budgetStatusPill, { backgroundColor: budgetBadgeBg }]}>
                <View style={[styles.budgetStatusDot, { backgroundColor: budgetColor }]} />
                <Text style={[styles.budgetStatusPillText, { color: budgetColor }]}>
                  {budgetPercentage.toFixed(0)}% • {budgetStatusLabel}
                </Text>
              </View>
            </View>

            {/* Symmetrical 50/50 Spent & Limit Row */}
            <View style={styles.budgetMainRow}>
              <View style={[styles.budgetMainCol, { paddingRight: 8 }]}>
                <Text style={styles.budgetMainLabel} numberOfLines={1}>Spent this Month</Text>
                <Text
                  style={styles.budgetMainAmount}
                  numberOfLines={1}
                  adjustsFontSizeToFit={true}
                >
                  {formatCurrency(budgetSpent, activeCurrency, privacyMode)}
                </Text>
              </View>
              <View style={[styles.budgetMainCol, { paddingLeft: 8, alignItems: 'flex-end' }]}>
                <Text style={styles.budgetMainLabel} numberOfLines={1}>Budget Limit</Text>
                <Text
                  style={styles.budgetMainAmount}
                  numberOfLines={1}
                  adjustsFontSizeToFit={true}
                >
                  {formatCurrency(monthlyBudget, activeCurrency, privacyMode)}
                </Text>
              </View>
            </View>

            {/* Budget Progress Bar */}
            <View style={styles.budgetTrack}>
              <View
                style={[
                  styles.budgetProgress,
                  {
                    width: `${Math.min(budgetPercentage, 100)}%`,
                    backgroundColor: budgetColor,
                  },
                ]}
              />
            </View>

            {/* Symmetrical 50/50 Bento Metrics Grid */}
            <View style={styles.budgetBentoGrid}>
              {/* Tile 1: Remaining Budget */}
              <View style={styles.budgetBentoTile}>
                <Text style={styles.budgetBentoLabel} numberOfLines={1}>Remaining Budget</Text>
                <Text
                  style={[
                    styles.budgetBentoValue,
                    { color: remainingBudget >= 0 ? Palette.success : Palette.error },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit={true}
                >
                  {remainingBudget >= 0
                    ? `${formatCurrency(remainingBudget, activeCurrency, privacyMode)} left`
                    : `${formatCurrency(Math.abs(remainingBudget), activeCurrency, privacyMode)} over`}
                </Text>
              </View>

              {/* Tile 2: Daily Allowance / Pacing */}
              <View style={styles.budgetBentoTile}>
                <Text style={styles.budgetBentoLabel} numberOfLines={1}>
                  {safeDailySpend !== null && safeDailySpend > 0 ? 'Daily Safe Spend' : 'Pacing Status'}
                </Text>
                <Text
                  style={[styles.budgetBentoValue, { color: Palette.ink }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit={true}
                >
                  {safeDailySpend !== null && safeDailySpend > 0
                    ? `${formatCurrency(safeDailySpend, activeCurrency, privacyMode)}/day`
                    : budgetStatusLabel}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.editBudgetBtn}
              onPress={() => {
                AppHaptics.light();
                onOpenSetBudget();
              }}
              activeOpacity={0.8}
            >
              <Target size={14} color={Palette.ink} style={{ marginRight: 6 }} />
              <Text style={styles.editBudgetBtnText}>Adjust Monthly Budget</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.emptyBudgetBox}>
            <View style={styles.emptyBudgetIconCircle}>
              <Target size={20} color={Palette.primary} />
            </View>
            <Text style={styles.emptyBudgetTitle}>No Budget Set for {periodTitle}</Text>
            <Text style={styles.emptyBudgetDesc}>
              Set a monthly spending limit to monitor whether your expenses stay on target.
            </Text>
            <TouchableOpacity
              style={styles.setBudgetBtn}
              onPress={() => {
                AppHaptics.light();
                onOpenSetBudget();
              }}
              activeOpacity={0.85}
            >
              <Plus size={15} color={Palette.white} style={{ marginRight: 6 }} />
              <Text style={styles.setBudgetBtnText}>Set Monthly Budget</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 5. Category Breakdown Header */}
      <View style={styles.sectionHeaderBox}>
        <Text style={styles.sectionHeaderTitle}>Category Breakdown</Text>
      </View>

      {/* Switcher (Expenses | Income) */}
      <View style={styles.switcher}>
        <TouchableOpacity
          style={[
            styles.switchBtn,
            analyticsType === 'expense' && styles.switchBtnActiveExpense,
          ]}
          onPress={() => {
            AppHaptics.selection();
            setAnalyticsType('expense');
          }}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.switchBtnText,
              analyticsType === 'expense' && styles.switchBtnTextActive,
            ]}
          >
            Expenses
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.switchBtn,
            analyticsType === 'income' && styles.switchBtnActiveIncome,
          ]}
          onPress={() => {
            AppHaptics.selection();
            setAnalyticsType('income');
          }}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.switchBtnText,
              analyticsType === 'income' && styles.switchBtnTextActive,
            ]}
          >
            Income
          </Text>
        </TouchableOpacity>
      </View>

      {/* Category Breakdown Section */}
      <View style={styles.breakdownContainer}>
        {categoryBreakdown.length > 0 ? (
          <>
            {/* Donut Chart Presentation */}
            <View style={styles.donutCard}>
              <DonutChart
                data={donutData}
                size={190}
                strokeWidth={20}
                centerTitle={`Total ${analyticsType === 'expense' ? 'Expense' : 'Income'}`}
                centerValue={formatCurrency(totalBreakdownAmount, activeCurrency, privacyMode)}
                centerSubtitle={`${categoryBreakdown.length} Categories • ${totalBreakdownTxCount} tx`}
              />
            </View>

            {/* Category Rows */}
            {categoryBreakdown.map((item) => (
              <View key={item.category} style={styles.categoryRow}>
                <View style={styles.categoryLeft}>
                  <View
                    style={[
                      styles.categoryIconBox,
                      {
                        backgroundColor:
                          analyticsType === 'expense' ? '#FFF1F2' : '#ECFDF5',
                      },
                    ]}
                  >
                    <CategoryIcon
                      name={getCategoryIconName(item.category)}
                      size={16}
                      color={item.color}
                    />
                  </View>
                  <View style={styles.categoryNameCol}>
                    <Text style={styles.categoryNameText}>{item.category}</Text>
                    <Text style={styles.categoryMetaText}>
                      {item.count} transaction{item.count > 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>

                <View style={styles.categoryRight}>
                  <Text style={styles.categoryAmountText}>
                    {formatCurrency(item.amount, activeCurrency, privacyMode)}
                  </Text>
                  <View style={styles.shareBadge}>
                    <View style={[styles.shareDot, { backgroundColor: item.color }]} />
                    <Text style={styles.categoryShareText}>
                      {item.percentage.toFixed(1)}%
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </>
        ) : (
          <View style={styles.emptyCard}>
            <Receipt size={26} color={Palette.muted} />
            <Text style={styles.emptyTitle}>
              No {analyticsType} in {periodTitle}
            </Text>
            <Text style={styles.emptyDesc}>
              Recorded transactions in {activeCurrency} will appear here.
            </Text>
          </View>
        )}
      </View>

      {/* Manage Categories Button */}
      <TouchableOpacity
        style={styles.manageBtn}
        onPress={() => onOpenCategoryManager(analyticsType)}
        activeOpacity={0.8}
      >
        <FolderTree size={16} color={Palette.ink} />
        <Text style={styles.manageBtnText}>Manage Categories</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitle: {
    ...Typography.heading,
    fontSize: 22,
    fontWeight: '700',
    color: Palette.ink,
  },
  headerSubtitle: {
    ...Typography.caption,
    fontSize: 12,
    color: Palette.muted,
    marginTop: 2,
  },
  journeyHeroCard: {
    backgroundColor: Palette.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  journeyHeroLabel: {
    ...Typography.caption,
    fontSize: 12,
    color: Palette.muted,
    fontWeight: '600',
    marginBottom: 4,
  },
  journeyHeroAmount: {
    ...Typography.display,
    fontSize: 24,
    fontWeight: '700',
    color: Palette.ink,
    marginVertical: 2,
  },
  journeyCardDivider: {
    height: 1,
    backgroundColor: Palette.hairline,
    marginVertical: 12,
  },
  journeyHeroFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  journeyFooterCol: {
    flex: 1,
  },
  journeyFooterSubLabel: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
    marginBottom: 2,
  },
  journeyFooterVal: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '700',
  },
  cashFlowCard: {
    backgroundColor: Palette.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  cashFlowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cashFlowTitle: {
    ...Typography.subheading,
    fontSize: 14,
    fontWeight: '700',
    color: Palette.ink,
  },
  cashFlowNetVal: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '700',
  },
  cfBarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cfBarCol: {
    flex: 1,
  },
  cfBarLabel: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
    marginBottom: 2,
  },
  cfBarAmount: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '700',
  },
  cfTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Palette.surfaceSoft,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 4,
  },
  cfSegment: {
    height: '100%',
  },
  momContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.hairline,
  },
  momTitle: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '600',
    color: Palette.muted,
    marginBottom: 6,
  },
  momChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  momChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  momChipText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '700',
  },
  currencyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  currencyBadgeText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: Palette.ink,
  },
  periodBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Palette.white,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  stepperBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Palette.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnDisabled: {
    opacity: 0.35,
  },
  periodCenterBtn: {
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  periodCenterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  periodTitleText: {
    ...Typography.heading,
    fontSize: 15,
    fontWeight: '700',
    color: Palette.ink,
  },
  periodSubtitleText: {
    ...Typography.caption,
    fontSize: 10,
    color: Palette.muted,
    marginTop: 1,
  },
  healthStatusCard: {
    backgroundColor: Palette.white,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  healthHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  healthHeaderTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  healthHeaderTitle: {
    ...Typography.heading,
    fontSize: 16,
    fontWeight: '700',
    color: Palette.ink,
  },
  healthBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  healthBadgeText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '700',
  },
  meterContainer: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    height: 8,
    marginBottom: 8,
  },
  meterSegment: {
    flex: 1,
    height: 8,
    borderRadius: 4,
  },
  meterLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  meterLabelText: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
    fontWeight: '600',
  },
  meterLabelActiveDeficit: {
    color: Palette.error,
    fontWeight: '700',
  },
  meterLabelActiveFragile: {
    color: '#D97706',
    fontWeight: '700',
  },
  meterLabelActiveStable: {
    color: Palette.accentTeal,
    fontWeight: '700',
  },
  meterLabelActiveHealthy: {
    color: Palette.success,
    fontWeight: '700',
  },
  diagnosisBox: {
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  diagnosisStatusHeadline: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  diagnosisText: {
    ...Typography.body,
    fontSize: 13,
    color: Palette.ink,
    lineHeight: 19,
  },
  sectionHeaderBox: {
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionHeaderTitle: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '700',
    color: Palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  pillarsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  pillarTile: {
    width: '48%',
    backgroundColor: Palette.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  pillarHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  pillarLabel: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  pillarValue: {
    ...Typography.heading,
    fontSize: 20,
    fontWeight: '700',
    color: Palette.ink,
    marginVertical: 4,
  },
  pillarBenchmark: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
    marginTop: 2,
  },
  guidanceCard: {
    backgroundColor: '#F0F7FF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#D0E4FF',
    marginBottom: 20,
  },
  guidanceTitle: {
    ...Typography.heading,
    fontSize: 13,
    fontWeight: '700',
    color: Palette.primary,
    marginBottom: 10,
  },
  guidanceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  guidanceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  guidanceText: {
    ...Typography.body,
    fontSize: 12,
    color: Palette.ink,
    flex: 1,
    lineHeight: 18,
  },
  budgetCard: {
    backgroundColor: Palette.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  budgetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  budgetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  budgetHeaderTitle: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: Palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  budgetStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  budgetStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  budgetStatusPillText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '700',
  },
  budgetMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  budgetMainCol: {
    flex: 1,
  },
  budgetMainLabel: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  budgetMainAmount: {
    ...Typography.heading,
    fontSize: 16,
    fontWeight: '700',
    color: Palette.ink,
  },
  budgetTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Palette.surfaceSoft,
    overflow: 'hidden',
    marginBottom: 12,
  },
  budgetProgress: {
    height: '100%',
    borderRadius: 4,
  },
  budgetBentoGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  budgetBentoTile: {
    flex: 1,
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  budgetBentoLabel: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: '600',
    color: Palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  budgetBentoValue: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '700',
  },
  editBudgetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 12,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  editBudgetBtnText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: Palette.ink,
  },
  emptyBudgetBox: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  emptyBudgetIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FDF0ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyBudgetTitle: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: '700',
    color: Palette.ink,
    marginBottom: 4,
    textAlign: 'center',
  },
  emptyBudgetDesc: {
    ...Typography.caption,
    fontSize: 12,
    color: Palette.muted,
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 14,
    paddingHorizontal: 12,
  },
  setBudgetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.primary,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  setBudgetBtnText: {
    ...Typography.caption,
    fontSize: 13,
    fontWeight: '700',
    color: Palette.white,
  },
  switcher: {
    flexDirection: 'row',
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 12,
    padding: 3,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  switchBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 9,
  },
  switchBtnActiveExpense: {
    backgroundColor: Palette.primary,
  },
  switchBtnActiveIncome: {
    backgroundColor: Palette.accentTeal,
  },
  switchBtnText: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '600',
    color: Palette.muted,
  },
  switchBtnTextActive: {
    color: Palette.white,
  },
  breakdownContainer: {
    backgroundColor: Palette.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  donutCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginBottom: 8,
  },
  shareBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  shareDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Palette.surfaceSoft,
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  categoryNameCol: {
    flex: 1,
  },
  categoryNameText: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: '600',
    color: Palette.ink,
  },
  categoryMetaText: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
  },
  categoryRight: {
    alignItems: 'flex-end',
  },
  categoryAmountText: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: '700',
    color: Palette.ink,
  },
  categoryShareText: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
    marginTop: 1,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyTitle: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: '600',
    color: Palette.ink,
    marginTop: 8,
    marginBottom: 2,
  },
  emptyDesc: {
    ...Typography.caption,
    fontSize: 12,
    color: Palette.muted,
    textAlign: 'center',
  },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Palette.white,
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Palette.hairline,
    marginBottom: 20,
  },
  manageBtnText: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '600',
    color: Palette.ink,
  },
});
