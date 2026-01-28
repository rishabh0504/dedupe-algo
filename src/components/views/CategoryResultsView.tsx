import React, { useMemo } from "react";
import { FileMetadata } from "../../store/useStore";
import { formatSize, cn } from "../../lib/utils";
import {
    CheckCircle2,
    Eye,
    ExternalLink,
    FileImage,
    FileVideo,
    FileText,
    FileArchive,
    File
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { invoke } from "@tauri-apps/api/core";

interface CategoryResultsViewProps {
    scanResults: { groups: FileMetadata[][] };
    selectionQueue: string[];
    toggleSelection: (path: string) => void;
    handlePreview: (e: React.MouseEvent, file: FileMetadata) => void;
    isMedia: (path: string) => boolean;
}

type CategoryType = 'Images' | 'Videos' | 'Documents' | 'Archives' | 'Others';

export const CategoryResultsView: React.FC<CategoryResultsViewProps> = ({
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

    /**
     * Grouping Logic:
     * Flatten all clusters, then categorize by extension.
     */
    const categoryGroups = useMemo(() => {
        if (!scanResults) return [];

        const groups: Record<CategoryType, { files: FileMetadata[], totalSize: number, count: number }> = {
            Images: { files: [], totalSize: 0, count: 0 },
            Videos: { files: [], totalSize: 0, count: 0 },
            Documents: { files: [], totalSize: 0, count: 0 },
            Archives: { files: [], totalSize: 0, count: 0 },
            Others: { files: [], totalSize: 0, count: 0 },
        };

        const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'tiff'];
        const videoExts = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv'];
        const docExts = ['pdf', 'doc', 'docx', 'txt', 'md', 'rtf', 'xls', 'xlsx', 'ppt', 'pptx'];
        const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz', 'iso', 'dmg'];

        scanResults.groups.forEach(cluster => {
            // We only care about duplicate files, but here we list ALL files in the cluster?
            // "Category View: Group by Images, Videos or Docs. Cleaning up specific media types."
            // This view usually lists all duplicates found, categorized.

            cluster.forEach(file => {
                const ext = file.path.split('.').pop()?.toLowerCase() || "";
                let category: CategoryType = 'Others';

                if (imageExts.includes(ext)) category = 'Images';
                else if (videoExts.includes(ext)) category = 'Videos';
                else if (docExts.includes(ext)) category = 'Documents';
                else if (archiveExts.includes(ext)) category = 'Archives';

                groups[category].files.push(file);
                groups[category].totalSize += file.size;
                groups[category].count++;
            });
        });

        // Filter out empty categories
        return Object.entries(groups)
            .filter(([_, data]) => data.count > 0)
            .map(([name, data]) => ({
                name: name as CategoryType,
                ...data,
                // Sort files by size descending
                files: data.files.sort((a, b) => b.size - a.size)
            }))
            .sort((a, b) => b.totalSize - a.totalSize);

    }, [scanResults]);

    const getIcon = (category: CategoryType) => {
        switch (category) {
            case 'Images': return <FileImage className="w-5 h-5 text-purple-500" />;
            case 'Videos': return <FileVideo className="w-5 h-5 text-blue-500" />;
            case 'Documents': return <FileText className="w-5 h-5 text-orange-500" />;
            case 'Archives': return <FileArchive className="w-5 h-5 text-slate-500" />;
            default: return <File className="w-5 h-5 text-gray-400" />;
        }
    };

    return (
        <div className="space-y-6">
            {categoryGroups.map((category) => (
                <div key={category.name} className="bg-white rounded-2xl border border-black/[0.05] overflow-hidden shadow-sm shadow-slate-200/50">
                    {/* Category Header */}
                    <div className="bg-slate-900 px-5 py-4 border-b border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-white/10 rounded-xl border border-white/10 flex items-center justify-center shrink-0">
                                {getIcon(category.name)}
                            </div>
                            <div className="flex flex-col">
                                <h3 className="text-sm font-black text-white tracking-tight uppercase font-mono">
                                    {category.name}
                                </h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="secondary" className="h-4 px-1.5 text-[9px] font-bold bg-amber-500/10 text-amber-500 border-amber-500/20">
                                        {category.count} Files
                                    </Badge>
                                    <span className="text-[10px] font-bold text-white/40 tabular-nums">
                                        {formatSize(category.totalSize)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* File List Grid for Media? Or List? Let's stick to List for consistency with other views first */}
                    <div className="divide-y divide-black/[0.03]">
                        {category.files.map((file) => {
                            const isChecked = selectionQueue.includes(file.path);
                            const fileName = file.path.split('/').pop() || "unknown";
                            const folderPath = file.path.split('/').slice(0, -1).join('/') || "/";

                            return (
                                <div
                                    key={file.path}
                                    onClick={(e) => handlePreview(e, file)}
                                    className={cn(
                                        "px-5 py-3 flex items-center justify-between cursor-pointer group/file hover:bg-slate-50 transition-colors",
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
                                            <span className="text-[9px] font-medium text-slate-400 truncate max-w-[500px]">
                                                {folderPath}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <span className="text-[9px] font-bold text-slate-400 tabular-nums">
                                            {formatSize(file.size)}
                                        </span>

                                        <div className="flex gap-2 opacity-0 group-hover/file:opacity-100 transition-opacity w-16 justify-end">
                                            {isMedia(file.path) && (
                                                <button
                                                    onClick={(e) => handlePreview(e, file)}
                                                    className="w-6 h-6 rounded-md flex items-center justify-center transition-all hover:bg-primary/10 text-primary/60 hover:text-primary"
                                                    title="Preview File"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                            <button
                                                onClick={(e) => handleReveal(e, file.path)}
                                                className="w-6 h-6 rounded-md flex items-center justify-center transition-all hover:bg-primary/10 text-primary/60 hover:text-primary"
                                                title="Reveal in Finder"
                                            >
                                                <ExternalLink className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
};
