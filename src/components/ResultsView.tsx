import React, { useState } from "react";
import { useStore, FileMetadata } from "../store/useStore";
import { formatSize, cn } from "../lib/utils";
import {
    Trash2,
    CheckCircle2,
    AlertCircle,
    Calendar,
    ChevronRight,
    FolderClosed,
    Eye,
    ExternalLink,
    X,
    Video,
    Image as ImageIcon,
    ImageOff,
    VideoOff,
} from "lucide-react";
import { DeleteConfirmation } from "./DeleteConfirmation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";

export function ResultsView() {
    const { scanResults, selectionQueue, toggleSelection, smartSelect } = useStore();
    const [isConfirmOpen, setConfirmOpen] = useState(false);
    const [previewFile, setPreviewFile] = useState<FileMetadata | null>(null);
    const [previewError, setPreviewError] = useState(false);

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

    const handleReveal = async (e: React.MouseEvent, path: string) => {
        e.stopPropagation();
        await invoke("reveal_in_finder", { path });
    };

    const handlePreview = async (e: React.MouseEvent, file: FileMetadata) => {
        e.stopPropagation();

        // Security Handshake: Dynamically allow the asset protocol to see this folder
        // This is critical for macOS security policies in Tauri v2
        try {
            const folderPath = file.path.split('/').slice(0, -1).join('/');
            await invoke("allow_folder_access", { path: folderPath });
        } catch (err) {
            console.error("Security handshake failed:", err);
        }

        setPreviewError(false); // Reset error state on new preview
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

    /**
     * Universal macOS Path Fix for dedupe-algo (Perfect Encoding)
     * Handles NFD/NFC normalization and surgical asset protocol encoding.
     */
    const safeConvertFileSrc = (path: string) => {
        if (!path) return "";

        // 1. macOS Normalization: Ensure the string is in standard NFC format
        const normalized = path.normalize('NFC');

        // 2. Initial conversion to get the verified protocol/hostname
        const originalUrl = convertFileSrc(normalized);

        // 3. Perfect Encoding: 
        // Ensure spaces are %20 and literal '+' are %2B.
        return originalUrl
            .replace(/ /g, '%20')
            .replace(/\+/g, '%2B');
    };

    // Robust State Synchronization: Clear preview if file is no longer in results
    React.useEffect(() => {
        if (!previewFile || !scanResults) return;
        const exists = scanResults.groups.some(group =>
            group.some(file => file.path === previewFile.path)
        );
        if (!exists) setPreviewFile(null);
    }, [scanResults, previewFile]);

    // Handle Closing Preview specifically
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
                    </div>
                </div>

                {/* Vertical Scroll Container */}
                <div className="flex-1 relative overflow-hidden">
                    <ScrollArea className="h-full w-full">
                        <div className="p-6">
                            <div className="overflow-hidden border border-black/[0.05] rounded-2xl bg-white shadow-xl shadow-slate-200/50">
                                <table className="min-w-full divide-y divide-black/[0.03]">
                                    <thead className="bg-slate-50/80 sticky top-0 z-10 backdrop-blur-md border-b border-black/[0.03]">
                                        <tr className="divide-x divide-black/[0.03]">
                                            <th className="w-10 px-4 py-3 text-left">
                                                <div className="w-3.5 h-3.5 border border-slate-200 rounded-sm" />
                                            </th>
                                            <th className="px-4 py-3 text-left text-[8px] font-black text-slate-400 uppercase tracking-widest">Name & Path</th>
                                            <th className="w-24 px-4 py-3 text-right text-[8px] font-black text-slate-400 uppercase tracking-widest">Size</th>
                                            <th className="w-24 px-4 py-3 text-center text-[8px] font-black text-slate-400 uppercase tracking-widest">Modified</th>
                                            <th className="w-16 px-4 py-3 text-center text-[8px] font-black text-slate-400 uppercase tracking-widest">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-black/[0.02]">
                                        {scanResults.groups.map((group, idx) => (
                                            <React.Fragment key={idx}>
                                                <tr className="bg-primary/[0.02]">
                                                    <td colSpan={5} className="px-4 py-2">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-5 h-5 bg-primary/10 rounded-md flex items-center justify-center text-primary/60 border border-primary/20">
                                                                <FolderClosed className="w-2.5 h-2.5" />
                                                            </div>
                                                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-primary/50 italic">
                                                                Cluster {idx + 1} &middot; {formatSize(group[0].size)}
                                                            </span>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {group.map((file) => {
                                                    const isChecked = selectionQueue.includes(file.path);
                                                    const isPreviewed = previewFile?.path === file.path;
                                                    const fileName = file.path.split('/').pop() || "unknown";
                                                    const folderPath = file.path.split('/').slice(0, -1).join('/') || "/";

                                                    return (
                                                        <tr
                                                            key={file.path}
                                                            onClick={() => toggleSelection(file.path)}
                                                            className={cn(
                                                                "group transition-colors cursor-pointer hover:bg-slate-50",
                                                                isChecked ? "bg-primary/[0.03]" : "",
                                                                isPreviewed ? "ring-1 ring-inset ring-primary/30 bg-primary/5" : ""
                                                            )}
                                                        >
                                                            <td className="px-4 py-2.5 align-middle">
                                                                <div className={cn(
                                                                    "w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-all",
                                                                    isChecked
                                                                        ? "bg-primary border-primary text-primary-foreground shadow-sm"
                                                                        : "border-slate-200 group-hover:border-primary/40"
                                                                )}>
                                                                    {isChecked && <CheckCircle2 className="w-2.5 h-2.5" />}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-2.5">
                                                                <div className="flex flex-col min-w-0">
                                                                    <span className={cn(
                                                                        "text-[11px] font-bold tracking-tight truncate max-w-[350px]",
                                                                        isChecked ? "text-primary" : "text-slate-900"
                                                                    )}>{fileName}</span>
                                                                    <span className="text-[8px] text-slate-400 font-medium truncate max-w-[450px]">
                                                                        {folderPath}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-2.5 text-right align-middle">
                                                                <span className="text-[10px] font-black tabular-nums text-slate-400 italic">
                                                                    {formatSize(file.size)}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-2.5 text-center align-middle">
                                                                <span className="text-[9px] font-bold tabular-nums text-slate-300">
                                                                    {new Date(file.modified * 1000).toLocaleDateString()}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-2.5 text-center align-middle">
                                                                <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    {isMedia(file.path) && (
                                                                        <button
                                                                            onClick={(e) => handlePreview(e, file)}
                                                                            className={cn(
                                                                                "w-6 h-6 rounded-md flex items-center justify-center transition-all",
                                                                                isPreviewed ? "bg-primary text-white" : "hover:bg-primary/10 text-primary/60 hover:text-primary"
                                                                            )}
                                                                        >
                                                                            <Eye className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        onClick={(e) => handleReveal(e, file.path)}
                                                                        className="w-6 h-6 rounded-md hover:bg-primary/10 flex items-center justify-center text-primary/60 hover:text-primary transition-all"
                                                                    >
                                                                        <ExternalLink className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="h-60" /> {/* Large buffer for footer room */}
                        </div>
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
