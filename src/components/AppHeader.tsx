import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Platform } from 'react-native';
import { Eye, EyeOff, Settings } from 'lucide-react-native';
import { Palette } from '../theme/tokens';
import { AppHaptics } from '../utils/haptics';

interface AppHeaderProps {
  privacyMode: boolean;
  onTogglePrivacy: () => void;
  onOpenSettings?: () => void;
}

export const AppHeader = React.memo<AppHeaderProps>(({
  privacyMode,
  onTogglePrivacy,
  onOpenSettings,
}) => {
  return (
    <View style={styles.appBar}>
      <View style={styles.brandBox}>
        <View style={styles.brandRow}>
          <View style={styles.logoBadgeContainer}>
            <Image
              source={require('../../assets/splash-icon.png')}
              style={styles.brandLogoImage}
              resizeMode="contain"
            />
          </View>
          <View style={styles.titleColumn}>
            <Text style={styles.brandTitle}>REKA</Text>
          </View>
        </View>
      </View>

      <View style={styles.actionsBox}>
        <TouchableOpacity
          style={styles.actionIconBtn}
          onPress={() => {
            AppHaptics.selection();
            onTogglePrivacy();
          }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={privacyMode ? 'Show amounts' : 'Hide amounts'}
          accessibilityState={{ selected: privacyMode }}
        >
          {privacyMode ? (
            <EyeOff size={16} color={Palette.muted} />
          ) : (
            <Eye size={16} color={Palette.muted} />
          )}
        </TouchableOpacity>

        {onOpenSettings ? (
          <TouchableOpacity
            style={styles.actionIconBtn}
            onPress={() => {
              AppHaptics.selection();
              onOpenSettings();
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Open settings"
          >
            <Settings size={16} color={Palette.muted} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
});

AppHeader.displayName = 'AppHeader';

const styles = StyleSheet.create({
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  brandBox: {
    flexShrink: 1,
    marginRight: 10,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoBadgeContainer: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#11473B', // Rich emerald base matching app identity
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#11473B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  brandLogoImage: {
    width: 24,
    height: 24,
  },
  titleColumn: {
    justifyContent: 'center',
  },
  brandTitle: {
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif-medium',
    fontSize: 18,
    fontWeight: '600',
    color: Palette.ink,
    letterSpacing: 1.4,
    lineHeight: 22,
  },
  actionsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  actionIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
});
