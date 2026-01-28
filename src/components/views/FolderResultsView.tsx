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
                            <AccordionTrigger className="px-5 py-4 hover:no-underline bg-zinc-900 hover:bg-zinc-800 transition-colors group/trigger border-b border-white/5 relative overflow-hidden">
                                <div className="flex items-center gap-4 text-left w-full min-w-0 pr-4">
                                    <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white border border-white/10 shrink-0">
                                        <Folder className="w-5 h-5" />
                                    </div>
                                    <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
                                        <div className="flex items-center gap-3 mb-1.5 w-full">
                                            <h3 className="text-sm font-black text-white truncate font-mono">
                                                {folder.folderPath.split('/').pop()}
                                            </h3>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={(e) => handleReveal(e, folder.folderPath)}
                                                className="h-5 w-5 text-white/40 hover:text-white hover:bg-white/10 rounded-md transition-colors shrink-0"
                                                title="Reveal in Finder"
                                            >
                                                <ExternalLink className="w-3 h-3" />
                                            </Button>
                                        </div>
                                        <div className="flex items-center gap-3 overflow-hidden w-full">
                                            <span className="text-[10px] text-white/40 font-medium truncate shrink min-w-0 font-mono opacity-60" title={folder.folderPath}>
                                                {folder.folderPath}
                                            </span>
                                            <div className="w-px h-3 bg-white/10 shrink-0" />
                                            <Badge variant="secondary" className="h-4 bg-amber-500/10 text-amber-500 border-amber-500/20 font-bold text-[9px] items-center gap-1 px-1.5 hover:bg-amber-500/20 shrink-0">
                                                {formatSize(folder.totalSize)}
                                            </Badge>
                                            <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest opacity-60 whitespace-nowrap shrink-0">
                                                {folder.duplicateSets.length} Sets
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
                                                "h-8 px-3 text-[10px] font-black uppercase tracking-widest transition-all border shrink-0 whitespace-nowrap",
                                                hasSelection
                                                    ? "bg-white text-slate-900 hover:bg-white/90 border-white"
                                                    : "bg-white/10 text-white/60 hover:text-white hover:bg-emerald-600 border-white/5 hover:border-emerald-500/50"
                                            )}
                                        >
                                            {hasSelection ? (
                                                <>
                                                    <X className="w-3.5 h-3.5 mr-2" />
                                                    Unselect All
                                                </>
                                            ) : (
                                                <>
                                                    <Trash2 className="w-3.5 h-3.5 mr-2" />
                                                    Mark Duplicates
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
                                                            "pl-12 pr-6 py-3 flex items-center justify-between cursor-pointer group/file transition-all",
                                                            isChecked ? "bg-emerald-500/10 hover:bg-emerald-500/20" : "hover:bg-white/[0.02]",
                                                            isFocused ? "ring-2 ring-emerald-500 ring-inset z-10" : ""
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-4 overflow-hidden">
                                                            <div
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    toggleSelection(file.path);
                                                                    setFocusedIndex(currentIndex);
                                                                }}
                                                                className={cn(
                                                                    "w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-all cursor-pointer hover:scale-110 active:scale-95",
                                                                    isChecked
                                                                        ? "bg-emerald-500 border-emerald-600 text-white shadow-sm"
                                                                        : "border-slate-200 hover:border-emerald-400/40"
                                                                )}>
                                                                {isChecked && <CheckCircle2 className="w-3 h-3" />}
                                                            </div>
                                                            <div className="flex flex-col min-w-0">
                                                                <span className={cn(
                                                                    "text-[11px] font-bold truncate max-w-[400px]",
                                                                    isChecked ? "text-emerald-700" : "text-slate-900"
                                                                )}>
                                                                    {fileName}
                                                                </span>
                                                                <span className={cn(
                                                                    "text-[9px] font-medium tabular-nums",
                                                                    isChecked ? "text-emerald-500/40" : "text-white/40"
                                                                )}>
                                                                    {formatSize(file.size)} &middot; {new Date(file.modified * 1000).toLocaleDateString()}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div className="flex gap-2 opacity-0 group-hover/file:opacity-100 transition-opacity">
                                                            {isMedia(file.path) && (
                                                                <button
                                                                    onClick={(e) => handlePreview(e, file)}
                                                                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-emerald-500/10 text-emerald-600/60 hover:text-emerald-600 cursor-pointer"
                                                                    title="Preview File"
                                                                >
                                                                    <Eye className="w-3.5 h-3.5" />
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={(e) => handleReveal(e, file.path)}
                                                                className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-emerald-500/10 text-emerald-600/60 hover:text-emerald-600 cursor-pointer"
                                                                title="Reveal in Finder"
                                                            >
                                                                <ExternalLink className="w-3.5 h-3.5" />
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
