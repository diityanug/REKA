import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import { Layers, CreditCard, Plus, Receipt, TrendingUp } from 'lucide-react-native';
import { Palette, Typography } from '../theme/tokens';
import { TabType } from '../types';
import { AppHaptics } from '../utils/haptics';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';

interface NavTabItemProps {
  label: string;
  active: boolean;
  onPress: () => void;
  renderIcon: (color: string) => React.ReactNode;
}

const AnimatedNavTabItem: React.FC<NavTabItemProps> = React.memo(({
  label,
  active,
  onPress,
  renderIcon,
}) => {
  const [pressScale] = useState(() => new Animated.Value(1));
  const [activeAnim] = useState(() => new Animated.Value(active ? 1 : 0));

  useEffect(() => {
    Animated.spring(activeAnim, {
      toValue: active ? 1 : 0,
      speed: 22,
      bounciness: active ? 9 : 0,
      useNativeDriver: true,
    }).start();
  }, [active, activeAnim]);

  const iconScale = activeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });

  const pillScale = activeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.65, 1],
  });

  return (
    <Pressable
      style={styles.navTabItem}
      onPressIn={() => {
        Animated.spring(pressScale, {
          toValue: 0.9,
          speed: 40,
          bounciness: 0,
          useNativeDriver: true,
        }).start();
      }}
      onPressOut={() => {
        Animated.spring(pressScale, {
          toValue: 1,
          speed: 24,
          bounciness: 8,
          useNativeDriver: true,
        }).start();
      }}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      <Animated.View
        style={[
          styles.navTabInner,
          { transform: [{ scale: pressScale }] },
        ]}
      >
        <View style={styles.iconHolder}>
          <Animated.View
            style={[
              styles.activeIconPill,
              {
                opacity: activeAnim,
                transform: [{ scale: pillScale }],
              },
            ]}
          />
          <Animated.View style={{ transform: [{ scale: iconScale }] }}>
            {renderIcon(active ? Palette.primary : Palette.muted)}
          </Animated.View>
        </View>
        <Text
          style={[
            styles.navTabLabel,
            active && styles.navTabLabelActive,
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
});

AnimatedNavTabItem.displayName = 'AnimatedNavTabItem';

interface BottomTabBarProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  onOpenManualTransaction: () => void;
  bottomInset: number;
}

export const BottomTabBar = React.memo<BottomTabBarProps>(({
  activeTab,
  onSelectTab,
  onOpenManualTransaction,
  bottomInset,
}) => {
  const keyboardHeight = useKeyboardHeight();
  const [fabScale] = useState(() => new Animated.Value(1));
  const [fabRotate] = useState(() => new Animated.Value(0));

  // Prevent Android adjustResize from pushing the floating nav bar up over search results
  if (keyboardHeight > 0) return null;

  const fabSpin = fabRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '18deg'],
  });

  return (
    <View
      pointerEvents="box-none"
      style={[styles.navBarWrapper, { paddingBottom: Math.max(bottomInset, 16) }]}
    >
      <View style={styles.navBar}>
        <AnimatedNavTabItem
          label="Overview"
          active={activeTab === 'overview'}
          onPress={() => {
            AppHaptics.selection();
            onSelectTab('overview');
          }}
          renderIcon={(color) => <Layers size={20} color={color} />}
        />

        <AnimatedNavTabItem
          label="Accounts"
          active={activeTab === 'accounts'}
          onPress={() => {
            AppHaptics.selection();
            onSelectTab('accounts');
          }}
          renderIcon={(color) => <CreditCard size={20} color={color} />}
        />

        {/* Center Primary Action: Tactile Spring FAB */}
        <Pressable
          onPressIn={() => {
            Animated.parallel([
              Animated.spring(fabScale, {
                toValue: 0.89,
                speed: 40,
                bounciness: 0,
                useNativeDriver: true,
              }),
              Animated.timing(fabRotate, {
                toValue: 1,
                duration: 110,
                useNativeDriver: true,
              }),
            ]).start();
          }}
          onPressOut={() => {
            Animated.parallel([
              Animated.spring(fabScale, {
                toValue: 1,
                speed: 22,
                bounciness: 10,
                useNativeDriver: true,
              }),
              Animated.spring(fabRotate, {
                toValue: 0,
                speed: 22,
                bounciness: 6,
                useNativeDriver: true,
              }),
            ]).start();
          }}
          onPress={() => {
            AppHaptics.light();
            onOpenManualTransaction();
          }}
          accessibilityRole="button"
          accessibilityLabel="Add transaction"
        >
          <Animated.View
            style={[
              styles.centerActionBtn,
              { transform: [{ scale: fabScale }] },
            ]}
          >
            <Animated.View style={{ transform: [{ rotate: fabSpin }] }}>
              <Plus size={24} color={Palette.white} strokeWidth={2.5} />
            </Animated.View>
          </Animated.View>
        </Pressable>

        <AnimatedNavTabItem
          label="History"
          active={activeTab === 'history'}
          onPress={() => {
            AppHaptics.selection();
            onSelectTab('history');
          }}
          renderIcon={(color) => <Receipt size={20} color={color} />}
        />

        <AnimatedNavTabItem
          label="Analytics"
          active={activeTab === 'analytics'}
          onPress={() => {
            AppHaptics.selection();
            onSelectTab('analytics');
          }}
          renderIcon={(color) => <TrendingUp size={20} color={color} />}
        />
      </View>
    </View>
  );
});

BottomTabBar.displayName = 'BottomTabBar';

const styles = StyleSheet.create({
  navBarWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Palette.white,
    borderRadius: 28,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Palette.hairline,
    shadowColor: Palette.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
  },
  navTabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 3,
  },
  iconHolder: {
    width: 40,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeIconPill: {
    position: 'absolute',
    width: 40,
    height: 28,
    borderRadius: 14,
    backgroundColor: Palette.tintExpense,
  },
  navTabLabel: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: '500',
    color: Palette.muted,
    marginTop: 2,
  },
  navTabLabelActive: {
    color: Palette.primary,
    fontWeight: '700',
  },
  centerActionBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
    shadowColor: Palette.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
});
