import React from "react";
import { FileMetadata } from "../../store/useStore";
import { formatSize, cn } from "../../lib/utils";
import { CheckCircle2, Eye, ExternalLink, Folder, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { invoke } from "@tauri-apps/api/core";
import { FolderData } from "../../lib/dataTransform";

interface FolderResultsViewProps {
    folderData: FolderData[];
    selectedSet: Set<string>;
    toggleSelection: (path: string) => void;
    handlePreview: (e: React.MouseEvent, file: FileMetadata) => void;
    isMedia: (path: string) => boolean;
}


export const FolderResultsView: React.FC<FolderResultsViewProps> = React.memo(({
    folderData,
    selectedSet,
    toggleSelection,
    handlePreview,
    isMedia,
}) => {
    const [focusedIndex, setFocusedIndex] = React.useState<number>(-1);
    const [expandedFolders, setExpandedFolders] = React.useState<string[]>([]);

    const handleReveal = async (e: React.MouseEvent, path: string) => {
        e.stopPropagation();
        await invoke("reveal_in_finder", { path });
    };

    const allFiles = React.useMemo(() => {
        return folderData.flatMap(folder => folder.duplicateSets.flatMap(set => set.files));
    }, [folderData]);

    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setFocusedIndex(prev => Math.min(prev + 1, allFiles.length - 1));
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setFocusedIndex(prev => Math.max(prev - 1, 0));
            } else if (e.key === "Enter" || e.key === " ") {
                if (focusedIndex >= 0 && focusedIndex < allFiles.length) {
                    toggleSelection(allFiles[focusedIndex].path);
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [allFiles, focusedIndex, toggleSelection]);

    React.useEffect(() => {
        if (focusedIndex >= 0 && allFiles[focusedIndex]) {
            const focusedFile = allFiles[focusedIndex];
            const parentDir = focusedFile.path.split('/').slice(0, -1).join('/') || "/";
            const folderIdx = folderData.findIndex(g => g.folderPath === parentDir);

            if (folderIdx !== -1) {
                const folderId = `folder-${folderIdx}`;
                if (!expandedFolders.includes(folderId)) {
                    setExpandedFolders(prev => [...prev, folderId]);
                }
            }

            const element = document.getElementById(`folder-file-${focusedFile.path}`);
            element?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
    }, [focusedIndex, allFiles, folderData]);

    let globalFileCounter = 0;

    return (
        <div className="w-full space-y-2">
            <Accordion
                type="multiple"
                className="w-full space-y-4"
                value={expandedFolders}
                onValueChange={setExpandedFolders}
            >
                {folderData.map((folder, idx) => {
                    const folderId = `folder-${idx}`;
                    const hasSelection = folder.duplicateSets.some(set =>
                        set.files.some(f => selectedSet.has(f.path))
                    );

                    return (
                        <AccordionItem
                            key={idx}
                            value={folderId}
                            className="border border-white/5 rounded-2xl bg-[#0c0c0c] shadow-2xl overflow-hidden px-0"
                        >
                            <AccordionTrigger className="px-5 py-5 hover:no-underline bg-zinc-900/50 hover:bg-zinc-800/80 transition-all group/trigger border-b border-white/5 relative overflow-hidden backdrop-blur-sm">
                                <div className="flex items-center gap-5 text-left w-full min-w-0 pr-4">
                                    <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary border border-primary/20 shrink-0 shadow-lg group-hover/trigger:scale-110 transition-transform">
                                        <Folder className="w-6 h-6" />
                                    </div>
                                    <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
                                        <div className="flex items-center gap-3 mb-2 w-full">
                                            <h3 className="text-base font-black text-white truncate tracking-tight uppercase italic group-hover/trigger:text-primary transition-colors">
                                                {folder.folderPath.split('/').pop()}
                                            </h3>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={(e) => handleReveal(e, folder.folderPath)}
                                                className="h-6 w-6 text-white/20 hover:text-primary hover:bg-primary/10 rounded-lg transition-all shrink-0"
                                                title="Reveal in Finder"
                                            >
                                                <ExternalLink className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                        <div className="flex items-center gap-3 overflow-hidden w-full">
                                            <span className="text-[10px] text-white/30 font-bold truncate shrink min-w-0 font-mono tracking-wider" title={folder.folderPath}>
                                                {folder.folderPath}
                                            </span>
                                            <div className="w-1 h-1 rounded-full bg-white/10 shrink-0" />
                                            <Badge variant="secondary" className="glass h-5 bg-amber-500/10 text-amber-500 border-amber-500/20 font-black text-[9px] items-center gap-1 px-2 hover:bg-amber-500/20 shrink-0 uppercase tracking-widest">
                                                {formatSize(folder.totalSize)}
                                            </Badge>
                                            <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] whitespace-nowrap shrink-0 italic">
                                                {folder.duplicateSets.length} Sets Detected
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 opacity-100 transition-opacity shrink-0 ml-4 relative z-10" onClick={e => e.stopPropagation()}>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (hasSelection) {
                                                    folder.duplicateSets.forEach(set => {
                                                        set.files.forEach(f => {
                                                            if (selectedSet.has(f.path)) {
                                                                toggleSelection(f.path);
                                                            }
                                                        });
                                                    });
                                                } else {
                                                    folder.duplicateSets.forEach(set => {
                                                        const sorted = [...set.files].sort((a, b) => {
                                                            if (a.modified !== b.modified) return a.modified - b.modified;
                                                            return a.path.length - b.path.length;
                                                        });
                                                        for (let i = 1; i < sorted.length; i++) {
                                                            const f = sorted[i];
                                                            if (!selectedSet.has(f.path)) {
                                                                toggleSelection(f.path);
                                                            }
                                                        }
                                                    });
                                                }
                                            }}
                                            className={cn(
                                                "h-10 px-5 text-[10px] font-black uppercase tracking-[0.1em] transition-all border shrink-0 whitespace-nowrap rounded-xl shadow-lg",
                                                hasSelection
                                                    ? "bg-white text-slate-900 hover:bg-white/90 border-white"
                                                    : "glass bg-primary/10 text-primary hover:text-black hover:bg-primary border-primary/20 hover:border-primary"
                                            )}
                                        >
                                            {hasSelection ? (
                                                <>
                                                    <X className="w-4 h-4 mr-2" />
                                                    Unselect All
                                                </>
                                            ) : (
                                                <>
                                                    <Trash2 className="w-4 h-4 mr-2" />
                                                    Auto-Mark Duplicates
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </AccordionTrigger>

                            <AccordionContent className="pb-0 border-t border-white/5">
                                <div className="divide-y divide-white/5">
                                    {folder.duplicateSets.map((set, sIdx) => (
                                        <div key={sIdx} className="bg-[#0c0c0c]">
                                            {folder.duplicateSets.length > 1 && (
                                                <div className="pl-12 pr-6 py-1.5 bg-white/[0.02] text-[9px] font-black uppercase tracking-widest text-white/20 border-b border-white/5">
                                                    Duplicate Set {sIdx + 1}
                                                </div>
                                            )}

                                            {set.files.map((file) => {
                                                const currentIndex = globalFileCounter++;
                                                const isFocused = focusedIndex === currentIndex;
                                                const isChecked = selectedSet.has(file.path);
                                                const fileName = file.path.split('/').pop() || "unknown";

                                                return (
                                                    <div
                                                        key={file.path}
                                                        id={`folder-file-${file.path}`}
                                                        onClick={(e) => {
                                                            handlePreview(e, file);
                                                            setFocusedIndex(currentIndex);
                                                        }}
                                                        className={cn(
                                                            "pl-12 pr-6 py-4 flex items-center justify-between cursor-pointer group/file transition-all relative",
                                                            isChecked ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-white/[0.04]",
                                                            isFocused ? "bg-white/5" : ""
                                                        )}
                                                    >
                                                        {isFocused && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary shadow-[0_0_15px_rgba(74,222,220,0.5)]" />}

                                                        <div className="flex items-center gap-5 overflow-hidden">
                                                            <div
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    toggleSelection(file.path);
                                                                    setFocusedIndex(currentIndex);
                                                                }}
                                                                className={cn(
                                                                    "w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 transition-all cursor-pointer hover:scale-110 active:scale-95",
                                                                    isChecked
                                                                        ? "bg-primary border-primary text-black shadow-[0_0_15px_rgba(74,222,220,0.4)]"
                                                                        : "border-white/20 hover:border-primary/50"
                                                                )}>
                                                                {isChecked && <CheckCircle2 className="w-3.5 h-3.5" />}
                                                            </div>
                                                            <div className="flex flex-col min-w-0">
                                                                <span className={cn(
                                                                    "text-xs font-bold truncate max-w-[500px] transition-colors",
                                                                    isChecked ? "text-primary" : "text-white/80 group-hover/file:text-white"
                                                                )}>
                                                                    {fileName}
                                                                </span>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <span className={cn(
                                                                        "text-[10px] font-black tracking-widest uppercase italic",
                                                                        isChecked ? "text-primary/50" : "text-white/20"
                                                                    )}>
                                                                        {formatSize(file.size)}
                                                                    </span>
                                                                    <div className="w-1 h-1 rounded-full bg-white/5" />
                                                                    <span className={cn(
                                                                        "text-[10px] font-medium font-mono",
                                                                        isChecked ? "text-primary/30" : "text-white/10"
                                                                    )}>
                                                                        {new Date(file.modified * 1000).toLocaleDateString()}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex gap-2 opacity-0 group-hover/file:opacity-100 transition-all transform translate-x-2 group-hover/file:translate-x-0">
                                                            {isMedia(file.path) && (
                                                                <button
                                                                    onClick={(e) => handlePreview(e, file)}
                                                                    className="w-8 h-8 rounded-xl flex items-center justify-center transition-all bg-white/5 hover:bg-primary/20 text-white/40 hover:text-primary cursor-pointer border border-white/5 hover:border-primary/20"
                                                                    title="Preview File"
                                                                >
                                                                    <Eye className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={(e) => handleReveal(e, file.path)}
                                                                className="w-8 h-8 rounded-xl flex items-center justify-center transition-all bg-white/5 hover:bg-primary/20 text-white/40 hover:text-primary cursor-pointer border border-white/5 hover:border-primary/20"
                                                                title="Reveal in Finder"
                                                            >
                                                                <ExternalLink className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    );
                })}
            </Accordion>
        </div>
    );
});
