import { useState, useEffect, useRef } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { useStore } from "@/store/useStore";
import {
    Folder,
    File,
    ChevronLeft,
    ChevronRight,
    ArrowUp,
    Search,
    Plus,
    Minus,
    Loader2,
    FileText,
    Image as ImageIcon,
    Video,
    Music,
    LayoutGrid,
    List as ListIcon,
    Play,
    X,
    ExternalLink,
    VideoOff,
    ImageOff,
    Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn, formatSize } from "@/lib/utils";
import { toast } from "sonner";

interface FileEntry {
    name: string;
    path: string;
    is_dir: boolean;
    size: number;
    created: number;
    modified: number;
}

// Context Menu Setup
interface ContextMenuState {
    x: number;
    y: number;
    entry: FileEntry;
}

const FileGridItem = ({
    entry,
    onClick,
    onContextMenu,
    scanQueue,
    addToQueue,
    removeFromQueue
}: {
    entry: FileEntry;
    onClick: (entry: FileEntry) => void;
    onContextMenu: (e: React.MouseEvent, entry: FileEntry) => void;
    scanQueue: string[];
    addToQueue: (path: string) => void;
    removeFromQueue: (path: string) => void;
}) => {
    const [mediaError, setMediaError] = useState(false);
    const [isHovering, setIsHovering] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const ext = entry.name.split('.').pop()?.toLowerCase();
    const isImage = ["jpg", "jpeg", "png", "webp", "gif", "svg"].includes(ext || "");
    const isVideo = ["mp4", "mov", "mkv", "webm", "avi"].includes(ext || "");
    const [duration, setDuration] = useState<string | null>(null);

    const formatDuration = (seconds: number) => {
        if (!seconds || isNaN(seconds)) return null;
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        if (isVideo && videoRef.current) {
            if (isHovering) {
                videoRef.current.play().catch(() => { });
            } else {
                videoRef.current.pause();
                videoRef.current.currentTime = 0;
            }
        }
    }, [isHovering, isVideo]);

    const renderPreview = () => {
        if (entry.is_dir) {
            return <Folder className="w-20 h-20 text-blue-400 fill-blue-400/10 drop-shadow-[0_10px_20px_rgba(59,130,246,0.3)] transition-transform group-hover:scale-110" />;
        }

        if (!mediaError) {
            if (isImage) {
                return (
                    <div className="w-full h-full absolute inset-0 bg-black/20">
                        <img
                            src={convertFileSrc(entry.path)}
                            alt={entry.name}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                            loading="lazy"
                            onError={() => setMediaError(true)}
                        />
                    </div>
                );
            }
            if (isVideo) {
                return (
                    <div className="w-full h-full absolute inset-0 bg-black/20 group-hover:ring-1 ring-primary/50 transition-all">
                        <video
                            ref={videoRef}
                            src={convertFileSrc(entry.path)}
                            className="w-full h-full object-cover"
                            muted
                            loop
                            playsInline
                            preload="metadata"
                            onLoadedMetadata={(e) => setDuration(formatDuration(e.currentTarget.duration))}
                            onError={() => setMediaError(true)}
                        />
                        {!isHovering && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center border border-white/10">
                                    <Play className="w-5 h-5 fill-white text-white ml-0.5" />
                                </div>
                            </div>
                        )}
                    </div>
                );
            }
        }

        // Fallback Icons
        if (isImage) return <ImageIcon className="w-16 h-16 text-purple-400/80 drop-shadow-lg group-hover:scale-110 transition-transform" />;
        if (isVideo) return <Video className="w-16 h-16 text-red-400/80 drop-shadow-lg group-hover:scale-110 transition-transform" />;
        if (["mp3", "wav"].includes(ext || "")) return <Music className="w-16 h-16 text-amber-400/80 drop-shadow-lg group-hover:scale-110 transition-transform" />;
        return <FileText className="w-16 h-16 text-primary/60 drop-shadow-lg group-hover:scale-110 transition-transform" />;
    };

    return (
        <div
            className={cn(
                "group relative flex flex-col items-center rounded-[32px] transition-all duration-500 cursor-pointer border border-white/[0.03] hover:border-white/20 hover:shadow-[0_25px_50px_rgba(0,0,0,0.5),0_0_30px_rgba(255,255,255,0.03)] animate-scale-in overflow-hidden active:scale-95",
                entry.is_dir
                    ? "bg-white/[0.04] hover:bg-white/[0.08] gap-4 py-8 min-h-[180px] p-3"
                    : "bg-black/60 hover:bg-white/[0.05] h-[280px] p-0"
            )}
            onClick={() => onClick(entry)}
            onContextMenu={(e) => onContextMenu(e, entry)}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
        >
            <div className={cn(
                "relative flex items-center justify-center transition-all duration-700 ease-out w-full h-full overflow-hidden",
                entry.is_dir ? "max-h-28 group-hover:scale-[1.1]" : "group-hover:scale-[1.05]"
            )}>
                {renderPreview()}

                {/* Queue Toggle Overlay */}
                {entry.is_dir && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (scanQueue.includes(entry.path)) removeFromQueue(entry.path);
                            else addToQueue(entry.path);
                        }}
                        className={cn(
                            "absolute z-10 top-2 right-2 w-9 h-9 rounded-full flex items-center justify-center shadow-2xl border border-white/25 backdrop-blur-2xl transition-all duration-500 transform scale-0 group-hover:scale-100 rotate-12 group-hover:rotate-0",
                            scanQueue.includes(entry.path) ? "bg-primary text-black scale-100" : "bg-black/70 text-white hover:bg-primary hover:text-black"
                        )}
                    >
                        {scanQueue.includes(entry.path) ? <Minus className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                    </button>
                )}

                {/* Comprehensive Floating Metadata Badge */}
                {!entry.is_dir && (
                    <div className="absolute top-3 right-3 left-3 z-20 pointer-events-none">
                        <div className="flex bg-transparent items-center justify-between gap-3 px-1 transition-all duration-500">
                            <p className="text-[10px] font-black tracking-tight truncate text-white uppercase italic flex-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" title={entry.name}>
                                {entry.name}
                            </p>
                            <div className="flex items-center gap-2 shrink-0 border-l border-white/20 pl-3">
                                <span className="text-[8px] font-black text-primary leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                                    {isVideo ? 'VIDEO' : isImage ? 'IMAGE' : ext?.toUpperCase() || 'FILE'}
                                </span>
                                <div className="w-px h-2 bg-white/20" />
                                <span className="text-[9px] font-black text-white/80 leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                                    {formatSize(entry.size)}
                                </span>
                                {isVideo && duration && (
                                    <>
                                        <div className="w-px h-2 bg-white/20" />
                                        <span className="text-[8px] font-black text-primary leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] opacity-80">
                                            {duration}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {entry.is_dir && (
                <div className="text-center w-full px-2 z-10 mt-2 pointer-events-none">
                    <p className="text-[12px] font-black tracking-tight truncate w-full group-hover:text-primary transition-colors duration-300 uppercase italic opacity-85 group-hover:opacity-100" title={entry.name}>{entry.name}</p>
                    <p className="text-[9px] text-primary/40 font-black uppercase tracking-widest mt-1">Directory Segment</p>
                </div>
            )}

            {/* Inner Glow/Rim Light Effect */}
            <div className="absolute inset-0 rounded-[32px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none bg-gradient-to-br from-white/[0.07] to-transparent ring-1 ring-inset ring-white/[0.07]" />
        </div>
    );
};

export function FileExplorerView() {
    const { explorerPath, setExplorerPath, scanQueue, addToQueue, removeFromQueue } = useStore();
    const [entries, setEntries] = useState<FileEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [history, setHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // Preview State
    const [previewFile, setPreviewFile] = useState<FileEntry | null>(null);
    const [previewError, setPreviewError] = useState(false);

    // Context Menu State
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

    useEffect(() => {
        if (explorerPath) {
            loadDirectory(explorerPath);
            setPreviewFile(null); // Clear preview on nav
            setContextMenu(null); // Clear menu
        }
    }, [explorerPath]);

    // Close context menu on click elsewhere
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        document.addEventListener("click", handleClick);
        return () => document.removeEventListener("click", handleClick);
    }, []);

    const loadDirectory = async (path: string) => {
        setIsLoading(true);
        try {
            // Optimistic error handling (if path deleted)
            const data = await invoke<FileEntry[]>("read_directory", { path });
            setEntries(data);
        } catch (error) {
            console.error("Failed to read directory:", error);
            // If current dir invalid, go up
            handleUp();
        } finally {
            setIsLoading(false);
        }
    };

    const handleEntryClick = async (entry: FileEntry) => {
        if (entry.is_dir) {
            if (entry.path === explorerPath) return;

            const newHistory = history.slice(0, historyIndex + 1);
            newHistory.push(entry.path);
            setHistory(newHistory);
            setHistoryIndex(newHistory.length - 1);

            setExplorerPath(entry.path);
        } else {
            try {
                const folderPath = entry.path.split('/').slice(0, -1).join('/');
                await invoke("allow_folder_access", { path: folderPath });
            } catch (err) {
                console.error("Security handshake failed:", err);
            }
            setPreviewError(false);
            setPreviewFile(entry);
        }
    };

    const handleContextMenu = (e: React.MouseEvent, entry: FileEntry) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            entry
        });
    };

    const handleDelete = async (entry: FileEntry) => {
        setContextMenu(null);
        const toastId = toast.loading(`Deleting ${entry.name}...`);

        try {
            const report = await invoke<{ success_count: number; fail_count: number; errors: string[] }>("delete_selections", {
                paths: [entry.path]
            });

            if (report.success_count > 0) {
                toast.success("Item deleted", { id: toastId });
                // If we deleted the currently previewed file, close preview
                if (previewFile?.path === entry.path) {
                    setPreviewFile(null);
                }
                // Refresh directory
                if (explorerPath) loadDirectory(explorerPath);
            } else {
                // Show specific error if available
                const msg = report.errors && report.errors.length > 0 ? report.errors[0] : "Failed to delete item";
                toast.error(msg, { id: toastId, duration: 4000 });
            }
        } catch (error) {
            console.error(error);
            toast.error("Error during deletion", { id: toastId });
        }
    };

    const handleBack = () => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            setExplorerPath(history[newIndex]);
        }
    };

    const handleForward = () => {
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            setExplorerPath(history[newIndex]);
        }
    };

    const handleUp = () => {
        if (!explorerPath) return;
        const parts = explorerPath.split(/[/\\]/);
        parts.pop();
        const parentPath = parts.join("/");
        if (parts.length > 0) {
            const target = parentPath || "/";
            if (target === explorerPath) return;
            const newHistory = history.slice(0, historyIndex + 1);
            newHistory.push(target);
            setHistory(newHistory);
            setHistoryIndex(newHistory.length - 1);
            setExplorerPath(target);
        }
    };

    useEffect(() => {
        if (explorerPath && history.length === 0) {
            setHistory([explorerPath]);
            setHistoryIndex(0);
        }
    }, [explorerPath]);

    const filteredEntries = entries.filter(e =>
        e.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const isVideo = (path: string) => {
        const ext = path.split('.').pop()?.toLowerCase();
        return ["mp4", "mov", "mkv", "webm"].includes(ext || "");
    };

    const safeConvertFileSrc = (path: string) => {
        if (!path) return "";
        return convertFileSrc(path);
    };

    const getListIcon = (entry: FileEntry) => {
        if (entry.is_dir) return <Folder className="w-5 h-5 text-blue-400" />;
        const ext = entry.name.split('.').pop()?.toLowerCase();
        if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext || "")) return <ImageIcon className="w-5 h-5 text-purple-400" />;
        if (["mp4", "mov", "mkv"].includes(ext || "")) return <Video className="w-5 h-5 text-red-400" />;
        return <File className="w-5 h-5 text-slate-400" />;
    };

    if (!explorerPath) {
        return (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                    <Folder className="w-24 h-24 mx-auto mb-6 opacity-10" />
                    <p className="text-sm font-medium opacity-60">Select a folder from the sidebar to browse</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-row h-full overflow-hidden bg-background/20 backdrop-blur-md text-white relative">
            <div className="flex-1 flex flex-col h-full overflow-hidden border-r border-white/5">
                {/* Toolbar */}
                <div className="flex items-center gap-3 p-4 border-b border-white/5 bg-black/30 backdrop-blur-xl">
                    <div className="flex items-center gap-1.5 p-1 bg-white/5 rounded-xl border border-white/5">
                        <Button variant="ghost" size="icon" onClick={handleBack} disabled={historyIndex <= 0} className="h-8 w-8 hover:bg-white/10 rounded-lg disabled:opacity-20 text-white/70">
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={handleForward} disabled={historyIndex >= history.length - 1} className="h-8 w-8 hover:bg-white/10 rounded-lg disabled:opacity-20 text-white/70">
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={handleUp} className="h-8 w-8 hover:bg-white/10 rounded-lg text-white/70">
                            <ArrowUp className="w-4 h-4" />
                        </Button>
                    </div>

                    <div className="flex-1 mx-2 relative group">
                        <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-primary/50 group-focus-within:text-primary transition-colors">
                            <Folder className="w-4 h-4" />
                        </div>
                        <Input
                            value={explorerPath}
                            readOnly
                            className="h-10 pl-10 pr-4 bg-black/40 border-white/10 text-xs font-mono rounded-xl focus:border-primary/50 transition-all text-white/60"
                        />
                    </div>

                    <div className="relative w-64 group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-primary transition-colors" />
                        <Input
                            placeholder="Search in folder..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-10 pl-10 bg-black/40 border-white/10 text-xs rounded-xl focus:border-primary/50 transition-all"
                        />
                    </div>

                    <div className="flex items-center bg-black/40 rounded-xl p-1 border border-white/5">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setViewMode('grid')}
                            className={cn("h-8 w-8 rounded-lg transition-all", viewMode === 'grid' ? "bg-white/15 text-primary shadow-lg shadow-primary/10" : "text-white/40 hover:text-white/60")}
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setViewMode('list')}
                            className={cn("h-8 w-8 rounded-lg transition-all", viewMode === 'list' ? "bg-white/15 text-primary shadow-lg shadow-primary/10" : "text-white/40 hover:text-white/60")}
                        >
                            <ListIcon className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                {/* Vertical Scroll Container */}
                <div className="flex-1 relative overflow-hidden bg-gradient-to-br from-white/[0.03] to-transparent">
                    <ScrollArea className="h-full w-full" type="always">
                        <div className="p-8" onContextMenu={(e) => e.preventDefault()}>
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center py-32 gap-4">
                                    <Loader2 className="w-10 h-10 animate-spin text-primary opacity-50" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/40 italic">Syncing Matrix...</span>
                                </div>
                            ) : filteredEntries.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-32 text-white/10 gap-4 animate-slide-up">
                                    <div className="w-24 h-24 rounded-full bg-white/[0.02] flex items-center justify-center border border-white/5">
                                        <FolderOpen className="w-10 h-10 opacity-20" />
                                    </div>
                                    <p className="text-[11px] font-black uppercase tracking-[0.2em] italic">Zero Segments Found</p>
                                </div>
                            ) : viewMode === 'grid' ? (
                                <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-10">
                                    {filteredEntries.map((entry) => (
                                        <FileGridItem
                                            key={entry.path}
                                            entry={entry}
                                            onClick={handleEntryClick}
                                            onContextMenu={handleContextMenu}
                                            scanQueue={scanQueue}
                                            addToQueue={addToQueue}
                                            removeFromQueue={removeFromQueue}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-1.5">
                                    {filteredEntries.map((entry) => (
                                        <div
                                            key={entry.path}
                                            className="group flex items-center gap-4 p-3 rounded-xl hover:bg-white/[0.05] transition-all cursor-pointer border border-transparent hover:border-white/10"
                                            onClick={() => handleEntryClick(entry)}
                                            onContextMenu={(e) => handleContextMenu(e, entry)}
                                        >
                                            <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center border border-white/5 group-hover:border-primary/20 group-hover:bg-primary/5 transition-all">
                                                {getListIcon(entry)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold truncate group-hover:text-primary transition-colors">{entry.name}</p>
                                                <p className="text-[10px] text-white/20 font-mono tracking-tighter truncate">{entry.path}</p>
                                            </div>
                                            {!entry.is_dir && (
                                                <div className="px-3 py-1 rounded-md bg-white/5 border border-white/5">
                                                    <span className="text-[10px] text-white/40 font-black tabular-nums">{formatSize(entry.size)}</span>
                                                </div>
                                            )}

                                            {entry.is_dir && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (scanQueue.includes(entry.path)) removeFromQueue(entry.path);
                                                        else addToQueue(entry.path);
                                                    }}
                                                    className={cn(
                                                        "w-8 h-8 rounded-lg flex items-center justify-center transition-all bg-white/5 border border-white/5",
                                                        scanQueue.includes(entry.path) ? "bg-primary text-black opacity-100" : "text-white/20 opacity-0 group-hover:opacity-100 hover:text-primary hover:border-primary/20"
                                                    )}
                                                >
                                                    {scanQueue.includes(entry.path) ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </div>
            </div>

            {/* Preview Panel */}
            {previewFile && (
                <div className="w-[420px] flex flex-col h-full bg-black/40 backdrop-blur-2xl border-l border-white/10 overflow-hidden relative animate-in slide-in-from-right duration-500">
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Preview Content */}
                        <div className="flex-1 flex flex-col bg-black/60 relative overflow-hidden group/media">
                            <div className="absolute top-6 right-6 z-20">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setPreviewFile(null)}
                                    className="rounded-2xl bg-black/50 text-white hover:bg-primary hover:text-black shadow-2xl border border-white/10 hover:scale-110 transition-all duration-300 h-10 w-10"
                                >
                                    <X className="w-5 h-5" />
                                </Button>
                            </div>

                            <div className="flex-1 flex items-center justify-center bg-slate-950/20 backdrop-blur-sm p-4">
                                {previewError ? (
                                    <div className="flex flex-col items-center gap-6 text-white/20 animate-slide-up">
                                        <div className="w-20 h-20 rounded-full border-2 border-dashed border-white/10 flex items-center justify-center">
                                            {isVideo(previewFile.path) ? <VideoOff className="w-8 h-8" /> : <ImageOff className="w-8 h-8" />}
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-[0.3em] italic">Render Protocol Failed</span>
                                    </div>
                                ) : isVideo(previewFile.path) ? (
                                    <video
                                        src={safeConvertFileSrc(previewFile.path)}
                                        controls
                                        muted
                                        className="max-w-full max-h-full rounded-2xl shadow-2xl border border-white/5"
                                        onError={() => setPreviewError(true)}
                                    />
                                ) : (
                                    <img
                                        src={safeConvertFileSrc(previewFile.path)}
                                        className="max-w-full max-h-full object-contain p-2 rounded-2xl drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
                                        alt="Preview"
                                        onError={() => setPreviewError(true)}
                                    />
                                )}
                            </div>

                            <div className="p-10 pb-12 bg-gradient-to-t from-black via-black/80 to-transparent flex flex-col gap-5">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-2xl">
                                        {isVideo(previewFile.path) ? <Video className="w-6 h-6 text-primary" /> : <ImageIcon className="w-6 h-6 text-primary" />}
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-xl font-black text-white truncate tracking-tighter uppercase leading-tight italic">{previewFile.name}</span>
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(74,222,220,1)]" />
                                            <span className="text-[10px] text-primary/60 font-black tracking-[0.2em] uppercase italic">Asset Authenticated</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-3 border-l-2 border-primary/30 pl-6 py-1">
                                    <div className="flex items-center gap-3">
                                        <Badge variant="secondary" className="glass bg-white/5 text-white border-white/10 uppercase font-black tracking-widest text-[9px] h-6 px-3">
                                            {formatSize(previewFile.size)}
                                        </Badge>
                                        <div className="w-1 h-1 rounded-full bg-white/20" />
                                        <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">{new Date(previewFile.modified * 1000).toLocaleDateString()}</span>
                                    </div>
                                    <p className="text-[10px] text-white/30 font-medium break-all leading-relaxed font-mono hover:text-white/60 transition-colors">
                                        {previewFile.path}
                                    </p>
                                </div>

                                <div className="mt-6 flex flex-col gap-3">
                                    <div className="grid grid-cols-2 gap-4">
                                        <Button
                                            variant="secondary"
                                            size="lg"
                                            onClick={() => invoke("reveal_in_finder", { path: previewFile.path })}
                                            className="bg-white/5 hover:bg-white/15 text-white border border-white/10 rounded-[24px] h-14 text-[10px] font-black uppercase tracking-[0.15em] transition-all hover:scale-[1.02] shadow-xl"
                                        >
                                            <ExternalLink className="w-5 h-5 mr-3 text-primary" />
                                            Reveal
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            size="lg"
                                            onClick={() => handleDelete(previewFile)}
                                            className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-[24px] h-14 text-[10px] font-black uppercase tracking-[0.15em] transition-all hover:scale-[1.02] shadow-xl shadow-red-500/5"
                                        >
                                            <Trash2 className="w-5 h-5 mr-3" />
                                            Purge
                                        </Button>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            navigator.clipboard.writeText(previewFile.path);
                                            toast.success("Identity key copied", {
                                                className: "glass-dark border-primary/20"
                                            });
                                        }}
                                        className="w-full bg-white/5 hover:bg-white/10 text-white/30 hover:text-white border border-white/5 rounded-2xl h-11 text-[9px] font-black uppercase tracking-[0.2em] transition-all"
                                    >
                                        Copy Identifier Protocol
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="fixed z-[100] min-w-[200px] glass-dark border border-white/10 rounded-2xl shadow-[0_20px_80px_rgba(0,0,0,1)] p-1.5 animate-in fade-in zoom-in-95 duration-200"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="px-3 py-2 text-[10px] font-black text-white/30 uppercase tracking-[0.15em] border-b border-white/10 mb-1.5 truncate max-w-[240px] italic">
                        {contextMenu.entry.name}
                    </div>
                    <button
                        onClick={() => {
                            invoke("reveal_in_finder", { path: contextMenu.entry.path });
                            setContextMenu(null);
                        }}
                        className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-[11px] font-bold text-white transition-all group"
                    >
                        <ExternalLink className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
                        Reveal in Finder
                    </button>
                    <button
                        onClick={() => {
                            navigator.clipboard.writeText(contextMenu.entry.path);
                            setContextMenu(null);
                            toast.success("Path copied");
                        }}
                        className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-[11px] font-bold text-white transition-all group"
                    >
                        <FileText className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
                        Copy System Path
                    </button>
                    <div className="h-px bg-white/10 my-1.5" />
                    <button
                        onClick={() => {
                            handleDelete(contextMenu.entry);
                            setContextMenu(null);
                        }}
                        className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-500/15 text-[11px] font-bold text-red-400 group transition-all"
                    >
                        <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        Execute Purge
                    </button>
                </div>
            )}
        </div>
    );
}

// Missing Component Definition
const FolderOpen = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.69.9H18a2 2 0 0 1 2 2v2" />
    </svg>
);
