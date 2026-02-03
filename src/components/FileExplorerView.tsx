import { useState, useEffect, useRef, useMemo } from "react";
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
    Trash2,
    Edit2,
    FolderPlus,
    FilePlus,
    SortAsc,
    SortDesc,
    Play,
    X,
    ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, formatSize } from "@/lib/utils";
import { toast } from "sonner";
import { SidebarTrigger } from "@/components/ui/sidebar";

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
    entry?: FileEntry;
    type: 'item' | 'background';
    path: string; // The directory where the menu was opened
}

const EmptyFolderIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.69.9H18a2 2 0 0 1 2 2v2" />
    </svg>
);

const FileGridItem = ({
    entry,
    onClick,
    onContextMenu,
    scanQueue,
    addToQueue,
    removeFromQueue,
    renamingPath,
    onRenameCommit,
    onRenameCancel
}: {
    entry: FileEntry;
    onClick: (entry: FileEntry) => void;
    onContextMenu: (e: React.MouseEvent, entry?: FileEntry, path?: string) => void;
    scanQueue: string[];
    addToQueue: (path: string) => void;
    removeFromQueue: (path: string) => void;
    renamingPath: string | null;
    onRenameCommit: (newName: string) => void;
    onRenameCancel: () => void;
}) => {
    const [mediaError, setMediaError] = useState(false);
    const [isHovering, setIsHovering] = useState(false);
    const [duration, setDuration] = useState<string | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [tempName, setTempName] = useState(entry.name);
    const videoRef = useRef<HTMLVideoElement>(null);
    const itemRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const isRenaming = renamingPath === entry.path;

    useEffect(() => {
        if (isRenaming && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isRenaming]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            onRenameCommit(tempName);
        } else if (e.key === 'Escape') {
            onRenameCancel();
        }
    };

    const ext = entry.name.split('.').pop()?.toLowerCase();
    const isImage = ["jpg", "jpeg", "png", "webp", "gif", "svg"].includes(ext || "");
    const isVideo = ["mp4", "mov", "mkv", "webm", "avi"].includes(ext || "");

    const formatDuration = (seconds: number) => {
        if (!seconds || isNaN(seconds)) return null;
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setIsVisible(true);
                observer.disconnect();
            }
        }, { rootMargin: '200px' });

        if (itemRef.current) {
            observer.observe(itemRef.current);
        }

        return () => observer.disconnect();
    }, []);

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
        if (!isVisible && !entry.is_dir) {
            return <div className="w-full h-full bg-white/[0.02] animate-pulse" />;
        }

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
                            preload="none"
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
            ref={itemRef}
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
                <div className="text-center w-full px-2 z-10 mt-2">
                    {isRenaming ? (
                        <input
                            ref={inputRef}
                            value={tempName}
                            onChange={(e) => setTempName(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onBlur={() => onRenameCommit(tempName)}
                            className="w-full bg-black/60 border border-primary/50 rounded-lg px-2 py-1 text-[12px] font-black text-white focus:outline-none uppercase italic"
                        />
                    ) : (
                        <>
                            <p className="text-[12px] font-black tracking-tight truncate w-full group-hover:text-primary transition-colors duration-300 uppercase italic opacity-85 group-hover:opacity-100" title={entry.name}>{entry.name}</p>
                            <div className="flex items-center justify-center gap-2 mt-1">
                                <p className="text-[9px] text-primary/40 font-black uppercase tracking-widest">Directory Segment</p>
                                {entry.size > 0 && (
                                    <>
                                        <div className="w-px h-2 bg-white/10" />
                                        <p className="text-[9px] text-white/30 font-black tabular-nums">{formatSize(entry.size)}</p>
                                    </>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};


const ExplorerSplit = ({
    tab,
    onFileClick,
    onContextMenu,
    onClose,
    renamingItem,
    setRenamingItem,
    onRenameCommit,
    newName,
    setNewName,
    refreshTrigger
}: {
    tab: any;
    onFileClick: (entry: FileEntry) => void;
    onContextMenu: (e: React.MouseEvent, entry?: FileEntry, path?: string) => void;
    onClose: () => void;
    renamingItem: { path: string, oldName: string } | null;
    setRenamingItem: (item: { path: string, oldName: string } | null) => void;
    onRenameCommit: () => void;
    newName: string;
    setNewName: (name: string) => void;
    refreshTrigger: number;
}) => {
    const { scanQueue, addToQueue, removeFromQueue, updateExplorerTab } = useStore();
    const [entries, setEntries] = useState<FileEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        loadDirectory(tab.path);
    }, [tab.path, renamingItem, refreshTrigger]);

    const loadDirectory = async (path: string) => {
        setIsLoading(true);
        try {
            const data = await invoke<FileEntry[]>("read_directory", { path });
            setEntries(data);
        } catch (error) {
            console.error("Failed to read directory:", error);
            handleUp();
        } finally {
            setIsLoading(false);
        }
    };

    const handleBack = () => {
        if (tab.historyIndex > 0) {
            const newIndex = tab.historyIndex - 1;
            const newPath = tab.history[newIndex];
            updateExplorerTab(tab.id, {
                path: newPath,
                historyIndex: newIndex,
                name: newPath.split(/[/\\]/).pop() || tab.name
            });
        }
    };

    const handleForward = () => {
        if (tab.historyIndex < tab.history.length - 1) {
            const newIndex = tab.historyIndex + 1;
            const newPath = tab.history[newIndex];
            updateExplorerTab(tab.id, {
                path: newPath,
                historyIndex: newIndex,
                name: newPath.split(/[/\\]/).pop() || tab.name
            });
        }
    };

    const handleUp = () => {
        const parts = tab.path.split(/[/\\]/);
        parts.pop();
        const parentPath = parts.join("/");
        if (parts.length > 0) {
            const target = parentPath || "/";
            if (target === tab.path) return;

            const newHistory = tab.history.slice(0, tab.historyIndex + 1);
            newHistory.push(target);

            updateExplorerTab(tab.id, {
                path: target,
                name: target.split(/[/\\]/).pop() || "Root",
                history: newHistory,
                historyIndex: newHistory.length - 1
            });
        }
    };

    const handleEntryClick = (entry: FileEntry) => {
        if (entry.is_dir) {
            const newHistory = tab.history.slice(0, tab.historyIndex + 1);
            newHistory.push(entry.path);

            updateExplorerTab(tab.id, {
                path: entry.path,
                name: entry.name,
                history: newHistory,
                historyIndex: newHistory.length - 1
            });
        } else {
            onFileClick(entry);
        }
    };

    const sortedEntries = useMemo(() => {
        return [...entries]
            .filter(e => e.name.toLowerCase().includes((tab.searchQuery || "").toLowerCase()))
            .sort((a, b) => {
                const order = (tab.sortOrder || 'asc') === 'asc' ? 1 : -1;

                if (tab.sortBy === 'modified') {
                    return (a.modified - b.modified) * order;
                } else if (tab.sortBy === 'kind') {
                    const extA = a.name.split('.').pop() || "";
                    const extB = b.name.split('.').pop() || "";
                    if (extA !== extB) return extA.localeCompare(extB) * order;
                    return a.name.toLowerCase().localeCompare(b.name.toLowerCase()) * order;
                } else {
                    // Unified Name Sort: Ignores is_dir priority as requested
                    return a.name.toLowerCase().localeCompare(b.name.toLowerCase()) * order;
                }
            });
    }, [entries, tab.searchQuery, tab.sortBy, tab.sortOrder]);

    const getListIcon = (entry: FileEntry) => {
        if (entry.is_dir) return <Folder className="w-5 h-5 text-blue-400" />;
        const ext = entry.name.split('.').pop()?.toLowerCase();
        if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext || "")) return <ImageIcon className="w-5 h-5 text-purple-400" />;
        if (["mp4", "mov", "mkv"].includes(ext || "")) return <Video className="w-5 h-5 text-red-400" />;
        return <File className="w-5 h-5 text-slate-400" />;
    };

    return (
        <div className="flex-1 flex flex-col min-w-[320px] border-r border-white/5 bg-black/20 overflow-hidden relative group/split">
            {/* Split Header */}
            <div className="flex h-11 shrink-0 items-center justify-between px-4 bg-white/[0.03] border-b border-white/5">
                <div className="flex items-center gap-2 overflow-hidden">
                    <Folder className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[11px] font-black uppercase tracking-tight truncate italic text-primary">{tab.name}</span>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 rounded-md hover:bg-white/10 text-white/40 hover:text-white transition-all ml-2"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col gap-2 p-3 border-b border-white/5 bg-black/40">
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 p-1 bg-white/5 rounded-lg border border-white/5">
                        <Button variant="ghost" size="icon" onClick={handleBack} disabled={tab.historyIndex <= 0} className="h-7 w-7 rounded-md">
                            <ChevronLeft className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={handleForward} disabled={tab.historyIndex >= tab.history.length - 1} className="h-7 w-7 rounded-md">
                            <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={handleUp} className="h-7 w-7 rounded-md">
                            <ArrowUp className="w-3.5 h-3.5" />
                        </Button>
                    </div>

                    <div className="flex items-center bg-black/40 rounded-lg p-0.5 border border-white/5">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => updateExplorerTab(tab.id, {
                                sortOrder: tab.sortOrder === 'asc' ? 'desc' : 'asc'
                            })}
                            className="h-7 w-7 rounded-md text-white/40 hover:text-primary transition-all"
                            title={`Sort ${tab.sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
                        >
                            {tab.sortOrder === 'asc' ? <SortAsc className="w-3.5 h-3.5" /> : <SortDesc className="w-3.5 h-3.5" />}
                        </Button>
                        <div className="w-px h-3 bg-white/10 mx-0.5" />
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                                const modes: ('name' | 'size' | 'modified')[] = ['name', 'size', 'modified'];
                                const next = modes[(modes.indexOf(tab.sortBy || 'name') + 1) % modes.length];
                                updateExplorerTab(tab.id, { sortBy: next });
                            }}
                            className="h-7 px-2 rounded-md text-[9px] font-black uppercase tracking-widest text-white/40 hover:text-primary transition-all min-w-[50px]"
                        >
                            {tab.sortBy || 'name'}
                        </Button>
                    </div>
                    <div className="flex-1 relative group">
                        <div className="absolute inset-y-0 left-2.5 flex items-center pointer-events-none text-white/20 group-focus-within:text-primary transition-colors">
                            <Search className="w-3 h-3" />
                        </div>
                        <Input
                            placeholder="Search..."
                            value={tab.searchQuery || ""}
                            onChange={(e) => updateExplorerTab(tab.id, { searchQuery: e.target.value })}
                            className="h-8 pl-8 bg-black/40 border-white/10 text-[10px] rounded-lg focus:border-primary/50"
                        />
                    </div>
                    <div className="flex items-center bg-black/40 rounded-lg p-0.5 border border-white/5">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => updateExplorerTab(tab.id, { viewMode: 'grid' })}
                            className={cn("h-7 w-7 rounded-md", (tab.viewMode || 'grid') === 'grid' ? "bg-white/10 text-primary" : "text-white/40")}
                        >
                            <LayoutGrid className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => updateExplorerTab(tab.id, { viewMode: 'list' })}
                            className={cn("h-7 w-7 rounded-md", tab.viewMode === 'list' ? "bg-white/10 text-primary" : "text-white/40")}
                        >
                            <ListIcon className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                </div>
                <div className="px-2">
                    <p className="text-[9px] font-mono opacity-30 truncate">{tab.path}</p>
                </div>
            </div>

            {/* Content Aria */}
            <div
                className="flex-1 relative overflow-hidden"
                onContextMenu={(e) => onContextMenu(e, undefined, tab.path)}
            >
                <ScrollArea className="h-full w-full" type="always">
                    <div className="p-4 min-h-full">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3">
                                <Loader2 className="w-6 h-6 animate-spin text-primary opacity-50" />
                                <span className="text-[9px] font-black uppercase tracking-widest text-primary/40 italic">Syncing...</span>
                            </div>
                        ) : sortedEntries.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-white/10 gap-3">
                                <EmptyFolderIcon className="w-8 h-8 opacity-20" />
                                <p className="text-[10px] font-black uppercase tracking-widest italic">Empty</p>
                            </div>
                        ) : tab.viewMode === 'grid' ? (
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-6">
                                {sortedEntries.map((entry) => (
                                    <FileGridItem
                                        key={entry.path}
                                        entry={entry}
                                        onClick={handleEntryClick}
                                        onContextMenu={onContextMenu}
                                        scanQueue={scanQueue}
                                        addToQueue={addToQueue}
                                        removeFromQueue={removeFromQueue}
                                        renamingPath={renamingItem?.path || null}
                                        onRenameCommit={(val) => {
                                            setNewName(val);
                                            // Trigger commit in parent context
                                            setTimeout(onRenameCommit, 0);
                                        }}
                                        onRenameCancel={() => setRenamingItem(null)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {sortedEntries.map((entry) => (
                                    <div
                                        key={entry.path}
                                        className="group/item flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.05] transition-all cursor-pointer border border-transparent hover:border-white/10"
                                        onClick={() => handleEntryClick(entry)}
                                        onContextMenu={(e) => onContextMenu(e, entry)}
                                    >
                                        <div className="w-8 h-8 rounded-md bg-white/5 flex items-center justify-center border border-white/5 group-hover/item:border-primary/20 transition-all">
                                            {getListIcon(entry)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            {renamingItem?.path === entry.path ? (
                                                <input
                                                    autoFocus
                                                    value={newName}
                                                    onChange={(e) => setNewName(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') onRenameCommit();
                                                        else if (e.key === 'Escape') setRenamingItem(null);
                                                    }}
                                                    onBlur={onRenameCommit}
                                                    className="w-full bg-black/60 border border-primary/50 rounded px-2 py-0.5 text-[11px] font-bold text-white focus:outline-none"
                                                />
                                            ) : (
                                                <>
                                                    <p className="text-[11px] font-bold truncate group-hover/item:text-primary transition-colors">{entry.name}</p>
                                                    <p className="text-[9px] text-white/20 font-mono tracking-tighter truncate">{entry.path}</p>
                                                </>
                                            )}
                                        </div>
                                        {!entry.is_dir && (
                                            <div className="px-2 py-0.5 rounded bg-white/5 border border-white/5">
                                                <span className="text-[9px] text-white/40 font-black tabular-nums">{formatSize(entry.size)}</span>
                                            </div>
                                        )}
                                        {entry.is_dir && entry.size > 0 && (
                                            <div className="px-2 py-0.5 rounded bg-white/5 border border-white/5">
                                                <span className="text-[9px] text-white/40 font-black tabular-nums">{formatSize(entry.size)}</span>
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
                                                    "w-7 h-7 rounded-md flex items-center justify-center transition-all bg-white/5 border border-white/5",
                                                    scanQueue.includes(entry.path) ? "bg-primary text-black opacity-100" : "text-white/20 opacity-0 group-hover/item:opacity-100"
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
        </div>
    );
};

export function FileExplorerView() {
    const {
        explorerTabs,
        activeTabId,
        setActiveTabId,
        closeExplorerTab,
        updateExplorerTab,
        triggerRefresh,
        refreshTrigger
    } = useStore();

    // Container ref for absolute positioning
    const containerRef = useRef<HTMLDivElement>(null);

    // Preview State (shared across splits)
    const [previewFile, setPreviewFile] = useState<FileEntry | null>(null);
    const [previewError, setPreviewError] = useState(false);
    const [previewWidth, setPreviewWidth] = useState(420);
    const [isResizing, setIsResizing] = useState(false);

    // Context Menu State (shared)
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

    useEffect(() => {
        if (!isResizing) return;

        const handleMouseMove = (e: MouseEvent) => {
            const newWidth = window.innerWidth - e.clientX;
            if (newWidth >= 300 && newWidth <= 800) {
                setPreviewWidth(newWidth);
            }
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            document.body.style.cursor = 'default';
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = 'col-resize';

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'default';
        };
    }, [isResizing]);

    // Close context menu on click elsewhere
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        document.addEventListener("click", handleClick);
        return () => document.removeEventListener("click", handleClick);
    }, []);

    const handleContextMenu = (e: React.MouseEvent, entry?: FileEntry, path?: string) => {
        e.preventDefault();
        e.stopPropagation();

        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;

        // Simple collision detection (flip if near edge)
        const menuWidth = 200;
        const menuHeight = entry ? 200 : 120; // Estimations

        if (x + menuWidth > rect.width) x -= menuWidth;
        if (y + menuHeight > rect.height) y -= menuHeight;

        setContextMenu({
            x,
            y,
            entry,
            type: entry ? 'item' : 'background',
            path: path || entry?.path || ""
        });
    };

    const generateUntitledName = (base: string, currentEntries: FileEntry[], isDir: boolean): string => {
        let name = base;
        let counter = 1;

        while (currentEntries.find(e => e.name.toLowerCase() === name.toLowerCase() && e.is_dir === isDir)) {
            name = `${base.split('.')[0]} (${counter})${base.includes('.') ? '.' + base.split('.').pop() : ''}`;
            counter++;
        }
        return name;
    };

    const handleCreate = async (dirPath: string, type: 'file' | 'dir') => {
        toast.promise(
            async () => {
                const name = type === 'dir' ? "Untitled Folder" : "untitled";
                const extension = type === 'file' ? ".txt" : "";

                const currentEntries = await invoke<FileEntry[]>("read_directory", { path: dirPath });
                const finalName = generateUntitledName(name + extension, currentEntries, type === 'dir');

                const fullPath = `${dirPath}/${finalName}`;
                if (type === 'dir') {
                    await invoke("create_dir", { path: fullPath });
                } else {
                    await invoke("create_file", { path: fullPath });
                }

                triggerRefresh();
            },
            {
                loading: `Creating ${type}...`,
                success: `${type === 'dir' ? 'Folder' : 'File'} created`,
                error: (err) => `Failed to create: ${err}`
            }
        );
    };

    const [renamingItem, setRenamingItem] = useState<{ path: string, oldName: string } | null>(null);
    const [newName, setNewName] = useState("");

    const handleRenameCommit = async () => {
        if (!renamingItem || !newName.trim() || newName === renamingItem.oldName) {
            setRenamingItem(null);
            return;
        }

        const oldPath = renamingItem.path;
        const parentDir = oldPath.substring(0, oldPath.lastIndexOf('/'));
        const newPath = `${parentDir}/${newName.trim()}`;

        try {
            await invoke("rename_path", { oldPath, newPath });
            toast.success("Renamed successfully");
            setRenamingItem(null);
            triggerRefresh();
        } catch (error) {
            toast.error(`Rename failed: ${error}`);
        }
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
                if (previewFile?.path === entry.path) {
                    setPreviewFile(null);
                }
                triggerRefresh();
            } else {
                const msg = report.errors && report.errors.length > 0 ? report.errors[0] : "Failed to delete item";
                toast.error(msg, { id: toastId, duration: 4000 });
            }
        } catch (error) {
            console.error(error);
            toast.error("Error during deletion", { id: toastId });
        }
    };

    const safeConvertFileSrc = (path: string) => {
        if (!path) return "";
        return convertFileSrc(path);
    };

    if (explorerTabs.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center relative overflow-hidden bg-black/5 animate-scale-in">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] opacity-20 animate-pulse" />
                <div className="relative z-10 text-center max-w-2xl px-6">
                    <div className="inline-flex items-center justify-center w-24 h-24 rounded-[32px] bg-white/[0.03] border border-white/10 backdrop-blur-2xl mb-12 group hover:border-primary/40 transition-all duration-700 shadow-2xl">
                        <Folder className="w-10 h-10 text-primary/40 group-hover:text-primary transition-all duration-700 animate-float" />
                    </div>
                    <h1 className="text-7xl font-black text-white tracking-tighter mb-6 uppercase italic leading-none drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                        Spatial <span className="text-primary italic">Audit</span>
                    </h1>
                    <div className="flex flex-col items-center gap-4">
                        <div className="h-px w-24 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/40 italic flex items-center gap-3">
                            Open segments from sidebar to begin
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className="flex-1 flex flex-col h-full overflow-hidden bg-background/20 backdrop-blur-md text-white relative"
        >
            <header className="flex h-14 shrink-0 items-center justify-between gap-2 px-4 border-b border-border/10 backdrop-blur-xl sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <SidebarTrigger className="h-8 w-8 text-white/40 hover:text-white" />
                    <div className="h-4 w-px bg-white/10 mx-1" />
                    <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20">
                        <img src="/src/assets/logo.png" alt="Logo" className="w-4 h-4 object-contain" />
                    </div>
                    <h1 className="text-xs font-black uppercase tracking-widest text-white/60 italic">Aether Multiview Explorer</h1>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-[9px] font-black uppercase tracking-widest text-primary/40 italic">Active Segments: {explorerTabs.length}</span>
                </div>
            </header>

            <div className="flex-1 flex flex-row overflow-hidden relative">
                {/* Scrollable container for splits if they overflow */}
                <div className="flex-1 flex flex-row h-full overflow-x-auto no-scrollbar">
                    {explorerTabs.map((tab) => (
                        <ExplorerSplit
                            key={tab.id}
                            tab={tab}
                            onFileClick={(entry) => {
                                setPreviewError(false);
                                setPreviewFile(entry);
                                setActiveTabId(tab.id);
                            }}
                            onContextMenu={handleContextMenu}
                            onClose={() => closeExplorerTab(tab.id)}
                            renamingItem={renamingItem}
                            setRenamingItem={setRenamingItem}
                            onRenameCommit={handleRenameCommit}
                            newName={newName}
                            setNewName={setNewName}
                            refreshTrigger={refreshTrigger}
                        />
                    ))}
                </div>

                {/* Preview Panel */}
                {previewFile && (
                    <div
                        className="flex flex-col h-full bg-black/60 backdrop-blur-3xl border-l border-white/10 overflow-hidden relative animate-in slide-in-from-right duration-500"
                        style={{ width: `${previewWidth}px` }}
                    >
                        <div
                            className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/30 transition-colors z-50"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                setIsResizing(true);
                            }}
                        />

                        <div className="flex-1 flex flex-col overflow-hidden">
                            <div className="flex-1 flex flex-col relative overflow-hidden group/media">
                                <div className="absolute top-6 right-6 z-20">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setPreviewFile(null)}
                                        className="rounded-xl bg-black/50 text-white hover:bg-primary hover:text-black shadow-2xl border border-white/10 h-10 w-10"
                                    >
                                        <X className="w-5 h-5" />
                                    </Button>
                                </div>

                                <div className="flex-1 flex items-center justify-center p-4">
                                    {previewError ? (
                                        <div className="flex flex-col items-center gap-6 text-white/20 animate-slide-up">
                                            <div className="w-16 h-16 rounded-full border border-dashed border-white/10 flex items-center justify-center">
                                                <X className="w-6 h-6" />
                                            </div>
                                            <span className="text-[9px] font-black uppercase tracking-widest italic">Render Error</span>
                                        </div>
                                    ) : previewFile.name.match(/\.(mp4|mov|mkv|webm)$/i) ? (
                                        <video
                                            src={safeConvertFileSrc(previewFile.path)}
                                            controls
                                            className="max-w-full max-h-full rounded-xl shadow-2xl border border-white/5"
                                            onError={() => setPreviewError(true)}
                                        />
                                    ) : (
                                        <img
                                            src={safeConvertFileSrc(previewFile.path)}
                                            className="max-w-full max-h-full object-contain p-2 rounded-xl drop-shadow-2xl"
                                            alt="Preview"
                                            onError={() => setPreviewError(true)}
                                        />
                                    )}
                                </div>

                                <div className="p-6 bg-gradient-to-t from-black to-transparent flex flex-col gap-4">
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-sm font-black text-white truncate tracking-tight uppercase italic mb-1">{previewFile.name}</span>
                                        <span className="text-[9px] text-white/30 truncate font-mono">{previewFile.path}</span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <Button
                                            variant="secondary"
                                            onClick={() => invoke("reveal_in_finder", { path: previewFile.path })}
                                            className="bg-white/5 hover:bg-white/10 text-white border border-white/5 rounded-xl h-10 text-[9px] font-black uppercase tracking-widest"
                                        >
                                            <ExternalLink className="w-3.5 h-3.5 mr-2 text-primary" />
                                            Reveal
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            onClick={() => handleDelete(previewFile)}
                                            className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/10 rounded-xl h-10 text-[9px] font-black uppercase tracking-widest"
                                        >
                                            <Trash2 className="w-3.5 h-3.5 mr-2" />
                                            Purge
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="absolute z-[100] min-w-[200px] bg-white border border-slate-200 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] p-1.5 animate-in fade-in zoom-in-95 duration-200"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {contextMenu.type === 'item' && contextMenu.entry && (
                        <>
                            <div className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 mb-1.5 truncate italic">
                                {contextMenu.entry.name}
                            </div>
                            <button
                                onClick={() => {
                                    invoke("reveal_in_finder", { path: contextMenu.entry!.path });
                                    setContextMenu(null);
                                }}
                                className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-100 text-[11px] font-bold text-slate-700 transition-all group"
                            >
                                <ExternalLink className="w-3.5 h-3.5 text-primary group-hover:scale-110 transition-transform" />
                                Reveal in Finder
                            </button>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(contextMenu.entry!.path);
                                    setContextMenu(null);
                                    toast.success("Path copied");
                                }}
                                className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-100 text-[11px] font-bold text-slate-700 transition-all group"
                            >
                                <FileText className="w-3.5 h-3.5 text-primary group-hover:scale-110 transition-transform" />
                                Copy Path
                            </button>
                            <button
                                onClick={() => {
                                    setRenamingItem({ path: contextMenu.entry!.path, oldName: contextMenu.entry!.name });
                                    setNewName(contextMenu.entry!.name);
                                    setContextMenu(null);
                                }}
                                className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-100 text-[11px] font-bold text-slate-700 transition-all group"
                            >
                                <Edit2 className="w-3.5 h-3.5 text-primary group-hover:scale-110 transition-transform" />
                                Rename
                            </button>
                            <div className="h-px bg-slate-100 my-1.5" />
                            <button
                                onClick={() => {
                                    handleDelete(contextMenu.entry!);
                                    setContextMenu(null);
                                }}
                                className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-red-50 text-[11px] font-bold text-red-500 group transition-all"
                            >
                                <Trash2 className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                                Purge
                            </button>
                        </>
                    )}

                    {contextMenu.type === 'background' && (
                        <div className="flex flex-col">
                            <button
                                onClick={() => {
                                    handleCreate(contextMenu.path, 'dir');
                                    setContextMenu(null);
                                }}
                                className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-100 text-[11px] font-bold text-slate-700 transition-all group"
                            >
                                <FolderPlus className="w-3.5 h-3.5 text-primary group-hover:scale-110 transition-transform" />
                                New Folder
                            </button>
                            <button
                                onClick={() => {
                                    handleCreate(contextMenu.path, 'file');
                                    setContextMenu(null);
                                }}
                                className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-100 text-[11px] font-bold text-slate-700 transition-all group"
                            >
                                <FilePlus className="w-3.5 h-3.5 text-primary group-hover:scale-110 transition-transform" />
                                New File
                            </button>
                            <div className="h-px bg-slate-100 my-1.5" />
                            <div className="px-3 py-1.5 text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] italic">
                                Sort Display
                            </div>
                            <button
                                onClick={() => {
                                    const tabId = explorerTabs.find(t => t.path === contextMenu.path)?.id || activeTabId;
                                    if (tabId) updateExplorerTab(tabId, { sortBy: 'name' });
                                    setContextMenu(null);
                                }}
                                className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-100 text-[11px] font-bold text-slate-700 transition-all group"
                            >
                                <SortAsc className="w-3.5 h-3.5 text-primary group-hover:scale-110 transition-transform" />
                                Sort by Name
                            </button>
                            <button
                                onClick={() => {
                                    const tabId = explorerTabs.find(t => t.path === contextMenu.path)?.id || activeTabId;
                                    if (tabId) updateExplorerTab(tabId, { sortBy: 'modified' });
                                    setContextMenu(null);
                                }}
                                className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-100 text-[11px] font-bold text-slate-700 transition-all group"
                            >
                                <Play className="rotate-90 w-3.5 h-3.5 text-primary group-hover:scale-110 transition-transform" />
                                Sort by Created
                            </button>
                            <button
                                onClick={() => {
                                    const tabId = explorerTabs.find(t => t.path === contextMenu.path)?.id || activeTabId;
                                    if (tabId) updateExplorerTab(tabId, { sortBy: 'kind' });
                                    setContextMenu(null);
                                }}
                                className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-100 text-[11px] font-bold text-slate-700 transition-all group"
                            >
                                <FileText className="w-3.5 h-3.5 text-primary group-hover:scale-110 transition-transform" />
                                Sort by Kind
                            </button>
                            <div className="h-px bg-slate-100 my-1.5" />
                            <div className="px-3 py-1.5 text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] italic">
                                Direction
                            </div>
                            <button
                                onClick={() => {
                                    const tabId = explorerTabs.find(t => t.path === contextMenu.path)?.id || activeTabId;
                                    const currentOrder = explorerTabs.find(t => t.id === tabId)?.sortOrder || 'asc';
                                    if (tabId) updateExplorerTab(tabId, { sortOrder: currentOrder === 'asc' ? 'desc' : 'asc' });
                                    setContextMenu(null);
                                }}
                                className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-100 text-[11px] font-bold text-slate-700 transition-all group"
                            >
                                {(explorerTabs.find(t => t.id === (explorerTabs.find(t => t.path === contextMenu.path)?.id || activeTabId))?.sortOrder === 'asc') ? (
                                    <>
                                        <SortDesc className="w-3.5 h-3.5 text-primary group-hover:scale-110 transition-transform" />
                                        Switch to Descending
                                    </>
                                ) : (
                                    <>
                                        <SortAsc className="w-3.5 h-3.5 text-primary group-hover:scale-110 transition-transform" />
                                        Switch to Ascending
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
