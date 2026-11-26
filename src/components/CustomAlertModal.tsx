import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import {
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from 'lucide-react-native';
import { Palette, Typography } from '../theme/tokens';
import { AppHaptics } from '../utils/haptics';
import { OverlayPortal, useOverlayLayer } from './OverlayHost';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export type AlertType = 'info' | 'warning' | 'error' | 'success' | 'confirm';

export interface CustomAlertModalProps {
  visible: boolean;
  title: string;
  message?: string;
  buttons?: AlertButton[];
  type?: AlertType;
  /** Identifies this dialog so a chained alert is not closed by the previous one */
  alertId?: string;
  onClose: (alertId?: string) => void;
}

const FrozenAlertBody = React.memo<{
  visible: boolean;
  children: React.ReactNode;
}>(
  ({ children }) => <>{children}</>,
  (_prev, next) => !next.visible
);
FrozenAlertBody.displayName = 'FrozenAlertBody';

export const CustomAlertModal: React.FC<CustomAlertModalProps> = ({
  visible,
  title,
  message,
  buttons = [{ text: 'OK', style: 'default' }],
  type = 'info',
  alertId,
  onClose,
}) => {
  const [mounted, setMounted] = useState<boolean>(visible);
  const [backdropAnim] = useState(() => new Animated.Value(visible ? 1 : 0));
  const [cardScale] = useState(() => new Animated.Value(visible ? 1 : 0.92));
  const actionPressedRef = useRef<boolean>(false);

  if (visible && !mounted) {
    setMounted(true);
  }

  useEffect(() => {
    if (visible) {
      actionPressedRef.current = false;
      backdropAnim.setValue(0);
      cardScale.setValue(0.9);
      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(cardScale, {
          toValue: 1,
          speed: 26,
          bounciness: 6,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 140,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(cardScale, {
          toValue: 0.94,
          duration: 140,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, mounted, backdropAnim, cardScale]);

  // Reset synchronous tap lock whenever a chained alert replaces this one with a new alertId
  useEffect(() => {
    actionPressedRef.current = false;
  }, [alertId]);

  // Multi-button confirmation dialogs, destructive actions, or single-button actions with
  // custom callbacks require an explicit tap; simple informational "OK" alerts can be
  // dismissed via Android Back or backdrop tap.
  const hasBlockingAction =
    buttons.length > 1 ||
    buttons.some((btn) => btn.style === 'destructive' || typeof btn.onPress === 'function');

  const handleBackPress = useCallback(() => {
    if (!hasBlockingAction) {
      onClose(alertId);
    }
    return true;
  }, [hasBlockingAction, onClose, alertId]);

  const { overlayId } = useOverlayLayer(mounted, visible, handleBackPress, 'alert');

  if (!mounted) return null;

  const renderIcon = () => {
    switch (type) {
      case 'warning':
        return (
          <View style={[styles.iconContainer, { backgroundColor: '#FEF3C7' }]}>
            <AlertTriangle size={24} color="#D97706" />
          </View>
        );
      case 'error':
        return (
          <View style={[styles.iconContainer, { backgroundColor: '#FEE2E2' }]}>
            <XCircle size={24} color={Palette.error} />
          </View>
        );
      case 'success':
        return (
          <View style={[styles.iconContainer, { backgroundColor: '#DCFCE7' }]}>
            <CheckCircle2 size={24} color={Palette.success} />
          </View>
        );
      case 'confirm':
        return (
          <View style={[styles.iconContainer, { backgroundColor: '#E0F2FE' }]}>
            <HelpCircle size={24} color="#0284C7" />
          </View>
        );
      case 'info':
      default:
        return (
          <View style={[styles.iconContainer, { backgroundColor: '#F0FDF4' }]}>
            <Info size={24} color={Palette.primary} />
          </View>
        );
    }
  };

  const requestClose = hasBlockingAction ? undefined : () => onClose(alertId);

  const handleButtonPress = (btn: AlertButton) => {
    if (actionPressedRef.current) return;
    actionPressedRef.current = true;
    AppHaptics.light();
    // Run the action BEFORE closing, so a confirm is never cancelled by the close.
    if (btn.onPress) {
      btn.onPress();
    }
    // Pass our own id: if the action opened a newer alert, that one stays visible
    onClose(alertId);
  };

  return (
    <OverlayPortal id={overlayId} active={mounted}>
      <Animated.View
        pointerEvents={visible ? 'auto' : 'none'}
        style={[styles.overlay, { opacity: backdropAnim }]}
      >
        <Pressable
          style={styles.overlayTapArea}
          onPress={requestClose}
          accessibilityViewIsModal={visible}
        >
          <Animated.View
            style={[
              styles.cardWrap,
              {
                opacity: backdropAnim,
                transform: [{ scale: cardScale }],
              },
            ]}
          >
            <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
              <FrozenAlertBody visible={visible}>
                <View style={styles.topSection}>
                  {renderIcon()}
                  <Text style={styles.title}>{title}</Text>
                  {message ? <Text style={styles.message}>{message}</Text> : null}
                </View>

                <View
                  style={[
                    styles.actionsContainer,
                    buttons.length > 2 ? styles.actionsColumn : styles.actionsRow,
                  ]}
                >
                  {buttons.map((btn, index) => {
                    const isCancel = btn.style === 'cancel';
                    const isDestructive = btn.style === 'destructive';

                    let btnBg = Palette.surfaceSoft;
                    let textCol = Palette.ink;

                    if (isDestructive) {
                      btnBg = Palette.error;
                      textCol = Palette.white;
                    } else if (!isCancel) {
                      btnBg = Palette.primary;
                      textCol = Palette.white;
                    }

                    return (
                      <TouchableOpacity
                        key={`${btn.text}-${index}`}
                        style={[
                          styles.button,
                          { backgroundColor: btnBg },
                          buttons.length <= 2 ? { flex: 1 } : { width: '100%' },
                        ]}
                        onPress={() => handleButtonPress(btn)}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityLabel={btn.text}
                      >
                        <Text style={[styles.buttonText, { color: textCol }]}>
                          {btn.text}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </FrozenAlertBody>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Animated.View>
    </OverlayPortal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(18, 18, 16, 0.44)',
  },
  overlayTapArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  cardWrap: {
    width: '100%',
    maxWidth: 340,
  },
  card: {
    width: '100%',
    backgroundColor: Palette.white,
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  topSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    ...Typography.heading,
    fontSize: 17,
    fontWeight: '700',
    color: Palette.ink,
    textAlign: 'center',
    marginBottom: 6,
  },
  message: {
    ...Typography.body,
    fontSize: 13.5,
    color: Palette.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  actionsContainer: {
    gap: 10,
  },
  actionsRow: {
    flexDirection: 'row',
  },
  actionsColumn: {
    flexDirection: 'column',
  },
  button: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  buttonText: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: '600',
  },
});
