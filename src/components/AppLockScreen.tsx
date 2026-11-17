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
  verifyPinDetailed,
  getLockoutState,
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
  const [lockedUntilMs, setLockedUntilMs] = useState<number>(0);
  const [remainingSec, setRemainingSec] = useState<number>(0);
  const [shakeAnim] = useState(() => new Animated.Value(0));

  const isLockedOut = remainingSec > 0;

  // Reset draft and stale countdown state when lock modal visibility changes
  useSyncOnChange([visible], () => {
    if (visible) {
      setPin('');
      setErrorMessage('');
    } else {
      setLockedUntilMs(0);
      setRemainingSec(0);
    }
  });

  // Load persisted lockout timer asynchronously whenever Lock Screen shows
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    getLockoutState()
      .then(({ lockedUntilMs: until }) => {
        if (cancelled) return;
        const left = until > Date.now() ? Math.ceil((until - Date.now()) / 1000) : 0;
        setLockedUntilMs(left > 0 ? until : 0);
        setRemainingSec(left);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [visible]);

  // Live cooldown ticker while locked out (updates strictly inside interval callback)
  useEffect(() => {
    if (!visible || lockedUntilMs <= 0) return;
    const timer = setInterval(() => {
      const diffMs = lockedUntilMs - Date.now();
      if (diffMs <= 0) {
        setLockedUntilMs(0);
        setRemainingSec(0);
        setErrorMessage('');
        clearInterval(timer);
      } else {
        setRemainingSec(Math.ceil(diffMs / 1000));
      }
    }, 500);
    return () => clearInterval(timer);
  }, [visible, lockedUntilMs]);

  // Trigger biometric prompt
  const handleBiometricAuth = useCallback(async () => {
    if (!biometricsEnabled || biometricType === 'None') return;
    AppHaptics.light();
    const success = await authenticateWithBiometrics('Unlock Reka');
    if (success) {
      AppHaptics.success();
      setPin('');
      setErrorMessage('');
      setLockedUntilMs(0);
      setRemainingSec(0);
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
    if (isVerifying || isLockedOut || pin.length >= 4) return;
    AppHaptics.light();
    setErrorMessage('');
    const nextPin = pin + digit;
    setPin(nextPin);

    if (nextPin.length === 4) {
      setIsVerifying(true);
      const res = await verifyPinDetailed(nextPin);
      if (res.ok) {
        AppHaptics.success();
        setPin('');
        setLockedUntilMs(0);
        setRemainingSec(0);
        setIsVerifying(false);
        onUnlock();
      } else {
        AppHaptics.error();
        triggerShake();
        if (res.isLockedOut) {
          setLockedUntilMs(res.lockedUntilMs);
          setRemainingSec(res.remainingSeconds);
          setPin('');
          setIsVerifying(false);
        } else {
          const attemptsLeft = Math.max(0, 5 - res.failedAttempts);
          setErrorMessage(
            attemptsLeft > 0 && res.failedAttempts >= 3
              ? `Incorrect PIN (${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} left)`
              : 'Incorrect PIN. Try again.'
          );
          setTimeout(() => {
            setPin('');
            setIsVerifying(false);
          }, 300);
        }
      }
    }
  };

  const handleDelete = () => {
    if (isVerifying || isLockedOut || pin.length === 0) return;
    AppHaptics.light();
    setPin((prev) => prev.slice(0, -1));
    setErrorMessage('');
  };

  if (!visible) return null;

  const feedbackText = isLockedOut
    ? `Too many failed attempts. Try again in ${remainingSec}s`
    : errorMessage;

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
          const isError = Boolean(feedbackText);
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
        {Boolean(feedbackText) && <Text style={styles.errorText}>{feedbackText}</Text>}
      </View>

      {/* Numeric Keypad */}
      <View style={styles.keypad}>
        <View style={styles.keyRow}>
          {['1', '2', '3'].map((num) => (
            <TouchableOpacity
              key={num}
              style={[styles.keyBtn, isLockedOut && styles.keyBtnDisabled]}
              onPress={() => handleKeyPress(num)}
              activeOpacity={0.65}
              disabled={isVerifying || isLockedOut}
            >
              <Text style={styles.keyText}>{num}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.keyRow}>
          {['4', '5', '6'].map((num) => (
            <TouchableOpacity
              key={num}
              style={[styles.keyBtn, isLockedOut && styles.keyBtnDisabled]}
              onPress={() => handleKeyPress(num)}
              activeOpacity={0.65}
              disabled={isVerifying || isLockedOut}
            >
              <Text style={styles.keyText}>{num}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.keyRow}>
          {['7', '8', '9'].map((num) => (
            <TouchableOpacity
              key={num}
              style={[styles.keyBtn, isLockedOut && styles.keyBtnDisabled]}
              onPress={() => handleKeyPress(num)}
              activeOpacity={0.65}
              disabled={isVerifying || isLockedOut}
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
            style={[styles.keyBtn, isLockedOut && styles.keyBtnDisabled]}
            onPress={() => handleKeyPress('0')}
            activeOpacity={0.65}
            disabled={isVerifying || isLockedOut}
          >
            <Text style={styles.keyText}>0</Text>
          </TouchableOpacity>

          {/* Delete Button */}
          <TouchableOpacity
            style={[styles.keyBtn, styles.actionKeyBtn]}
            onPress={handleDelete}
            activeOpacity={0.65}
            disabled={isVerifying || isLockedOut || pin.length === 0}
            accessibilityLabel="Delete last digit"
          >
            <Delete size={22} color={pin.length > 0 && !isLockedOut ? Palette.ink : Palette.mutedSoft} />
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
    textAlign: 'center',
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
  keyBtnDisabled: {
    opacity: 0.45,
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
