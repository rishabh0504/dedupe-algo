import React from "react";
import { FileMetadata } from "../../store/useStore";
import { formatSize, cn } from "../../lib/utils";
import {
    CheckCircle2,
    FolderClosed,
    Eye,
    ExternalLink,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

interface ClusterResultsViewProps {
    scanResults: { groups: FileMetadata[][] };
    selectedSet: Set<string>;
    toggleSelection: (path: string) => void;
    handlePreview: (e: React.MouseEvent, file: FileMetadata) => void;
    isMedia: (path: string) => boolean;
}

export const ClusterResultsView: React.FC<ClusterResultsViewProps> = React.memo(({
    scanResults,
    selectedSet,
    toggleSelection,
    handlePreview,
    isMedia,
}) => {
    const [focusedIndex, setFocusedIndex] = React.useState<number>(-1);

    // Flatten all files across all groups for linear keyboard navigation
    const allFiles = React.useMemo(() => {
        return scanResults.groups.flatMap(group => group);
    }, [scanResults]);

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

    // Scroll focused element into view
    React.useEffect(() => {
        if (focusedIndex >= 0 && allFiles[focusedIndex]) {
            const element = document.getElementById(`file-${allFiles[focusedIndex].path}`);
            element?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
    }, [focusedIndex, allFiles]);

    const handleReveal = async (e: React.MouseEvent, path: string) => {
        e.stopPropagation();
        await invoke("reveal_in_finder", { path });
    };

    let globalFileIndex = 0;

    return (
        <div className="overflow-hidden border border-black/[0.05] rounded-2xl bg-white shadow-xl shadow-slate-200/50">
            <table className="min-w-full divide-y divide-black/[0.03]">
                <thead className="bg-slate-900 sticky top-0 z-10 backdrop-blur-md border-b border-white/5">
                    <tr className="divide-x divide-white/5">
                        <th className="w-10 px-5 py-3 text-left">
                            <div className="w-3.5 h-3.5 border border-white/20 rounded-sm" />
                        </th>
                        <th className="px-5 py-3 text-left text-[8px] font-black text-white/40 uppercase tracking-widest">Name & Path</th>
                        <th className="w-24 px-5 py-3 text-right text-[8px] font-black text-white/40 uppercase tracking-widest">Size</th>
                        <th className="w-24 px-5 py-3 text-center text-[8px] font-black text-white/40 uppercase tracking-widest">Modified</th>
                        <th className="w-16 px-5 py-3 text-center text-[8px] font-black text-white/40 uppercase tracking-widest">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.02]">
                    {scanResults.groups.map((group, idx) => (
                        <React.Fragment key={idx}>
                            <tr className="bg-slate-800/50">
                                <td colSpan={5} className="px-5 py-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 bg-white/10 rounded-md flex items-center justify-center text-white/60 border border-white/10">
                                            <FolderClosed className="w-2.5 h-2.5" />
                                        </div>
                                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40 italic">
                                            Cluster {idx + 1} &middot; {formatSize(group[0].size)}
                                        </span>
                                    </div>
                                </td>
                            </tr>
                            {group.map((file) => {
                                const currentIndex = globalFileIndex++;
                                const isFocused = focusedIndex === currentIndex;
                                const isChecked = selectedSet.has(file.path);
                                const fileName = file.path.split('/').pop() || "unknown";
                                const folderPath = file.path.split('/').slice(0, -1).join('/') || "/";

                                return (
                                    <tr
                                        key={file.path}
                                        id={`file-${file.path}`}
                                        onClick={(e) => {
                                            handlePreview(e, file);
                                            setFocusedIndex(currentIndex);
                                        }}
                                        className={cn(
                                            "group transition-all cursor-pointer",
                                            isChecked ? "bg-emerald-50 hover:bg-emerald-100/80" : "hover:bg-slate-50",
                                            isFocused ? "ring-2 ring-emerald-500 ring-inset z-10" : ""
                                        )}
                                    >
                                        <td className="px-5 py-2.5 align-middle">
                                            <div
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleSelection(file.path);
                                                    setFocusedIndex(currentIndex);
                                                }}
                                                className={cn(
                                                    "w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-all cursor-pointer hover:scale-110 active:scale-95",
                                                    isChecked
                                                        ? "bg-emerald-500 border-emerald-600 text-white shadow-sm"
                                                        : "border-slate-200 group-hover:border-emerald-400/40"
                                                )}>
                                                {isChecked && <CheckCircle2 className="w-2.5 h-2.5" />}
                                            </div>
                                        </td>
                                        <td className="px-5 py-2.5">
                                            <div className="flex flex-col min-w-0">
                                                <span className={cn(
                                                    "text-[11px] font-bold tracking-tight truncate max-w-[350px]",
                                                    isChecked ? "text-emerald-700" : "text-slate-900"
                                                )}>{fileName}</span>
                                                <span className={cn(
                                                    "text-[8px] font-medium truncate max-w-[450px]",
                                                    isChecked ? "text-emerald-600/60" : "text-slate-400"
                                                )}>
                                                    {folderPath}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-2.5 text-right align-middle">
                                            <span className={cn(
                                                "text-[10px] font-black tabular-nums italic",
                                                isChecked ? "text-emerald-600/50" : "text-slate-400"
                                            )}>
                                                {formatSize(file.size)}
                                            </span>
                                        </td>
                                        <td className="px-5 py-2.5 text-center align-middle">
                                            <span className={cn(
                                                "text-[9px] font-bold tabular-nums",
                                                isChecked ? "text-emerald-600/40" : "text-slate-300"
                                            )}>
                                                {new Date(file.modified * 1000).toLocaleDateString()}
                                            </span>
                                        </td>
                                        <td className="px-5 py-2.5 text-center align-middle">
                                            <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {isMedia(file.path) && (
                                                    <button
                                                        onClick={(e) => handlePreview(e, file)}
                                                        className="w-6 h-6 rounded-md flex items-center justify-center transition-all hover:bg-emerald-500/10 text-emerald-600/60 hover:text-emerald-600"
                                                    >
                                                        <Eye className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={(e) => handleReveal(e, file.path)}
                                                    className="w-6 h-6 rounded-md hover:bg-emerald-500/10 flex items-center justify-center text-emerald-600/60 hover:text-emerald-600 transition-all"
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
    );
});
