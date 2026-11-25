import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  UIManager,
  View,
  ViewStyle,
} from 'react-native';

// Enable LayoutAnimation on Android Old Architecture (no-op on New Architecture)
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental &&
  !(global as { nativeFabricUIManager?: unknown }).nativeFabricUIManager
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * Triggers a smooth, subtle spring layout transition for expand/collapse blocks.
 */
export function triggerSmoothLayout() {
  LayoutAnimation.configureNext({
    duration: 220,
    create: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity,
    },
    update: {
      type: LayoutAnimation.Types.easeInEaseOut,
    },
    delete: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity,
    },
  });
}

/**
 * Tactile native-driver spring-scale pressable for cards, tiles, and buttons.
 */
interface ScalePressableProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  scaleTo?: number;
  activeOpacity?: number;
  children: React.ReactNode;
}

export const ScalePressable: React.FC<ScalePressableProps> = ({
  style,
  contentStyle,
  scaleTo = 0.975,
  activeOpacity = 0.92,
  disabled,
  onPressIn,
  onPressOut,
  children,
  ...rest
}) => {
  const [scaleAnim] = useState(() => new Animated.Value(1));
  const [opacityAnim] = useState(() => new Animated.Value(1));
  const pressDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didShrinkRef = useRef<boolean>(false);

  useEffect(() => {
    return () => {
      if (pressDelayTimerRef.current) {
        clearTimeout(pressDelayTimerRef.current);
      }
    };
  }, []);

  const handlePressIn: PressableProps['onPressIn'] = (e) => {
    if (pressDelayTimerRef.current) {
      clearTimeout(pressDelayTimerRef.current);
    }
    // Small press-intent delay prevents scroll gestures from accidentally shrinking cards
    pressDelayTimerRef.current = setTimeout(() => {
      didShrinkRef.current = true;
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: scaleTo,
          speed: 38,
          bounciness: 0,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: activeOpacity,
          duration: 80,
          useNativeDriver: true,
        }),
      ]).start();
    }, 50);
    onPressIn?.(e);
  };

  const handlePressOut: PressableProps['onPressOut'] = (e) => {
    if (pressDelayTimerRef.current) {
      clearTimeout(pressDelayTimerRef.current);
      pressDelayTimerRef.current = null;
    }
    if (didShrinkRef.current) {
      didShrinkRef.current = false;
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          speed: 26,
          bounciness: 5,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 140,
          useNativeDriver: true,
        }),
      ]).start();
    }
    onPressOut?.(e);
  };

  return (
    <Pressable
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={style}
      {...rest}
    >
      <Animated.View
        style={[
          contentStyle,
          {
            opacity: opacityAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
};

/**
 * Persistent tab screen container with silky native-driver cross-fade & subtle directional glide.
 * Keeps mounted tab scroll state intact while hiding inactive tabs cleanly.
 */
interface AnimatedTabPaneProps {
  active: boolean;
  /** +1 when navigating to a tab on the right, -1 when navigating to a tab on the left */
  direction: number;
  children: React.ReactNode;
}

export const AnimatedTabPane: React.FC<AnimatedTabPaneProps> = ({
  active,
  direction,
  children,
}) => {
  // On lazy first visit (direction !== 0), start slightly offset + transparent so first tab switch also animates smoothly
  const [progress] = useState(() => new Animated.Value(active && direction === 0 ? 1 : 0));
  const [slideOffset] = useState(
    () => new Animated.Value(active && direction !== 0 ? (direction > 0 ? 16 : -16) : 0)
  );
  const [renderVisible, setRenderVisible] = useState<boolean>(active);
  const wasActiveRef = useRef<boolean>(active && direction === 0);

  if (active && !renderVisible) {
    setRenderVisible(true);
  }

  useEffect(() => {
    if (active === wasActiveRef.current) return;
    wasActiveRef.current = active;

    progress.stopAnimation();
    slideOffset.stopAnimation();

    if (active) {
      slideOffset.setValue(direction === 0 ? 0 : direction > 0 ? 16 : -16);
      progress.setValue(0);
      Animated.parallel([
        Animated.timing(progress, {
          toValue: 1,
          duration: 210,
          easing: Easing.bezier(0.2, 0.85, 0.25, 1),
          useNativeDriver: true,
        }),
        Animated.timing(slideOffset, {
          toValue: 0,
          duration: 220,
          easing: Easing.bezier(0.2, 0.85, 0.25, 1),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.timing(progress, {
        toValue: 0,
        duration: 130,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && !wasActiveRef.current) {
          setRenderVisible(false);
        }
      });
    }
  }, [active, direction, progress, slideOffset]);

  return (
    <Animated.View
      pointerEvents={active ? 'auto' : 'none'}
      style={[
        styles.tabPaneBase,
        !renderVisible && styles.tabPaneHidden,
        {
          opacity: progress,
          transform: [{ translateX: slideOffset }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};

/**
 * Smooth animated horizontal progress bar (0..100%) using GPU-friendly transform.
 */
interface AnimatedProgressBarProps {
  percentage: number;
  fillColor: string;
  trackColor?: string;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export const AnimatedProgressBar: React.FC<AnimatedProgressBarProps> = ({
  percentage,
  fillColor,
  trackColor = '#EFE9DE',
  height = 8,
  borderRadius = 4,
  style,
}) => {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(percentage) ? percentage : 0));
  const [animWidth] = useState(() => new Animated.Value(clamped));

  useEffect(() => {
    Animated.timing(animWidth, {
      toValue: clamped,
      duration: 320,
      easing: Easing.bezier(0.2, 0.85, 0.25, 1),
      useNativeDriver: false,
    }).start();
  }, [clamped, animWidth]);

  const widthInterpolated = animWidth.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View
      style={[
        styles.progressTrack,
        { backgroundColor: trackColor, height, borderRadius },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.progressFill,
          {
            width: widthInterpolated,
            backgroundColor: fillColor,
            borderRadius,
          },
        ]}
      />
    </View>
  );
};

/**
 * Subtle fade + micro-lift container triggered whenever `transitionKey` changes
 * (ideal for month switches, currency switches, and chart mode toggles).
 */
interface FadeSlideSwitchProps {
  transitionKey: string | number;
  offsetY?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export const FadeSlideSwitch: React.FC<FadeSlideSwitchProps> = ({
  transitionKey,
  offsetY = 6,
  duration = 190,
  style,
  children,
}) => {
  const [anim] = useState(() => new Animated.Value(1));
  const prevKeyRef = useRef(transitionKey);

  useEffect(() => {
    if (prevKeyRef.current === transitionKey) return;
    prevKeyRef.current = transitionKey;
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration,
      easing: Easing.bezier(0.2, 0.85, 0.25, 1),
      useNativeDriver: true,
    }).start();
  }, [transitionKey, duration, anim]);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [offsetY, 0],
  });

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: anim,
          transform: [{ translateY }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  tabPaneBase: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  tabPaneHidden: {
    display: 'none',
  },
  progressTrack: {
    width: '100%',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
});
