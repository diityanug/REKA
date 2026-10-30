import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowUp, ArrowDown, Check } from 'lucide-react-native';
import { Palette, Typography } from '../../theme/tokens';
import { useSyncOnChange } from '../../hooks/useSyncOnChange';
import { Wallet } from '../../types';
import { AppHaptics } from '../../utils/haptics';
import { formatCurrency } from '../../utils/formatters';
import { ModalHeader } from '../ModalHeader';
import { BottomSheetModal } from '../BottomSheetModal';
import { CustomAlertModal } from '../CustomAlertModal';

interface ManageAccountOrderModalProps {
  visible: boolean;
  wallets: Wallet[];
  privacyMode: boolean;
  onSaveOrder: (orderedWallets: Wallet[]) => Promise<void> | void;
  onClose: () => void;
}

export const ManageAccountOrderModal: React.FC<ManageAccountOrderModalProps> = ({
  visible,
  wallets,
  privacyMode,
  onSaveOrder,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const [orderedList, setOrderedList] = useState<Wallet[]>([]);
  const [saving, setSaving] = useState<boolean>(false);
  const [discardAlertVisible, setDiscardAlertVisible] = useState<boolean>(false);

  useSyncOnChange([visible, wallets], () => {
    if (visible) {
      setOrderedList([...wallets]);
    }
  });

  const idsOf = (list: Wallet[]) => list.map((w) => w.id).join('|');
  const hasChanges = idsOf(orderedList) !== idsOf(wallets);

  const moveItem = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= orderedList.length) return;
    AppHaptics.selection();
    const updated = [...orderedList];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    setOrderedList(updated);
  };

  // Closing with a rearranged list would silently drop the work.
  const requestClose = () => {
    if (saving) return;
    if (hasChanges) {
      setDiscardAlertVisible(true);
      return;
    }
    onClose();
  };

  const submit = async () => {
    if (saving) return;
    AppHaptics.light();
    setSaving(true);
    try {
      await onSaveOrder(orderedList);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={requestClose}
      height="80%"
      maxHeight="88%"
    >
      <ModalHeader
        title="Manage Account Order"
        onClose={requestClose}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 16) + 80 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.hintText}>
          Use the up and down arrows to rearrange.
        </Text>

        {orderedList.map((w, index) => {
          const isFirst = index === 0;
          const isLast = index === orderedList.length - 1;

          return (
            <View key={w.id} style={styles.itemRow}>
              <View style={styles.leftInfo}>
                <View style={[styles.colorDot, { backgroundColor: w.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.accountName} numberOfLines={1}>
                    {w.name}
                  </Text>
                  <Text style={styles.accountMeta}>
                    {w.currency} • {formatCurrency(w.balance, w.currency, privacyMode)}
                  </Text>
                </View>
              </View>

              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.arrowBtn, isFirst && styles.arrowBtnDisabled]}
                  disabled={isFirst || saving}
                  onPress={() => moveItem(index, index - 1)}
                  accessibilityRole="button"
                  accessibilityLabel="Move up"
                  accessibilityState={{ disabled: isFirst || saving }}
                >
                  <ArrowUp
                    size={18}
                    color={isFirst ? Palette.hairline : Palette.ink}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.arrowBtn, isLast && styles.arrowBtnDisabled]}
                  disabled={isLast || saving}
                  onPress={() => moveItem(index, index + 1)}
                  accessibilityRole="button"
                  accessibilityLabel="Move down"
                  accessibilityState={{ disabled: isLast || saving }}
                >
                  <ArrowDown
                    size={18}
                    color={isLast ? Palette.hairline : Palette.ink}
                  />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.7 }]}
          onPress={submit}
          disabled={saving}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Save account order"
        >
          {saving ? (
            <>
              <ActivityIndicator size="small" color={Palette.white} style={{ marginRight: 8 }} />
              <Text style={styles.saveBtnText}>Saving...</Text>
            </>
          ) : (
            <>
              <Check size={18} color={Palette.white} style={{ marginRight: 8 }} />
              <Text style={styles.saveBtnText}>Save Order</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <CustomAlertModal
        visible={discardAlertVisible}
        title="Discard changes?"
        message="Your account order changes have not been saved."
        type="confirm"
        buttons={[
          { text: 'Keep Editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => onClose(),
          },
        ]}
        onClose={() => setDiscardAlertVisible(false)}
      />
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  hintText: {
    ...Typography.caption,
    fontSize: 12,
    color: Palette.muted,
    marginBottom: 14,
    lineHeight: 18,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Palette.white,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Palette.hairline,
    marginBottom: 10,
  },
  leftInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  accountName: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: '600',
    color: Palette.ink,
  },
  accountMeta: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  arrowBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: Palette.surfaceSoft,
    borderWidth: 1,
    borderColor: Palette.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowBtnDisabled: {
    opacity: 0.4,
    backgroundColor: Palette.canvas,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: Palette.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.hairline,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.primary,
    paddingVertical: 13,
    borderRadius: 14,
  },
  saveBtnText: {
    ...Typography.body,
    fontSize: 15,
    fontWeight: '600',
    color: Palette.white,
  },
});
