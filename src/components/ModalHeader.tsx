import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import { Palette, Typography } from '../theme/tokens';
import { AppHaptics } from '../utils/haptics';

interface ModalHeaderProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
}

export const ModalHeader: React.FC<ModalHeaderProps> = ({ title, subtitle, onClose }) => {
  return (
    <View style={styles.headerContainer}>
      {/* Tier 1: Drag handle + top anchored close button */}
      <View style={styles.topBar}>
        {/* Decorative grab handle — hidden from screen readers */}
        <View
          style={styles.dragHandle}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => {
            AppHaptics.light();
            onClose();
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <X size={18} color={Palette.muted} />
        </TouchableOpacity>
      </View>

      {/* Tier 2: Clean title & optional short subtitle (No inline buttons - Rule 3) */}
      <View style={styles.titleBox}>
        <Text style={styles.titleText}>{title}</Text>
        {subtitle ? <Text style={styles.subtitleText}>{subtitle}</Text> : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.hairline,
  },
  topBar: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 2,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Palette.hairline,
  },
  closeBtn: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBox: {
    width: '100%',
  },
  titleText: {
    ...Typography.heading,
    fontSize: 20,
    color: Palette.ink,
  },
  subtitleText: {
    ...Typography.caption,
    marginTop: 2,
    color: Palette.muted,
  },
});
