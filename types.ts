export interface PatternConfig {
  mode: 'random' | 'grid';
  density: number; // For random mode
  gridGap: number; // For grid mode
  minSize: number;
  maxSize: number;
  rotationRandomness: boolean;
  colors: string[];
  useRandomColor: boolean;
  preventOverlap: boolean;
  useMask: boolean;
  showMaskBg: boolean;
  
  // Animation
  enableAnim: boolean;
  animAmplitude: number;
  animSpeed: number;
}

export interface ProcessedAsset {
  id: string;
  originalFile: File;
  type: 'svg' | 'raster';
  img: HTMLImageElement;
  aspectRatio: number;
  viewBox?: string; // For SVGs
  vectorContent?: string; // For SVGs
}

export interface LayoutItem {
  id: string;
  assetId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  angle: number;
  color: string | null;
  // Animation properties
  animPhase: number;
  animSpeedMul: number;
  cachedCanvas?: HTMLCanvasElement | null; // Performance Optimization
}
