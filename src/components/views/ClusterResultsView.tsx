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
    selectionQueue: string[];
    toggleSelection: (path: string) => void;
    handlePreview: (e: React.MouseEvent, file: FileMetadata) => void;
    isMedia: (path: string) => boolean;
}

export const ClusterResultsView: React.FC<ClusterResultsViewProps> = ({
    scanResults,
    selectionQueue,
    toggleSelection,
    handlePreview,
    isMedia,
}) => {

    // Independent helper to keep it self-contained or passed props? 
    // Passed props is better but reveal is simple enough to duplicate or pass. 
    // Let's pass it or redefine it. Redefining small handlers is fine for decoupling.
    const handleReveal = async (e: React.MouseEvent, path: string) => {
        e.stopPropagation();
        await invoke("reveal_in_finder", { path });
    };

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
                                const isChecked = selectionQueue.includes(file.path);
                                const fileName = file.path.split('/').pop() || "unknown";
                                const folderPath = file.path.split('/').slice(0, -1).join('/') || "/";

                                return (
                                    <tr
                                        key={file.path}
                                        onClick={(e) => handlePreview(e, file)}
                                        className={cn(
                                            "group transition-colors cursor-pointer hover:bg-slate-50",
                                            isChecked ? "bg-primary/[0.03]" : "",
                                        )}
                                    >
                                        <td className="px-5 py-2.5 align-middle">
                                            <div
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleSelection(file.path);
                                                }}
                                                className={cn(
                                                    "w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-all cursor-pointer hover:scale-110 active:scale-95",
                                                    isChecked
                                                        ? "bg-primary border-primary text-primary-foreground shadow-sm"
                                                        : "border-slate-200 group-hover:border-primary/40"
                                                )}>
                                                {isChecked && <CheckCircle2 className="w-2.5 h-2.5" />}
                                            </div>
                                        </td>
                                        <td className="px-5 py-2.5">
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
                                        <td className="px-5 py-2.5 text-right align-middle">
                                            <span className="text-[10px] font-black tabular-nums text-slate-400 italic">
                                                {formatSize(file.size)}
                                            </span>
                                        </td>
                                        <td className="px-5 py-2.5 text-center align-middle">
                                            <span className="text-[9px] font-bold tabular-nums text-slate-300">
                                                {new Date(file.modified * 1000).toLocaleDateString()}
                                            </span>
                                        </td>
                                        <td className="px-5 py-2.5 text-center align-middle">
                                            <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {isMedia(file.path) && (
                                                    <button
                                                        onClick={(e) => handlePreview(e, file)}
                                                        className="w-6 h-6 rounded-md flex items-center justify-center transition-all hover:bg-primary/10 text-primary/60 hover:text-primary"
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
    );
};
