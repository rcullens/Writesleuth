import axios from 'axios';
import { ComparisonResult, HistoryItem } from '../store/appStore';

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://writesleuth.preview.emergentagent.com';

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
