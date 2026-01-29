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
    const isImage = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext || "");
    const isVideo = ["mp4", "mov", "mkv", "webm"].includes(ext || "");

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
            return <Folder className="w-14 h-14 text-blue-400 fill-blue-400/10 drop-shadow-lg transition-transform group-hover:scale-105" />;
        }

        if (!mediaError) {
            if (isImage) {
                return (
                    <div className="w-full h-full absolute inset-0 rounded-lg overflow-hidden border border-white/5 bg-black/20">
                        <img
                            src={convertFileSrc(entry.path)}
                            alt={entry.name}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            loading="lazy"
                            onError={() => setMediaError(true)}
                        />
                    </div>
                );
            }
            if (isVideo) {
                return (
                    <div className="w-full h-full absolute inset-0 rounded-lg overflow-hidden border border-white/5 bg-black/20 group-hover:ring-1 ring-primary/50 transition-all">
                        <video
                            ref={videoRef}
                            src={convertFileSrc(entry.path)}
                            className="w-full h-full object-cover"
                            muted
                            loop
                            playsInline
                            onError={() => setMediaError(true)}
                        />
                        {!isHovering && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                <div className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/10">
                                    <Play className="w-3.5 h-3.5 fill-white text-white ml-0.5" />
                                </div>
                            </div>
                        )}
                    </div>
                );
            }
        }

        // Fallback Icons
        if (isImage) return <ImageIcon className="w-10 h-10 text-purple-400/80" />;
        if (isVideo) return <Video className="w-10 h-10 text-red-400/80" />;
        if (["mp3", "wav"].includes(ext || "")) return <Music className="w-10 h-10 text-amber-400/80" />;
        if (["js", "ts", "json", "rs", "py", "md", "txt", "css", "html"].includes(ext || "")) return <FileText className="w-10 h-10 text-emerald-400/80" />;
        return <File className="w-10 h-10 text-slate-400/50" />;
    };

    return (
        <div
            className="group relative flex flex-col items-center gap-3 p-3 rounded-2xl hover:bg-white/5 transition-all duration-300 cursor-pointer border border-transparent hover:border-white/5"
            onClick={() => onClick(entry)}
            onContextMenu={(e) => onContextMenu(e, entry)}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
        >
            <div className={cn(
                "relative flex items-center justify-center transition-all duration-300",
                ((isImage || isVideo) && !mediaError && (!entry.is_dir)) ? "w-full aspect-[4/3]" : "w-16 h-16"
            )}>
                {renderPreview()}

                {/* Queue Toggle Overlay - Only for Folders */}
                {entry.is_dir && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (scanQueue.includes(entry.path)) removeFromQueue(entry.path);
                            else addToQueue(entry.path);
                        }}
                        className={cn(
                            "absolute z-10 -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center shadow-lg border border-black transition-all duration-300 transform scale-0 group-hover:scale-100",
                            scanQueue.includes(entry.path) ? "bg-primary text-primary-foreground scale-100" : "bg-white text-black hover:bg-primary hover:text-white"
                        )}
                    >
                        {scanQueue.includes(entry.path) ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    </button>
                )}
            </div>

            <div className="text-center w-full px-1">
                <p className="text-[10px] font-medium truncate w-full" title={entry.name}>{entry.name}</p>
                {!entry.is_dir && (
                    <p className="text-[9px] text-muted-foreground opacity-60 mt-0.5 font-mono">{formatSize(entry.size)}</p>
                )}
            </div>
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
        <div className="flex-1 flex flex-row h-full overflow-hidden bg-[#0c0c0c] text-white relative">
            <div className="flex-1 flex flex-col h-full overflow-hidden border-r border-white/5">
                {/* Toolbar */}
                <div className="flex items-center gap-2 p-3 border-b border-white/5 bg-white/[0.02]">
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={handleBack} disabled={historyIndex <= 0} className="h-8 w-8 hover:bg-white/10">
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={handleForward} disabled={historyIndex >= history.length - 1} className="h-8 w-8 hover:bg-white/10">
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={handleUp} className="h-8 w-8 hover:bg-white/10">
                            <ArrowUp className="w-4 h-4" />
                        </Button>
                    </div>

                    <div className="flex-1 mx-2 relative">
                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                            <Folder className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                        <Input
                            value={explorerPath}
                            readOnly
                            className="h-8 pl-9 bg-black/20 border-white/10 text-xs font-mono"
                        />
                    </div>

                    <div className="relative w-48">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                            placeholder="Filter..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-8 pl-8 bg-black/20 border-white/10 text-xs"
                        />
                    </div>

                    <div className="flex items-center bg-black/20 rounded-lg p-0.5 border border-white/5">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setViewMode('grid')}
                            className={cn("h-7 w-7 rounded-md", viewMode === 'grid' && "bg-white/10 shadow-sm")}
                        >
                            <LayoutGrid className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setViewMode('list')}
                            className={cn("h-7 w-7 rounded-md", viewMode === 'list' && "bg-white/10 shadow-sm")}
                        >
                            <ListIcon className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                </div>

                {/* Content */}
                <ScrollArea className="flex-1" type="always">
                    <div className="p-4" onContextMenu={(e) => e.preventDefault()}>
                        {isLoading ? (
                            <div className="flex justify-center py-20">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            </div>
                        ) : filteredEntries.length === 0 ? (
                            <div className="text-center py-20 text-muted-foreground/50">
                                <p>Empty folder</p>
                            </div>
                        ) : viewMode === 'grid' ? (
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4">
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
                            <div className="space-y-1">
                                {filteredEntries.map((entry) => (
                                    <div
                                        key={entry.path}
                                        className="group flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer border border-transparent hover:border-white/5"
                                        onClick={() => handleEntryClick(entry)}
                                        onContextMenu={(e) => handleContextMenu(e, entry)}
                                    >
                                        {getListIcon(entry)}
                                        <span className="text-xs flex-1 truncate">{entry.name}</span>
                                        {!entry.is_dir && <span className="text-[10px] text-muted-foreground w-16 text-right">{formatSize(entry.size)}</span>}

                                        {entry.is_dir && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (scanQueue.includes(entry.path)) removeFromQueue(entry.path);
                                                    else addToQueue(entry.path);
                                                }}
                                                className={cn(
                                                    "w-6 h-6 rounded flex items-center justify-center transition-opacity opacity-0 group-hover:opacity-100",
                                                    scanQueue.includes(entry.path) ? "opacity-100 text-primary" : "text-muted-foreground hover:text-primary"
                                                )}
                                            >
                                                {scanQueue.includes(entry.path) ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </div>

            {/* RIGHT COLUMN: PREVIEW PANEL */}
            {previewFile && (
                <div className="w-[420px] flex flex-col h-full bg-[#0c0c0c] border-l border-white/5 overflow-hidden relative animate-in slide-in-from-right duration-300">
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Preview Content */}
                        <div className="flex-1 flex flex-col bg-black/95 relative overflow-hidden group/media">
                            <div className="absolute top-4 right-4 z-20">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setPreviewFile(null)}
                                    className="rounded-xl bg-white/10 text-white hover:bg-white/20 shadow-lg border border-white/10 hover:scale-105 transition-all"
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
                                        onError={() => setPreviewError(true)}
                                    />
                                )}
                            </div>

                            <div className="p-6 pb-8 bg-gradient-to-t from-black to-transparent flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                    {isVideo(previewFile.path) ? <Video className="w-4 h-4 text-primary" /> : <ImageIcon className="w-4 h-4 text-primary" />}
                                    <span className="text-sm font-black text-white truncate tracking-tight">{previewFile.name}</span>
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
                                            Reveal
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => handleDelete(previewFile)}
                                            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl h-9 w-9 p-0"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => navigator.clipboard.writeText(previewFile.path)}
                                        className="w-full bg-white/5 hover:bg-white/10 text-white/40 hover:text-white border border-white/5 rounded-xl h-8 text-[8px] font-black uppercase tracking-widest"
                                    >
                                        Copy Path
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Context Menu Portal/Overlay */}
            {contextMenu && (
                <div
                    className="fixed z-50 min-w-[160px] bg-[#0c0c0c] border border-white/10 rounded-xl shadow-2xl p-1 animate-in fade-in zoom-in-95 duration-100"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="px-2 py-1.5 text-[10px] font-black text-muted-foreground uppercase tracking-wider border-b border-white/5 mb-1 truncate max-w-[200px]">
                        {contextMenu.entry.name}
                    </div>
                    <button
                        onClick={() => {
                            invoke("reveal_in_finder", { path: contextMenu.entry.path });
                            setContextMenu(null);
                        }}
                        className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 text-xs text-white transition-colors"
                    >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Reveal in Finder
                    </button>
                    <button
                        onClick={() => {
                            navigator.clipboard.writeText(contextMenu.entry.path);
                            setContextMenu(null);
                        }}
                        className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 text-xs text-white transition-colors"
                    >
                        <FileText className="w-3.5 h-3.5" />
                        Copy Path
                    </button>
                    <div className="h-px bg-white/5 my-1" />
                    <button
                        onClick={() => handleDelete(contextMenu.entry)}
                        className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-red-500/10 text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                    </button>
                </div>
            )}
        </div>
    );
}
