import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Delete } from 'lucide-react-native';
import { Palette, Typography } from '../../theme/tokens';
import { AppHaptics } from '../../utils/haptics';
import { ModalHeader } from '../ModalHeader';
import { BottomSheetModal } from '../BottomSheetModal';
import { useSyncOnChange } from '../../hooks/useSyncOnChange';
import { setPin, verifyPin } from '../../services/authService';

interface PinSetupModalProps {
  visible: boolean;
  isChanging: boolean;
  onSuccess: () => void;
  onClose: () => void;
}

type Step = 'verify_old' | 'enter_new' | 'confirm_new';

export const PinSetupModal: React.FC<PinSetupModalProps> = ({
  visible,
  isChanging,
  onSuccess,
  onClose,
}) => {
  const [step, setStep] = useState<Step>(isChanging ? 'verify_old' : 'enter_new');
  const [inputPin, setInputPin] = useState<string>('');
  const [newPinCandidate, setNewPinCandidate] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [shakeAnim] = useState(() => new Animated.Value(0));

  useSyncOnChange([visible, isChanging], () => {
    if (visible) {
      setStep(isChanging ? 'verify_old' : 'enter_new');
      setInputPin('');
      setNewPinCandidate('');
      setErrorMessage('');
    }
  });

  const triggerShake = useCallback(() => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const handleKeyPress = async (digit: string) => {
    if (inputPin.length >= 4) return;
    AppHaptics.light();
    setErrorMessage('');
    const nextPin = inputPin + digit;
    setInputPin(nextPin);

    if (nextPin.length === 4) {
      if (step === 'verify_old') {
        const matches = await verifyPin(nextPin);
        if (matches) {
          AppHaptics.light();
          setStep('enter_new');
          setInputPin('');
        } else {
          AppHaptics.error();
          triggerShake();
          setErrorMessage('Current PIN is incorrect');
          setTimeout(() => setInputPin(''), 300);
        }
      } else if (step === 'enter_new') {
        AppHaptics.light();
        setNewPinCandidate(nextPin);
        setStep('confirm_new');
        setInputPin('');
      } else if (step === 'confirm_new') {
        if (nextPin === newPinCandidate) {
          AppHaptics.success();
          await setPin(nextPin);
          onSuccess();
          onClose();
        } else {
          AppHaptics.error();
          triggerShake();
          setErrorMessage('PINs do not match. Try again.');
          setTimeout(() => {
            setStep('enter_new');
            setInputPin('');
            setNewPinCandidate('');
          }, 400);
        }
      }
    }
  };

  const handleDelete = () => {
    if (inputPin.length === 0) return;
    AppHaptics.light();
    setInputPin((prev) => prev.slice(0, -1));
    setErrorMessage('');
  };

  const getStepTitle = () => {
    if (step === 'verify_old') return 'Enter Current PIN';
    if (step === 'enter_new') return isChanging ? 'Enter New PIN' : 'Create 4-Digit PIN';
    return 'Confirm Your PIN';
  };

  const getStepSubtitle = () => {
    if (step === 'verify_old') return 'Verify your current security PIN';
    if (step === 'enter_new') return 'Choose a memorable 4-digit code';
    return 'Re-enter your new PIN to confirm';
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      height="82%"
    >
      <View style={styles.container}>
        <ModalHeader
          title={isChanging ? 'Change PIN' : 'Set Up PIN'}
          onClose={onClose}
        />

        <View style={styles.content}>
          <Text style={styles.stepTitle}>{getStepTitle()}</Text>
          <Text style={styles.stepSubtitle}>{getStepSubtitle()}</Text>

          {/* Dots Indicator */}
          <Animated.View style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
            {[0, 1, 2, 3].map((index) => {
              const isFilled = inputPin.length > index;
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

          {/* Message Area */}
          <View style={styles.messageBox}>
            {Boolean(errorMessage) && <Text style={styles.errorText}>{errorMessage}</Text>}
          </View>

          {/* Keypad */}
          <View style={styles.keypad}>
            <View style={styles.keyRow}>
              {['1', '2', '3'].map((num) => (
                <TouchableOpacity
                  key={num}
                  style={styles.keyBtn}
                  onPress={() => handleKeyPress(num)}
                  activeOpacity={0.65}
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
                >
                  <Text style={styles.keyText}>{num}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.keyRow}>
              <View style={styles.keyBtnEmpty} />
              <TouchableOpacity
                style={styles.keyBtn}
                onPress={() => handleKeyPress('0')}
                activeOpacity={0.65}
              >
                <Text style={styles.keyText}>0</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.keyBtn, styles.actionKeyBtn]}
                onPress={handleDelete}
                activeOpacity={0.65}
                disabled={inputPin.length === 0}
              >
                <Delete size={22} color={inputPin.length > 0 ? Palette.ink : Palette.mutedSoft} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  stepTitle: {
    ...Typography.subheading,
    color: Palette.ink,
    marginTop: 12,
    marginBottom: 4,
  },
  stepSubtitle: {
    ...Typography.caption,
    color: Palette.muted,
    textAlign: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
    gap: 16,
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
  messageBox: {
    minHeight: 20,
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
    maxWidth: 300,
    gap: 12,
  },
  keyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  keyBtn: {
    width: 66,
    height: 66,
    borderRadius: 33,
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
    width: 66,
    height: 66,
  },
  keyText: {
    fontSize: 22,
    fontWeight: '600',
    color: Palette.ink,
  },
});
