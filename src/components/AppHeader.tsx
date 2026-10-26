import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Platform } from 'react-native';
import { Eye, EyeOff, Settings } from 'lucide-react-native';
import { Palette, Typography } from '../theme/tokens';
import { CurrencyType } from '../types';
import { AppHaptics } from '../utils/haptics';

interface AppHeaderProps {
  activeCurrency: CurrencyType;
  privacyMode: boolean;
  onCurrencyChange: (currency: CurrencyType) => void;
  onTogglePrivacy: () => void;
  onOpenSettings?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  activeCurrency,
  privacyMode,
  onCurrencyChange,
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
        <View style={styles.currencyToggleBox}>
          <TouchableOpacity
            style={[
              styles.currencyBtn,
              activeCurrency === 'IDR' && styles.currencyBtnActive,
            ]}
            onPress={() => {
              AppHaptics.selection();
              onCurrencyChange('IDR');
            }}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.currencyBtnText,
                activeCurrency === 'IDR' && styles.currencyBtnTextActive,
              ]}
            >
              IDR
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.currencyBtn,
              activeCurrency === 'USD' && styles.currencyBtnActive,
            ]}
            onPress={() => {
              AppHaptics.selection();
              onCurrencyChange('USD');
            }}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.currencyBtnText,
                activeCurrency === 'USD' && styles.currencyBtnTextActive,
              ]}
            >
              USD
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.actionIconBtn}
          onPress={() => {
            AppHaptics.selection();
            onTogglePrivacy();
          }}
          activeOpacity={0.7}
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
          >
            <Settings size={16} color={Palette.muted} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

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
  brandTagline: {
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
    fontSize: 9,
    fontWeight: '500',
    color: Palette.muted,
    letterSpacing: 0.3,
    marginTop: 1,
  },
  actionsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  currencyToggleBox: {
    flexDirection: 'row',
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 16,
    padding: 3,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  currencyBtn: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  currencyBtnActive: {
    backgroundColor: Palette.white,
    shadowColor: Palette.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  currencyBtnText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '600',
    color: Palette.muted,
  },
  currencyBtnTextActive: {
    color: Palette.ink,
  },
  actionIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Palette.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
});
