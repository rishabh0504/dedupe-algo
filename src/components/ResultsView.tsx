import React, { useState, useEffect } from "react";
import { useStore, FileMetadata } from "../store/useStore";
import { formatSize, cn } from "../lib/utils";
import {
    Trash2,
    Calendar,
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
} from "lucide-react";
import { DeleteConfirmation } from "./DeleteConfirmation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { ClusterResultsView } from "./views/ClusterResultsView";
import { FolderResultsView } from "./views/FolderResultsView";
import { CategoryResultsView } from "./views/CategoryResultsView";

interface ResultsViewProps {
    onRescan: () => void;
}

export function ResultsView({ onRescan }: ResultsViewProps) {
    const { scanResults, selectionQueue, toggleSelection, smartSelect, clearSelection } = useStore();
    const [isConfirmOpen, setConfirmOpen] = useState(false);
    const [previewFile, setPreviewFile] = useState<FileMetadata | null>(null);
    const [previewError, setPreviewError] = useState(false);
    const [viewMode, setViewMode] = useState<'cluster' | 'folder' | 'category'>('cluster');

    if (!scanResults || scanResults.groups.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center animate-in fade-in zoom-in-95 duration-500 bg-[#f9fafb]">
                <div className="w-16 h-16 bg-muted/30 rounded-2xl flex items-center justify-center mb-4 border border-border/50">
                    <AlertCircle className="w-8 h-8 text-muted-foreground opacity-20" />
                </div>
                <h3 className="text-xl font-black tracking-tight text-slate-900 uppercase italic">Noise Floor Detected</h3>
                <p className="max-w-[240px] mt-2 text-[11px] text-slate-400 leading-relaxed font-medium">
                    The scanning engine found no redundant file structures in the prioritized volumes.
                </p>
            </div>
        );
    }

    const totalReclaimable = scanResults.groups.reduce((acc: number, group: FileMetadata[]) => {
        const groupSize = group[0].size;
        const dupesCount = group.length - 1;
        return acc + (groupSize * dupesCount);
    }, 0);

    const selectedSize = selectionQueue.reduce((acc: number, path: string) => {
        if (!scanResults) return acc;
        for (const group of scanResults.groups) {
            const file = group.find((f: FileMetadata) => f.path === path);
            if (file) return acc + file.size;
        }
        return acc;
    }, 0);

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
        return ["jpg", "jpeg", "png", "webp", "gif", "mp4", "mov"].includes(ext || "");
    };

    const isVideo = (path: string) => {
        const ext = path.split('.').pop()?.toLowerCase();
        return ["mp4", "mov"].includes(ext || "");
    };

    const safeConvertFileSrc = (path: string) => {
        if (!path) return "";
        const normalized = path.normalize('NFC');
        const originalUrl = convertFileSrc(normalized);
        return originalUrl.replace(/ /g, '%20').replace(/\+/g, '%2B');
    };

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
        <div className="flex-1 flex flex-row h-full overflow-hidden bg-[#f9fafb] animate-in fade-in duration-500">

            {/* LEFT COLUMN: AUDIT MATRIX */}
            <div className="flex-1 flex flex-col h-full overflow-hidden border-r border-black/[0.03]">
                {/* Header / Actions */}
                <div className="p-6 pb-4 flex items-center justify-between bg-white/80 backdrop-blur-3xl sticky top-0 z-20 shadow-sm border-b border-black/[0.03]">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-black tracking-tighter uppercase italic leading-none text-slate-900">Audit Matrix</h2>
                            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-[8px] h-4 px-1 font-black uppercase tracking-widest leading-none">
                                {scanResults.groups.length} Groups
                            </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                                Potential Yield: {formatSize(totalReclaimable)}
                            </span>
                        </div>
                    </div>

                    <div className="flex gap-4 items-center">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={onRescan}
                            className="h-8 w-8 text-slate-400 hover:text-primary hover:bg-primary/5 border-slate-200"
                            title="Rescan Folder"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                        </Button>

                        <div className="h-4 w-px bg-slate-200" />

                        {/* View Switcher Dropdown */}
                        <div className="w-[180px]">
                            <Select value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
                                <SelectTrigger className="h-8 text-[10px] font-black uppercase tracking-widest bg-slate-50 border-slate-200 text-slate-700">
                                    <SelectValue placeholder="Select View" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="cluster" className="text-[10px] font-bold uppercase tracking-wider">Cluster View</SelectItem>
                                    <SelectItem value="category" className="text-[10px] font-bold uppercase tracking-wider">Category View</SelectItem>
                                    <SelectItem value="folder" className="text-[10px] font-bold uppercase tracking-wider">Folder View</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="h-4 w-px bg-slate-200" />

                        <div className="flex gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => smartSelect("newest")}
                                className="rounded-lg h-8 px-3 font-black text-[9px] uppercase tracking-wider hover:bg-primary/5 text-slate-500 hover:text-primary transition-all"
                            >
                                <Calendar className="w-3 h-3 mr-1.5" />
                                Retain Newest
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => smartSelect("oldest")}
                                className="rounded-lg h-8 px-3 font-black text-[9px] uppercase tracking-wider hover:bg-primary/5 text-slate-500 hover:text-primary transition-all"
                            >
                                <Calendar className="w-3 h-3 mr-1.5" />
                                Retain Oldest
                            </Button>

                            {selectionQueue.length > 0 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={clearSelection}
                                    className="rounded-lg h-8 px-3 font-black text-[9px] uppercase tracking-wider hover:bg-destructive/5 text-destructive hover:text-destructive transition-all animate-in fade-in zoom-in duration-300"
                                >
                                    <X className="w-3 h-3 mr-1.5" />
                                    Unselect All
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Vertical Scroll Container */}
                <div className="flex-1 relative overflow-hidden">
                    <ScrollArea className="h-full w-full">
                        <div className="p-6">
                            {viewMode === 'cluster' && (
                                <ClusterResultsView
                                    scanResults={scanResults}
                                    selectionQueue={selectionQueue}
                                    toggleSelection={toggleSelection}
                                    handlePreview={handlePreview}
                                    isMedia={isMedia}
                                />
                            )}
                            {viewMode === 'folder' && (
                                <FolderResultsView
                                    scanResults={scanResults}
                                    selectionQueue={selectionQueue}
                                    toggleSelection={toggleSelection}
                                    handlePreview={handlePreview}
                                    isMedia={isMedia}
                                />
                            )}
                            {viewMode === 'category' && (
                                <CategoryResultsView
                                    scanResults={scanResults}
                                    selectionQueue={selectionQueue}
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
                <div className="w-[480px] flex flex-col h-full bg-white/40 backdrop-blur-3xl border-l border-black/[0.03] overflow-hidden relative group/preview animate-in slide-in-from-right duration-300">
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Preview Content */}
                        <div className="flex-1 flex flex-col bg-black/95 relative overflow-hidden group/media">
                            <div className="absolute top-4 right-4 z-20">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={closePreview}
                                    className="rounded-xl bg-white text-black hover:bg-white/90 shadow-lg border-2 border-transparent hover:scale-105 transition-all"
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>

                            <div className="flex-1 flex items-center justify-center bg-slate-950/50">
                                {previewError ? (
                                    <div className="flex flex-col items-center gap-4 text-white/20">
                                        <div className="w-16 h-16 rounded-full border-2 border-dashed border-white/10 flex items-center justify-center">
                                            {isVideo(previewFile.path) ? <VideoOff className="w-6 h-6" /> : <ImageOff className="w-6 h-6" />}
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-widest">
                                            {isVideo(previewFile.path) ? "Playback Failed" : "Render Failed"}
                                        </span>
                                    </div>
                                ) : isVideo(previewFile.path) ? (
                                    <video
                                        src={safeConvertFileSrc(previewFile.path)}
                                        controls
                                        muted
                                        className="max-w-full max-h-full"
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

                            <div className="p-8 pb-10 bg-gradient-to-t from-black to-transparent flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                    {isVideo(previewFile.path) ? <Video className="w-4 h-4 text-primary" /> : <ImageIcon className="w-4 h-4 text-primary" />}
                                    <span className="text-sm font-black text-white truncate tracking-tight">{previewFile.path.split('/').pop()}</span>
                                </div>
                                <div className="flex flex-col gap-1.5 border-l-2 border-primary/20 pl-4 py-1">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="secondary" className="bg-white/10 text-white border-white/10 uppercase font-black tracking-widest text-[8px] h-4">
                                            {formatSize(previewFile.size)}
                                        </Badge>
                                        <span className="text-[9px] text-white/30 font-bold uppercase tracking-widest">{new Date(previewFile.modified * 1000).toLocaleDateString()}</span>
                                    </div>
                                    <p className="text-[9px] text-white/40 font-medium break-all leading-tight opacity-60 hover:opacity-100 transition-opacity">
                                        {previewFile.path}
                                    </p>
                                </div>

                                <div className="mt-4 flex flex-col gap-2">
                                    <div className="flex gap-2">
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => invoke("reveal_in_finder", { path: previewFile.path })}
                                            className="flex-1 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl h-9 text-[10px] font-black uppercase tracking-widest"
                                        >
                                            <ExternalLink className="w-3.5 h-3.5 mr-2" />
                                            Locate
                                        </Button>
                                        <Button
                                            variant="default"
                                            size="sm"
                                            onClick={() => toggleSelection(previewFile.path)}
                                            className={cn(
                                                "flex-1 rounded-xl h-9 text-[10px] font-black uppercase tracking-widest",
                                                selectionQueue.includes(previewFile.path)
                                                    ? "bg-destructive hover:bg-destructive/90 text-white"
                                                    : "bg-primary hover:bg-primary/90 text-white"
                                            )}
                                        >
                                            {selectionQueue.includes(previewFile.path) ? <><Trash2 className="w-3.5 h-3.5 mr-2" /> Deselect</> : <><CheckCircle2 className="w-3.5 h-3.5 mr-2" /> Select</>}
                                        </Button>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => navigator.clipboard.writeText(previewFile.path)}
                                        className="w-full bg-white/5 hover:bg-white/10 text-white/40 hover:text-white border border-white/5 rounded-xl h-8 text-[8px] font-black uppercase tracking-widest"
                                    >
                                        Copy Full Path
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
