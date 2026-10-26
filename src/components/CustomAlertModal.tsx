import React from 'react';
import {
  Modal,
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
  onClose: () => void;
}

export const CustomAlertModal: React.FC<CustomAlertModalProps> = ({
  visible,
  title,
  message,
  buttons = [{ text: 'OK', style: 'default' }],
  type = 'info',
  onClose,
}) => {
  if (!visible) return null;

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

  const handleButtonPress = (btn: AlertButton) => {
    AppHaptics.light();
    onClose();
    if (btn.onPress) {
      btn.onPress();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.topSection}>
            {renderIcon()}
            <Text style={styles.title}>{title}</Text>
            {message ? <Text style={styles.message}>{message}</Text> : null}
          </View>

          <View style={[
            styles.actionsContainer,
            buttons.length > 2 ? styles.actionsColumn : styles.actionsRow
          ]}>
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
                >
                  <Text style={[styles.buttonText, { color: textCol }]}>
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(18, 18, 16, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    maxWidth: 340,
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
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 13,
    lineHeight: 19,
    color: Palette.muted,
    textAlign: 'center',
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
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: '600',
  },
});
