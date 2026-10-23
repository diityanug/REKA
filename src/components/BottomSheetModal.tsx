import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
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

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface BottomSheetModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  height?: DimensionValue;
  maxHeight?: DimensionValue;
  sheetStyle?: StyleProp<ViewStyle>;
  dismissOnBackdropPress?: boolean;
}

export const BottomSheetModal: React.FC<BottomSheetModalProps> = ({
  visible,
  onClose,
  children,
  height,
  maxHeight,
  sheetStyle,
  dismissOnBackdropPress = true,
}) => {
  const insets = useSafeAreaInsets();
  const [modalMounted, setModalMounted] = useState(visible);
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setModalMounted(true);
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
    if (dismissOnBackdropPress) {
      Keyboard.dismiss();
      onClose();
    }
  };

  return (
    <Modal
      visible={modalMounted}
      transparent={true}
      animationType="none"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.rootContainer,
          { paddingTop: Math.max(insets.top, 24) + 8 },
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

        {/* Sliding Sheet Container with Curved Header */}
        <Animated.View
          style={[
            styles.sheet,
            height ? { height } : null,
            maxHeight ? { maxHeight } : null,
            sheetStyle,
            { transform: [{ translateY: sheetTranslateY }] },
          ]}
        >
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    justifyContent: 'flex-end',
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
});
