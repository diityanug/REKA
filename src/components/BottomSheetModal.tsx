import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  View,
  TouchableOpacity,
  Animated,
  StyleSheet,
  useWindowDimensions,
  StyleProp,
  ViewStyle,
  Keyboard,
  Easing,
  DimensionValue,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Palette } from '../theme/tokens';
import {
  OverlayPortal,
  SheetDepthContext,
  useOverlayLayer,
} from './OverlayHost';

const FullPageSheetContext = createContext<boolean>(false);

export function useIsFullPageSheet(): boolean {
  return useContext(FullPageSheetContext);
}

/**
 * Keeps the closing sheet's last visible children subtree intact during the
 * exit animation without triggering double renders while open.
 */
const FrozenContent = React.memo<{
  visible: boolean;
  children: React.ReactNode;
}>(
  ({ children }) => <>{children}</>,
  (_prevProps, nextProps) => !nextProps.visible
);
FrozenContent.displayName = 'FrozenContent';

export type FullPagePresentation = 'push' | 'modal';

interface BottomSheetModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  height?: DimensionValue;
  maxHeight?: DimensionValue;
  sheetStyle?: StyleProp<ViewStyle>;
  dismissOnBackdropPress?: boolean;
  fullPage?: boolean;
  /**
   * Native transition style when `fullPage={true}`:
   * - `'push'`: horizontal slide-in from right (drill-down detail & settings pages, paired with ←)
   * - `'modal'`: snappy upward lift + fade (creation forms & task flows, paired with ✕)
   */
  presentation?: FullPagePresentation;
}

export const BottomSheetModal: React.FC<BottomSheetModalProps> = ({
  visible,
  onClose,
  children,
  height,
  maxHeight,
  sheetStyle,
  dismissOnBackdropPress = true,
  fullPage = false,
  presentation = 'modal',
}) => {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [modalMounted, setModalMounted] = useState(visible);
  const animValue = useState(() => new Animated.Value(0))[0];

  const isPush = fullPage && presentation === 'push';
  const isFullModal = fullPage && presentation === 'modal';

  // Mount synchronously when opening (derived state) instead of through an effect (cascading render)
  if (visible && !modalMounted) {
    setModalMounted(true);
  }

  useEffect(() => {
    if (visible) {
      Keyboard.dismiss();
      Animated.timing(animValue, {
        toValue: 1,
        duration: isPush ? 260 : isFullModal ? 220 : 250,
        easing: Easing.bezier(0.2, 0.85, 0.25, 1),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(animValue, {
        toValue: 0,
        duration: isPush ? 210 : isFullModal ? 175 : 200,
        easing: isPush
          ? Easing.bezier(0.32, 0.08, 0.24, 1)
          : Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setModalMounted(false);
        }
      });
    }
  }, [visible, animValue, isPush, isFullModal]);

  const handleRequestClose = useCallback(() => {
    if (Keyboard.isVisible && Keyboard.isVisible()) {
      Keyboard.dismiss();
      return true;
    }
    onClose();
    return true;
  }, [onClose]);

  const { overlayId } = useOverlayLayer(
    modalMounted,
    visible,
    handleRequestClose
  );

  if (!modalMounted) return null;

  // Soft stationary fading scrim (lighter for fullPage push/modal so it feels truly native)
  const backdropOpacity = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  // Native motion curves per presentation type
  const sheetTranslateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [
      isFullModal ? Math.min(windowHeight * 0.12, 84) : windowHeight,
      0,
    ],
  });

  const pushTranslateX = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [windowWidth, 0],
  });

  const modalFadeOpacity = animValue.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [0, 0.96, 1],
  });

  const animatedContainerStyle = isPush
    ? { transform: [{ translateX: pushTranslateX }] }
    : isFullModal
      ? {
          opacity: modalFadeOpacity,
          transform: [{ translateY: sheetTranslateY }],
        }
      : { transform: [{ translateY: sheetTranslateY }] };

  const handleBackdropPress = () => {
    if (fullPage || !dismissOnBackdropPress) return;
    // While typing, a tap outside should only dismiss the keyboard,
    // otherwise a stray tap would discard a half-filled form.
    if (Keyboard.isVisible && Keyboard.isVisible()) {
      Keyboard.dismiss();
      return;
    }
    Keyboard.dismiss();
    onClose();
  };

  const overlayView = (
    <View
      accessibilityViewIsModal={visible}
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        styles.rootContainer,
        fullPage ? styles.rootContainerFullPage : { paddingTop: Math.max(insets.top, 24) + 8 },
      ]}
    >
      {/* Subtle Native Dim Layer behind incoming page / sheet */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          fullPage
            ? isPush
              ? styles.backdropPush
              : styles.backdropFullModal
            : styles.backdrop,
          { opacity: backdropOpacity },
        ]}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          disabled={fullPage}
          onPress={handleBackdropPress}
        />
      </Animated.View>

      {/* Sliding Native Page / Bottom Sheet Container */}
      <Animated.View
        style={[
          styles.sheet,
          fullPage && [styles.sheetFullPage, { paddingTop: insets.top }],
          isPush && styles.sheetPushShadow,
          height && !fullPage ? { height } : null,
          maxHeight && !fullPage ? { maxHeight } : null,
          sheetStyle,
          animatedContainerStyle,
        ]}
      >
        <SheetDepthContext.Provider value={true}>
          <FullPageSheetContext.Provider value={fullPage}>
            <FrozenContent visible={visible}>{children}</FrozenContent>
          </FullPageSheetContext.Provider>
        </SheetDepthContext.Provider>
      </Animated.View>
    </View>
  );

  // Always portal into root OverlayHost so modals mounted inside tabs
  // (like HistoryFilterModal) render edge-to-edge above AppHeader and BottomTabBar.
  return (
    <OverlayPortal id={overlayId} active={modalMounted}>
      {overlayView}
    </OverlayPortal>
  );
};

const styles = StyleSheet.create({
  rootContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  rootContainerFullPage: {
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
    paddingTop: 0,
  },
  backdrop: {
    backgroundColor: 'rgba(18, 18, 16, 0.34)', // Compact bottom-sheet scrim
  },
  backdropPush: {
    backgroundColor: 'rgba(20, 20, 19, 0.14)', // Native push screen subtle previous-page dim
  },
  backdropFullModal: {
    backgroundColor: 'rgba(20, 20, 19, 0.16)', // Subtle transition scrim for full-page task modal
  },
  sheet: {
    backgroundColor: Palette.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  sheetFullPage: {
    flex: 1,
    width: '100%',
    height: '100%',
    maxHeight: '100%',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    backgroundColor: Palette.canvas,
    overflow: 'hidden',
  },
  sheetPushShadow: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: 'rgba(20, 20, 19, 0.1)',
    shadowColor: '#141413',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
});
