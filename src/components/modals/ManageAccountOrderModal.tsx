import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  PanResponder,
  Animated,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GripVertical } from 'lucide-react-native';
import { Palette, Typography } from '../../theme/tokens';
import { useSyncOnChange } from '../../hooks/useSyncOnChange';
import { Wallet } from '../../types';
import { AppHaptics } from '../../utils/haptics';
import { formatCurrency } from '../../utils/formatters';
import { ModalHeader } from '../ModalHeader';
import { BottomSheetModal } from '../BottomSheetModal';

const ROW_HEIGHT = 66;
const ROW_GAP = 10;
const ROW_STRIDE = ROW_HEIGHT + ROW_GAP;
const SHIFT_DURATION = 180;
const SETTLE_DURATION = 180;

function reorderList<T>(list: T[], startIndex: number, endIndex: number): T[] {
  if (startIndex === endIndex) return list;
  const result = [...list];
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
}

interface ManageAccountOrderModalProps {
  visible: boolean;
  wallets: Wallet[];
  privacyMode: boolean;
  onSaveOrder: (orderedWallets: Wallet[]) => Promise<void> | void;
  onClose: () => void;
}

interface DraggableAccountRowProps {
  wallet: Wallet;
  slotIndex: number;
  privacyMode: boolean;
  isActive: boolean;
  positionY: Animated.Value;
  dragScale: Animated.Value;
  onDragStart: (id: string) => void;
  onDragMove: (id: string, dy: number) => void;
  onDragRelease: (id: string) => void;
}

/**
 * Each row is absolutely positioned and driven only by its own `positionY`.
 * The render order never changes during or after a drag, so React never re-lays
 * out the list — this eliminates the post-drop flicker entirely.
 */
