import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Layers } from 'lucide-react-native';
import { Palette, Typography } from '../theme/tokens';
import { AllocationPlan, CurrencyType } from '../types';
import { formatCurrency } from '../utils/formatters';
import { AppHaptics } from '../utils/haptics';

interface AllocationPlanCardProps {
  plan: AllocationPlan;
  activeCurrency: CurrencyType;
  privacyMode: boolean;
  onEdit: (plan: AllocationPlan) => void;
}

export const AllocationPlanCard: React.FC<AllocationPlanCardProps> = ({
  plan,
  activeCurrency,
  privacyMode,
  onEdit,
}) => {
  const totalAmount = plan.items.reduce((sum, it) => sum + (it.amount || 0), 0);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => {
        AppHaptics.light();
        onEdit(plan);
      }}
      activeOpacity={0.85}
    >
      {/* Card Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <View style={styles.iconCircle}>
            <Layers size={15} color={Palette.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.planTitle}>{plan.title}</Text>
            <Text style={styles.planSubtitle}>
              {plan.items.length} Allocation Item{plan.items.length > 1 ? 's' : ''}
            </Text>
          </View>
        </View>
      </View>

      {/* 2-Column Details List */}
      <View style={styles.itemsContainer}>
        {plan.items.map((item, index) => (
          <View
            key={item.id || index}
            style={[
              styles.itemRow,
              index === plan.items.length - 1 && styles.itemRowLast,
            ]}
          >
            {/* Left Column: Description */}
            <View style={styles.leftCol}>
              <View style={styles.bulletDot} />
              <Text style={styles.itemLabel} numberOfLines={1} ellipsizeMode="tail">
                {item.label}
              </Text>
            </View>

            {/* Right Column: Amount (Strictly right-aligned, no overlap) */}
            <View style={styles.rightCol}>
              <Text style={styles.itemAmount} numberOfLines={1}>
                {formatCurrency(item.amount, activeCurrency, privacyMode)}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Card Footer: Total Allocated */}
      <View style={styles.footerRow}>
        <Text style={styles.footerLabel}>Total Allocated:</Text>
        <Text style={styles.footerAmount}>
          {formatCurrency(totalAmount, activeCurrency, privacyMode)}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Palette.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FDF0ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  planTitle: {
    ...Typography.body,
    fontSize: 15,
    fontWeight: '700',
    color: Palette.ink,
  },
  planSubtitle: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
    marginTop: 1,
  },
  itemsContainer: {
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.hairline,
  },
  itemRowLast: {
    borderBottomWidth: 0,
  },
  leftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 12,
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Palette.primary,
    marginRight: 8,
  },
  itemLabel: {
    ...Typography.body,
    fontSize: 13,
    color: Palette.ink,
    fontWeight: '500',
    flexShrink: 1,
  },
  rightCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  itemAmount: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '700',
    color: Palette.ink,
    textAlign: 'right',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 2,
  },
  footerLabel: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: Palette.muted,
  },
  footerAmount: {
    ...Typography.heading,
    fontSize: 16,
    fontWeight: '700',
    color: Palette.ink,
  },
});
