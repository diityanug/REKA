import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Trash2, Copy, X } from 'lucide-react-native';
import { Palette, Typography } from '../../theme/tokens';
import {
  Category,
  CategoryBudgetsMap,
  CurrencyType,
  BillingCycleConfig,
  filterSelectableCategories,
} from '../../types';
import {
  formatCurrency,
  formatCurrencyNumberForInput,
} from '../../utils/formatters';
import { formatPeriodLabelWithCycle } from '../../utils/billingCycle';
import { AppHaptics } from '../../utils/haptics';
import { useLastDefined } from '../../hooks/useLastDefined';
import { useSyncOnChange } from '../../hooks/useSyncOnChange';
import { useLocalAlert } from '../../hooks/useLocalAlert';
import { ModalHeader } from '../ModalHeader';
import { KeyboardSafeContainer } from '../KeyboardSafeContainer';
import { BottomSheetModal } from '../BottomSheetModal';
import { CategoryIcon } from '../CategoryIcon';
import { AmountInputModal } from './AmountInputModal';
import { CustomAlertModal } from '../CustomAlertModal';

interface SetBudgetModalProps {
  visible: boolean;
  activeCurrency: CurrencyType;
  selectedMonth: string;
  billingCycle?: BillingCycleConfig;
  currentBudget: number;
  categoryBudgets: CategoryBudgetsMap;
  categories: Category[];
  onSaveCategoryBudgets: (budgets: CategoryBudgetsMap) => void | Promise<void>;
  onCopyPrevMonth?: () => Promise<CategoryBudgetsMap>;
  onRemove: () => void | Promise<void>;
  onClose: () => void;
}

