import React from 'react';
import { PulsingBorder } from '@paper-design/shaders-react';
import type { ComponentProps } from 'react';

// thickness from parent is physical pixels; PulsingBorder expects normalized shader units (px * 0.01)
type Props = Omit<ComponentProps<typeof PulsingBorder>, 'thickness'> & {
  webOnly?: boolean;
  thickness?: number;
};

export const PulsingBorderShader: React.FC<Props> = ({ webOnly: _, thickness, ...props }) => (
  <PulsingBorder thickness={thickness !== undefined ? thickness * 0.01 : undefined} {...props} />
);
