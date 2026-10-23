import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { G, Circle } from 'react-native-svg';
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
  centerTitle?: string;
  centerValue?: string;
  centerSubtitle?: string;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  data,
  size = 190,
  strokeWidth = 22,
  centerTitle,
  centerValue,
  centerSubtitle,
}) => {
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Filter out any zero or invalid percentage items
  const validData = data.filter((d) => d.percentage > 0);

  // If there are multiple slices, add a small visual separator gap (in pixels of circumference)
  const gap = validData.length > 1 ? 3 : 0;

  // Compute slice offsets
  let accumulated = 0;
  const slices = validData.map((slice) => {
    const fraction = slice.percentage / 100;
    const strokeLength = Math.max(fraction * circumference - gap, 0.5);
    const offset = -accumulated;
    accumulated += fraction * circumference;
    return {
      ...slice,
      dashArray: `${strokeLength} ${circumference}`,
      dashOffset: offset,
    };
  });

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
          {slices.map((slice) => (
            <Circle
              key={slice.label}
              cx={center}
              cy={center}
              r={radius}
              stroke={slice.color}
              strokeWidth={strokeWidth}
              strokeDasharray={slice.dashArray}
              strokeDashoffset={slice.dashOffset}
              strokeLinecap={validData.length > 1 ? 'round' : 'butt'}
              fill="none"
            />
          ))}
        </G>
      </Svg>

      {/* Center Information */}
      <View style={[styles.centerOverlay, { width: size - strokeWidth * 2, height: size - strokeWidth * 2 }]}>
        {centerTitle ? (
          <Text style={styles.centerTitleText} numberOfLines={1}>
            {centerTitle}
          </Text>
        ) : null}

        {centerValue ? (
          <Text style={styles.centerValueText} numberOfLines={1} adjustsFontSizeToFit>
            {centerValue}
          </Text>
        ) : null}

        {centerSubtitle ? (
          <Text style={styles.centerSubtitleText} numberOfLines={1}>
            {centerSubtitle}
          </Text>
        ) : null}
      </View>
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
    ...Typography.heading,
    fontSize: 16,
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
