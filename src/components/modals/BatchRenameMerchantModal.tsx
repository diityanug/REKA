import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Info, Pencil } from 'lucide-react-native';
import { Palette, Typography } from '../../theme/tokens';
import { AppHaptics } from '../../utils/haptics';
import { useSyncOnChange } from '../../hooks/useSyncOnChange';
import { BottomSheetModal } from '../BottomSheetModal';
import { ModalHeader } from '../ModalHeader';
import { KeyboardSafeContainer } from '../KeyboardSafeContainer';
import { StableTextInput } from '../StableTextInput';

interface BatchRenameMerchantModalProps {
  visible: boolean;
  eligibleCount: number;
  skippedTransferCount: number;
  existingNames: string[];
  onConfirm: (newMerchantName: string) => Promise<boolean>;
  onClose: () => void;
}

export const BatchRenameMerchantModal: React.FC<BatchRenameMerchantModalProps> = ({
  visible,
  eligibleCount,
  skippedTransferCount,
  existingNames,
  onConfirm,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const [merchantName, setMerchantName] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const savingRef = useRef<boolean>(false);

  const uniqueSuggestions = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const raw of existingNames) {
      const cleaned = (raw || '').trim();
      if (!cleaned) continue;
      const key = cleaned.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        list.push(cleaned);
      }
      if (list.length >= 6) break;
    }
    return list;
  }, [existingNames]);

  useSyncOnChange([visible], () => {
    if (visible) {
      setMerchantName('');
      setSaving(false);
      savingRef.current = false;
    }
  });

  const trimmed = merchantName.trim();
  const canSubmit = !saving && eligibleCount > 0 && trimmed.length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || savingRef.current) return;
    Keyboard.dismiss();
    savingRef.current = true;
    setSaving(true);
    try {
      const ok = await onConfirm(trimmed);
      if (ok) {
        onClose();
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      maxHeight="82%"
      sheetStyle={styles.sheetCanvas}
    >
      <ModalHeader
        title="Rename Merchant"
        subtitle={`Apply one merchant name to ${eligibleCount} ${eligibleCount === 1 ? 'transaction' : 'transactions'}`}
        onClose={onClose}
      />

      <KeyboardSafeContainer
        adaptive={true}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 16) + 12 },
        ]}
        extraBottomSpace={16}
      >
        <Text style={styles.inputLabel}>
          New Merchant Name <Text style={styles.requiredStar}>*</Text>
        </Text>
        <View style={styles.inputWrap}>
          <Pencil size={15} color={Palette.primary} style={{ marginRight: 8 }} />
          <StableTextInput
            style={styles.textInput}
            placeholder="e.g. Parking Fee, KRL, Lunch"
            placeholderTextColor={Palette.mutedSoft}
            value={merchantName}
            onChangeText={setMerchantName}
            maxLength={50}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />
        </View>

        {uniqueSuggestions.length > 0 ? (
          <View style={styles.suggestionsSection}>
            <Text style={styles.suggestionsLabel}>Use existing name from selection</Text>
            <View style={styles.chipsRow}>
              {uniqueSuggestions.map((name) => {
                const isSelected = trimmed.toLowerCase() === name.toLowerCase();
                return (
                  <TouchableOpacity
                    key={name}
                    style={[styles.chip, isSelected && styles.chipActive]}
                    onPress={() => {
                      AppHaptics.selection();
                      setMerchantName(name);
                    }}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[styles.chipText, isSelected && styles.chipTextActive]}
                      numberOfLines={1}
                    >
                      {name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : null}

        {skippedTransferCount > 0 ? (
          <View style={styles.noticeBox}>
            <Info size={14} color={Palette.muted} style={{ marginRight: 8, marginTop: 1 }} />
            <Text style={styles.noticeText}>
              {skippedTransferCount} internal {skippedTransferCount === 1 ? 'transfer' : 'transfers'} in your selection will be skipped.
            </Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.applyBtn, !canSubmit && styles.applyBtnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Rename ${eligibleCount} transactions`}
        >
          {saving ? (
            <ActivityIndicator size="small" color={Palette.white} />
          ) : (
            <>
              <Check size={16} color={Palette.white} style={{ marginRight: 6 }} />
              <Text style={styles.applyBtnText}>
                Apply to {eligibleCount} {eligibleCount === 1 ? 'Transaction' : 'Transactions'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </KeyboardSafeContainer>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  sheetCanvas: {
    backgroundColor: Palette.canvas,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  inputLabel: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '700',
    color: Palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  requiredStar: {
    color: Palette.error,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Palette.hairline,
    paddingHorizontal: 14,
    height: 48,
  },
  textInput: {
    flex: 1,
    ...Typography.body,
    fontSize: 15,
    color: Palette.ink,
    padding: 0,
  },
  suggestionsSection: {
    marginTop: 14,
  },
  suggestionsLabel: {
    ...Typography.caption,
    fontSize: 11.5,
    fontWeight: '600',
    color: Palette.muted,
    marginBottom: 8,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: Palette.white,
    borderWidth: 1,
    borderColor: Palette.hairline,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: '100%',
  },
  chipActive: {
    backgroundColor: Palette.tintExpense,
    borderColor: Palette.primary,
  },
  chipText: {
    ...Typography.caption,
    fontSize: 12.5,
    fontWeight: '600',
    color: Palette.bodyStrong,
  },
  chipTextActive: {
    color: Palette.primary,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 14,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  noticeText: {
    flex: 1,
    ...Typography.caption,
    fontSize: 12,
    lineHeight: 17,
    color: Palette.muted,
  },
  applyBtn: {
    marginTop: 18,
    height: 48,
    borderRadius: 14,
    backgroundColor: Palette.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnDisabled: {
    opacity: 0.45,
  },
  applyBtnText: {
    ...Typography.body,
    fontSize: 14.5,
    fontWeight: '700',
    color: Palette.white,
  },
});
