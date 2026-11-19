import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Platform } from 'react-native';
import {
  useFonts,
  PlayfairDisplay_600SemiBold,
} from '@expo-google-fonts/playfair-display';
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
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_600SemiBold,
  });

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
          <View
            style={styles.titleColumn}
            accessible={true}
            accessibilityRole="header"
            accessibilityLabel="Reka"
          >
            <Text
              style={[
                styles.brandTitle,
                fontsLoaded && styles.brandTitleEditorial,
              ]}
            >
              Reka<Text style={styles.brandDot}>.</Text>
            </Text>
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
    gap: 10,
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
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 24,
    fontWeight: '600',
    color: '#11473B',
    letterSpacing: 0.3,
    lineHeight: 28,
    includeFontPadding: false,
  },
  brandTitleEditorial: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontWeight: '400',
  },
  brandDot: {
    color: Palette.primary,
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
