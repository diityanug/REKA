import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
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
          <Image
            source={require('../../assets/splash-icon.png')}
            style={styles.brandLogoImage}
            resizeMode="contain"
          />
          <Text style={styles.brandTitle}>AES</Text>
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
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  brandBox: {
    flex: 1,
    paddingRight: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandLogoImage: {
    width: 32,
    height: 32,
  },
  brandTitle: {
    ...Typography.heading,
    fontSize: 20,
    fontWeight: '800',
    color: Palette.ink,
    letterSpacing: -0.5,
  },
  actionsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
