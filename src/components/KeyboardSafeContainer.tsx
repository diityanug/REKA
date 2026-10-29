import React from 'react';
import {
  ScrollView,
  StyleSheet,
  ViewStyle,
  StyleProp,
  View,
} from 'react-native';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';

interface KeyboardSafeContainerProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  extraBottomSpace?: number;
  keyboardDismissMode?: 'none' | 'on-drag' | 'interactive';
}

// Scrollable container protecting fields from keyboard obstruction across iOS and Android
export const KeyboardSafeContainer: React.FC<KeyboardSafeContainerProps> = ({
  children,
  style,
  contentContainerStyle,
  extraBottomSpace = 40,
  keyboardDismissMode = 'none',
}) => {
  const keyboardHeight = useKeyboardHeight();

  // Dynamic bottom padding for both iOS and Android in modal dialogs so fields can be scrolled into view
  const dynamicBottomPadding =
    keyboardHeight > 0
      ? keyboardHeight + extraBottomSpace
      : extraBottomSpace;

  return (
    <View style={styles.outerContainer}>
      <ScrollView
        style={[styles.wrapper, style]}
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
  wrapper: {
    flex: 1,
    width: '100%',
  },
  defaultContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
});
