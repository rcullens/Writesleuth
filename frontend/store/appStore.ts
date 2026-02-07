import { create } from 'zustand';

export interface SubScore {
  name: string;
  score: number;
  description: string;
}

export interface ComparisonResult {
  id: string;
  timestamp: string;
  questioned_image_thumb: string;
  known_image_thumb: string;
  processed_questioned: string;
  processed_known: string;
  difference_heatmap: string;
  composite_score: number;
  sub_scores: SubScore[];
  verdict: string;
  verdict_color: string;
  ai_analysis?: string;
}

export interface HistoryItem {
  id: string;
  timestamp: string;
  composite_score: number;
  verdict: string;
  verdict_color: string;
  questioned_thumb: string;
  known_thumb: string;
}

interface AppState {
  questionedImage: string | null;
  knownImage: string | null;
  isComparing: boolean;
  currentResult: ComparisonResult | null;
  history: HistoryItem[];
  error: string | null;
  
  setQuestionedImage: (image: string | null) => void;
  setKnownImage: (image: string | null) => void;
  setIsComparing: (comparing: boolean) => void;
  setCurrentResult: (result: ComparisonResult | null) => void;
  setHistory: (history: HistoryItem[]) => void;
  setError: (error: string | null) => void;
  clearImages: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  questionedImage: null,
  knownImage: null,
  isComparing: false,
  currentResult: null,
  history: [],
  error: null,
  
  setQuestionedImage: (image) => set({ questionedImage: image }),
  setKnownImage: (image) => set({ knownImage: image }),
  setIsComparing: (comparing) => set({ isComparing: comparing }),
  setCurrentResult: (result) => set({ currentResult: result }),
  setHistory: (history) => set({ history }),
  setError: (error) => set({ error }),
  clearImages: () => set({ questionedImage: null, knownImage: null }),
}));
