import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { G, Rect, Line, Path, Circle, Text as SvgText } from 'react-native-svg';
import { Palette, Typography } from '../theme/tokens';
import { CurrencyType } from '../types';
import { formatCurrency } from '../utils/formatters';
import { AppHaptics } from '../utils/haptics';

export interface TrendPoint {
  periodKey: string;
  label: string; // e.g. "Nov"
  fullLabel: string; // e.g. "Nov 2026"
  income: number;
  expense: number;
  net: number;
}

export interface TrendChartProps {
  data: TrendPoint[];
  currency: CurrencyType;
  privacyMode: boolean;
}

function formatCompactAxis(val: number, currency: CurrencyType): string {
  const abs = Math.abs(val);
  if (abs === 0) return '0';
  if (currency === 'IDR') {
    if (abs >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
    if (abs >= 1_000_000) return `${(val / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
    if (abs >= 1_000) return `${Math.round(val / 1_000)}k`;
    return String(Math.round(val));
  }
  if (abs >= 1_000_000) return `$${(val / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (abs >= 1_000) return `$${(val / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return `$${Math.round(val)}`;
}

export const TrendChart: React.FC<TrendChartProps> = ({
  data,
  currency,
  privacyMode,
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number>(Math.max(0, data.length - 1));
  const [chartWidth, setChartWidth] = useState<number>(300);
  const [mode, setMode] = useState<'bars' | 'net'>('bars');

  const safeIndex = Math.min(Math.max(0, selectedIndex), Math.max(0, data.length - 1));
  const activePoint = data[safeIndex] || null;
  const hasAnyActivity = data.some((d) => d.income > 0 || d.expense > 0);

  const chartHeight = 164;
  const padLeft = 36;
  const padRight = 10;
  const padTop = 14;
  const padBottom = 26;
  const plotWidth = Math.max(120, chartWidth - padLeft - padRight);
  const plotHeight = chartHeight - padTop - padBottom;

  const maxBarVal = Math.max(
    1,
    ...data.map((d) => Math.max(d.income, d.expense))
  );
  const netMaxAbs = Math.max(1, ...data.map((d) => Math.abs(d.net)));

  const slotWidth = data.length > 0 ? plotWidth / data.length : plotWidth;
  const barWidth = Math.max(7, Math.min(14, (slotWidth - 14) / 2));

  // Build Net Cashflow line coordinates (0 centered)
  const netPoints = data.map((d, idx) => {
    const cx = padLeft + slotWidth * idx + slotWidth / 2;
    const midY = padTop + plotHeight / 2;
    const cy = midY - (d.net / netMaxAbs) * (plotHeight * 0.42);
    return { cx, cy, ...d };
  });

  const netPath =
    netPoints.length > 0
      ? netPoints
          .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.cx.toFixed(1)} ${pt.cy.toFixed(1)}`)
          .join(' ')
      : '';

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Monthly Trend</Text>
          <Text style={styles.subtitle}>Last 6 months</Text>
        </View>
        <View style={styles.modeSwitch}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'bars' && styles.modeBtnActive]}
            onPress={() => {
              AppHaptics.selection();
              setMode('bars');
            }}
            activeOpacity={0.75}
          >
            <Text style={[styles.modeBtnText, mode === 'bars' && styles.modeBtnTextActive]}>
              In / Out
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'net' && styles.modeBtnActive]}
            onPress={() => {
              AppHaptics.selection();
              setMode('net');
            }}
            activeOpacity={0.75}
          >
            <Text style={[styles.modeBtnText, mode === 'net' && styles.modeBtnTextActive]}>
              Net
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {!hasAnyActivity ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>
            Record income or expenses across months to visualize your 6-month trend.
          </Text>
        </View>
      ) : (
        <>
          {/* Selected Period Detail Strip */}
          {activePoint ? (
            <View style={styles.detailStrip}>
              <Text style={styles.detailPeriod}>{activePoint.fullLabel}</Text>
              <View style={styles.detailMetricsRow}>
                <View style={styles.detailMetricItem}>
                  <View style={[styles.legendDot, { backgroundColor: Palette.accentTeal }]} />
                  <Text style={styles.detailMetricLabel}>In </Text>
                  <Text style={styles.detailMetricVal} numberOfLines={1}>
                    {formatCurrency(activePoint.income, currency, privacyMode)}
                  </Text>
                </View>
                <View style={styles.detailMetricItem}>
                  <View style={[styles.legendDot, { backgroundColor: Palette.primary }]} />
                  <Text style={styles.detailMetricLabel}>Out </Text>
                  <Text style={styles.detailMetricVal} numberOfLines={1}>
                    {formatCurrency(activePoint.expense, currency, privacyMode)}
                  </Text>
                </View>
              </View>
              <Text
                style={[
                  styles.detailNetText,
                  { color: activePoint.net >= 0 ? Palette.success : Palette.error },
                ]}
              >
                Net: {activePoint.net >= 0 ? '+' : '-'}
                {formatCurrency(Math.abs(activePoint.net), currency, privacyMode)}
              </Text>
            </View>
          ) : null}

          {/* SVG Plot Area */}
          <View
            style={styles.svgContainer}
            onLayout={(e) => {
              const w = e.nativeEvent.layout.width;
              if (w > 0 && Math.abs(w - chartWidth) > 2) {
                setChartWidth(w);
              }
            }}
          >
            <Svg width={chartWidth} height={chartHeight}>
              {mode === 'bars' ? (
                <>
                  {/* Horizontal Grid Lines (0%, 50%, 100%) */}
                  {[0, 0.5, 1].map((ratio) => {
                    const y = padTop + plotHeight * (1 - ratio);
                    const tickVal = maxBarVal * ratio;
                    return (
                      <G key={`grid-${ratio}`}>
                        <Line
                          x1={padLeft}
                          y1={y}
                          x2={chartWidth - padRight}
                          y2={y}
                          stroke={Palette.hairline}
                          strokeWidth={1}
                          strokeDasharray={ratio > 0 ? '3 3' : undefined}
                        />
                        {!privacyMode ? (
                          <SvgText
                            x={padLeft - 6}
                            y={y + 3}
                            fontSize={9}
                            fill={Palette.muted}
                            textAnchor="end"
                          >
                            {formatCompactAxis(tickVal, currency)}
                          </SvgText>
                        ) : null}
                      </G>
                    );
                  })}

                  {/* Grouped Bars */}
                  {data.map((pt, idx) => {
                    const isSelected = idx === safeIndex;
                    const groupCenter = padLeft + slotWidth * idx + slotWidth / 2;
                    const incH = Math.max(pt.income > 0 ? 3 : 0, (pt.income / maxBarVal) * plotHeight);
                    const expH = Math.max(pt.expense > 0 ? 3 : 0, (pt.expense / maxBarVal) * plotHeight);
                    const baseY = padTop + plotHeight;
                    const gap = 3;

                    return (
                      <G key={pt.periodKey}>
                        {isSelected ? (
                          <Rect
                            x={padLeft + slotWidth * idx + 3}
                            y={padTop - 4}
                            width={Math.max(slotWidth - 6, 10)}
                            height={plotHeight + 6}
                            rx={8}
                            fill={Palette.surfaceSoft}
                          />
                        ) : null}

                        {/* Income Bar */}
                        <Rect
                          x={groupCenter - barWidth - gap / 2}
                          y={baseY - incH}
                          width={barWidth}
                          height={incH}
                          rx={4}
                          fill={Palette.accentTeal}
                          opacity={isSelected ? 1 : 0.72}
                        />

                        {/* Expense Bar */}
                        <Rect
                          x={groupCenter + gap / 2}
                          y={baseY - expH}
                          width={barWidth}
                          height={expH}
                          rx={4}
                          fill={Palette.primary}
                          opacity={isSelected ? 1 : 0.72}
                        />

                        {/* X-Axis Period Label */}
                        <SvgText
                          x={groupCenter}
                          y={chartHeight - 6}
                          fontSize={10}
                          fontWeight={isSelected ? '700' : '500'}
                          fill={isSelected ? Palette.ink : Palette.muted}
                          textAnchor="middle"
                        >
                          {pt.label}
                        </SvgText>
                      </G>
                    );
                  })}
                </>
              ) : (
                <>
                  {/* Zero baseline + upper/lower guides */}
                  {[1, 0, -1].map((dir) => {
                    const midY = padTop + plotHeight / 2;
                    const y = midY - dir * (plotHeight * 0.42);
                    const labelVal = dir * netMaxAbs;
                    return (
                      <G key={`net-grid-${dir}`}>
                        <Line
                          x1={padLeft}
                          y1={y}
                          x2={chartWidth - padRight}
                          y2={y}
                          stroke={dir === 0 ? Palette.mutedSoft : Palette.hairline}
                          strokeWidth={dir === 0 ? 1.2 : 1}
                          strokeDasharray={dir !== 0 ? '3 3' : undefined}
                        />
                        {!privacyMode ? (
                          <SvgText
                            x={padLeft - 6}
                            y={y + 3}
                            fontSize={9}
                            fill={Palette.muted}
                            textAnchor="end"
                          >
                            {dir === 0 ? '0' : formatCompactAxis(labelVal, currency)}
                          </SvgText>
                        ) : null}
                      </G>
                    );
                  })}

                  {/* Connecting Path */}
                  {netPath ? (
                    <Path
                      d={netPath}
                      fill="none"
                      stroke={Palette.ink}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ) : null}

                  {/* Data Nodes */}
                  {netPoints.map((pt, idx) => {
                    const isSelected = idx === safeIndex;
                    const dotColor = pt.net >= 0 ? Palette.success : Palette.error;
                    return (
                      <G key={`net-pt-${pt.periodKey}`}>
                        <Circle
                          cx={pt.cx}
                          cy={pt.cy}
                          r={isSelected ? 6 : 4}
                          fill={dotColor}
                          stroke={Palette.white}
                          strokeWidth={2}
                        />
                        <SvgText
                          x={pt.cx}
                          y={chartHeight - 6}
                          fontSize={10}
                          fontWeight={isSelected ? '700' : '500'}
                          fill={isSelected ? Palette.ink : Palette.muted}
                          textAnchor="middle"
                        >
                          {pt.label}
                        </SvgText>
                      </G>
                    );
                  })}
                </>
              )}
            </Svg>

            {/* Transparent Touch Hit Areas over Each Period Column */}
            <View
              style={[
                styles.touchOverlay,
                { left: padLeft, right: padRight, top: 0, bottom: 0 },
              ]}
            >
              {data.map((pt, idx) => (
                <TouchableOpacity
                  key={`hit-${pt.periodKey}`}
                  style={styles.touchColumn}
                  onPress={() => {
                    AppHaptics.selection();
                    setSelectedIndex(idx);
                  }}
                  activeOpacity={1}
                  accessibilityRole="button"
                  accessibilityLabel={`Inspect ${pt.fullLabel}`}
                />
              ))}
            </View>
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Palette.white,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    ...Typography.heading,
    fontSize: 15,
    fontWeight: '700',
    color: Palette.ink,
  },
  subtitle: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
    marginTop: 2,
  },
  modeSwitch: {
    flexDirection: 'row',
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  modeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  modeBtnActive: {
    backgroundColor: Palette.white,
  },
  modeBtnText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '600',
    color: Palette.muted,
  },
  modeBtnTextActive: {
    color: Palette.ink,
    fontWeight: '700',
  },
  detailStrip: {
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 10,
  },
  detailPeriod: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: Palette.ink,
    marginBottom: 4,
  },
  detailMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 3,
  },
  detailMetricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 5,
  },
  detailMetricLabel: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
  },
  detailMetricVal: {
    ...Typography.body,
    fontSize: 12,
    fontWeight: '700',
    color: Palette.ink,
    flexShrink: 1,
  },
  detailNetText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '700',
  },
  svgContainer: {
    position: 'relative',
    width: '100%',
  },
  touchOverlay: {
    position: 'absolute',
    flexDirection: 'row',
  },
  touchColumn: {
    flex: 1,
    height: '100%',
  },
  emptyBox: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyText: {
    ...Typography.caption,
    fontSize: 12,
    color: Palette.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
