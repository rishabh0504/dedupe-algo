import React, { useMemo } from "react";
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

interface FolderResultsViewProps {
    scanResults: { groups: FileMetadata[][] };
    selectionQueue: string[];
    toggleSelection: (path: string) => void;
    handlePreview: (e: React.MouseEvent, file: FileMetadata) => void;
    isMedia: (path: string) => boolean;
}

interface NestedFolderGroup {
    folderPath: string;
    totalSize: number;
    duplicateSets: {
        hash: string;
        files: FileMetadata[];
    }[];
}

export const FolderResultsView: React.FC<FolderResultsViewProps> = ({
    scanResults,
    selectionQueue,
    toggleSelection,
    handlePreview,
    isMedia,
}) => {

    const handleReveal = async (e: React.MouseEvent, path: string) => {
        e.stopPropagation();
        await invoke("reveal_in_finder", { path });
    };

    const resultGroups = useMemo(() => {
        if (!scanResults) return [];

        const folderMap = new Map<string, NestedFolderGroup>();

        scanResults.groups.forEach((group, groupIndex) => {
            const clusterId = `cluster-${groupIndex}`;
            group.forEach(file => {
                const parentDir = file.path.split('/').slice(0, -1).join('/') || "/";
                if (!folderMap.has(parentDir)) {
                    folderMap.set(parentDir, {
                        folderPath: parentDir,
                        totalSize: 0,
                        duplicateSets: []
                    });
                }
                const folderEntry = folderMap.get(parentDir)!;
                let setEntry = folderEntry.duplicateSets.find(s => s.hash === clusterId);
                if (!setEntry) {
                    setEntry = { hash: clusterId, files: [] };
                    folderEntry.duplicateSets.push(setEntry);
                }
                if (!setEntry.files.some(f => f.path === file.path)) {
                    setEntry.files.push(file);
                    folderEntry.totalSize += file.size;
                }
            });
        });

        // Filter: Only keep folders that have > 1 file in a set (intra-folder strictness)
        return Array.from(folderMap.values())
            .map(folder => ({
                ...folder,
                duplicateSets: folder.duplicateSets.filter(set => set.files.length > 1)
            }))
            .filter(folder => folder.duplicateSets.length > 0)
            .sort((a, b) => b.totalSize - a.totalSize);

    }, [scanResults]);

    return (
        <div className="w-full space-y-2">
            <Accordion type="multiple" className="w-full space-y-4">
                {resultGroups.map((folder, idx) => {
                    // Check if any file in this entire folder is currently selected
                    const hasSelection = folder.duplicateSets.some(set =>
                        set.files.some(f => selectionQueue.includes(f.path))
                    );

                    return (
                        <AccordionItem
                            key={idx}
                            value={`folder-${idx}`}
                            className="border border-black/[0.05] rounded-2xl bg-white shadow-sm shadow-slate-200/50 overflow-hidden px-0"
                        >
                            <AccordionTrigger className="px-5 py-4 hover:no-underline bg-slate-900 hover:bg-slate-800 transition-colors group/trigger border-b border-white/5 relative overflow-hidden">
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
                                                    // USAGE: Unselect ALL files in this folder
                                                    folder.duplicateSets.forEach(set => {
                                                        set.files.forEach(f => {
                                                            if (selectionQueue.includes(f.path)) {
                                                                toggleSelection(f.path);
                                                            }
                                                        });
                                                    });
                                                } else {
                                                    // USAGE: Smart Select Logic
                                                    folder.duplicateSets.forEach(set => {
                                                        const sorted = [...set.files].sort((a, b) => {
                                                            if (a.modified !== b.modified) return a.modified - b.modified;
                                                            return a.path.length - b.path.length;
                                                        });
                                                        for (let i = 1; i < sorted.length; i++) {
                                                            const f = sorted[i];
                                                            if (!selectionQueue.includes(f.path)) {
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
                                                    : "bg-white/10 text-white/60 hover:text-white hover:bg-destructive border-white/5 hover:border-destructive/50"
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


                            <AccordionContent className="pb-0 border-t border-black/[0.03]">
                                <div className="divide-y divide-black/[0.03]">
                                    {folder.duplicateSets.map((set, sIdx) => (
                                        <div key={sIdx} className="bg-white">
                                            {/* Inner Set Header if needed, or just list files */}
                                            {folder.duplicateSets.length > 1 && (
                                                <div className="pl-12 pr-6 py-1.5 bg-slate-50/50 text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-black/[0.02]">
                                                    Duplicate Set {sIdx + 1}
                                                </div>
                                            )}

                                            {set.files.map((file) => {
                                                const isChecked = selectionQueue.includes(file.path);
                                                const fileName = file.path.split('/').pop() || "unknown";

                                                return (
                                                    <div
                                                        key={file.path}
                                                        onClick={(e) => handlePreview(e, file)}
                                                        className={cn(
                                                            "pl-12 pr-6 py-3 flex items-center justify-between cursor-pointer group/file hover:bg-slate-50 transition-colors",
                                                            isChecked ? "bg-primary/[0.02]" : ""
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-4 overflow-hidden">
                                                            <div
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    toggleSelection(file.path);
                                                                }}
                                                                className={cn(
                                                                    "w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-all cursor-pointer hover:scale-110 active:scale-95",
                                                                    isChecked
                                                                        ? "bg-primary border-primary text-primary-foreground shadow-sm"
                                                                        : "border-slate-200 hover:border-primary/40"
                                                                )}>
                                                                {isChecked && <CheckCircle2 className="w-3 h-3" />}
                                                            </div>
                                                            <div className="flex flex-col min-w-0">
                                                                <span className={cn(
                                                                    "text-[11px] font-bold truncate max-w-[400px]",
                                                                    isChecked ? "text-primary" : "text-slate-900"
                                                                )}>
                                                                    {fileName}
                                                                </span>
                                                                <span className="text-[9px] font-medium text-slate-400 tabular-nums">
                                                                    {formatSize(file.size)} &middot; {new Date(file.modified * 1000).toLocaleDateString()}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div className="flex gap-2 opacity-0 group-hover/file:opacity-100 transition-opacity">
                                                            {isMedia(file.path) && (
                                                                <button
                                                                    onClick={(e) => handlePreview(e, file)}
                                                                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-primary/10 text-primary/60 hover:text-primary"
                                                                    title="Preview File"
                                                                >
                                                                    <Eye className="w-3.5 h-3.5" />
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={(e) => handleReveal(e, file.path)}
                                                                className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-primary/10 text-primary/60 hover:text-primary"
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
};