export const SetBudgetModal: React.FC<SetBudgetModalProps> = ({
  visible,
  activeCurrency,
  selectedMonth,
  billingCycle,
  currentBudget,
  categoryBudgets,
  categories,
  onSaveCategoryBudgets,
  onCopyPrevMonth,
  onRemove,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const [draftBudgets, setDraftBudgets] = useState<CategoryBudgetsMap>({});
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [removing, setRemoving] = useState<boolean>(false);
  const [copying, setCopying] = useState<boolean>(false);

  const effectiveBudget =
    useLastDefined(!saving && !removing && visible ? currentBudget : null) ?? currentBudget;
  const { alertConfig, showAlert, hideAlert } = useLocalAlert();

  useSyncOnChange([visible], () => {
    if (visible) {
      setDraftBudgets({ ...(categoryBudgets || {}) });
      setEditingCategory(null);
      setSaving(false);
      setRemoving(false);
      setCopying(false);
    }
  });

  const expenseCategories = useMemo(
    () => filterSelectableCategories(categories, 'expense'),
    [categories]
  );

  // Include any legacy/deleted category keys already budgeted in this month so nothing is hidden
  const displayCategories = useMemo(() => {
    const knownNames = new Set(expenseCategories.map((c) => c.name.toLowerCase()));
    const extras: Category[] = Object.keys(draftBudgets)
      .filter((name) => !knownNames.has(name.toLowerCase()) && (draftBudgets[name] || 0) > 0)
      .map((name) => ({
        id: `extra_${name}`,
        name,
        type: 'expense',
        icon: 'Tag',
        color: Palette.primary,
        isDefault: false,
      }));
    return [...expenseCategories, ...extras];
  }, [expenseCategories, draftBudgets]);

  const activeCategoryEntries = useMemo(
    () => Object.entries(draftBudgets).filter(([, val]) => Number(val) > 0),
    [draftBudgets]
  );

  const computedTotal = useMemo(
    () => activeCategoryEntries.reduce((sum, [, val]) => sum + (Number(val) || 0), 0),
    [activeCategoryEntries]
  );

  const isLegacyGlobalOnly =
    effectiveBudget > 0 &&
    Object.keys(categoryBudgets || {}).length === 0 &&
    computedTotal === 0;

  const periodLabel = `${formatPeriodLabelWithCycle(selectedMonth, billingCycle)} · ${activeCurrency}`;
  const canSubmit = !saving && !removing && computedTotal > 0;

  const handleSetCategoryValue = (catName: string, num: number) => {
    setDraftBudgets((prev) => {
      const next = { ...prev };
      if (num > 0) {
        next[catName] = num;
      } else {
        delete next[catName];
      }
      return next;
    });
  };

  const handleCopyPrevious = async () => {
    if (!onCopyPrevMonth || copying) return;
    AppHaptics.selection();
    setCopying(true);
    try {
      const prevMap = await onCopyPrevMonth();
      const entries = Object.entries(prevMap || {}).filter(([, v]) => Number(v) > 0);
      if (entries.length === 0) {
        showAlert(
          'No Previous Budget',
          'There are no category budgets saved in the previous period to copy.',
          undefined,
          'info'
        );
        return;
      }
      setDraftBudgets(prevMap);
      AppHaptics.success();
    } catch {
      showAlert('Notice', 'Could not load previous period budgets.', undefined, 'warning');
    } finally {
      setCopying(false);
    }
  };

  const submit = async () => {
    if (!canSubmit) return;
    AppHaptics.heavy();
    setSaving(true);
    try {
      await onSaveCategoryBudgets(draftBudgets);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const runRemove = async () => {
    if (removing) return;
    setRemoving(true);
    try {
      await onRemove();
      onClose();
    } finally {
      setRemoving(false);
    }
  };

  const requestRemove = () => {
    if (removing) return;
    AppHaptics.light();
    Keyboard.dismiss();
    showAlert(
      'Remove Budget Limit',
      'Remove all category budgets and the total budget limit for this period?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: runRemove,
        },
      ],
      'confirm'
    );
  };

  const editingCurrentAmount = editingCategory ? draftBudgets[editingCategory] || 0 : 0;

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      fullPage={true}
      presentation="push"
    >
      <ModalHeader
        title="Monthly Category Budgets"
        subtitle={periodLabel}
        onClose={onClose}
        leadingIcon="back"
      />

      <KeyboardSafeContainer extraBottomSpace={28}>
        {/* Main Auto-Total Summary Card */}
        <View style={styles.totalSummaryCard}>
          <View style={styles.totalSummaryTop}>
            <Text style={styles.totalSummaryLabel}>TOTAL BUDGET (AUTO-SUM)</Text>
            <View style={styles.countPill}>
              <Text style={styles.countPillText}>
                {activeCategoryEntries.length}{' '}
                {activeCategoryEntries.length === 1 ? 'category' : 'categories'}
              </Text>
            </View>
          </View>
          <Text
            style={styles.totalSummaryValue}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {formatCurrency(computedTotal, activeCurrency)}
          </Text>
          <Text style={styles.totalSummaryHint}>
            {isLegacyGlobalOnly
              ? `Current overall limit is ${formatCurrency(effectiveBudget, activeCurrency)}. Assign categories below to switch to auto-summed category budgets.`
              : 'Total budget automatically sums every category limit you set below.'}
          </Text>
        </View>

        {/* Section Header + Copy from Previous Period */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Set Budget per Category</Text>
          {onCopyPrevMonth ? (
            <TouchableOpacity
              style={styles.copyPrevBtn}
              onPress={handleCopyPrevious}
              disabled={copying}
              activeOpacity={0.75}
            >
              {copying ? (
                <ActivityIndicator size="small" color={Palette.primary} />
              ) : (
                <>
                  <Copy size={12} color={Palette.primary} />
                  <Text style={styles.copyPrevBtnText}>Copy Last Period</Text>
                </>
              )}
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Category Budget Rows */}
        <View style={styles.categoryList}>
          {displayCategories.map((cat) => {
            const val = draftBudgets[cat.name] || 0;
            const isSet = val > 0;
            return (
              <View
                key={cat.id}
                style={[styles.categoryRow, isSet && styles.categoryRowActive]}
              >
                <TouchableOpacity
                  style={styles.categoryRowMain}
                  onPress={() => {
                    AppHaptics.light();
                    Keyboard.dismiss();
                    setEditingCategory(cat.name);
                  }}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={`Set budget for ${cat.name}, currently ${
                    isSet ? formatCurrency(val, activeCurrency) : 'not set'
                  }`}
                >
                  <View
                    style={[
                      styles.catIconBox,
                      isSet && { backgroundColor: '#FDF0ED' },
                    ]}
                  >
                    <CategoryIcon
                      name={cat.icon}
                      size={16}
                      color={isSet ? Palette.primary : Palette.muted}
                    />
                  </View>
                  <View style={styles.catTextCol}>
                    <Text style={styles.catName} numberOfLines={1}>
                      {cat.name}
                    </Text>
                    <Text style={styles.catSub}>
                      {isSet ? 'Tap to adjust limit' : 'Tap to add budget'}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.amountPill,
                      isSet && styles.amountPillActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.amountPillText,
                        isSet && styles.amountPillTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {isSet
                        ? formatCurrency(val, activeCurrency)
                        : activeCurrency === 'IDR'
                          ? '+ Set Rp'
                          : '+ Set $'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {isSet ? (
                  <TouchableOpacity
                    style={styles.clearCatBtn}
                    onPress={() => {
                      AppHaptics.selection();
                      handleSetCategoryValue(cat.name, 0);
                    }}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 6, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove budget for ${cat.name}`}
                  >
                    <X size={14} color={Palette.muted} />
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })}
        </View>

        {effectiveBudget > 0 ? (
          <TouchableOpacity
            style={styles.removeBtn}
            onPress={requestRemove}
            disabled={removing}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Remove all budgets for this period"
          >
            {removing ? (
              <ActivityIndicator size="small" color={Palette.error} />
            ) : (
              <>
                <Trash2 size={15} color={Palette.error} style={{ marginRight: 6 }} />
                <Text style={styles.removeBtnText}>Clear All Budgets</Text>
              </>
            )}
          </TouchableOpacity>
        ) : null}
      </KeyboardSafeContainer>

      {/* Sticky Footer Save CTA */}
      <View
        style={[
          styles.stickyFooter,
          { paddingBottom: Math.max(insets.bottom, 16) },
        ]}
      >
        <TouchableOpacity
          style={[styles.saveBtn, !canSubmit && { opacity: 0.45 }]}
          onPress={submit}
          disabled={!canSubmit}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Save category budgets"
          accessibilityState={{ disabled: !canSubmit, busy: saving }}
        >
          {saving ? (
            <>
              <ActivityIndicator size="small" color={Palette.white} style={{ marginRight: 8 }} />
              <Text style={styles.saveBtnText}>Saving...</Text>
            </>
          ) : (
            <>
              <Check size={18} color={Palette.white} style={{ marginRight: 8 }} />
              <Text style={styles.saveBtnText}>
                {computedTotal > 0
                  ? `Save Budget (${formatCurrency(computedTotal, activeCurrency)})`
                  : 'Select a Category to Budget'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <AmountInputModal
        visible={!!editingCategory}
        title={editingCategory ? `${editingCategory} Budget` : 'Category Budget'}
        subtitle={`${periodLabel} · Enter 0 to remove`}
        initialAmount={
          editingCurrentAmount > 0
            ? formatCurrencyNumberForInput(editingCurrentAmount, activeCurrency)
            : ''
        }
        currency={activeCurrency}
        allowZero
        onConfirm={(_formatted, numericVal) => {
          if (editingCategory) {
            handleSetCategoryValue(editingCategory, numericVal > 0 ? numericVal : 0);
          }
          setEditingCategory(null);
        }}
        onClose={() => setEditingCategory(null)}
      />

      <CustomAlertModal
        visible={alertConfig.visible}
        alertId={alertConfig.id}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        type={alertConfig.type}
        onClose={hideAlert}
      />
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  totalSummaryCard: {
    backgroundColor: Palette.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  totalSummaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  totalSummaryLabel: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: '700',
    color: Palette.muted,
    letterSpacing: 0.6,
  },
  countPill: {
    backgroundColor: Palette.white,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  countPillText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: Palette.primary,
  },
  totalSummaryValue: {
    ...Typography.heading,
    fontSize: 28,
    fontWeight: '800',
    color: Palette.ink,
    marginBottom: 4,
  },
  totalSummaryHint: {
    ...Typography.caption,
    fontSize: 12,
    color: Palette.muted,
    lineHeight: 17,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    ...Typography.subheading,
    fontSize: 13,
    fontWeight: '700',
    color: Palette.ink,
  },
  copyPrevBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FDF0ED',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  copyPrevBtnText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: Palette.primary,
  },
  categoryList: {
    gap: 8,
    marginBottom: 14,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.white,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  categoryRowActive: {
    borderColor: Palette.primary,
    backgroundColor: '#FFFCFB',
  },
  categoryRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  catIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Palette.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  catTextCol: {
    flex: 1,
    marginRight: 8,
  },
  catName: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: '600',
    color: Palette.ink,
  },
  catSub: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
    marginTop: 1,
  },
  amountPill: {
    backgroundColor: Palette.surfaceSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    maxWidth: 130,
  },
  amountPillActive: {
    backgroundColor: '#FDF0ED',
  },
  amountPillText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: Palette.muted,
  },
  amountPillTextActive: {
    color: Palette.primary,
    fontWeight: '700',
  },
  clearCatBtn: {
    marginLeft: 6,
    padding: 4,
  },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#FDF0ED',
    marginTop: 4,
  },
  removeBtnText: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '600',
    color: Palette.error,
  },
  stickyFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Palette.hairline,
    backgroundColor: Palette.white,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.ink,
    paddingVertical: 14,
    borderRadius: 16,
  },
  saveBtnText: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: '700',
    color: Palette.white,
  },
});
