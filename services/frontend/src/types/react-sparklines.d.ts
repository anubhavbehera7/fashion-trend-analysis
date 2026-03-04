declare module 'react-sparklines' {
  import * as React from 'react';

  interface SparklinesProps {
    data: number[];
    limit?: number;
    width?: number;
    height?: number;
    svgWidth?: number;
    svgHeight?: number;
    preserveAspectRatio?: string;
    margin?: number;
    min?: number;
    max?: number;
    style?: React.CSSProperties;
    children?: React.ReactNode;
  }

  interface SparklinesLineProps {
    color?: string;
    style?: React.CSSProperties & { strokeWidth?: number; fill?: string };
    onMouseMove?: (event: string, value: number) => void;
  }

  interface SparklinesSpotsProps {
    size?: number;
    style?: React.CSSProperties;
    spotColors?: Record<string, string>;
  }

  interface SparklinesReferenceLineProps {
    type?: 'max' | 'min' | 'mean' | 'avg' | 'median' | 'custom';
    value?: number;
    style?: React.CSSProperties;
  }

  interface SparklinesBarsProps {
    barWidth?: number;
    margin?: number;
    style?: React.CSSProperties;
    color?: string;
  }

  export const Sparklines: React.FC<SparklinesProps>;
  export const SparklinesLine: React.FC<SparklinesLineProps>;
  export const SparklinesSpots: React.FC<SparklinesSpotsProps>;
  export const SparklinesReferenceLine: React.FC<SparklinesReferenceLineProps>;
  export const SparklinesBars: React.FC<SparklinesBarsProps>;
}
