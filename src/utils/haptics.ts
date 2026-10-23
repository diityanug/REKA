import * as Haptics from 'expo-haptics';

/**
 * Centralized Haptic Engine
 * Prevents redundant import and boilerplate calls across multiple components.
 */
export const AppHaptics = {
  selection: () => {
    try {
      Haptics.selectionAsync();
    } catch {
      // Graceful fallback on non-supported environments
    }
  },
  light: () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  },
  medium: () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
  },
  heavy: () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {}
  },
  success: () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  },
  error: () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch {}
  },
};
