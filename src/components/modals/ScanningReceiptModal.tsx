import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { Camera, Sparkles, Receipt } from 'lucide-react-native';
import { Palette, Typography } from '../../theme/tokens';

interface ScanningReceiptModalProps {
  visible: boolean;
}

export const ScanningReceiptModal: React.FC<ScanningReceiptModalProps> = ({ visible }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Gentle pulsing animation for scanner core
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.12,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );

      // Subtle rotation for sparkles
      const rotateLoop = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );

      pulseLoop.start();
      rotateLoop.start();

      return () => {
        pulseLoop.stop();
        rotateLoop.stop();
      };
    }
  }, [visible, pulseAnim, rotateAnim]);

  if (!visible) return null;

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconWrapper}>
            <Animated.View
              style={[
                styles.pulseRing,
                {
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            />
            <View style={styles.iconCore}>
              <Receipt size={28} color={Palette.white} />
            </View>
            <Animated.View
              style={[
                styles.sparkleBadge,
                { transform: [{ rotate: spin }] },
              ]}
            >
              <Sparkles size={14} color="#F59E0B" />
            </Animated.View>
          </View>

          <Text style={styles.title}>Analyzing Slip</Text>

          <View style={styles.indicatorRow}>
            <ActivityIndicator size="small" color={Palette.accentTeal} style={{ marginRight: 8 }} />
            <Text style={styles.indicatorText}>Reading receipt items</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(18, 18, 16, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: Palette.white,
    borderRadius: 22,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  iconWrapper: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  pulseRing: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(93, 184, 166, 0.18)',
  },
  iconCore: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#11473B',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#11473B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  sparkleBadge: {
    position: 'absolute',
    top: 0,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Palette.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
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
    color: Palette.muted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  indicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.surfaceSoft,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  indicatorText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: Palette.bodyStrong,
  },
});

export default ScanningReceiptModal;
