import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Layers, CreditCard, Plus, Receipt, TrendingUp } from 'lucide-react-native';
import { Palette, Typography } from '../theme/tokens';
import { TabType } from '../types';
import { AppHaptics } from '../utils/haptics';

interface BottomTabBarProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  onOpenManualTransaction: () => void;
  bottomInset: number;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  activeTab,
  onSelectTab,
  onOpenManualTransaction,
  bottomInset,
}) => {
  return (
    <View style={[styles.navBarWrapper, { paddingBottom: Math.max(bottomInset, 16) }]}>
      <View style={styles.navBar}>
        <TouchableOpacity
          style={styles.navTabItem}
          onPress={() => {
            AppHaptics.selection();
            onSelectTab('overview');
          }}
          activeOpacity={0.7}
        >
          <Layers
            size={20}
            color={activeTab === 'overview' ? Palette.primary : Palette.muted}
          />
          <Text
            style={[
              styles.navTabLabel,
              activeTab === 'overview' && styles.navTabLabelActive,
            ]}
          >
            Overview
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navTabItem}
          onPress={() => {
            AppHaptics.selection();
            onSelectTab('accounts');
          }}
          activeOpacity={0.7}
        >
          <CreditCard
            size={20}
            color={activeTab === 'accounts' ? Palette.primary : Palette.muted}
          />
          <Text
            style={[
              styles.navTabLabel,
              activeTab === 'accounts' && styles.navTabLabelActive,
            ]}
          >
            Accounts
          </Text>
        </TouchableOpacity>

        {/* Center Primary Action: Manual Transaction */}
        <TouchableOpacity
          style={styles.centerActionBtn}
          onPress={() => {
            AppHaptics.light();
            onOpenManualTransaction();
          }}
          activeOpacity={0.85}
        >
          <Plus size={24} color={Palette.white} strokeWidth={2.5} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navTabItem}
          onPress={() => {
            AppHaptics.selection();
            onSelectTab('history');
          }}
          activeOpacity={0.7}
        >
          <Receipt
            size={20}
            color={activeTab === 'history' ? Palette.primary : Palette.muted}
          />
          <Text
            style={[
              styles.navTabLabel,
              activeTab === 'history' && styles.navTabLabelActive,
            ]}
          >
            History
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navTabItem}
          onPress={() => {
            AppHaptics.selection();
            onSelectTab('analytics');
          }}
          activeOpacity={0.7}
        >
          <TrendingUp
            size={20}
            color={activeTab === 'analytics' ? Palette.primary : Palette.muted}
          />
          <Text
            style={[
              styles.navTabLabel,
              activeTab === 'analytics' && styles.navTabLabelActive,
            ]}
          >
            Analytics
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  navBarWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
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
    paddingVertical: 4,
  },
  navTabLabel: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: '500',
    color: Palette.muted,
    marginTop: 3,
  },
  navTabLabelActive: {
    color: Palette.primary,
    fontWeight: '600',
  },
  centerActionBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Palette.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
    marginHorizontal: 4,
  },
});
