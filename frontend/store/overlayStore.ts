import { create } from 'zustand';

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OverlayState {
  // Source images
  sourceImage: string | null; // Image to crop from (Questioned Document)
  baseImage: string | null;   // Image to overlay on (Known Sample)
  
  // Cropped overlay
  croppedImage: string | null;
  croppedWidth: number;
  croppedHeight: number;
  
  // Overlay position and transform
  overlayX: number;
  overlayY: number;
  overlayScale: number;
  overlayAlpha: number;
  
  // Crop rect
  cropRect: CropRect;
  
  // UI state
  isCropMode: boolean;
  isOverlayMode: boolean;
  showGrid: boolean;
  showCrosshair: boolean;
  showHeatmap: boolean;
  
  // Local comparison results
  localSSIM: number;
  edgeOverlap: number;
  differenceHeatmap: string | null;
  edgeVisualization: string | null;
  
  // Loading states
  isCropping: boolean;
  isComparing: boolean;
  
  // Actions
  setSourceImage: (image: string | null) => void;
  setBaseImage: (image: string | null) => void;
  setCroppedImage: (image: string | null, width?: number, height?: number) => void;
  setCropRect: (rect: CropRect) => void;
  setOverlayPosition: (x: number, y: number) => void;
  setOverlayScale: (scale: number) => void;
  setOverlayAlpha: (alpha: number) => void;
  toggleCropMode: (enabled: boolean) => void;
  toggleOverlayMode: (enabled: boolean) => void;
  toggleGrid: () => void;
  toggleCrosshair: () => void;
  toggleHeatmap: () => void;
  setLocalComparison: (ssim: number, edgeOverlap: number, heatmap: string | null, edgeViz: string | null) => void;
  setIsCropping: (loading: boolean) => void;
  setIsComparing: (loading: boolean) => void;
  resetOverlay: () => void;
  resetAll: () => void;
}

export const useOverlayStore = create<OverlayState>((set) => ({
  // Initial state
  sourceImage: null,
  baseImage: null,
  croppedImage: null,
  croppedWidth: 0,
  croppedHeight: 0,
  overlayX: 50,
  overlayY: 50,
  overlayScale: 1.0,
  overlayAlpha: 0.7,
  cropRect: { x: 50, y: 50, width: 150, height: 100 },
  isCropMode: false,
  isOverlayMode: false,
  showGrid: false,
  showCrosshair: true,
  showHeatmap: false,
  localSSIM: 0,
  edgeOverlap: 0,
  differenceHeatmap: null,
  edgeVisualization: null,
  isCropping: false,
  isComparing: false,
  
  // Actions
  setSourceImage: (image) => set({ sourceImage: image }),
  setBaseImage: (image) => set({ baseImage: image }),
  setCroppedImage: (image, width = 0, height = 0) => set({ 
    croppedImage: image, 
    croppedWidth: width, 
    croppedHeight: height 
  }),
  setCropRect: (rect) => set({ cropRect: rect }),
  setOverlayPosition: (x, y) => set({ overlayX: x, overlayY: y }),
  setOverlayScale: (scale) => set({ overlayScale: scale }),
  setOverlayAlpha: (alpha) => set({ overlayAlpha: alpha }),
  toggleCropMode: (enabled) => set({ isCropMode: enabled }),
  toggleOverlayMode: (enabled) => set({ isOverlayMode: enabled }),
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
  toggleCrosshair: () => set((state) => ({ showCrosshair: !state.showCrosshair })),
  toggleHeatmap: () => set((state) => ({ showHeatmap: !state.showHeatmap })),
  setLocalComparison: (ssim, edgeOverlap, heatmap, edgeViz) => set({
    localSSIM: ssim,
    edgeOverlap: edgeOverlap,
    differenceHeatmap: heatmap,
    edgeVisualization: edgeViz,
  }),
  setIsCropping: (loading) => set({ isCropping: loading }),
  setIsComparing: (loading) => set({ isComparing: loading }),
  resetOverlay: () => set({
    croppedImage: null,
    croppedWidth: 0,
    croppedHeight: 0,
    overlayX: 50,
    overlayY: 50,
    overlayScale: 1.0,
    overlayAlpha: 0.7,
    isOverlayMode: false,
    localSSIM: 0,
    edgeOverlap: 0,
    differenceHeatmap: null,
    edgeVisualization: null,
  }),
  resetAll: () => set({
    sourceImage: null,
    baseImage: null,
    croppedImage: null,
    croppedWidth: 0,
    croppedHeight: 0,
    overlayX: 50,
    overlayY: 50,
    overlayScale: 1.0,
    overlayAlpha: 0.7,
    cropRect: { x: 50, y: 50, width: 150, height: 100 },
    isCropMode: false,
    isOverlayMode: false,
    showGrid: false,
    showCrosshair: true,
    showHeatmap: false,
    localSSIM: 0,
    edgeOverlap: 0,
    differenceHeatmap: null,
    edgeVisualization: null,
    isCropping: false,
    isComparing: false,
  }),
}));
