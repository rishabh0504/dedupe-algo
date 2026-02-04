import React, { useState, useEffect } from "react";
import { useStore, FileMetadata } from "../store/useStore";
import { formatSize, cn } from "../lib/utils";
import {
    Trash2,
    ChevronRight,
    AlertCircle,
    X,
    Video,
    Image as ImageIcon,
    ImageOff,
    VideoOff,
    CheckCircle2,
    ExternalLink,
    RotateCcw,
    Search,
    LayoutGrid,
    Binary,
    Folders,
    Loader2
} from "lucide-react";
import { DeleteConfirmation } from "./DeleteConfirmation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { ClusterResultsView } from "./views/ClusterResultsView";
import { FolderResultsView } from "./views/FolderResultsView";
import { CategoryResultsView } from "./views/CategoryResultsView";
import { transformToCategories, transformToFolders } from "../lib/dataTransform";
import { toast } from "sonner";

interface ResultsViewProps {
    onRescan: () => void;
}

export function ResultsView({ onRescan }: ResultsViewProps) {
    const { scanResults, selectionQueue, toggleSelection, clearSelection } = useStore();
    const [isConfirmOpen, setConfirmOpen] = useState(false);
    const [previewFile, setPreviewFile] = useState<FileMetadata | null>(null);
    const [previewError, setPreviewError] = useState(false);
    const [viewMode, setViewMode] = useState<'cluster' | 'folder' | 'category'>('cluster');
    const [isSwitching, setIsSwitching] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const handleViewChange = (mode: 'cluster' | 'folder' | 'category') => {
        if (mode === viewMode) return;
        setIsSwitching(true);
        setViewMode(mode);
        setTimeout(() => setIsSwitching(false), 300);
    };

    const filteredResults = React.useMemo(() => {
        if (!scanResults) return null;
        if (!searchQuery.trim()) return scanResults;

        const query = searchQuery.toLowerCase();
        const filtered = scanResults.groups.filter(group =>
            group.some(file => file.path.toLowerCase().includes(query))
        );

        return { groups: filtered };
    }, [scanResults, searchQuery]);

    const categoryData = React.useMemo(() => {
        if (!filteredResults) return [];
        return transformToCategories(filteredResults.groups);
    }, [filteredResults]);

    const folderData = React.useMemo(() => {
        if (!filteredResults) return [];
        return transformToFolders(filteredResults.groups);
    }, [filteredResults]);

    if (!scanResults || scanResults.groups.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center animate-in fade-in zoom-in-95 duration-500 bg-[#0c0c0c]">
                <div className="w-24 h-24 bg-white/[0.02] rounded-3xl flex items-center justify-center mb-6 border border-white/5 shadow-2xl relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                    <AlertCircle className="w-10 h-10 text-white/20 group-hover:text-primary/50 transition-colors duration-500" />
                    <div className="absolute inset-0 border-2 border-white/5 rounded-3xl" />
                </div>

                <h3 className="text-2xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-white/40 uppercase italic">
                    Noise Floor Detected
                </h3>

                <div className="w-12 h-0.5 bg-gradient-to-r from-transparent via-primary/50 to-transparent my-4 opacity-50" />

                <p className="max-w-[320px] text-xs text-slate-500 leading-relaxed font-medium">
                    The scanning engine found <span className="text-white/60 font-bold">no redundant file structures</span> in the prioritized volumes.
                </p>

                <div className="mt-8 flex items-center gap-2 px-4 py-2 bg-white/[0.03] rounded-full border border-white/5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500/80">System Optimal</span>
                </div>
            </div>
        );
    }

    const totalReclaimable = React.useMemo(() => {
        if (!scanResults) return 0;
        return scanResults.groups.reduce((acc, group) => {
            const groupSize = group[0]?.size || 0;
            const dupesCount = Math.max(0, group.length - 1);
            return acc + (groupSize * dupesCount);
        }, 0);
    }, [scanResults]);

    const filePathMap = React.useMemo(() => {
        const map = new Map<string, number>();
        if (!scanResults) return map;
        scanResults.groups.forEach(group => {
            group.forEach(file => {
                map.set(file.path, file.size);
            });
        });
        return map;
    }, [scanResults]);

    const selectedSize = React.useMemo(() => {
        return selectionQueue.reduce((acc, path) => acc + (filePathMap.get(path) || 0), 0);
    }, [selectionQueue, filePathMap]);

    const handlePreview = async (e: React.MouseEvent, file: FileMetadata) => {
        e.stopPropagation();

        // Security Handshake: Dynamically allow the asset protocol to see this folder
        try {
            const folderPath = file.path.split('/').slice(0, -1).join('/');
            await invoke("allow_folder_access", { path: folderPath });
        } catch (err) {
            console.error("Security handshake failed:", err);
        }

        setPreviewError(false);
        setPreviewFile(file);
    };

    const isMedia = (path: string) => {
        const ext = path.split('.').pop()?.toLowerCase();
        return ["jpg", "jpeg", "png", "webp", "gif", "mp4", "mov", "mkv", "webm"].includes(ext || "");
    };

    const isVideo = (path: string) => {
        const ext = path.split('.').pop()?.toLowerCase();
        return ["mp4", "mov", "mkv", "webm", "avi", "wmv", "3gp", "flv", "mts", "m2ts", "ts"].includes(ext || "");
    };

    const isNativeVideo = (path: string) => {
        const ext = path.split('.').pop()?.toLowerCase();
        return ["mp4", "mov", "webm"].includes(ext || "");
    };

    const safeConvertFileSrc = (path: string) => {
        if (!path) return "";
        const normalized = path.normalize('NFC');
        const originalUrl = convertFileSrc(normalized);
        return originalUrl.replace(/ /g, '%20').replace(/\+/g, '%2B');
    };

    const selectedSet = React.useMemo(() => new Set(selectionQueue), [selectionQueue]);

    // Robust State Synchronization
    useEffect(() => {
        if (!previewFile || !scanResults) return;
        const exists = scanResults.groups.some(group =>
            group.some(file => file.path === previewFile.path)
        );
        if (!exists) setPreviewFile(null);
    }, [scanResults, previewFile]);

    const closePreview = () => setPreviewFile(null);

    return (
        <div className="flex-1 flex flex-row h-full overflow-hidden bg-[#0c0c0c] animate-in fade-in duration-500">

            {/* LEFT COLUMN: AUDIT MATRIX */}
            <div className="flex-1 flex flex-col h-full overflow-hidden border-r border-white/5">
                {/* Header / Actions */}
                <div className="p-6 pb-6 flex flex-col gap-6 bg-white/[0.02] backdrop-blur-3xl sticky top-0 z-20 shadow-sm border-b border-white/5">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl font-black tracking-tighter uppercase italic leading-none text-white text-glow">Audit Matrix</h1>
                                <Badge variant="secondary" className="glass bg-primary/10 text-primary border-primary/20 text-[10px] h-5 px-2 font-black uppercase tracking-widest leading-none">
                                    {scanResults.groups.length} Groups
                                </Badge>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                                    Total Potential Yield: {formatSize(totalReclaimable)}
                                </span>
                            </div>
                        </div>

                        <div className="flex gap-3 items-center">
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={onRescan}
                                className="h-9 w-9 text-slate-400 hover:text-primary hover:bg-primary/5 border-slate-200 rounded-xl cursor-pointer"
                                title="Rescan Folder"
                            >
                                <RotateCcw className="w-4 h-4" />
                            </Button>

                            <div className="h-5 w-px bg-slate-200 mx-1" />

                            <div className="flex gap-1.5 p-1 bg-white/[0.05] rounded-2xl border border-white/5">
                                {[
                                    { id: 'cluster', icon: LayoutGrid, label: 'Cluster' },
                                    { id: 'category', icon: Binary, label: 'Category' },
                                    { id: 'folder', icon: Folders, label: 'Folder' }
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => handleViewChange(tab.id as any)}
                                        className={cn(
                                            "flex items-center gap-2 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer",
                                            viewMode === tab.id
                                                ? "bg-white/10 text-white shadow-sm border border-white/10"
                                                : "text-white/40 hover:text-white/60"
                                        )}
                                    >
                                        <tab.icon className="w-3.5 h-3.5" />
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex-1 relative group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                <Search className="w-4 h-4" />
                            </div>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by filename or path metadata..."
                                className="w-full h-11 pl-11 pr-4 bg-white/[0.03] border border-white/10 rounded-2xl text-xs font-medium placeholder:text-white/20 text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery("")}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {selectionQueue.length > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={clearSelection}
                                className="rounded-xl h-11 px-6 font-black text-[10px] uppercase tracking-widest hover:bg-destructive/5 text-destructive border border-transparent hover:border-destructive/20 transition-all"
                            >
                                <X className="w-3.5 h-3.5 mr-2" />
                                Clear {selectionQueue.length} Selections
                            </Button>
                        )}
                    </div>
                </div>

                {/* Vertical Scroll Container */}
                <div className="flex-1 relative overflow-hidden">
                    {isSwitching && (
                        <div className="absolute inset-0 z-30 bg-[#0c0c0c]/40 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
                            <div className="flex flex-col items-center gap-4">
                                <div className="relative">
                                    <div className="absolute -inset-4 bg-primary/20 rounded-full blur-xl animate-pulse" />
                                    <Loader2 className="w-8 h-8 text-primary animate-spin relative z-10" />
                                </div>
                                <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] ml-1">Re-Mapping Audit Matrix</span>
                            </div>
                        </div>
                    )}
                    <ScrollArea className="h-full w-full">
                        <div className="p-6">
                            {viewMode === 'cluster' && filteredResults && (
                                <ClusterResultsView
                                    scanResults={filteredResults}
                                    selectedSet={selectedSet}
                                    toggleSelection={toggleSelection}
                                    handlePreview={handlePreview}
                                    isMedia={isMedia}
                                />
                            )}
                            {viewMode === 'folder' && filteredResults && (
                                <FolderResultsView
                                    folderData={folderData}
                                    selectedSet={selectedSet}
                                    toggleSelection={toggleSelection}
                                    handlePreview={handlePreview}
                                    isMedia={isMedia}
                                />
                            )}
                            {viewMode === 'category' && filteredResults && (
                                <CategoryResultsView
                                    categoryData={categoryData}
                                    selectedSet={selectedSet}
                                    toggleSelection={toggleSelection}
                                    handlePreview={handlePreview}
                                    isMedia={isMedia}
                                />
                            )}
                            <div className="h-60" /> {/* Large buffer for footer room */}
                        </div>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                </div>
            </div>

            {/* RIGHT COLUMN: PREVIEW PANEL (COLLAPSIBLE) */}
            {previewFile && (
                <div className="w-[480px] flex flex-col h-full bg-[#0c0c0c] border-l border-white/5 overflow-hidden relative group/preview animate-in slide-in-from-right duration-300">
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Preview Content */}
                        <div className="flex-1 flex flex-col bg-black/95 relative overflow-hidden group/media">
                            <div className="absolute top-4 right-4 z-20">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={closePreview}
                                    className="rounded-xl bg-white/10 text-white hover:bg-white/20 shadow-lg border border-white/10 hover:scale-105 transition-all"
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>

                            <div className="flex-1 flex items-center justify-center bg-slate-950/50 relative">
                                {previewError || (isVideo(previewFile.path) && !isNativeVideo(previewFile.path)) ? (
                                    <div className="flex flex-col items-center gap-6 text-white/20 animate-in fade-in zoom-in-95 duration-500">
                                        <div className="w-20 h-20 rounded-full border border-dashed border-white/10 flex items-center justify-center bg-white/[0.02]">
                                            {isVideo(previewFile.path) ? <VideoOff className="w-8 h-8 opacity-50" /> : <ImageOff className="w-8 h-8 opacity-50" />}
                                        </div>
                                        <div className="flex flex-col items-center gap-2">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
                                                {isVideo(previewFile.path) ? "Format Not Supported In-App" : "Render Failed"}
                                            </span>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => invoke("open_file", { path: previewFile.path })}
                                                className="h-8 text-[9px] font-black uppercase tracking-widest bg-white/5 border-white/10 hover:bg-white/10 hover:text-white"
                                            >
                                                Open System Player
                                            </Button>
                                        </div>
                                    </div>
                                ) : isVideo(previewFile.path) ? (
                                    <video
                                        src={safeConvertFileSrc(previewFile.path)}
                                        controls
                                        muted
                                        className="max-w-full max-h-full shadow-2xl"
                                        onError={() => setPreviewError(true)}
                                    />
                                ) : (
                                    <img
                                        src={safeConvertFileSrc(previewFile.path)}
                                        className="max-w-full max-h-full object-contain p-2"
                                        alt="Preview"
                                        onLoad={(e) => {
                                            (e.target as HTMLImageElement).classList.add('animate-in', 'fade-in', 'zoom-in-95', 'duration-700');
                                        }}
                                        onError={() => setPreviewError(true)}
                                    />
                                )}
                            </div>

                            <div className="p-10 pb-12 bg-gradient-to-t from-black via-black/90 to-transparent flex flex-col gap-5">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-2xl">
                                        {isVideo(previewFile.path) ? <Video className="w-6 h-6 text-primary" /> : <ImageIcon className="w-6 h-6 text-primary" />}
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-lg font-black text-white truncate tracking-tight uppercase leading-tight italic">{previewFile.path.split('/').pop()}</span>
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                            <span className="text-[10px] text-emerald-500 font-black tracking-[0.2em] uppercase italic">System Integrity Verified</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3 border-l-2 border-primary/30 pl-6 py-1">
                                    <div className="flex items-center gap-3">
                                        <Badge variant="secondary" className="glass bg-white/5 text-white border-white/10 uppercase font-black tracking-widest text-[9px] h-5 px-2">
                                            {formatSize(previewFile.size)}
                                        </Badge>
                                        <div className="w-1 h-1 rounded-full bg-white/20" />
                                        <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">{new Date(previewFile.modified * 1000).toLocaleDateString()}</span>
                                    </div>
                                    <p className="text-[10px] text-white/30 font-medium break-all leading-tight font-mono hover:text-white/60 transition-colors">
                                        {previewFile.path}
                                    </p>
                                </div>

                                <div className="mt-6 flex flex-col gap-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <Button
                                            variant="secondary"
                                            size="lg"
                                            onClick={() => invoke("reveal_in_finder", { path: previewFile.path })}
                                            className="bg-white/5 hover:bg-white/15 text-white border border-white/10 rounded-2xl h-12 text-[10px] font-black uppercase tracking-widest transition-all hover:scale-[1.02]"
                                        >
                                            <ExternalLink className="w-4 h-4 mr-2 text-primary" />
                                            Locate
                                        </Button>
                                        <Button
                                            variant="default"
                                            size="lg"
                                            onClick={() => toggleSelection(previewFile.path)}
                                            className={cn(
                                                "rounded-2xl h-12 text-[10px] font-black uppercase tracking-widest transition-all hover:scale-[1.02] shadow-xl",
                                                selectionQueue.includes(previewFile.path)
                                                    ? "bg-red-500 text-white hover:bg-red-600 shadow-red-500/20"
                                                    : "bg-primary text-black hover:bg-primary/90 shadow-primary/20"
                                            )}
                                        >
                                            {selectionQueue.includes(previewFile.path) ? <><X className="w-4 h-4 mr-2" /> Deselect</> : <><CheckCircle2 className="w-4 h-4 mr-2" /> Select</>}
                                        </Button>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            navigator.clipboard.writeText(previewFile.path);
                                            toast.success("Identity identifier copied");
                                        }}
                                        className="w-full bg-white/5 hover:bg-white/10 text-white/30 hover:text-white border border-white/5 rounded-xl h-10 text-[9px] font-black uppercase tracking-widest transition-all"
                                    >
                                        Copy Protocol Path
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Selection HUD */}
            {selectionQueue.length > 0 && (
                <div className="fixed bottom-8 left-[calc(50%-120px)] w-full max-w-sm px-6 animate-in slide-in-from-bottom-full duration-500 z-30 pointer-events-none">
                    <div className="bg-slate-900 border border-white/10 p-2.5 rounded-2xl shadow-2xl flex items-center justify-between gap-4 pointer-events-auto">
                        <div className="flex items-center gap-3 ml-2">
                            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary border border-primary/20 relative">
                                <Trash2 className="w-5 h-5 text-destructive" />
                                <div className="absolute -top-1.5 -right-1.5 bg-destructive text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-lg border border-black">
                                    {selectionQueue.length}
                                </div>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[8px] font-black text-white/30 uppercase tracking-widest opacity-50">Yield Reclaim</span>
                                <span className="text-xs font-black text-white italic leading-none">{formatSize(selectedSize)}</span>
                            </div>
                        </div>

                        <Button
                            onClick={() => setConfirmOpen(true)}
                            className="rounded-xl px-5 h-10 text-[9px] font-black shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 text-primary-foreground uppercase tracking-widest gap-2"
                        >
                            Cleanup
                            <ChevronRight className="w-3 h-3" />
                        </Button>
                    </div>
                </div>
            )}

            <DeleteConfirmation isOpen={isConfirmOpen} onClose={() => setConfirmOpen(false)} />
        </div>
    );
}
