import React from 'react';
import {
  ScrollView,
  StyleSheet,
  ViewStyle,
  StyleProp,
  View,
} from 'react-native';
import { useUncompensatedKeyboardHeight } from '../hooks/useKeyboardHeight';

interface KeyboardSafeContainerProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  extraBottomSpace?: number;
  keyboardDismissMode?: 'none' | 'on-drag' | 'interactive';
  /** When true (inside an auto-height bottom sheet), hugs content up to parent maxHeight instead of forcing flex: 1 */
  adaptive?: boolean;
}

// Scrollable container protecting fields from keyboard obstruction across iOS and Android
export const KeyboardSafeContainer: React.FC<KeyboardSafeContainerProps> = ({
  children,
  style,
  contentContainerStyle,
  extraBottomSpace = 40,
  keyboardDismissMode = 'none',
  adaptive = false,
}) => {
  const keyboardHeight = useUncompensatedKeyboardHeight();

  // Dynamic bottom padding for iOS and unresized Android layouts so fields can scroll into view
  const dynamicBottomPadding =
    keyboardHeight > 0
      ? keyboardHeight + extraBottomSpace
      : extraBottomSpace;

  return (
    <View style={adaptive ? styles.outerContainerAdaptive : styles.outerContainer}>
      <ScrollView
        style={[adaptive ? styles.wrapperAdaptive : styles.wrapper, style]}
        contentContainerStyle={[
          styles.defaultContent,
          contentContainerStyle,
          { paddingBottom: dynamicBottomPadding },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={keyboardDismissMode}
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets={false}
      >
        {children}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    width: '100%',
  },
  outerContainerAdaptive: {
    flexShrink: 1,
    width: '100%',
  },
  wrapper: {
    flex: 1,
    width: '100%',
  },
  wrapperAdaptive: {
    flexShrink: 1,
    width: '100%',
  },
  defaultContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
});
