import { useState, useEffect, useRef, useMemo } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { Drive } from "../hooks/useDrives";

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
    ListFilter,
    Trash2,
    Edit2,
    FolderPlus,
    FilePlus,
    SortAsc,
    SortDesc,
    Play,
    X,
    ExternalLink,
    CheckSquare,
    Square,
    Pin,
    PinOff,
    Copy,
    FolderInput,
    XSquare
} from "lucide-react";
import { useStore, FileEntry } from "@/store/useStore";
import { Button } from "@/components/ui/button";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, formatSize } from "@/lib/utils";
import { toast } from "sonner";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { VideoPlayer } from "./VideoPlayer";
import {
    MonitorPlay,
    TerminalSquare,
    RotateCw
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";



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
    onRenameCancel,
    isSelected,
    isMarqueeSelected,
    onToggleSelection
}: {
    entry: FileEntry;
    onClick: (entry: FileEntry) => void;
    onContextMenu: (e: React.MouseEvent, entry?: FileEntry, path?: string) => void;
    scanQueue: Drive[];
    addToQueue: (drive: Drive) => void;
    removeFromQueue: (path: string) => void;
    renamingPath: string | null;
    onRenameCommit: (newName: string) => void;
    onRenameCancel: () => void;
    isSelected: boolean;
    isMarqueeSelected?: boolean;
    onToggleSelection: (e: React.MouseEvent) => void;
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
                            key={entry.path} // Force remount on path change to reset playing state
                            ref={videoRef}
                            src={convertFileSrc(entry.path)}
                            className="w-full h-full object-cover"
                            muted // Default to muted
                            loop
                            playsInline
                            preload="none"
                            autoPlay={false} // Ensure video starts paused
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
            data-path={entry.path}
            className={cn(
                "group relative flex flex-col items-center rounded-[32px] transition-all duration-500 cursor-pointer shadow-none hover:shadow-[0_25px_50px_rgba(0,0,0,0.5),0_0_30px_rgba(255,255,255,0.03)] animate-scale-in overflow-hidden active:scale-95",
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
                            if (scanQueue.some(item => item.mount_point === entry.path)) removeFromQueue(entry.path);
                            else addToQueue({
                                name: entry.name,
                                mount_point: entry.path,
                                total_space: 0,
                                available_space: 0,
                                is_removable: false
                            });
                        }}
                        className={cn(
                            "absolute z-10 top-2 right-2 w-9 h-9 rounded-full flex items-center justify-center shadow-2xl border border-white/25 backdrop-blur-2xl transition-all duration-500 transform scale-0 group-hover:scale-100 rotate-12 group-hover:rotate-0",
                            scanQueue.some(item => item.mount_point === entry.path) ? "bg-primary text-black scale-100" : "bg-black/70 text-white hover:bg-primary hover:text-black"
                        )}
                    >
                        {scanQueue.some(item => item.mount_point === entry.path) ? <Minus className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
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

            {/* Checkbox moved to outer container for consistent bottom alignment */}
            <div
                onClick={onToggleSelection}
                className={cn(
                    "absolute bottom-4 left-4 z-30 w-6 h-6 rounded-md border flex items-center justify-center transition-all bg-black/40 backdrop-blur-md cursor-pointer group/cb",
                    (isSelected || isMarqueeSelected)
                        ? "bg-primary border-primary text-black opacity-100"
                        : "border-white/20 text-transparent opacity-0 group-hover:opacity-100 hover:border-white/40"
                )}
            >
                {(isSelected || isMarqueeSelected) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 group-hover/cb:text-white/40" />}
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


interface SelectionBox {
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
}

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
    const {
        scanQueue,
        addToQueue,
        removeFromQueue,
        updateExplorerTab,
        explorerSelection,
        toggleExplorerSelection,
        contextFolders,
        clearExplorerSelection,
        clearContextFolders,
        triggerRefresh
    } = useStore();
    const [items, setItems] = useState<FileEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
    const [marqueeSelectedPaths, setMarqueeSelectedPaths] = useState<Set<string>>(new Set());
    const [scrollAreaRef] = useState<any>(null);
    const [targetPath, setTargetPath] = useState<string>("");

    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

    const handleBulkDelete = async () => {
        if (!isConfirmingDelete) {
            setIsConfirmingDelete(true);
            setTimeout(() => setIsConfirmingDelete(false), 3000); // Reset after 3s
            return;
        }

        const toastId = toast.loading(`Purging ${explorerSelection.length} staged items using rm -rf...`);
        try {
            const paths = explorerSelection.map(e => e.path);
            await invoke("purge_staged_rm_rf", { paths });

            toast.success(`Successfully purged ${explorerSelection.length} items`, { id: toastId });

            clearExplorerSelection();
            triggerRefresh();
            setIsConfirmingDelete(false);
        } catch (error) {
            console.error(error);
            toast.error("Failed to execute rm -rf purge", { id: toastId });
        }
    };

    const handleBulkMove = async () => {
        if (!targetPath || explorerSelection.length === 0) return;

        // Filter out invalid moves
        const validItems = explorerSelection.filter(item => {
            // Cannot move a folder into itself
            if (item.path === targetPath) return false;
            // Cannot move a folder into its own subdirectory
            // Ensure we check with a separator to avoid partial name matches (e.g. /tmp/foo vs /tmp/foobar)
            const itemPathWithSlash = item.path.endsWith('/') ? item.path : item.path + '/';
            if (targetPath.startsWith(itemPathWithSlash)) return false;
            return true;
        });

        if (validItems.length === 0) {
            toast.error("No valid items to move.");
            return;
        }

        const toastId = toast.loading(`Moving ${validItems.length} items to ${targetPath.split(/[/\\]/).pop()}...`);
        try {
            const paths = validItems.map(e => e.path);
            await invoke("bulk_move", { paths, targetDir: targetPath });
            toast.success(`Successfully moved ${validItems.length} items`, { id: toastId });
            clearExplorerSelection();
            triggerRefresh(); // Refresh UI
        } catch (error) {
            console.error(error);
            toast.error("Failed to execute bulk move", { id: toastId });
        }
    };

    const handleBulkCopy = async () => {
        if (!targetPath || explorerSelection.length === 0) return;
        const toastId = toast.loading(`Copying ${explorerSelection.length} items to ${targetPath.split(/[/\\]/).pop()}...`);
        try {
            const paths = explorerSelection.map(e => e.path);
            await invoke("bulk_copy", { paths, targetDir: targetPath });
            toast.success(`Successfully copied ${explorerSelection.length} items`, { id: toastId });
            clearExplorerSelection();
            triggerRefresh();
        } catch (error) {
            console.error(error);
            toast.error("Failed to execute bulk copy", { id: toastId });
        }
    };



    useEffect(() => {
        if (tab.viewMode !== 'selected') {
            loadDirectory(tab.path);
        }
    }, [tab.path, renamingItem, refreshTrigger, tab.viewMode]);

    const loadDirectory = async (path: string) => {
        setIsLoading(true);
        try {
            const data = await invoke<FileEntry[]>("read_directory", { path });
            setItems(data);
        } catch (error) {
            console.error("Failed to read directory:", error);
            handleUp();
        } finally {
            setIsLoading(false);
        }
    };

    // --- Search / Filter Logic ---
    const [isSizeFilterActive, setIsSizeFilterActive] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [sizeRange, setSizeRange] = useState([0, 100]); // Percentage 0-100
    const [fileResults, setFileResults] = useState<FileEntry[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // Convert Slider 0-100 to Bytes (Logarithmic scale 1MB to 100GB)
    // 1MB = 10^6, 100GB = 10^11. Range is 5 orders of magnitude.
    const minBytesLog = Math.log10(1024 * 1024); // 1MB
    const maxBytesLog = Math.log10(20 * 1024 * 1024 * 1024); // 20GB

    const sliderToBytes = (val: number) => {
        const logVal = minBytesLog + (val / 100) * (maxBytesLog - minBytesLog);
        return Math.pow(10, logVal);
    };

    const performSearch = async () => {
        if (!isSizeFilterActive) return;
        setIsSearching(true);
        try {
            const minBytes = sliderToBytes(sizeRange[0]);
            const maxBytes = sliderToBytes(sizeRange[1]);

            const results = await invoke<FileEntry[]>("search_files_command", {
                searchPath: tab.path,
                minSize: Math.floor(minBytes),
                maxSize: Math.floor(maxBytes),
                includeHidden: true // As requested "hidden or visible"
            });
            setFileResults(results);
            setHasSearched(true);
            toast.success(`Found ${results.length} files`);
        } catch (error) {
            console.error("Search failed:", error);
            toast.error("File search failed");
        } finally {
            setIsSearching(false);
        }
    };

    useEffect(() => {
        if (!isSizeFilterActive) {
            setFileResults([]);
            setHasSearched(false);
        }
    }, [isSizeFilterActive, tab.path]);

    // Override items if filter is active
    // If filter is active but we haven't searched yet, show nothing (or original items? User said manual search)
    // Let's show filtered results only if searched. 
    // If filter ON, we show results. If results empty AND searched, show empty. 
    // If filter ON and NOT searched, show instructions? or empty?
    // User wants "filter... apply... search". 
    const displayItems = isSizeFilterActive ? fileResults : items;


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
        const sourceEntries = tab.viewMode === 'selected' ? explorerSelection : displayItems;
        return [...sourceEntries]
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
    }, [items, explorerSelection, tab.searchQuery, tab.sortBy, tab.sortOrder, tab.viewMode, displayItems]);

    const getListIcon = (entry: FileEntry) => {
        if (entry.is_dir) return <Folder className="w-5 h-5 text-blue-400" />;
        const ext = entry.name.split('.').pop()?.toLowerCase();
        if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext || "")) return <ImageIcon className="w-5 h-5 text-purple-400" />;
        if (["mp4", "mov", "mkv"].includes(ext || "")) return <Video className="w-5 h-5 text-red-400" />;
        return <File className="w-5 h-5 text-slate-400" />;
    };

    const calculateIntersections = (box: SelectionBox, container: HTMLElement) => {
        const left = Math.min(box.startX, box.currentX);
        const top = Math.min(box.startY, box.currentY);
        const right = Math.max(box.startX, box.currentX);
        const bottom = Math.max(box.startY, box.currentY);

        const itemElements = container.querySelectorAll('[data-path]');
        const found = new Set<string>();

        itemElements.forEach((el) => {
            const element = el as HTMLElement;
            const path = element.getAttribute('data-path');
            if (!path) return;

            // Get position relative to the scroll area viewport
            const elLeft = element.offsetLeft;
            const elTop = element.offsetTop;
            const elRight = elLeft + element.offsetWidth;
            const elBottom = elTop + element.offsetHeight;

            // Check intersection with scroll adjustment if needed
            // But since startX/Y are relative to container, and offsetLeft/Top are relative to parent (viewport),
            // this should work if the box is also relative to the container.
            if (elLeft < right && elRight > left && elTop < bottom && elBottom > top) {
                found.add(path);
            }
        });

        setMarqueeSelectedPaths(found);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        // Only start selection on Left Click (button 0)
        if (e.button !== 0) return;

        // Only start selection if clicking on the background or container (not on buttons/inputs or items)
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('input') || target.closest('select') || target.closest('[data-path]')) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const startX = e.clientX - rect.left;
        const startY = e.clientY - rect.top;

        setSelectionBox({
            startX,
            startY,
            currentX: startX,
            currentY: startY,
        });
        setMarqueeSelectedPaths(new Set());
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!selectionBox) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const nextBox = {
            ...selectionBox,
            currentX: e.clientX - rect.left,
            currentY: e.clientY - rect.top,
        };

        setSelectionBox(nextBox);
        calculateIntersections(nextBox, e.currentTarget as HTMLElement);
    };

    const handleMouseUp = () => {
        if (!selectionBox) return;

        // Add all marquee selected items to the main selection
        marqueeSelectedPaths.forEach(path => {
            const entry = displayItems.find(i => i.path === path);
            if (entry && !explorerSelection.some(e => e.path === path)) {
                toggleExplorerSelection(entry);
            }
        });

        setSelectionBox(null);
        setMarqueeSelectedPaths(new Set());
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
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1 p-1 bg-white/5 rounded-lg border border-white/5">
                        <TooltipProvider delayDuration={300}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" onClick={handleBack} disabled={tab.historyIndex <= 0} className="h-7 w-7 rounded-md">
                                        <ChevronLeft className="w-3.5 h-3.5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="text-[10px] bg-black/90 border-white/10 text-white">Back</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" onClick={handleForward} disabled={tab.historyIndex >= tab.history.length - 1} className="h-7 w-7 rounded-md">
                                        <ChevronRight className="w-3.5 h-3.5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="text-[10px] bg-black/90 border-white/10 text-white">Forward</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" onClick={handleUp} className="h-7 w-7 rounded-md">
                                        <ArrowUp className="w-3.5 h-3.5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="text-[10px] bg-black/90 border-white/10 text-white">Up</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>

                    <div className="flex items-center bg-black/40 rounded-lg p-0.5 border border-white/5">
                        <TooltipProvider delayDuration={300}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => updateExplorerTab(tab.id, {
                                            sortOrder: tab.sortOrder === 'asc' ? 'desc' : 'asc'
                                        })}
                                        className="h-7 w-7 rounded-md text-white/40 hover:text-primary transition-all"
                                    >
                                        {tab.sortOrder === 'asc' ? <SortAsc className="w-3.5 h-3.5" /> : <SortDesc className="w-3.5 h-3.5" />}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="text-[10px] bg-black/90 border-white/10 text-white">
                                    Sort {tab.sortOrder === 'asc' ? 'Descending' : 'Ascending'}
                                </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-primary/70 hover:text-primary hover:bg-primary/10 transition-colors"
                                        onClick={triggerRefresh}
                                    >
                                        <RotateCw className="w-3.5 h-3.5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="text-[10px] bg-black/90 border-white/10 text-white">Refresh</TooltipContent>
                            </Tooltip>
                            <div className="h-4 w-px bg-white/10 mx-1" />
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => {
                                            const modes: ('name' | 'modified' | 'kind')[] = ['name', 'modified', 'kind'];
                                            const next = modes[(modes.indexOf(tab.sortBy || 'name') + 1) % modes.length];
                                            updateExplorerTab(tab.id, { sortBy: next });
                                        }}
                                        className="h-7 w-7 rounded-md text-white/40 hover:text-primary transition-all"
                                    >
                                        <ListFilter className="w-3.5 h-3.5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="text-[10px] bg-black/90 border-white/10 text-white">
                                    Sort by: <span className="text-primary font-bold uppercase">{tab.sortBy || 'name'}</span>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
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

                    {/* Size Filter Toggle */}
                    <div className="flex items-center gap-2 px-2 h-8 bg-black/40 border border-white/10 rounded-lg">
                        <Checkbox
                            id="size-filter"
                            checked={isSizeFilterActive}
                            onCheckedChange={(c) => setIsSizeFilterActive(!!c)}
                            className="w-3.5 h-3.5 border-white/30 data-[state=checked]:bg-primary data-[state=checked]:text-black"
                        />
                        <label htmlFor="size-filter" className="text-[9px] uppercase font-black tracking-widest text-white/60 cursor-pointer select-none hover:text-white transition-colors">
                            Size
                        </label>
                    </div>

                    <div className="flex items-center bg-black/40 rounded-lg p-0.5 border border-white/5">
                        {['grid', 'list', 'selected'].map((mode) => (
                            <Button
                                key={mode}
                                variant="ghost"
                                size="icon"
                                onClick={() => updateExplorerTab(tab.id, { viewMode: mode as any })}
                                className={cn(
                                    "h-7 w-7 rounded-sm transition-all duration-300",
                                    (tab.viewMode || 'grid') === mode
                                        ? "bg-primary text-black"
                                        : "text-white/40 hover:text-white"
                                )}
                                title={`${mode.charAt(0).toUpperCase() + mode.slice(1)} View`}
                            >
                                {mode === 'grid' ? <LayoutGrid className="w-3.5 h-3.5" /> :
                                    mode === 'list' ? <ListIcon className="w-3.5 h-3.5" /> :
                                        <div className="relative">
                                            <CheckSquare className="w-3.5 h-3.5" />
                                            {explorerSelection.length > 0 && (
                                                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-red-500 text-[6px] font-bold text-white ring-1 ring-black">
                                                    {explorerSelection.length}
                                                </span>
                                            )}
                                        </div>
                                }
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Size Filter Slider Row  */}
                {isSizeFilterActive && (
                    <div className="flex items-center gap-3 px-2 py-2 bg-white/5 rounded-lg animate-in fade-in slide-in-from-top-1 duration-200 border border-white/5">
                        <span className="text-[9px] font-mono text-primary whitespace-nowrap min-w-[50px] text-right">
                            {formatSize(sliderToBytes(sizeRange[0]))}
                        </span>
                        <Slider
                            value={sizeRange}
                            max={100}
                            step={1}
                            minStepsBetweenThumbs={1}
                            onValueChange={setSizeRange}
                            className="flex-1"
                        />
                        <span className="text-[9px] font-mono text-primary whitespace-nowrap min-w-[50px]">
                            {formatSize(sliderToBytes(sizeRange[1]))}
                        </span>

                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={performSearch}
                            disabled={isSearching}
                            className="h-6 px-3 text-[10px] font-bold uppercase tracking-widest bg-primary text-black hover:bg-white hover:text-black transition-colors"
                        >
                            {isSearching ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Search className="w-3 h-3 mr-1" />}
                            Search
                        </Button>
                    </div>
                )}

                {tab.viewMode === 'selected' && explorerSelection.length > 0 && (
                    <div className="flex items-center gap-2 mt-2 p-2 bg-primary/5 rounded-lg border border-primary/20 animate-in fade-in slide-in-from-top-1 duration-300 flex-wrap">
                        <div className="flex items-center gap-2">
                            <TooltipProvider delayDuration={300}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={clearExplorerSelection}
                                            className="h-7 w-7 text-red-400 hover:text-red-500 hover:bg-red-500/10 transition-all border border-red-500/20"
                                        >
                                            <XSquare className="w-3.5 h-3.5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="text-[10px] bg-black/90 border-white/10 text-white">Clear Selection</TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={handleBulkDelete}
                                            className={cn(
                                                "h-7 w-7 transition-all border",
                                                isConfirmingDelete
                                                    ? "bg-red-500 text-white border-red-600 scale-105 shadow-[0_0_15px_rgba(239,68,68,0.4)]"
                                                    : "text-red-400 hover:text-red-500 hover:bg-red-500/10 border-red-500/10"
                                            )}
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="text-[10px] bg-black/90 border-white/10 text-white">
                                        {isConfirmingDelete ? "Confirm Purge" : "Purge Selected Items"}
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                        <div className="w-px h-4 bg-primary/20 mx-1 hidden sm:block" />
                        <div className="flex-1 flex items-center gap-2 min-w-[200px]">
                            <span className="text-[9px] font-black uppercase tracking-widest text-primary/40 whitespace-nowrap hidden sm:inline">Target:</span>
                            <select
                                value={targetPath}
                                onChange={(e) => setTargetPath(e.target.value)}
                                className="flex-1 h-7 bg-black/40 border border-white/10 rounded px-2 text-[10px] text-white focus:outline-none focus:border-primary/40 min-w-[120px]"
                            >
                                <option value="">Select context folder...</option>
                                {contextFolders.map(path => (
                                    <option key={path} value={path}>{path.split(/[/\\]/).pop() || path}</option>
                                ))}
                            </select>
                            <TooltipProvider delayDuration={300}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={clearContextFolders}
                                            className="h-7 w-7 p-0 text-white/40 hover:text-red-400 transition-colors shrink-0"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="text-[10px] bg-black/90 border-white/10 text-white">Clear Pinned Folders</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                        <div className="flex items-center gap-1">
                            <TooltipProvider delayDuration={300}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            disabled={!targetPath}
                                            onClick={handleBulkMove}
                                            className="h-7 w-7 text-primary hover:bg-primary/10 transition-all disabled:opacity-30"
                                        >
                                            <FolderInput className="w-3.5 h-3.5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="text-[10px] bg-black/90 border-white/10 text-white">Move to Target</TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            disabled={!targetPath}
                                            onClick={handleBulkCopy}
                                            className="h-7 w-7 text-primary hover:bg-primary/10 transition-all disabled:opacity-30"
                                        >
                                            <Copy className="w-3.5 h-3.5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="text-[10px] bg-black/90 border-white/10 text-white">Copy to Target</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    </div>
                )}

                <div className="px-2">
                    <p className="text-[9px] font-mono opacity-30 truncate">{tab.path}</p>
                </div>
            </div>

            {/* Content Aria */}
            <div
                className="flex-1 relative overflow-hidden"
                onContextMenu={(e) => onContextMenu(e, undefined, tab.path)}
            >
                <ScrollArea
                    className="h-full w-full"
                    ref={scrollAreaRef}
                    type="always"
                >
                    <div
                        className="p-6 min-h-full relative select-none"
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                    >
                        {/* Selection Box Visual */}
                        {selectionBox && (
                            <div
                                className="absolute pointer-events-none border border-primary/50 bg-primary/10 z-50 rounded-sm"
                                style={{
                                    left: Math.min(selectionBox.startX, selectionBox.currentX),
                                    top: Math.min(selectionBox.startY, selectionBox.currentY),
                                    width: Math.abs(selectionBox.currentX - selectionBox.startX),
                                    height: Math.abs(selectionBox.currentY - selectionBox.startY),
                                }}
                            />
                        )}
                        {/* Loader Overlay */}
                        {(isLoading || isSearching) && (
                            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                                <div className="flex flex-col items-center gap-4">
                                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
                                    <p className="text-xs font-black uppercase tracking-widest text-white/80 animate-pulse">
                                        {isSearching ? "Searching Files..." : "Loading Content..."}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Empty State */}
                        {!isLoading && !isSearching && displayItems.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-white/20 select-none pointer-events-none">
                                {isSizeFilterActive ? (
                                    hasSearched ? (
                                        <>
                                            <Search className="w-12 h-12 mb-4 opacity-50" />
                                            <p className="text-sm font-bold uppercase tracking-widest">No matching files found</p>
                                            <p className="text-[10px] mt-2 opacity-60">Try adjusting the size range</p>
                                        </>
                                    ) : (
                                        <>
                                            <Search className="w-12 h-12 mb-4 opacity-50" />
                                            <p className="text-sm font-bold uppercase tracking-widest">Ready to Search</p>
                                            <p className="text-[10px] mt-2 opacity-60">Click Search to find files in range</p>
                                        </>
                                    )
                                ) : (
                                    <>
                                        <EmptyFolderIcon className="w-12 h-12 mb-4 opacity-50" />
                                        <p className="text-sm font-bold uppercase tracking-widest">Empty Directory</p>
                                    </>
                                )}
                            </div>
                        )}

                        {(!isLoading && !isSearching && displayItems.length > 0) && (tab.viewMode === 'grid' ? (
                            (() => {
                                const folders = sortedEntries.filter(e => e.is_dir);
                                const files = sortedEntries.filter(e => !e.is_dir);

                                return (
                                    <div className="flex flex-col gap-8">
                                        {folders.length > 0 && (
                                            <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-6">
                                                {folders.map((entry) => (
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
                                                            setTimeout(onRenameCommit, 0);
                                                        }}
                                                        onRenameCancel={() => setRenamingItem(null)}
                                                        isSelected={explorerSelection.some(e => e.path === entry.path)}
                                                        isMarqueeSelected={marqueeSelectedPaths.has(entry.path)}
                                                        onToggleSelection={(e) => {
                                                            e.stopPropagation();
                                                            toggleExplorerSelection(entry);
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        )}

                                        {folders.length > 0 && files.length > 0 && (
                                            <div className="h-px bg-white/5 w-full" />
                                        )}

                                        {files.length > 0 && (
                                            <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-6">
                                                {files.map((entry) => (
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
                                                            setTimeout(onRenameCommit, 0);
                                                        }}
                                                        onRenameCancel={() => setRenamingItem(null)}
                                                        isSelected={explorerSelection.some(e => e.path === entry.path)}
                                                        isMarqueeSelected={marqueeSelectedPaths.has(entry.path)}
                                                        onToggleSelection={(e) => {
                                                            e.stopPropagation();
                                                            toggleExplorerSelection(entry);
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })()
                        ) : (
                            <div className="space-y-1">
                                {(() => {
                                    const folders = sortedEntries.filter(e => e.is_dir);
                                    const files = sortedEntries.filter(e => !e.is_dir);

                                    const renderListItem = (entry: FileEntry) => (
                                        <div
                                            key={entry.path}
                                            data-path={entry.path}
                                            className="group/item flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.05] transition-all cursor-pointer border border-transparent hover:border-white/10"
                                            onClick={() => handleEntryClick(entry)}
                                            onContextMenu={(e) => onContextMenu(e, entry)}
                                        >
                                            <div
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleExplorerSelection(entry);
                                                }}
                                                className={cn(
                                                    "w-6 h-6 rounded-md border flex items-center justify-center transition-all bg-black/40",
                                                    (explorerSelection.some(e => e.path === entry.path) || marqueeSelectedPaths.has(entry.path))
                                                        ? "bg-primary border-primary text-black opacity-100"
                                                        : "border-white/10 text-transparent opacity-0 group-hover/item:opacity-100 hover:border-white/30"
                                                )}
                                            >
                                                {(explorerSelection.some(e => e.path === entry.path) || marqueeSelectedPaths.has(entry.path)) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 opacity-20" />}
                                            </div>
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
                                                        if (scanQueue.some(item => item.mount_point === entry.path)) removeFromQueue(entry.path);
                                                        else addToQueue({
                                                            name: entry.name,
                                                            mount_point: entry.path,
                                                            total_space: 0,
                                                            available_space: 0,
                                                            is_removable: false
                                                        });
                                                    }}
                                                    className={cn(
                                                        "w-7 h-7 rounded-md flex items-center justify-center transition-all bg-white/5 border border-white/5",
                                                        scanQueue.some(item => item.mount_point === entry.path) ? "bg-primary text-black opacity-100" : "text-white/20 opacity-0 group-hover/item:opacity-100"
                                                    )}
                                                >
                                                    {scanQueue.some(item => item.mount_point === entry.path) ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                                                </button>
                                            )}
                                        </div>
                                    );

                                    return (
                                        <>
                                            {folders.map(renderListItem)}
                                            {folders.length > 0 && files.length > 0 && (
                                                <div className="h-px bg-white/5 w-full my-2" />
                                            )}
                                            {files.map(renderListItem)}
                                        </>
                                    );
                                })()}
                            </div>
                        ))}
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
        refreshTrigger,
        contextFolders,
        pinContextFolder,
        unpinContextFolder
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

    // Creation State
    const [creationItem, setCreationItem] = useState<{ path: string, type: 'file' | 'dir' } | null>(null);
    const [creationName, setCreationName] = useState("");

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

    const handleCreate = async (dirPath: string, type: 'file' | 'dir', name?: string) => {
        if (!name) {
            setCreationItem({ path: dirPath, type });
            setCreationName("");
            return;
        }

        toast.promise(
            async () => {
                const fullPath = `${dirPath}/${name}`;
                if (type === 'dir') {
                    await invoke("create_dir", { path: fullPath });
                    pinContextFolder(fullPath);
                } else {
                    await invoke("create_file", { path: fullPath });
                }

                triggerRefresh();
                setCreationItem(null);
            },
            {
                loading: `Creating ${type}...`,
                success: `${type.charAt(0).toUpperCase() + type.slice(1)} created`,
                error: (err) => `Failed to create ${type}: ${err}`
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
            await invoke("purge_staged_rm_rf", {
                paths: [entry.path]
            });

            toast.success("Item deleted", { id: toastId });
            if (previewFile?.path === entry.path) {
                setPreviewFile(null);
            }
            triggerRefresh();
        } catch (error) {
            console.error(error);
            toast.error(`Error during deletion: ${error}`, { id: toastId });
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
                                    {previewError || (previewFile.name.match(/\.(avi|wmv|3gp|flv|mts|m2ts|ts)$/i)) ? (
                                        <div className="flex flex-col items-center justify-center w-full h-full p-8">
                                            <div className="relative mb-6">
                                                <div className="absolute -inset-8 bg-primary/10 rounded-full blur-2xl animate-pulse" />
                                                <div className="w-20 h-20 rounded-3xl bg-white/[0.02] border border-white/10 flex items-center justify-center relative z-10">
                                                    <MonitorPlay className="w-8 h-8 text-primary/50" />
                                                </div>
                                                <div className="absolute -bottom-2 -right-2 w-7 h-7 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-center z-20">
                                                    <TerminalSquare className="w-3.5 h-3.5 text-primary" />
                                                </div>
                                            </div>

                                            <div className="flex flex-col items-center gap-2 text-center max-w-xs">
                                                <h4 className="text-sm font-black text-white uppercase tracking-tighter italic">Deep Audit Protocol</h4>
                                                <p className="text-[10px] text-white/30 font-medium leading-relaxed uppercase tracking-widest">
                                                    Codecs for this format are restricted by the system sandbox. Use the high-performance hardware decoder for full validation.
                                                </p>
                                            </div>

                                            <div className="mt-8 flex flex-col gap-3 w-full max-w-[200px]">
                                                <Button
                                                    variant="default"
                                                    size="lg"
                                                    onClick={() => invoke("trigger_quick_look", { path: previewFile.path })}
                                                    className="h-11 bg-white text-black font-black text-[9px] uppercase tracking-[0.2em] rounded-xl shadow-xl hover:scale-[1.02] transition-all"
                                                >
                                                    Initialize Quick Look
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => invoke("open_file", { path: previewFile.path })}
                                                    className="h-10 text-white/60 hover:text-white font-black text-[8px] uppercase tracking-widest border-white/10 bg-white/5"
                                                >
                                                    Full System Playback
                                                </Button>
                                            </div>
                                        </div>
                                    ) : previewFile.name.match(/\.(mp4|mov|mkv|webm)$/i) ? (
                                        <VideoPlayer
                                            key={previewFile.path}
                                            src={safeConvertFileSrc(previewFile.path)}
                                            className="w-full h-full"
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
                            {contextMenu.entry!.is_dir && (
                                <button
                                    onClick={() => {
                                        const path = contextMenu.entry!.path;
                                        if (contextFolders.includes(path)) {
                                            unpinContextFolder(path);
                                            toast.success("Folder unpinned");
                                        } else {
                                            pinContextFolder(path);
                                            toast.success("Folder pinned to context");
                                        }
                                        setContextMenu(null);
                                    }}
                                    className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-100 text-[11px] font-bold text-slate-700 transition-all group"
                                >
                                    {contextFolders.includes(contextMenu.entry!.path) ? (
                                        <>
                                            <PinOff className="w-3.5 h-3.5 text-orange-400 group-hover:scale-110 transition-transform" />
                                            Unpin from Context
                                        </>
                                    ) : (
                                        <>
                                            <Pin className="w-3.5 h-3.5 text-primary group-hover:scale-110 transition-transform" />
                                            Pin to Context
                                        </>
                                    )}
                                </button>
                            )}
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
                                    const path = contextMenu.path;
                                    if (contextFolders.includes(path)) {
                                        unpinContextFolder(path);
                                        toast.success("Folder unpinned");
                                    } else {
                                        pinContextFolder(path);
                                        toast.success("Folder pinned to context");
                                    }
                                    setContextMenu(null);
                                }}
                                className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-100 text-[11px] font-bold text-slate-700 transition-all group"
                            >
                                {contextFolders.includes(contextMenu.path) ? (
                                    <>
                                        <PinOff className="w-3.5 h-3.5 text-orange-400 group-hover:scale-110 transition-transform" />
                                        Unpin Current Folder
                                    </>
                                ) : (
                                    <>
                                        <Pin className="w-3.5 h-3.5 text-primary group-hover:scale-110 transition-transform" />
                                        Pin Current Folder
                                    </>
                                )}
                            </button>
                            <div className="h-px bg-slate-100 my-1.5" />
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

            <CreationNamingModal
                creationItem={creationItem}
                creationName={creationName}
                setCreationName={setCreationName}
                setCreationItem={setCreationItem}
                handleCreate={handleCreate}
            />
        </div>
    );
}

{/* Creation Naming Modal */ }
interface CreationNamingModalProps {
    creationItem: { path: string, type: 'file' | 'dir' } | null;
    creationName: string;
    setCreationName: (name: string) => void;
    setCreationItem: (item: { path: string, type: 'file' | 'dir' } | null) => void;
    handleCreate: (dirPath: string, type: 'file' | 'dir', name?: string) => void;
}

const CreationNamingModal = ({
    creationItem,
    creationName,
    setCreationName,
    setCreationItem,
    handleCreate
}: CreationNamingModalProps) => {
    if (!creationItem) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
            <div
                className="w-[450px] bg-[#0c0c0c] border border-white/10 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] p-8 space-y-6 animate-in zoom-in-95 duration-300"
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && creationName.trim()) {
                        handleCreate(creationItem.path, creationItem.type, creationName.trim());
                    } else if (e.key === 'Escape') {
                        setCreationItem(null);
                    }
                }}
            >
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-xl">
                        {creationItem.type === 'dir' ? (
                            <FolderPlus className="w-6 h-6 text-primary" />
                        ) : (
                            <FilePlus className="w-6 h-6 text-primary" />
                        )}
                    </div>
                    <div>
                        <h3 className="text-lg font-black uppercase tracking-tight text-white leading-none mb-1">
                            New {creationItem.type === 'dir' ? 'Folder' : 'File'}
                        </h3>
                        <p className="text-[11px] text-white/30 font-medium uppercase tracking-widest">Assign a name to continue</p>
                    </div>
                </div>

                <div className="relative group">
                    <Input
                        autoFocus
                        placeholder={`Enter ${creationItem.type} name...`}
                        value={creationName}
                        onChange={(e) => setCreationName(e.target.value)}
                        className="bg-white/5 border-white/10 text-base focus:border-primary/50 transition-all h-14 pl-4 rounded-xl text-white placeholder:text-white/10"
                    />
                    <div className="absolute inset-0 rounded-xl bg-primary/5 opacity-0 group-focus-within:opacity-100 pointer-events-none transition-opacity" />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                    <Button
                        variant="ghost"
                        onClick={() => setCreationItem(null)}
                        className="text-[11px] font-black uppercase tracking-widest text-white/30 hover:text-white transition-colors h-11 px-6 rounded-xl"
                    >
                        Cancel
                    </Button>
                    <Button
                        disabled={!creationName.trim()}
                        onClick={() => handleCreate(creationItem.path, creationItem.type, creationName.trim())}
                        className="bg-primary text-black hover:bg-primary/90 text-[11px] font-black uppercase tracking-widest px-8 h-11 rounded-xl shadow-[0_10px_20px_rgba(255,255,255,0.05)] active:scale-95 transition-all"
                    >
                        Create {creationItem.type === 'dir' ? 'Folder' : 'File'}
                    </Button>
                </div>
            </div>
        </div>
    );
};