const DraggableAccountRow: React.FC<DraggableAccountRowProps> = React.memo(({
  wallet,
  slotIndex,
  privacyMode,
  isActive,
  positionY,
  dragScale,
  onDragStart,
  onDragMove,
  onDragRelease,
}) => {
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => onDragStart(wallet.id),
        onPanResponderMove: (_, g) => onDragMove(wallet.id, g.dy),
        onPanResponderRelease: () => onDragRelease(wallet.id),
        onPanResponderTerminate: () => onDragRelease(wallet.id),
      }),
    [wallet.id, onDragStart, onDragMove, onDragRelease]
  );

  const displayName =
    wallet.name?.trim() ||
    (wallet.type ? `${wallet.type} Account` : 'Account');

  return (
    <Animated.View
      style={[
        styles.itemRow,
        isActive && styles.itemRowDragging,
        {
          zIndex: isActive ? 999 : 1,
          elevation: isActive ? 12 : 1,
          transform: [
            { translateY: positionY },
            { scale: isActive ? dragScale : 1 },
          ],
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Account ${slotIndex + 1}: ${displayName}`}
    >
      <View style={styles.leftInfo}>
        <View style={[styles.colorDot, { backgroundColor: wallet.color }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.accountName} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.accountMeta} numberOfLines={1}>
            {wallet.currency} • {formatCurrency(wallet.balance, wallet.currency, privacyMode)}
          </Text>
        </View>
      </View>

      {/* PanResponder attached strictly to the drag grip icon */}
      <View
        {...panResponder.panHandlers}
        style={[styles.dragHandleBox, isActive && styles.dragHandleBoxActive]}
        hitSlop={{ top: 14, bottom: 14, left: 18, right: 18 }}
      >
        <GripVertical size={20} color={isActive ? Palette.white : Palette.muted} />
      </View>
    </Animated.View>
  );
});
DraggableAccountRow.displayName = 'DraggableAccountRow';

export const ManageAccountOrderModal: React.FC<ManageAccountOrderModalProps> = ({
  visible,
  wallets,
  privacyMode,
  onSaveOrder,
  onClose,
}) => {
  const insets = useSafeAreaInsets();

  // Stable render order (never reordered while the modal is open).
  const [renderIds, setRenderIds] = useState<string[]>([]);
  // Current logical order (slot index per id) — only used for labels.
  const [orderIds, setOrderIds] = useState<string[]>([]);
  // One persistent Animated.Value (absolute Y) per wallet id.
  const [positions, setPositions] = useState<Record<string, Animated.Value>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragScale] = useState(() => new Animated.Value(1));

  const orderRef = useRef<string[]>([]);
  const positionsRef = useRef<Record<string, Animated.Value>>({});
  const dragRef = useRef<{ id: string; startSlot: number; hoverSlot: number } | null>(null);
  const settlingRef = useRef(false);
  const onSaveOrderRef = useRef(onSaveOrder);
  const walletsRef = useRef<Wallet[]>(wallets);

  useEffect(() => {
    onSaveOrderRef.current = onSaveOrder;
    walletsRef.current = wallets;
  }, [onSaveOrder, wallets]);

  const walletById = useMemo(() => {
    const map: Record<string, Wallet> = {};
    wallets.forEach((w) => {
      map[w.id] = w;
    });
    return map;
  }, [wallets]);

  // Rebuild only when the modal opens or the set of accounts changes.
  // A pure order change (from our own optimistic save) must NOT rebuild,
  // otherwise the rows would be re-laid out and flicker.
  const idSetKey = useMemo(() => wallets.map((w) => w.id).sort().join('|'), [wallets]);

  useSyncOnChange([visible, idSetKey], () => {
    if (!visible) return;
    const ids = wallets.map((w) => w.id);
    const map: Record<string, Animated.Value> = {};
    ids.forEach((id, idx) => {
      map[id] = new Animated.Value(idx * ROW_STRIDE);
    });
    setRenderIds(ids);
    setOrderIds(ids);
    setPositions(map);
    setActiveId(null);
  });

  // Keep refs in sync with the freshly built state (outside render).
  useEffect(() => {
    positionsRef.current = positions;
    orderRef.current = orderIds;
  }, [positions, orderIds]);

  const animateTo = (value: Animated.Value, toValue: number, duration: number) =>
    Animated.timing(value, {
      toValue,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

  const handleDragStart = useCallback(
    (id: string) => {
      if (settlingRef.current) return;
      const startSlot = orderRef.current.indexOf(id);
      if (startSlot < 0) return;
      dragRef.current = { id, startSlot, hoverSlot: startSlot };
      AppHaptics.medium();
      setActiveId(id);
      Animated.spring(dragScale, {
        toValue: 1.03,
        friction: 7,
        tension: 220,
        useNativeDriver: true,
      }).start();
    },
    [dragScale]
  );

  const handleDragMove = useCallback((id: string, dy: number) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== id) return;
    const order = orderRef.current;
    const pos = positionsRef.current;
    const maxSlot = order.length - 1;

    // Clamp finger movement to list bounds for a solid feel.
    const minY = 0;
    const maxY = maxSlot * ROW_STRIDE;
    const rawY = drag.startSlot * ROW_STRIDE + dy;
    const y = Math.max(minY - 20, Math.min(maxY + 20, rawY));
    pos[id]?.setValue(y);

    const hover = Math.max(0, Math.min(maxSlot, Math.round(y / ROW_STRIDE)));
    if (hover === drag.hoverSlot) return;
    drag.hoverSlot = hover;
    AppHaptics.selection();

    // Glide every other row into its tentative slot.
    const tentative = reorderList(order, drag.startSlot, hover);
    tentative.forEach((otherId, slot) => {
      if (otherId === id) return;
      const v = pos[otherId];
      if (v) animateTo(v, slot * ROW_STRIDE, SHIFT_DURATION).start();
    });
  }, []);

  const handleDragRelease = useCallback(
    (id: string) => {
      const drag = dragRef.current;
      if (!drag || drag.id !== id) return;
      dragRef.current = null;
      settlingRef.current = true;

      const { startSlot, hoverSlot } = drag;
      const finalOrder = reorderList(orderRef.current, startSlot, hoverSlot);
      orderRef.current = finalOrder;
      const pos = positionsRef.current;

      // Make sure every neighbour is heading to its final slot.
      finalOrder.forEach((otherId, slot) => {
        if (otherId === id) return;
        const v = pos[otherId];
        if (v) animateTo(v, slot * ROW_STRIDE, SHIFT_DURATION).start();
      });

      // Glide the dragged card into its slot — no reset, no re-layout.
      Animated.parallel([
        animateTo(pos[id], hoverSlot * ROW_STRIDE, SETTLE_DURATION),
        animateTo(dragScale, 1, SETTLE_DURATION),
      ]).start(() => {
        settlingRef.current = false;
        setActiveId(null);
        if (startSlot !== hoverSlot) {
          AppHaptics.selection();
          setOrderIds(finalOrder);
          const map: Record<string, Wallet> = {};
          walletsRef.current.forEach((w) => {
            map[w.id] = w;
          });
          const reordered = finalOrder.map((wid) => map[wid]).filter((w): w is Wallet => !!w);
          Promise.resolve(onSaveOrderRef.current(reordered)).catch(() => {});
        }
      });
    },
    [dragScale]
  );

  const slotOf = useMemo(() => {
    const map: Record<string, number> = {};
    orderIds.forEach((id, idx) => {
      map[id] = idx;
    });
    return map;
  }, [orderIds]);

  return (
    <BottomSheetModal visible={visible} onClose={onClose} height="80%" maxHeight="88%">
      <ModalHeader title="Manage Account Order" onClose={onClose} />

      <ScrollView
        scrollEnabled={activeId === null}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 16 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.hintText}>
          Touch and drag the grip icon up or down to reorder. Changes are saved automatically.
        </Text>

        <View style={[styles.listContainer, { height: renderIds.length * ROW_STRIDE }]}>
          {renderIds.map((id) => {
            const w = walletById[id];
            const posY = positions[id];
            if (!w || !posY) return null;
            return (
              <DraggableAccountRow
                key={id}
                wallet={w}
                slotIndex={slotOf[id] ?? 0}
                privacyMode={privacyMode}
                isActive={activeId === id}
                positionY={posY}
                dragScale={dragScale}
                onDragStart={handleDragStart}
                onDragMove={handleDragMove}
                onDragRelease={handleDragRelease}
              />
            );
          })}
        </View>
      </ScrollView>
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
  listContainer: {
    position: 'relative',
  },
  itemRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Palette.white,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  itemRowDragging: {
    borderColor: Palette.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
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
  dragHandleBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Palette.surfaceSoft,
    borderWidth: 1,
    borderColor: Palette.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragHandleBoxActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
});
