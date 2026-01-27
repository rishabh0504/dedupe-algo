import { useStore } from "../store/useStore";
import { formatSize } from "../lib/utils";
import {
    Trash2,
    X,
    Loader2,
    ShieldAlert
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
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

    const totalSize = selectionQueue.reduce((acc, path) => {
        if (!scanResults) return acc;
        for (const group of scanResults.groups) {
            const file = group.find(f => f.path === path);
            if (file) return acc + file.size;
        }
        return acc;
    }, 0);

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
            <AlertDialogContent className="bg-card/95 backdrop-blur-3xl border-border/50 rounded-[2.5rem] p-0 overflow-hidden max-w-lg shadow-2xl">
                <div className="p-8 space-y-8 relative">
                    {/* Visual Danger Indicator */}
                    <div className="absolute top-0 left-0 w-1 h-full bg-destructive opacity-50" />

                    <div className="flex items-start justify-between">
                        <div className="w-16 h-16 bg-destructive/10 rounded-2xl flex items-center justify-center text-destructive animate-pulse border border-destructive/20 shadow-[0_0_30px_rgba(var(--destructive),0.1)]">
                            <ShieldAlert className="w-9 h-9" />
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

                    <div className="space-y-3">
                        <AlertDialogTitle className="text-3xl font-black tracking-tighter uppercase italic text-white flex items-center gap-3 text-left">
                            Confirm Disposal
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-md font-medium text-muted-foreground leading-relaxed text-left">
                            You are about to authorize the extraction and disposal of <span className="text-white font-black underline decoration-primary underline-offset-4">{selectionQueue.length} redundant system entries</span>.
                            This operation will restore approximately <span className="text-primary font-black">{formatSize(totalSize)}</span> of computational capacity.
                        </AlertDialogDescription>
                    </div>

                    <div className="p-4 bg-primary/5 rounded-2xl flex items-center gap-4 border border-primary/10">
                        <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
                        <span className="text-[10px] uppercase tracking-widest font-black text-primary opacity-80">Safety Protocol Active: Recoverable via System Trash</span>
                    </div>

                    <AlertDialogFooter className="flex sm:flex-row gap-3">
                        <Button
                            variant="secondary"
                            onClick={onClose}
                            disabled={isDeleting}
                            className="flex-1 rounded-2xl font-bold h-12 bg-muted/50 hover:bg-muted text-xs uppercase tracking-wider"
                        >
                            Abort Mission
                        </Button>
                        <Button
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="flex-[2] rounded-2xl font-black h-12 bg-destructive hover:bg-destructive/90 text-white shadow-xl shadow-destructive/20 text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Executing...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="w-4 h-4" />
                                    Confirm Extraction
                                </>
                            )}
                        </Button>
                    </AlertDialogFooter>
                </div>
            </AlertDialogContent>
        </AlertDialog>
    );
}
