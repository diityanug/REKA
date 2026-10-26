import React from 'react';
import Svg, { Rect, Path, SvgProps } from 'react-native-svg';

export interface IconProps extends SvgProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export const ContactlessCardIcon: React.FC<IconProps> = ({
  size = 24,
  color = 'currentColor',
  strokeWidth = 2,
  ...props
}) => {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Card Outline */}
      <Rect x="2" y="5" width="20" height="14" rx="2" />
      {/* Contactless Tap Waves */}
      <Path d="M13 10a2.5 2.5 0 0 1 0 4" />
      <Path d="M16 8a5.5 5.5 0 0 1 0 8" />
      {/* Smart Chip */}
      <Rect x="5" y="10" width="3.5" height="4" rx="0.5" />
      <Path d="M5 12h3.5" />
    </Svg>
  );
};

export default ContactlessCardIcon;
