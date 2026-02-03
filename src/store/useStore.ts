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

export interface ExplorerTab {
  id: string;
  name: string;
  path: string;
  history: string[];
  historyIndex: number;
  viewMode: 'grid' | 'list';
  searchQuery: string;
  sortBy: 'name' | 'size' | 'modified' | 'kind';
  sortOrder: 'asc' | 'desc';
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
  minFileSize: number; // in bytes
  scanPhase: 'idle' | 'metadata' | 'partial' | 'full';
  scanTimestamp: number;
  scanProgress: { current: number; total: number; file: string; } | null;
  isOnboarded: boolean;
  setScanning: (isScanning: boolean) => void;
  setScanPhase: (phase: 'idle' | 'metadata' | 'partial' | 'full') => void;
  setScanHidden: (scanHidden: boolean) => void;
  setScanImages: (scanImages: boolean) => void;
  setScanVideos: (scanVideos: boolean) => void;
  setScanZips: (scanZips: boolean) => void;
  setMinFileSize: (size: number) => void;
  setScanTimestamp: (ts: number) => void;
  setScanProgress: (progress: { current: number; total: number; file: string; } | null) => void;
  setOnboarded: (val: boolean) => void;
  addToQueue: (path: string) => void;
  removeFromQueue: (path: string) => void;
  clearQueue: () => void;
  setResults: (results: ScanResult | null) => void;
  toggleSelection: (path: string) => void;
  smartSelect: (criteria: "newest" | "oldest") => void;
  clearSelection: () => void;
  activeView: 'explorer' | 'dedupe' | 'jarvis';
  activeDedupeTab: 'queue' | 'results';
  explorerPath: string | null;
  explorerTabs: ExplorerTab[];
  activeTabId: string | null;
  setActiveView: (view: 'explorer' | 'dedupe' | 'jarvis') => void;
  setActiveDedupeTab: (tab: 'queue' | 'results') => void;
  setExplorerPath: (path: string | null) => void;
  addExplorerTab: (name: string, path: string) => void;
  closeExplorerTab: (id: string) => void;
  setActiveTabId: (id: string | null) => void;
  updateExplorerTab: (id: string, updates: Partial<ExplorerTab>) => void;
  removeDeletedFromResults: (paths: string[]) => void;
  refreshTrigger: number;
  triggerRefresh: () => void;
  isVoiceEnabled: boolean;
  setVoiceEnabled: (enabled: boolean) => void;
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
  minFileSize: 51200, // 50KB Default
  scanPhase: 'idle',
  scanTimestamp: 0,
  scanProgress: null,
  isOnboarded: localStorage.getItem('aether-onboarded') === 'true',
  activeView: (localStorage.getItem('aether-active-view') as any) || 'explorer',
  activeDedupeTab: (localStorage.getItem('aether-dedupe-tab') as any) || 'queue',
  explorerPath: localStorage.getItem('aether-explorer-path'),
  explorerTabs: (JSON.parse(localStorage.getItem('aether-explorer-tabs') || '[]') as ExplorerTab[]).map(t => ({
    ...t,
    viewMode: t.viewMode || 'grid',
    searchQuery: t.searchQuery || '',
    sortBy: t.sortBy || 'name',
    sortOrder: t.sortOrder || 'asc'
  })),
  activeTabId: localStorage.getItem('aether-active-tab-id'),
  refreshTrigger: 0,
  triggerRefresh: () => set((state) => ({ refreshTrigger: state.refreshTrigger + 1 })),
  isVoiceEnabled: false, // ALWAYS OFF by default (User must explicitly enable)
  setScanning: (isScanning) => set({ isScanning }),
  setVoiceEnabled: (enabled) => {
    localStorage.setItem('aether-voice-enabled', enabled.toString());
    set({ isVoiceEnabled: enabled });
  },
  setScanPhase: (scanPhase) => set({ scanPhase }),
  setScanHidden: (scanHidden) => set({ scanHidden }),
  setScanImages: (scanImages) => set({ scanImages }),
  setScanVideos: (scanVideos) => set({ scanVideos }),
  setScanZips: (scanZips) => set({ scanZips }),
  setMinFileSize: (minFileSize) => set({ minFileSize }),
  setScanTimestamp: (ts) => set({ scanTimestamp: ts }),
  setScanProgress: (scanProgress) => set({ scanProgress }),
  setActiveView: (activeView) => {
    localStorage.setItem('aether-active-view', activeView);
    set((state) => ({
      activeView,
      scanQueue: activeView !== 'dedupe' ? [] : state.scanQueue
    }));
  },
  setActiveDedupeTab: (activeDedupeTab) => {
    localStorage.setItem('aether-dedupe-tab', activeDedupeTab);
    set({ activeDedupeTab });
  },
  setExplorerPath: (explorerPath) => {
    if (explorerPath) {
      localStorage.setItem('aether-explorer-path', explorerPath);
    } else {
      localStorage.removeItem('aether-explorer-path');
    }
    set({ explorerPath });
  },
  addExplorerTab: (name, path) => set((state) => {
    const newTab: ExplorerTab = {
      id: Math.random().toString(36).substring(7),
      name,
      path,
      history: [path],
      historyIndex: 0,
      viewMode: 'grid',
      searchQuery: '',
      sortBy: 'name',
      sortOrder: 'asc'
    };

    const newTabs = [...state.explorerTabs, newTab];
    localStorage.setItem('aether-explorer-tabs', JSON.stringify(newTabs));
    localStorage.setItem('aether-active-tab-id', newTab.id);
    return {
      explorerTabs: newTabs,
      activeTabId: newTab.id,
      explorerPath: path // Keep sync for legacy or shared parts
    };
  }),
  closeExplorerTab: (id) => set((state) => {
    const newTabs = state.explorerTabs.filter(t => t.id !== id);
    let nextActiveId = state.activeTabId;

    if (state.activeTabId === id) {
      nextActiveId = newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null;
    }

    localStorage.setItem('aether-explorer-tabs', JSON.stringify(newTabs));
    if (nextActiveId) {
      localStorage.setItem('aether-active-tab-id', nextActiveId);
    } else {
      localStorage.removeItem('aether-active-tab-id');
    }

    const activeTab = newTabs.find(t => t.id === nextActiveId);

    return {
      explorerTabs: newTabs,
      activeTabId: nextActiveId,
      explorerPath: activeTab?.path || null
    };
  }),
  setActiveTabId: (id) => {
    if (id) {
      localStorage.setItem('aether-active-tab-id', id);
    } else {
      localStorage.removeItem('aether-active-tab-id');
    }
    set((state) => {
      const activeTab = state.explorerTabs.find(t => t.id === id);
      return {
        activeTabId: id,
        explorerPath: activeTab?.path || state.explorerPath
      };
    });
  },
  updateExplorerTab: (id, updates) => set((state) => {
    const newTabs = state.explorerTabs.map(t =>
      t.id === id ? { ...t, ...updates } : t
    );
    localStorage.setItem('aether-explorer-tabs', JSON.stringify(newTabs));

    const activeTab = newTabs.find(t => t.id === state.activeTabId);

    return {
      explorerTabs: newTabs,
      explorerPath: activeTab?.path || state.explorerPath
    };
  }),
  setOnboarded: (val: boolean) => {
    localStorage.setItem('aether-onboarded', val.toString());
    set({ isOnboarded: val });
  },
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
