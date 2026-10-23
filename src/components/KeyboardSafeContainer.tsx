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
}

// Scrollable container protecting fields from keyboard obstruction across iOS and Android
export const KeyboardSafeContainer: React.FC<KeyboardSafeContainerProps> = ({
  children,
  style,
  contentContainerStyle,
  extraBottomSpace = 40,
}) => {
  const keyboardHeight = useKeyboardHeight();

  // Dynamically provide clearance for keyboard on both platforms
  const dynamicBottomPadding =
    keyboardHeight > 0 ? keyboardHeight + extraBottomSpace : extraBottomSpace;

  return (
    <View style={styles.outerContainer}>
      <ScrollView
        style={[styles.wrapper, style]}
        contentContainerStyle={[
          styles.defaultContent,
          contentContainerStyle,
          { paddingBottom: dynamicBottomPadding },
        ]}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="none"
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
