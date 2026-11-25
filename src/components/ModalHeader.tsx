import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ArrowLeft, X } from 'lucide-react-native';
import { Palette, Typography } from '../theme/tokens';
import { AppHaptics } from '../utils/haptics';
import { useIsFullPageSheet } from './BottomSheetModal';

interface ModalHeaderProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  hideDragHandle?: boolean;
  /** Leading navigation icon for full-page screens: 'back' (←) for drill-down/detail, 'close' (✕) for forms/flows */
  leadingIcon?: 'back' | 'close';
  /** Optional right-side action slot on full-page headers */
  rightAction?: React.ReactNode;
}

export const ModalHeader: React.FC<ModalHeaderProps> = ({
  title,
  subtitle,
  onClose,
  hideDragHandle = false,
  leadingIcon = 'back',
  rightAction,
}) => {
  const isFullPage = useIsFullPageSheet() || hideDragHandle;

  if (isFullPage) {
    const LeadingGlyph = leadingIcon === 'close' ? X : ArrowLeft;
    return (
      <View style={styles.pageHeaderContainer}>
        <TouchableOpacity
          style={styles.pageLeadingBtn}
          onPress={() => {
            AppHaptics.light();
            onClose();
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={leadingIcon === 'close' ? 'Close' : 'Go back'}
        >
          <LeadingGlyph size={18} color={Palette.ink} strokeWidth={2.1} />
        </TouchableOpacity>

        <View style={[styles.pageTitleBox, rightAction ? styles.pageTitleBoxWithAction : null]}>
          <Text style={styles.pageTitleText} numberOfLines={1} ellipsizeMode="tail">
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.pageSubtitleText} numberOfLines={1} ellipsizeMode="tail">
              {subtitle}
            </Text>
          ) : null}
        </View>

        {rightAction ? <View style={styles.pageRightSlot}>{rightAction}</View> : null}
      </View>
    );
  }

  return (
    <View style={styles.headerContainer}>
      {/* Tier 1: Drag handle + top anchored close button (compact utility sheets) */}
      <View style={styles.topBar}>
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

      {/* Tier 2: Clean title & optional short subtitle */}
      <View style={styles.titleBox}>
        <Text style={styles.titleText}>{title}</Text>
        {subtitle ? <Text style={styles.subtitleText}>{subtitle}</Text> : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Full-page Warm Editorial compact 1-row header
  pageHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: Palette.canvas,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.hairline,
  },
  pageLeadingBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Palette.white,
    borderWidth: 1,
    borderColor: Palette.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageTitleBox: {
    flex: 1,
    marginLeft: 12,
    marginRight: 4,
  },
  pageTitleBoxWithAction: {
    marginRight: 10,
  },
  pageTitleText: {
    ...Typography.editorialTitle,
    fontSize: 18.5,
    letterSpacing: -0.15,
    color: Palette.ink,
  },
  pageSubtitleText: {
    ...Typography.caption,
    fontSize: 12,
    marginTop: 1,
    color: Palette.muted,
  },
  pageRightSlot: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Compact utility bottom-sheet header
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
