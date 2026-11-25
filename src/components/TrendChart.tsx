import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { G, Rect, Line, Path, Circle, Text as SvgText } from 'react-native-svg';
import { FontFamily, Palette, Typography } from '../theme/tokens';
import { CurrencyType } from '../types';
import { formatCurrency } from '../utils/formatters';
import { AppHaptics } from '../utils/haptics';
import { FadeSlideSwitch } from './MotionPrimitives';

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

  const chartHeight = 196;
  const padLeft = 46;
  const padRight = 10;
  const padTop = 18;
  const padBottom = 34;
  const plotWidth = Math.max(120, chartWidth - padLeft - padRight);
  const plotHeight = chartHeight - padTop - padBottom;

  const maxBarVal = Math.max(
    1,
    ...data.map((d) => Math.max(d.income, d.expense))
  );
  const netMaxAbs = Math.max(1, ...data.map((d) => Math.abs(d.net)));

  const slotWidth = data.length > 0 ? plotWidth / data.length : plotWidth;
  const barWidth = Math.max(8, Math.min(13, (slotWidth - 18) / 2));

  // Build Net Cashflow line coordinates (0 centered)
  const netPoints = data.map((d, idx) => {
    const cx = padLeft + slotWidth * idx + slotWidth / 2;
    const midY = padTop + plotHeight / 2;
    const cy = midY - (d.net / netMaxAbs) * (plotHeight * 0.4);
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
        <View style={styles.headerTextWrap}>
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
          {/* Selected Period Mini Ledger — Airy 3-row layout (handles Rp billions cleanly) */}
          {activePoint ? (
            <View style={styles.detailCard}>
              <View style={styles.detailTopRow}>
                <Text style={styles.detailPeriod}>{activePoint.fullLabel}</Text>
                <Text style={styles.detailHint}>
                  {mode === 'bars' ? 'Tap bar to inspect' : 'Tap point to inspect'}
                </Text>
              </View>

              <View style={styles.detailDivider} />

              <View style={styles.detailRows}>
                <View style={styles.detailRow}>
                  <View style={styles.detailLabelGroup}>
                    <View style={[styles.legendDot, { backgroundColor: Palette.accentTeal }]} />
                    <Text style={styles.detailMetricLabel}>Income</Text>
                  </View>
                  <Text
                    style={styles.detailMetricVal}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.82}
                  >
                    {formatCurrency(activePoint.income, currency, privacyMode)}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <View style={styles.detailLabelGroup}>
                    <View style={[styles.legendDot, { backgroundColor: Palette.primary }]} />
                    <Text style={styles.detailMetricLabel}>Expense</Text>
                  </View>
                  <Text
                    style={styles.detailMetricVal}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.82}
                  >
                    {formatCurrency(activePoint.expense, currency, privacyMode)}
                  </Text>
                </View>
              </View>

              <View style={styles.detailNetRow}>
                <Text style={styles.detailNetLabel}>Net Cashflow</Text>
                <Text
                  style={[
                    styles.detailNetVal,
                    { color: activePoint.net >= 0 ? Palette.success : Palette.error },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.82}
                >
                  {activePoint.net >= 0 ? '+' : '-'}
                  {formatCurrency(Math.abs(activePoint.net), currency, privacyMode)}
                </Text>
              </View>
            </View>
          ) : null}

          {/* SVG Plot Area */}
          <FadeSlideSwitch
            transitionKey={mode}
            offsetY={6}
            duration={210}
            style={styles.svgContainer}
          >
            <View
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
                          strokeDasharray={ratio > 0 ? '3 4' : undefined}
                        />
                        {!privacyMode ? (
                          <SvgText
                            x={padLeft - 8}
                            y={y + 3.5}
                            fontSize={10}
                            fontFamily={FontFamily.sans}
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
                    const incH = Math.max(pt.income > 0 ? 4 : 0, (pt.income / maxBarVal) * plotHeight);
                    const expH = Math.max(pt.expense > 0 ? 4 : 0, (pt.expense / maxBarVal) * plotHeight);
                    const baseY = padTop + plotHeight;
                    const gap = 4;

                    return (
                      <G key={pt.periodKey}>
                        {isSelected ? (
                          <Rect
                            x={padLeft + slotWidth * idx + 4}
                            y={padTop - 8}
                            width={Math.max(slotWidth - 8, 12)}
                            height={plotHeight + 12}
                            rx={10}
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
                          opacity={isSelected ? 1 : 0.68}
                        />

                        {/* Expense Bar */}
                        <Rect
                          x={groupCenter + gap / 2}
                          y={baseY - expH}
                          width={barWidth}
                          height={expH}
                          rx={4}
                          fill={Palette.primary}
                          opacity={isSelected ? 1 : 0.68}
                        />

                        {/* X-Axis Period Label */}
                        <SvgText
                          x={groupCenter}
                          y={chartHeight - 10}
                          fontSize={11}
                          fontFamily={FontFamily.sans}
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
                    const y = midY - dir * (plotHeight * 0.4);
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
                          strokeDasharray={dir !== 0 ? '3 4' : undefined}
                        />
                        {!privacyMode ? (
                          <SvgText
                            x={padLeft - 8}
                            y={y + 3.5}
                            fontSize={10}
                            fontFamily={FontFamily.sans}
                            fill={Palette.muted}
                            textAnchor="end"
                          >
                            {dir === 0 ? '0' : formatCompactAxis(labelVal, currency)}
                          </SvgText>
                        ) : null}
                      </G>
                    );
                  })}

                  {/* Selected Point Vertical Crosshair Guide (distinct from bar column highlight) */}
                  {netPoints[safeIndex] ? (
                    <Line
                      x1={netPoints[safeIndex].cx}
                      y1={padTop - 4}
                      x2={netPoints[safeIndex].cx}
                      y2={padTop + plotHeight + 2}
                      stroke={Palette.mutedSoft}
                      strokeWidth={1.2}
                      strokeDasharray="3 3"
                      opacity={0.75}
                    />
                  ) : null}

                  {/* Connecting Path */}
                  {netPath ? (
                    <Path
                      d={netPath}
                      fill="none"
                      stroke={Palette.ink}
                      strokeWidth={2.2}
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
                        {isSelected ? (
                          <Circle
                            cx={pt.cx}
                            cy={pt.cy}
                            r={11}
                            fill={dotColor}
                            opacity={0.18}
                          />
                        ) : null}
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
                          y={chartHeight - 10}
                          fontSize={11}
                          fontFamily={FontFamily.sans}
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
          </FadeSlideSwitch>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Palette.white,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  headerTextWrap: {
    flex: 1,
  },
  title: {
    fontFamily: FontFamily.sans,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: Palette.ink,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontFamily: FontFamily.sans,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: Palette.muted,
    marginTop: 2,
  },
  modeSwitch: {
    flexDirection: 'row',
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 10,
    padding: 3,
    gap: 2,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  modeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  modeBtnActive: {
    backgroundColor: Palette.white,
  },
  modeBtnText: {
    fontFamily: FontFamily.sans,
    fontSize: 11.5,
    lineHeight: 14,
    fontWeight: '600',
    color: Palette.muted,
  },
  modeBtnTextActive: {
    color: Palette.ink,
    fontWeight: '700',
  },
  detailCard: {
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  detailTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  detailPeriod: {
    fontFamily: FontFamily.sans,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
    color: Palette.ink,
  },
  detailHint: {
    fontFamily: FontFamily.sans,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
    color: Palette.muted,
  },
  detailDivider: {
    height: 1,
    backgroundColor: Palette.hairline,
    marginVertical: 10,
  },
  detailRows: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  detailLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  detailMetricLabel: {
    fontFamily: FontFamily.sans,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '500',
    color: Palette.muted,
  },
  detailMetricVal: {
    ...Typography.mono,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
    color: Palette.ink,
    textAlign: 'right',
    flexShrink: 1,
  },
  detailNetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Palette.hairline,
  },
  detailNetLabel: {
    fontFamily: FontFamily.sans,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '600',
    color: Palette.ink,
    flexShrink: 0,
  },
  detailNetVal: {
    ...Typography.mono,
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '700',
    textAlign: 'right',
    flexShrink: 1,
  },
  svgContainer: {
    position: 'relative',
    width: '100%',
    paddingTop: 2,
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
    paddingVertical: 24,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: FontFamily.sans,
    fontSize: 12.5,
    color: Palette.muted,
    textAlign: 'center',
    lineHeight: 19,
  },
});
