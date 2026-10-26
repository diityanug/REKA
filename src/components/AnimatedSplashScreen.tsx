import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  Animated,
  StyleSheet,
  Easing,
  Platform,
} from 'react-native';
import Svg, { Circle, Path, Defs, LinearGradient, Stop } from 'react-native-svg';

interface AnimatedSplashScreenProps {
  onAnimationFinish?: () => void;
  minDurationMs?: number; // 1.2 - 1.5 detik
}

export const AnimatedSplashScreen: React.FC<AnimatedSplashScreenProps> = ({
  onAnimationFinish,
  minDurationMs = 1350,
}) => {
  const spinValue = useRef(new Animated.Value(0)).current;
  const pulseValue = useRef(new Animated.Value(0.95)).current;
  const contentFade = useRef(new Animated.Value(0)).current;
  const screenFade = useRef(new Animated.Value(1)).current;

  // Animasi 3 titik dot loading "..."
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in seluruh konten dengan lembut
    Animated.timing(contentFade, {
      toValue: 1,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // Rotasi ring loader
    const spinAnim = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1100,
        easing: Easing.bezier(0.4, 0.0, 0.2, 1),
        useNativeDriver: true,
      })
    );
    spinAnim.start();

    // Pulse halus pada inner orb
    const pulseAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseValue, {
          toValue: 1.08,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseValue, {
          toValue: 0.95,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulseAnim.start();

    // Animasi titik-titik bergerak (wave dots)
    const animateDots = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(dot1, { toValue: 1, duration: 250, useNativeDriver: true }),
          Animated.timing(dot2, { toValue: 1, duration: 250, useNativeDriver: true }),
          Animated.timing(dot3, { toValue: 1, duration: 250, useNativeDriver: true }),
          Animated.parallel([
            Animated.timing(dot1, { toValue: 0, duration: 250, useNativeDriver: true }),
            Animated.timing(dot2, { toValue: 0, duration: 250, useNativeDriver: true }),
            Animated.timing(dot3, { toValue: 0, duration: 250, useNativeDriver: true }),
          ]),
        ])
      ).start();
    };
    animateDots();

    // Timer transisi 1 - 1.5 detik
    const timer = setTimeout(() => {
      Animated.timing(screenFade, {
        toValue: 0,
        duration: 350,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        if (onAnimationFinish) {
          onAnimationFinish();
        }
      });
    }, minDurationMs);

    return () => {
      clearTimeout(timer);
      spinAnim.stop();
      pulseAnim.stop();
    };
  }, [spinValue, pulseValue, contentFade, screenFade, dot1, dot2, dot3, minDurationMs, onAnimationFinish]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={[styles.container, { opacity: screenFade }]}>
      {/* Decorative Warm Ambient Glow in the background */}
      <View style={styles.ambientGlow} />

      {/* Main Center Area: Custom Modern Loader & Typography */}
      <Animated.View style={[styles.centerBox, { opacity: contentFade }]}>
        <View style={styles.loaderWrap}>
          {/* Subtle Outer Track Ring */}
          <View style={styles.trackRing} />

          {/* Animated Spinner with Gradient Arc */}
          <Animated.View style={[styles.spinningRing, { transform: [{ rotate: spin }] }]}>
            <Svg width={64} height={64} viewBox="0 0 64 64">
              <Defs>
                <LinearGradient id="loaderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
                  <Stop offset="50%" stopColor="#5DB8A6" stopOpacity="0.8" />
                  <Stop offset="100%" stopColor="#CC785C" stopOpacity="0.1" />
                </LinearGradient>
              </Defs>
              <Circle
                cx="32"
                cy="32"
                r="26"
                stroke="url(#loaderGrad)"
                strokeWidth="4"
                strokeLinecap="round"
                fill="none"
                strokeDasharray="120"
                strokeDashoffset="45"
              />
            </Svg>
          </Animated.View>

          {/* Glowing Center Core Pulse */}
          <Animated.View
            style={[
              styles.centerCore,
              { transform: [{ scale: pulseValue }] },
            ]}
          >
            <View style={styles.innerCoreDot} />
          </Animated.View>
        </View>

        {/* Custom Editorial Themed Loading Text with Animated Dots */}
        <View style={styles.loadingTextContainer}>
          <Text style={styles.loadingWord}>loading</Text>
          <View style={styles.dotsRow}>
            <Animated.Text
              style={[
                styles.dotText,
                {
                  opacity: dot1.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }),
                  transform: [{ translateY: dot1.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) }],
                },
              ]}
            >
              .
            </Animated.Text>
            <Animated.Text
              style={[
                styles.dotText,
                {
                  opacity: dot2.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }),
                  transform: [{ translateY: dot2.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) }],
                },
              ]}
            >
              .
            </Animated.Text>
            <Animated.Text
              style={[
                styles.dotText,
                {
                  opacity: dot3.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }),
                  transform: [{ translateY: dot3.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) }],
                },
              ]}
            >
              .
            </Animated.Text>
          </View>
        </View>
      </Animated.View>

      {/* Footer: Prominent App Brand Icon & Tagline */}
      <Animated.View style={[styles.footerContainer, { opacity: contentFade }]}>
        <View style={styles.iconCirclePlate}>
          <Image
            source={require('../../assets/splash-icon.png')}
            style={styles.footerAppIcon}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.footerBrandName}>REKA</Text>
        <Text style={styles.footerTagline}>Your money, in perspective</Text>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#11473B', // Rich deep emerald forest green
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  ambientGlow: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(93, 184, 166, 0.08)',
    top: '30%',
  },
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -48,
  },
  loaderWrap: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackRing: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  spinningRing: {
    position: 'absolute',
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerCore: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerCoreDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    shadowColor: '#5DB8A6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  loadingTextContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 22,
  },
  loadingWord: {
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif-medium',
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 2.2,
    textTransform: 'lowercase',
  },
  dotsRow: {
    flexDirection: 'row',
    marginLeft: 2,
  },
  dotText: {
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif-medium',
    fontSize: 16,
    fontWeight: '700',
    color: '#5DB8A6',
  },
  footerContainer: {
    position: 'absolute',
    bottom: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCirclePlate: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
  },
  footerAppIcon: {
    width: 66,
    height: 66,
  },
  footerBrandName: {
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif-medium',
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 3,
    marginBottom: 3,
  },
  footerTagline: {
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.65)',
    fontWeight: '400',
    letterSpacing: 0.4,
  },
});
