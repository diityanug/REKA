import React, { useEffect, useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Easing,
  TouchableOpacity,
} from 'react-native';
import { Receipt, FileText, CheckCircle2 } from 'lucide-react-native';
import { Palette, Typography } from '../../theme/tokens';
import { AppHaptics } from '../../utils/haptics';

interface ScanningReceiptModalProps {
  visible: boolean;
  mode?: 'receipt' | 'statement';
  onCancel?: () => void;
}

const STATEMENT_STAGES = [
  'Reading document pages & format...',
  'Extracting transaction rows & amounts...',
  'Matching account & payment methods...',
  'Finalizing categories & dates...',
];

const RECEIPT_STAGES = [
  'Scanning image clarity & text...',
  'Extracting items, subtotal & tax...',
  'Matching category & payment method...',
  'Finalizing transaction details...',
];

export const ScanningReceiptModal: React.FC<ScanningReceiptModalProps> = ({
  visible,
  mode = 'receipt',
  onCancel,
}) => {
  const isStatement = mode === 'statement';
  const stages = isStatement ? STATEMENT_STAGES : RECEIPT_STAGES;

  const [currentStageIdx, setCurrentStageIdx] = useState(0);

  // Animated values initialized cleanly via useState to satisfy React Compiler / Hooks rules
  const [pulseAnim] = useState(() => new Animated.Value(0));
  const [beamAnim] = useState(() => new Animated.Value(0));
  const [shimmerAnim] = useState(() => new Animated.Value(0));
  const [fadeAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!visible) {
      return;
    }

    // Fade-in modal content
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();

    // 1. Gentle continuous pulse for radar halo
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    // 2. Vertical laser scan beam traversing the core icon
    const beamLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(beamAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(beamAnim, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    // 3. Shimmer progress bar
    const shimmerLoop = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1800,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    // 4. Cycle stage descriptions to keep the user engaged
    const stageInterval = setInterval(() => {
      setCurrentStageIdx((prev) => (prev + 1) % stages.length);
    }, 2400);

    pulseLoop.start();
    beamLoop.start();
    shimmerLoop.start();

    return () => {
      pulseLoop.stop();
      beamLoop.stop();
      shimmerLoop.stop();
      clearInterval(stageInterval);
      pulseAnim.setValue(0);
      beamAnim.setValue(0);
      shimmerAnim.setValue(0);
      fadeAnim.setValue(0);
      setCurrentStageIdx(0);
    };
  }, [visible, stages.length, fadeAnim, pulseAnim, beamAnim, shimmerAnim]);

  // Memoized radar scale & opacity
  const radarScale = useMemo(
    () =>
      pulseAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.95, 1.38],
      }),
    [pulseAnim]
  );

  const radarOpacity = useMemo(
    () =>
      pulseAnim.interpolate({
        inputRange: [0, 0.4, 1],
        outputRange: [0.5, 0.25, 0],
      }),
    [pulseAnim]
  );

  // Memoized laser beam position (-18 to +18 px)
  const beamTranslateY = useMemo(
    () =>
      beamAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [-18, 18],
      }),
    [beamAnim]
  );

  // Memoized shimmer progress bar translation (-120 to +260 px)
  const shimmerTranslateX = useMemo(
    () =>
      shimmerAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [-120, 260],
      }),
    [shimmerAnim]
  );

  if (!visible) return null;

  const accentColor = isStatement ? '#D97706' : Palette.accentTeal;
  const haloColor = isStatement ? 'rgba(217, 119, 6, 0.16)' : 'rgba(93, 184, 166, 0.20)';
  const innerRingBg = isStatement ? '#FEF3C7' : '#E6F5F3';

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
          {/* Scanner Visual Hero */}
          <View style={styles.visualContainer}>
            {/* Outer Pulsing Halo */}
            <Animated.View
              style={[
                styles.pulseHalo,
                {
                  backgroundColor: haloColor,
                  transform: [{ scale: radarScale }],
                  opacity: radarOpacity,
                },
              ]}
            />

            {/* Middle Decorative Ring */}
            <View style={[styles.middleRing, { backgroundColor: innerRingBg }]}>
              {/* Center Core Circle */}
              <View style={[styles.coreCircle, { backgroundColor: accentColor }]}>
                {isStatement ? (
                  <FileText size={28} color={Palette.white} strokeWidth={2.2} />
                ) : (
                  <Receipt size={28} color={Palette.white} strokeWidth={2.2} />
                )}

                {/* Animated Horizontal Laser Scan Beam */}
                <Animated.View
                  style={[
                    styles.laserBeam,
                    {
                      transform: [{ translateY: beamTranslateY }],
                    },
                  ]}
                />
              </View>
            </View>
          </View>

          {/* Title & Subtitle */}
          <Text style={styles.title}>
            {isStatement ? 'Analyzing e-Statement' : 'Scanning Receipt Slip'}
          </Text>

          {/* Shimmering Progress Bar */}
          <View style={styles.progressBarTrack}>
            <Animated.View
              style={[
                styles.progressBarFill,
                {
                  backgroundColor: accentColor,
                  transform: [{ translateX: shimmerTranslateX }],
                },
              ]}
            />
          </View>

          {/* Live Dynamic Stage Text */}
          <View style={styles.stageRow}>
            <ActivityIndicator size="small" color={accentColor} style={{ marginRight: 8 }} />
            <Text style={styles.stageText} numberOfLines={1}>
              {stages[currentStageIdx]}
            </Text>
          </View>

          {/* Smart Features / Benefit Note */}
          <View style={styles.featureNoteBox}>
            <CheckCircle2 size={13} color={Palette.muted} style={{ marginRight: 6 }} />
            <Text style={styles.featureNoteText}>
              {isStatement
                ? 'Auto-matches account, detects duplicates & balances'
                : 'Auto-extracts items, tax, discounts & payment method'}
            </Text>
          </View>

          {/* Cancel Button */}
          {onCancel ? (
            <TouchableOpacity
              style={styles.cancelBtn}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={isStatement ? 'Cancel statement analysis' : 'Cancel receipt scanning'}
              onPress={() => {
                AppHaptics.light();
                onCancel();
              }}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(16, 15, 14, 0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 330,
    backgroundColor: Palette.white,
    borderRadius: 26,
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Palette.hairline,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.14,
    shadowRadius: 32,
    elevation: 12,
  },
  visualContainer: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  pulseHalo: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  middleRing: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  coreCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  laserBeam: {
    position: 'absolute',
    width: 48,
    height: 2.5,
    borderRadius: 1.25,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
    elevation: 2,
  },
  title: {
    ...Typography.heading,
    fontSize: 18,
    fontWeight: '700',
    color: Palette.ink,
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  progressBarTrack: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    backgroundColor: Palette.surfaceSoft,
    overflow: 'hidden',
    marginBottom: 14,
  },
  progressBarFill: {
    width: 80,
    height: '100%',
    borderRadius: 2,
  },
  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 24,
    marginBottom: 14,
    paddingHorizontal: 8,
  },
  stageText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: Palette.body,
    textAlign: 'center',
  },
  featureNoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.surfaceSoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Palette.hairline,
    width: '100%',
    marginBottom: 16,
  },
  featureNoteText: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
    flexShrink: 1,
    textAlign: 'center',
    lineHeight: 15,
  },
  cancelBtn: {
    paddingVertical: 9,
    paddingHorizontal: 22,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Palette.hairline,
    backgroundColor: Palette.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: Palette.muted,
  },
});

export default ScanningReceiptModal;
