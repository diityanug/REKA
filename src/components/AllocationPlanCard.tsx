import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Layers, Copy } from 'lucide-react-native';
import { Palette, Typography } from '../theme/tokens';
import { AllocationPlan, CurrencyType } from '../types';
import { formatCurrency } from '../utils/formatters';
import { AppHaptics } from '../utils/haptics';

interface AllocationPlanCardProps {
  plan: AllocationPlan;
  activeCurrency: CurrencyType;
  privacyMode: boolean;
  onEdit: (plan: AllocationPlan) => void;
  onDuplicate?: (plan: AllocationPlan) => void;
  onApply?: (plan: AllocationPlan) => void;
}

export const AllocationPlanCard: React.FC<AllocationPlanCardProps> = ({
  plan,
  activeCurrency,
  privacyMode,
  onEdit,
  onDuplicate,
  onApply,
}) => {
  const planCurrency = plan.currency || activeCurrency;
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
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.planTitle}>{plan.title}</Text>
            <Text style={styles.planSubtitle}>
              {plan.items.length} Allocation Item{plan.items.length > 1 ? 's' : ''}
            </Text>
          </View>
        </View>
        <View style={styles.headerRightWrap}>
          {onDuplicate && (
            <TouchableOpacity
              style={styles.duplicateCardBtn}
              onPress={(e) => {
                e?.stopPropagation?.();
                AppHaptics.light();
                onDuplicate(plan);
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Duplicate ${plan.title}`}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            >
              <Copy size={14} color={Palette.muted} />
            </TouchableOpacity>
          )}
          <View style={styles.currencyBadge}>
            <Text style={styles.currencyBadgeText}>{planCurrency}</Text>
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
            {/* Left Column: Description (wraps cleanly, never truncated with ...) */}
            <View style={styles.leftCol}>
              <View style={styles.bulletDot} />
              <Text style={styles.itemLabel}>
                {item.label}
              </Text>
            </View>

            {/* Right Column: Amount (Strictly right-aligned, scales cleanly for billions) */}
            <View style={styles.rightCol}>
              <Text
                style={styles.itemAmount}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.78}
              >
                {formatCurrency(item.amount, planCurrency, privacyMode)}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Card Footer: Total Allocated */}
      <View style={styles.footerRow}>
        <Text style={styles.footerLabel}>Total Allocated:</Text>
        <Text
          style={styles.footerAmount}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.78}
        >
          {formatCurrency(totalAmount, planCurrency, privacyMode)}
        </Text>
      </View>

      {/* Apply to Pockets Action Button */}
      {onApply && (
        <TouchableOpacity
          style={styles.applyBtn}
          onPress={(e) => {
            e?.stopPropagation?.();
            AppHaptics.medium();
            onApply(plan);
          }}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Apply ${plan.title} to pockets`}
        >
          <Layers size={14} color={Palette.primary} style={{ marginRight: 6 }} />
          <Text style={styles.applyBtnText}>Apply to Pockets</Text>
        </TouchableOpacity>
      )}
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
    fontSize: 14.5,
    lineHeight: 19,
    fontWeight: '700',
    color: Palette.ink,
  },
  planSubtitle: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
    marginTop: 1,
  },
  headerRightWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  duplicateCardBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Palette.surfaceSoft,
    borderWidth: 1,
    borderColor: Palette.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  currencyBadge: {
    backgroundColor: Palette.surfaceSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
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
  itemsContainer: {
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
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
    minWidth: 0,
    paddingRight: 12,
    borderRightWidth: 1,
    borderRightColor: Palette.hairline,
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Palette.primary,
    marginRight: 8,
    flexShrink: 0,
  },
  itemLabel: {
    ...Typography.body,
    fontSize: 12.5,
    lineHeight: 17,
    color: Palette.ink,
    fontWeight: '500',
    flex: 1,
  },
  rightCol: {
    width: '44%',
    minWidth: 120,
    paddingLeft: 12,
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexShrink: 0,
  },
  itemAmount: {
    ...Typography.mono,
    fontSize: 12.5,
    fontWeight: '700',
    color: Palette.ink,
    textAlign: 'right',
    width: '100%',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    paddingTop: 2,
  },
  footerLabel: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: Palette.muted,
    flexShrink: 0,
  },
  footerAmount: {
    ...Typography.mono,
    fontSize: 15.5,
    fontWeight: '700',
    color: Palette.ink,
    flex: 1,
    textAlign: 'right',
  },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F9F7',
    borderRadius: 12,
    paddingVertical: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#D1E6E0',
  },
  applyBtnText: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '700',
    color: Palette.primary,
  },
});
