import { create } from 'zustand';

export interface FileMetadata {
  path: string;
  size: number;
  modified: number;
  partial_hash: string | null;
  full_hash: string | null;
}

export interface ScanResult {
  groups: FileMetadata[][];
}

interface UIState {
  isScanning: boolean;
  scanQueue: string[];
  scanResults: ScanResult | null;
  selectionQueue: string[]; // paths to delete
  scanHidden: boolean;
  scanImages: boolean;
  scanVideos: boolean;
  scanZips: boolean;
  scanPhase: 'idle' | 'metadata' | 'partial' | 'full';
  scanTimestamp: number;
  setScanning: (isScanning: boolean) => void;
  setScanPhase: (phase: 'idle' | 'metadata' | 'partial' | 'full') => void;
  setScanHidden: (scanHidden: boolean) => void;
  setScanImages: (scanImages: boolean) => void;
  setScanVideos: (scanVideos: boolean) => void;
  setScanZips: (scanZips: boolean) => void;
  setScanTimestamp: (ts: number) => void;
  addToQueue: (path: string) => void;
  removeFromQueue: (path: string) => void;
  clearQueue: () => void;
  setResults: (results: ScanResult | null) => void;
  toggleSelection: (path: string) => void;
  smartSelect: (criteria: "newest" | "oldest") => void;
  clearSelection: () => void;
  removeDeletedFromResults: (paths: string[]) => void;
}

export const useStore = create<UIState>((set) => ({
  isScanning: false,
  scanQueue: [],
  scanResults: null,
  selectionQueue: [],
  scanHidden: true,
  scanImages: true,
  scanVideos: true,
  scanZips: true,
  scanPhase: 'idle',
  scanTimestamp: 0,
  setScanning: (isScanning) => set({ isScanning }),
  setScanPhase: (scanPhase) => set({ scanPhase }),
  setScanHidden: (scanHidden) => set({ scanHidden }),
  setScanImages: (scanImages) => set({ scanImages }),
  setScanVideos: (scanVideos) => set({ scanVideos }),
  setScanZips: (scanZips) => set({ scanZips }),
  setScanTimestamp: (ts) => set({ scanTimestamp: ts }),
  addToQueue: (path) => set((state) => ({
    scanQueue: state.scanQueue.includes(path) ? state.scanQueue : [...state.scanQueue, path]
  })),
  removeFromQueue: (path) => set((state) => ({
    scanQueue: state.scanQueue.filter((p) => p !== path)
  })),
  clearQueue: () => set({ scanQueue: [] }),
  setResults: (results) => set({ scanResults: results }),
  toggleSelection: (path) => set((state) => ({
    selectionQueue: state.selectionQueue.includes(path)
      ? state.selectionQueue.filter((p) => p !== path)
      : [...state.selectionQueue, path]
  })),
  smartSelect: (criteria) => set((state) => {
    if (!state.scanResults) return state;

    const newSelection: string[] = [];
    state.scanResults.groups.forEach((group) => {
      // Sort group by modified date
      const sorted = [...group].sort((a, b) =>
        criteria === "newest" ? b.modified - a.modified : a.modified - b.modified
      );

      // Keep the first one (newest/oldest), select the rest
      sorted.slice(1).forEach((f) => {
        newSelection.push(f.path);
      });
    });

    return { selectionQueue: newSelection };
  }),
  clearSelection: () => set({ selectionQueue: [] }),
  removeDeletedFromResults: (paths: string[]) => set((state) => {
    if (!state.scanResults) return state;

    const newGroups = state.scanResults.groups.map(group =>
      group.filter(file => !paths.includes(file.path))
    ).filter(group => group.length > 1); // Only keep groups that still have duplicates

    return {
      scanResults: { ...state.scanResults, groups: newGroups },
      selectionQueue: state.selectionQueue.filter(p => !paths.includes(p))
    };
  }),
}));
