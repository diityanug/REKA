import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Dimensions,
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
  useIsInsideSheet,
  useOverlayLayer,
} from './OverlayHost';

const { height: WINDOW_HEIGHT } = Dimensions.get('window');
const { height: SCREEN_HEIGHT_RAW } = Dimensions.get('screen');
const SCREEN_HEIGHT = Math.max(WINDOW_HEIGHT, SCREEN_HEIGHT_RAW || 0);

/**
 * Keeps the closing sheet's last visible children subtree intact during the
 * 200ms slide-down animation without triggering double renders while open.
 */
const FrozenContent = React.memo<{
  visible: boolean;
  children: React.ReactNode;
}>(
  ({ children }) => <>{children}</>,
  (_prevProps, nextProps) => !nextProps.visible
);
FrozenContent.displayName = 'FrozenContent';

interface BottomSheetModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  height?: DimensionValue;
  maxHeight?: DimensionValue;
  sheetStyle?: StyleProp<ViewStyle>;
  dismissOnBackdropPress?: boolean;
  fullPage?: boolean;
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
}) => {
  const insets = useSafeAreaInsets();
  const insideSheet = useIsInsideSheet();
  const [modalMounted, setModalMounted] = useState(visible);
  const animValue = useState(() => new Animated.Value(0))[0];

  // Mount synchronously when opening (derived state) instead of through an effect (cascading render)
  if (visible && !modalMounted) {
    setModalMounted(true);
  }

  useEffect(() => {
    if (visible) {
      Keyboard.dismiss();
      Animated.timing(animValue, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(animValue, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setModalMounted(false);
        }
      });
    }
  }, [visible, animValue]);

  const handleRequestClose = useCallback(() => {
    if (Keyboard.isVisible && Keyboard.isVisible()) {
      Keyboard.dismiss();
      return true;
    }
    onClose();
    return true;
  }, [onClose]);

  const { overlayId, zIndex } = useOverlayLayer(
    modalMounted,
    visible,
    handleRequestClose
  );

  if (!modalMounted) return null;

  // Backdrop softly fades in/out without any harsh sliding black box
  const backdropOpacity = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  // Sheet smoothly glides up from bottom
  const sheetTranslateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [SCREEN_HEIGHT, 0],
  });

  const handleBackdropPress = () => {
    if (!dismissOnBackdropPress) return;
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
        !insideSheet && { zIndex },
        fullPage ? styles.rootContainerFullPage : { paddingTop: Math.max(insets.top, 24) + 8 },
      ]}
    >
      {/* Soft Stationary Fading Scrim - Warm Editorial Overlay */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.backdrop,
          { opacity: backdropOpacity },
        ]}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={handleBackdropPress}
        />
      </Animated.View>

      {/* Sliding Sheet / Page Container with Curved Header */}
      <Animated.View
        style={[
          styles.sheet,
          fullPage && [styles.sheetFullPage, { paddingTop: insets.top }],
          height && !fullPage ? { height } : null,
          maxHeight && !fullPage ? { maxHeight } : null,
          sheetStyle,
          { transform: [{ translateY: sheetTranslateY }] },
        ]}
      >
        <SheetDepthContext.Provider value={true}>
          <FrozenContent visible={visible}>{children}</FrozenContent>
        </SheetDepthContext.Provider>
      </Animated.View>
    </View>
  );

  if (insideSheet) {
    return (
      <OverlayPortal id={overlayId} active={modalMounted}>
        {overlayView}
      </OverlayPortal>
    );
  }

  return overlayView;
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
    backgroundColor: 'rgba(18, 18, 16, 0.32)', // Soft warm subtle scrim (No harsh pitch-black)
  },
  sheet: {
    backgroundColor: Palette.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  sheetFullPage: {
    flex: 1,
    height: '100%',
    maxHeight: '100%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: Palette.white,
    overflow: 'hidden',
  },
});
