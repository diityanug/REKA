import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { G, Circle, Line } from 'react-native-svg';
import { Palette, Typography } from '../theme/tokens';

export interface DonutSlice {
  label: string;
  value: number;
  percentage: number;
  color: string;
}

export interface DonutChartProps {
  data: DonutSlice[];
  size?: number;
  strokeWidth?: number;
  selectedLabel?: string | null;
  onPressCenter?: () => void;
  centerTitle?: string;
  centerValue?: string;
  centerSubtitle?: string;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  data,
  size = 190,
  strokeWidth = 22,
  selectedLabel = null,
  onPressCenter,
  centerTitle,
  centerValue,
  centerSubtitle,
}) => {
  const focusBump = 4;
  const center = size / 2;
  const radius = (size - (strokeWidth + focusBump)) / 2;
  const circumference = 2 * Math.PI * radius;

  // Filter out any zero or invalid percentage items
  const validData = data.filter((d) => d.percentage > 0);
  const totalPct = validData.reduce((sum, d) => sum + d.percentage, 0) || 100;
  const hasSelection = Boolean(
    selectedLabel && validData.some((d) => d.label === selectedLabel)
  );

  // Compute exact flush arcs + crisp radial divider angles (no bulbous overlapping round caps)
  const { slices, dividerAngles } = validData.reduce<{
    slices: (DonutSlice & { dashArray: string; dashOffset: number })[];
    dividerAngles: number[];
    accumulatedPct: number;
  }>(
    (acc, slice) => {
      const normalizedFraction = slice.percentage / totalPct;
      const arcLength = Math.max(normalizedFraction * circumference, 1.5);
      const offset = -(acc.accumulatedPct / totalPct) * circumference;

      // Record radial boundary angle (0 rad = 12 o'clock because outer G is rotated -90deg)
      acc.dividerAngles.push((acc.accumulatedPct / totalPct) * 2 * Math.PI);
      acc.slices.push({
        ...slice,
        dashArray: `${arcLength} ${circumference}`,
        dashOffset: offset,
      });
      acc.accumulatedPct += slice.percentage;
      return acc;
    },
    { slices: [], dividerAngles: [], accumulatedPct: 0 }
  );

  // Inner and outer radii slightly overdraw the ring edges so white radial cuts are razor sharp
  const maxRingWidth = strokeWidth + focusBump;
  const innerR = radius - maxRingWidth / 2 - 1;
  const outerR = radius + maxRingWidth / 2 + 1;

  // Render dimmed slices first, active slice last so the focused slice sits crisply on top
  const orderedSlices = hasSelection
    ? [
        ...slices.filter((s) => s.label !== selectedLabel),
        ...slices.filter((s) => s.label === selectedLabel),
      ]
    : slices;

  const centerInnerWidth = size - maxRingWidth * 2 - 6;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background Base Ring */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={Palette.surfaceSoft}
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Data Segments starting at 12 o'clock (-90 deg) */}
        <G rotation="-90" origin={`${center}, ${center}`}>
          {orderedSlices.map((slice) => {
            const isSelected = hasSelection && slice.label === selectedLabel;
            const isDimmed = hasSelection && !isSelected;
            return (
              <Circle
                key={slice.label}
                cx={center}
                cy={center}
                r={radius}
                stroke={slice.color}
                strokeWidth={isSelected ? strokeWidth + focusBump : strokeWidth}
                strokeDasharray={slice.dashArray}
                strokeDashoffset={slice.dashOffset}
                strokeLinecap="butt"
                strokeOpacity={isDimmed ? 0.14 : 1}
                fill="none"
              />
            );
          })}

          {/* Crisp Uniform Radial Separators between Slices */}
          {validData.length > 1
            ? dividerAngles.map((angle, idx) => {
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);
                return (
                  <Line
                    key={`div-${idx}`}
                    x1={center + innerR * cos}
                    y1={center + innerR * sin}
                    x2={center + outerR * cos}
                    y2={center + outerR * sin}
                    stroke={Palette.white}
                    strokeWidth={2.5}
                    strokeLinecap="butt"
                  />
                );
              })
            : null}
        </G>
      </Svg>

      {/* Center Information (tap to reset when focused) */}
      <TouchableOpacity
        disabled={!onPressCenter}
        onPress={onPressCenter}
        activeOpacity={0.75}
        style={[
          styles.centerOverlay,
          { width: centerInnerWidth, height: centerInnerWidth },
        ]}
      >
        {centerTitle ? (
          <Text style={styles.centerTitleText} numberOfLines={1}>
            {centerTitle}
          </Text>
        ) : null}

        {centerValue ? (
          <Text
            style={styles.centerValueText}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.72}
          >
            {centerValue}
          </Text>
        ) : null}

        {centerSubtitle ? (
          <Text style={styles.centerSubtitleText} numberOfLines={1}>
            {centerSubtitle}
          </Text>
        ) : null}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  centerOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  centerTitleText: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: '700',
    color: Palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  centerValueText: {
    ...Typography.mono,
    fontSize: 15.5,
    fontWeight: '700',
    color: Palette.ink,
    textAlign: 'center',
  },
  centerSubtitleText: {
    ...Typography.caption,
    fontSize: 10,
    color: Palette.muted,
    fontWeight: '500',
    marginTop: 2,
  },
});
