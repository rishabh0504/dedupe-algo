import { useStore } from "../store/useStore";
import { formatSize } from "../lib/utils";
import {
    Trash2,
    Loader2,
    ShieldAlert
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useState, useMemo } from "react";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function DeleteConfirmation({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const { selectionQueue, scanResults, removeDeletedFromResults } = useStore();
    const [isDeleting, setIsDeleting] = useState(false);

    const { totalSize, categories, previewFiles } = useMemo(() => {
        let size = 0;
        const cats = {
            Images: 0,
            Videos: 0,
            Documents: 0,
            Archives: 0,
            Others: 0
        };
        const allFiles: any[] = [];

        if (scanResults) {
            selectionQueue.forEach(path => {
                for (const group of scanResults.groups) {
                    const file = group.find(f => f.path === path);
                    if (file) {
                        size += file.size;
                        allFiles.push(file);
                        const ext = file.path.split('.').pop()?.toLowerCase() || '';
                        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext)) cats.Images++;
                        else if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) cats.Videos++;
                        else if (['pdf', 'docx', 'xlsx', 'txt', 'md'].includes(ext)) cats.Documents++;
                        else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) cats.Archives++;
                        else cats.Others++;
                        break;
                    }
                }
            });
        }

        return {
            totalSize: size,
            categories: Object.entries(cats).filter(([_, count]) => count > 0),
            previewFiles: allFiles.slice(0, 100)
        };
    }, [selectionQueue, scanResults]);

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            const report = await invoke<{ success_count: number; fail_count: number }>("delete_selections", {
                paths: selectionQueue,
            });
            console.log("Deletion Report:", report);

            // Remove successfully deleted files from UI
            removeDeletedFromResults(selectionQueue);
            onClose();
        } catch (error) {
            console.error("Deletion failed:", error);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <AlertDialog open={isOpen} onOpenChange={(open) => !isDeleting && !open && onClose()}>
            <AlertDialogContent className="bg-[#0a0a0a] border-emerald-500/40 !p-0 overflow-hidden !max-w-[850px] !gap-0 !flex !flex-row items-stretch h-[450px]">
                {/* Left Column: Selection Scope */}
                <div className="bg-muted/10 border-r border-white/5 flex flex-col w-[320px] shrink-0 h-full">
                    <div className="p-4 border-b border-white/5 bg-white/[0.02]">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Target Selection</span>
                        <div className="mt-1 text-[9px] font-mono opacity-50 text-destructive">
                            {selectionQueue.length} objects marked for removal
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-none">
                        {previewFiles.length > 0 ? previewFiles.map((file: any, i: number) => (
                            <div key={file.path || i} className="px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5 group hover:bg-white/[0.04] transition-colors">
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <div className="w-1.5 h-1.5 rounded-full bg-destructive/50 group-hover:bg-destructive transition-colors shrink-0" />
                                        <span className="text-[10px] font-bold text-foreground/90 truncate">{file.path.split('/').pop()}</span>
                                    </div>
                                    <span className="text-[9px] font-mono text-muted-foreground/60">{formatSize(file.size)}</span>
                                </div>
                                <div className="text-[8px] font-mono text-muted-foreground truncate pl-3.5 opacity-40">
                                    {file.path}
                                </div>
                            </div>
                        )) : (
                            <div className="px-4 py-8 text-center">
                                <Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground mb-2" />
                                <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Resolving Metadata...</span>
                            </div>
                        )}
                        {selectionQueue.length > previewFiles.length && (
                            <div className="px-3 py-2 text-center">
                                <span className="text-[9px] italic text-muted-foreground opacity-50">
                                    + {selectionQueue.length - previewFiles.length} more items...
                                </span>
                            </div>
                        )}
                    </div>
                    <div className="p-3 border-t border-white/5 bg-white/[0.02]">
                        <div className="flex items-center justify-between opacity-60">
                            <span className="text-[9px] font-black uppercase tracking-widest">Total Impact</span>
                            <span className="text-[9px] font-mono text-destructive">{formatSize(totalSize)}</span>
                        </div>
                    </div>
                </div>

                {/* Right Column: Protocol & Actions */}
                <div className="flex flex-col p-6 flex-1 h-full justify-between relative overflow-hidden bg-[#0c0c0c]">
                    <div className="absolute top-0 right-0 p-40 bg-destructive/5 blur-[100px] rounded-full pointer-events-none -mr-20 -mt-20" />
                    <div className="h-full w-px bg-gradient-to-b from-transparent via-white/5 to-transparent absolute left-0 top-0" />

                    <div className="relative z-10 space-y-6">
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center border border-destructive/20 shadow-[0_0_15px_-3px_rgba(239,68,68,0.2)]">
                                    <ShieldAlert className="w-5 h-5 text-destructive" />
                                </div>
                                <div>
                                    <AlertDialogTitle className="text-2xl font-black tracking-tighter uppercase italic text-white leading-none">
                                        Confirm Purge
                                    </AlertDialogTitle>
                                    <span className="text-[9px] mono uppercase tracking-[0.3em] font-bold text-destructive/60">
                                        Irreversible Operation
                                    </span>
                                </div>
                            </div>

                            <AlertDialogDescription className="text-xs font-medium text-muted-foreground leading-relaxed">
                                You are about to permanently remove <span className="text-white font-bold">{selectionQueue.length} files</span>. This action interacts directly with your file system.
                            </AlertDialogDescription>

                            {/* Impact Chips - Compact Grid */}
                            <div className="grid grid-cols-2 gap-2">
                                {categories.map(([name, count]: [string, number]) => (
                                    <div key={name} className="px-3 py-2 bg-white/[0.03] border border-white/5 rounded-lg flex items-center justify-between">
                                        <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/70">{name}</span>
                                        <span className="text-[10px] font-bold text-white">{count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Status Indicator */}
                        <div className="p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/10 flex items-center justify-between">
                            <div className="flex flex-col">
                                <span className="text-[9px] uppercase tracking-widest font-black text-emerald-500/60">Effect</span>
                                <span className="text-lg font-black text-emerald-500 tracking-tighter">
                                    +{formatSize(totalSize)}
                                </span>
                            </div>
                            <div className="text-xs font-bold text-emerald-500 flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                RECOVERABLE
                            </div>
                        </div>
                    </div>

                    <AlertDialogFooter className="flex-col gap-2 relative z-10 sm:flex-col sm:space-x-0 mt-auto">
                        <Button
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="w-full rounded-xl font-black h-10 bg-destructive hover:bg-destructive/90 text-white shadow-lg shadow-destructive/20 text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                                    Purging...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Initiate Permanent Purge
                                </>
                            )}
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={onClose}
                            disabled={isDeleting}
                            className="w-full h-8 text-[10px] uppercase tracking-wider border border-white/5 hover:bg-white/5 hover:text-white text-muted-foreground/50"
                        >
                            Abort Mission
                        </Button>
                    </AlertDialogFooter>
                </div>
            </AlertDialogContent>
        </AlertDialog>
    );
}
