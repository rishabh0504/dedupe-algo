import { useStore } from "../store/useStore";
import { formatSize } from "../lib/utils";
import {
    Trash2,
    X,
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
            previewFiles: allFiles.slice(0, 5)
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
            <AlertDialogContent className="bg-background/95 backdrop-blur-3xl border-border/50 rounded-[2.5rem] p-0 overflow-hidden max-w-xl shadow-2xl border">
                {/* Industrial Header Stripe */}
                <div className="h-2 w-full bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(239,68,68,0.2)_10px,rgba(239,68,68,0.2)_20px)]" />

                <div className="p-8 space-y-8 relative">
                    <div className="flex items-start justify-between">
                        <div className="space-y-1">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-destructive/10 rounded-2xl flex items-center justify-center text-destructive border border-destructive/20 shadow-[0_0_20px_rgba(239,68,68,0.1)]">
                                    <ShieldAlert className="w-6 h-6" />
                                </div>
                                <AlertDialogTitle className="text-3xl font-black tracking-tighter uppercase italic text-white">
                                    Purge Protocol
                                </AlertDialogTitle>
                            </div>
                            <p className="text-[10px] mono uppercase tracking-[0.3em] font-bold text-destructive/80 pl-1">
                                Critical System Cleanup Ref: {Math.random().toString(36).substring(7).toUpperCase()}
                            </p>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            disabled={isDeleting}
                            className="rounded-full opacity-30 hover:opacity-100 transition-opacity"
                        >
                            <X className="w-5 h-5" />
                        </Button>
                    </div>

                    <div className="space-y-6">
                        <AlertDialogDescription className="text-lg font-medium text-muted-foreground leading-relaxed text-left">
                            Authorization requested for the permanent extraction of <span className="text-white font-black">{selectionQueue.length} system objects</span>.
                        </AlertDialogDescription>

                        {/* Impact Breakdown Chips */}
                        <div className="flex flex-wrap gap-2">
                            {categories.map(([name, count]: [string, number]) => (
                                <div key={name} className="px-3 py-1.5 bg-muted/30 border border-border/50 rounded-xl flex items-center gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{name}</span>
                                    <span className="text-xs font-bold text-white">{count}</span>
                                </div>
                            ))}
                        </div>

                        {/* Space Reclaim Gauge */}
                        <div className="p-6 bg-emerald-500/5 rounded-[2rem] border border-emerald-500/10 space-y-4">
                            <div className="flex items-end justify-between">
                                <div className="space-y-1">
                                    <span className="text-[10px] uppercase tracking-widest font-black text-emerald-500/80">Net Capacity Gain</span>
                                    <div className="text-4xl font-black text-emerald-500 tracking-tighter">
                                        +{formatSize(totalSize)}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] uppercase tracking-widest font-black text-white/40">Status</span>
                                    <div className="text-xs font-bold text-emerald-500 flex items-center gap-1 justify-end">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        RECOVERABLE
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Preview List (Concise) */}
                        <div className="space-y-2">
                            <span className="text-[10px] uppercase tracking-widest font-black text-muted-foreground ml-1">Extraction Buffer Preview</span>
                            <div className="rounded-2xl border border-border/50 bg-muted/10 overflow-hidden">
                                {previewFiles.map((file: any, i: number) => (
                                    <div key={i} className="px-4 py-2 border-b border-border/30 last:border-0 flex items-center justify-between gap-4">
                                        <span className="text-[11px] truncate text-muted-foreground font-mono max-w-[300px]">{file.path}</span>
                                        <span className="text-[10px] whitespace-nowrap font-bold text-white/40 italic">{formatSize(file.size)}</span>
                                    </div>
                                ))}
                                {selectionQueue.length > 5 && (
                                    <div className="px-4 py-1.5 bg-muted/20 text-center">
                                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20 italic">
                                            + {selectionQueue.length - 5} additional entries in queue
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-muted/30 rounded-2xl flex items-center gap-4 border border-border/50">
                        <div className="p-2 bg-destructive/10 rounded-lg text-destructive">
                            <ShieldAlert className="w-4 h-4" />
                        </div>
                        <p className="text-[10px] leading-tight font-medium text-muted-foreground">
                            <strong className="text-white">Safety Check:</strong> Files will be transferred to the <span className="text-white font-bold">System Trash</span>. Disposal can be reverted manually via OS protocols if required.
                        </p>
                    </div>

                    <AlertDialogFooter className="flex sm:flex-row gap-3">
                        <Button
                            variant="secondary"
                            onClick={onClose}
                            disabled={isDeleting}
                            className="flex-1 rounded-2xl font-bold h-14 bg-muted/50 hover:bg-muted text-xs uppercase tracking-wider border-border/50 border"
                        >
                            Abort Mission
                        </Button>
                        <Button
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="flex-[2] rounded-2xl font-black h-14 bg-destructive hover:bg-destructive/90 text-white shadow-2xl shadow-destructive/20 text-xs uppercase tracking-widest flex items-center justify-center gap-2 group overflow-hidden relative"
                        >
                            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform" />
                            {isDeleting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                                    Execution in Progress...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                    Initiate Permanent Purge
                                </>
                            )}
                        </Button>
                    </AlertDialogFooter>
                </div>
            </AlertDialogContent>
        </AlertDialog>
    );
}
