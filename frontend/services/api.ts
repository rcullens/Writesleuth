import axios from 'axios';
import { ComparisonResult, HistoryItem } from '../store/appStore';

// Use environment variable, fallback to relative URL for same-origin requests
const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const api = axios.create({
  baseURL: `${API_BASE}/api`,
  timeout: 120000, // 2 minutes for AI analysis
  headers: {
    'Content-Type': 'application/json',
  },
});

export const compareHandwriting = async (
  questionedImage: string,
  knownImage: string,
  useAiAnalysis: boolean = true
): Promise<ComparisonResult> => {
  const response = await api.post('/compare', {
    questioned_image: questionedImage,
    known_image: knownImage,
    use_ai_analysis: useAiAnalysis,
  });
  return response.data;
};

export const getHistory = async (limit: number = 20): Promise<HistoryItem[]> => {
  const response = await api.get('/history', { params: { limit } });
  return response.data;
};

export const getComparison = async (id: string): Promise<any> => {
  const response = await api.get(`/comparison/${id}`);
  return response.data;
};

export const deleteComparison = async (id: string): Promise<void> => {
  await api.delete(`/history/${id}`);
};

export const clearHistory = async (): Promise<void> => {
  await api.delete('/history');
};

export const healthCheck = async (): Promise<boolean> => {
  try {
    const response = await api.get('/health');
    return response.data.status === 'healthy';
  } catch {
    return false;
  }
};

export interface PDFReportRequest {
  comparison_id: string;
  questioned_thumb: string;
  known_thumb: string;
  processed_questioned: string;
  processed_known: string;
  difference_heatmap: string;
  composite_score: number;
  sub_scores: Array<{ name: string; score: number; description: string }>;
  verdict: string;
  ai_analysis?: string;
}

export const generatePDFReport = async (request: PDFReportRequest): Promise<{ pdf_base64: string; filename: string }> => {
  const response = await api.post('/generate-pdf', request);
  return response.data;
};

// Crop & Overlay APIs
export interface CropRequest {
  image_base64: string;
  crop_x: number;
  crop_y: number;
  crop_width: number;
  crop_height: number;
}

export interface CropResponse {
  cropped_image: string;
  cropped_solid: string;
  width: number;
  height: number;
  original_x: number;
  original_y: number;
}

export const cropRegion = async (request: CropRequest): Promise<CropResponse> => {
  const response = await api.post('/crop-region', request);
  return response.data;
};

export interface LocalComparisonRequest {
  base_image: string;
  overlay_image: string;
  overlay_x: number;
  overlay_y: number;
  overlay_width: number;
  overlay_height: number;
}

export interface LocalComparisonResponse {
  local_ssim: number;
  difference_heatmap: string;
  edge_overlap: number;
  edge_visualization: string;
  region_width: number;
  region_height: number;
}

export const localComparison = async (request: LocalComparisonRequest): Promise<LocalComparisonResponse> => {
  const response = await api.post('/local-comparison', request);
  return response.data;
};

export interface OverlayReportRequest {
  base_image: string;
  overlay_image: string;
  overlay_x: number;
  overlay_y: number;
  overlay_width: number;
  overlay_height: number;
  overlay_alpha: number;
  local_ssim: number;
  edge_overlap: number;
  notes?: string;
}

export const generateOverlayPDF = async (request: OverlayReportRequest): Promise<{ pdf_base64: string; filename: string }> => {
  const response = await api.post('/generate-overlay-pdf', request);
  return response.data;
};
