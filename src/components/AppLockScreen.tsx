import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Keyboard,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lock, Delete, Fingerprint, ScanFace } from 'lucide-react-native';
import { Palette, Typography } from '../theme/tokens';
import { AppHaptics } from '../utils/haptics';
import { useSyncOnChange } from '../hooks/useSyncOnChange';
import { useOverlayLayer } from './OverlayHost';
import {
  verifyPin,
  authenticateWithBiometrics,
  BiometricType,
} from '../services/authService';

interface AppLockScreenProps {
  visible: boolean;
  biometricsEnabled: boolean;
  biometricType: BiometricType;
  onUnlock: () => void;
}

export const AppLockScreen: React.FC<AppLockScreenProps> = ({
  visible,
  biometricsEnabled,
  biometricType,
  onUnlock,
}) => {
  const insets = useSafeAreaInsets();
  const [pin, setPin] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [shakeAnim] = useState(() => new Animated.Value(0));

  // Reset PIN when visible changes
  useSyncOnChange([visible], () => {
    if (visible) {
      setPin('');
      setErrorMessage('');
    }
  });

  // Trigger biometric prompt
  const handleBiometricAuth = useCallback(async () => {
    if (!biometricsEnabled || biometricType === 'None') return;
    AppHaptics.light();
    const success = await authenticateWithBiometrics('Unlock Reka');
    if (success) {
      AppHaptics.success();
      setPin('');
      setErrorMessage('');
      onUnlock();
    }
  }, [biometricsEnabled, biometricType, onUnlock]);

  const blockBackWhileLocked = useCallback(() => true, []);
  useOverlayLayer(visible, visible, blockBackWhileLocked, true);

  // Dismiss any lingering background keyboard and prompt biometrics when locked
  useEffect(() => {
    if (!visible) return;
    Keyboard.dismiss();
    if (biometricsEnabled && biometricType !== 'None') {
      const timer = setTimeout(() => {
        handleBiometricAuth();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [visible, biometricsEnabled, biometricType, handleBiometricAuth]);

  const triggerShake = useCallback(() => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const handleKeyPress = async (digit: string) => {
    if (isVerifying || pin.length >= 4) return;
    AppHaptics.light();
    setErrorMessage('');
    const nextPin = pin + digit;
    setPin(nextPin);

    if (nextPin.length === 4) {
      setIsVerifying(true);
      const isMatch = await verifyPin(nextPin);
      if (isMatch) {
        AppHaptics.success();
        setPin('');
        setIsVerifying(false);
        onUnlock();
      } else {
        AppHaptics.error();
        triggerShake();
        setErrorMessage('Incorrect PIN. Try again.');
        setTimeout(() => {
          setPin('');
          setIsVerifying(false);
        }, 300);
      }
    }
  };

  const handleDelete = () => {
    if (isVerifying || pin.length === 0) return;
    AppHaptics.light();
    setPin((prev) => prev.slice(0, -1));
    setErrorMessage('');
  };

  if (!visible) return null;

  return (
    <View
      accessibilityViewIsModal={true}
      style={[styles.overlay, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 20 }]}
    >
      <StatusBar barStyle="dark-content" />

      {/* Lock Icon & Title */}
      <View style={styles.headerSection}>
        <View style={styles.iconCircle}>
          <Lock size={26} color={Palette.primary} />
        </View>
        <Text style={styles.appTitle}>Reka Vault</Text>
        <Text style={styles.subtitle}>Enter 4-digit PIN to continue</Text>
      </View>

      {/* PIN Dots with Shake Animation */}
      <Animated.View style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
        {[0, 1, 2, 3].map((index) => {
          const isFilled = pin.length > index;
          const isError = Boolean(errorMessage);
          return (
            <View
              key={index}
              style={[
                styles.dot,
                isFilled && styles.dotFilled,
                isError && styles.dotError,
              ]}
            />
          );
        })}
      </Animated.View>

      {/* Feedback Message */}
      <View style={styles.messageContainer}>
        {Boolean(errorMessage) && <Text style={styles.errorText}>{errorMessage}</Text>}
      </View>

      {/* Numeric Keypad */}
      <View style={styles.keypad}>
        <View style={styles.keyRow}>
          {['1', '2', '3'].map((num) => (
            <TouchableOpacity
              key={num}
              style={styles.keyBtn}
              onPress={() => handleKeyPress(num)}
              activeOpacity={0.65}
              disabled={isVerifying}
            >
              <Text style={styles.keyText}>{num}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.keyRow}>
          {['4', '5', '6'].map((num) => (
            <TouchableOpacity
              key={num}
              style={styles.keyBtn}
              onPress={() => handleKeyPress(num)}
              activeOpacity={0.65}
              disabled={isVerifying}
            >
              <Text style={styles.keyText}>{num}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.keyRow}>
          {['7', '8', '9'].map((num) => (
            <TouchableOpacity
              key={num}
              style={styles.keyBtn}
              onPress={() => handleKeyPress(num)}
              activeOpacity={0.65}
              disabled={isVerifying}
            >
              <Text style={styles.keyText}>{num}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.keyRow}>
          {/* Biometric Button */}
          {biometricsEnabled && biometricType !== 'None' ? (
            <TouchableOpacity
              style={[styles.keyBtn, styles.actionKeyBtn]}
              onPress={handleBiometricAuth}
              activeOpacity={0.65}
              disabled={isVerifying}
              accessibilityLabel={`Unlock with ${biometricType}`}
            >
              {biometricType === 'Face ID' ? (
                <ScanFace size={24} color={Palette.primary} />
              ) : (
                <Fingerprint size={24} color={Palette.primary} />
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.keyBtnEmpty} />
          )}

          {/* Zero */}
          <TouchableOpacity
            style={styles.keyBtn}
            onPress={() => handleKeyPress('0')}
            activeOpacity={0.65}
            disabled={isVerifying}
          >
            <Text style={styles.keyText}>0</Text>
          </TouchableOpacity>

          {/* Delete Button */}
          <TouchableOpacity
            style={[styles.keyBtn, styles.actionKeyBtn]}
            onPress={handleDelete}
            activeOpacity={0.65}
            disabled={isVerifying || pin.length === 0}
            accessibilityLabel="Delete last digit"
          >
            <Delete size={22} color={pin.length > 0 ? Palette.ink : Palette.mutedSoft} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Palette.canvas,
    zIndex: 999999,
    elevation: 999999,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  headerSection: {
    alignItems: 'center',
    marginTop: 20,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Palette.surfaceSoft,
    borderWidth: 1,
    borderColor: Palette.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  appTitle: {
    ...Typography.heading,
    color: Palette.ink,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  subtitle: {
    ...Typography.caption,
    color: Palette.muted,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 18,
    gap: 18,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: Palette.hairline,
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  dotError: {
    backgroundColor: Palette.error,
    borderColor: Palette.error,
  },
  messageContainer: {
    minHeight: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    ...Typography.caption,
    color: Palette.error,
    fontWeight: '600',
  },
  keypad: {
    width: '100%',
    maxWidth: 320,
    marginBottom: 10,
    gap: 14,
  },
  keyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  keyBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Palette.white,
    borderWidth: 1,
    borderColor: Palette.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionKeyBtn: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  keyBtnEmpty: {
    width: 72,
    height: 72,
  },
  keyText: {
    fontSize: 24,
    fontWeight: '600',
    color: Palette.ink,
  },
});
