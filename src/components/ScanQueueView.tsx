import * as React from "react";
import { useStore } from "../store/useStore";
import { useDrives } from "../hooks/useDrives";
import { formatSize } from "../lib/utils";
import { useQuery, useIsFetching } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import {
    HardDrive,
    X,
    Zap,
    ArrowRight,
    Database,
    Search,
    Settings2,
    Loader2,
    Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// Define Drive interface locally or import if available
interface Drive {
    name: string;
    mount_point: string;
    total_space: number;
    available_space: number;
    is_removable: boolean;
}

export function ScanQueueView({ onStartScan }: { onStartScan: () => void }) {
    const { scanQueue, removeFromQueue, isScanning, scanPhase } = useStore();
    const { data: drives } = useDrives();

    const { data: systemNodes } = useQuery({
        queryKey: ["systemNodes"],
        queryFn: () => invoke<Drive[]>("get_system_nodes")
    });

    const isIndexing = useIsFetching({ queryKey: ["folderSize"] }) > 0;

    const allNodes = React.useMemo(() => [...(drives || []), ...(systemNodes || [])], [drives, systemNodes]);
    const queuedDrives = allNodes.filter(d => scanQueue.includes(d.mount_point)) || [];

    const getPhaseMessage = () => {
        if (isIndexing) return "Mapping Data Intensity...";
        switch (scanPhase) {
            case 'metadata': return "Indexing Metadata Stack...";
            case 'partial': return "Calculating Content Samples...";
            case 'full': return "Performing Deep Collision Audit...";
            default: return "Initializing Scanning Engine...";
        }
    };

    if (isScanning || (isIndexing && scanQueue.length > 0 && !isScanning && scanPhase === 'idle')) {
        const isInitialIndex = isIndexing && scanPhase === 'idle';
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
                <div className="relative mb-8">
                    <div className="absolute -inset-8 bg-primary/20 rounded-full blur-3xl animate-pulse" />
                    <div className="w-20 h-20 bg-card rounded-2xl flex items-center justify-center border border-primary/20 shadow-2xl relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-t from-primary/10 to-transparent" />
                        {isInitialIndex ? (
                            <Activity className="w-8 h-8 text-primary animate-pulse" />
                        ) : (
                            <Zap className="w-8 h-8 text-primary animate-bounce" />
                        )}
                    </div>
                </div>

                <div className="space-y-4 max-w-xs w-full">
                    <div className="flex flex-col gap-1">
                        <h3 className="text-lg font-black tracking-tighter uppercase italic">{getPhaseMessage()}</h3>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] opacity-40">
                            {isInitialIndex ? "Optimizing Virtual Tree" : "DO NOT INTERRUPT SYSTEM BUS"}
                        </p>
                    </div>

                    <div className="h-1 w-full bg-secondary/20 rounded-full overflow-hidden">
                        <div
                            className={cn(
                                "h-full bg-primary transition-all duration-1000",
                                isInitialIndex ? "w-1/2 animate-pulse" :
                                    scanPhase === 'metadata' ? "w-1/3" : scanPhase === 'partial' ? "w-2/3" : "w-full"
                            )}
                        />
                    </div>

                    {!isInitialIndex && (
                        <div className="flex justify-between items-center px-1">
                            <div className={cn("w-1.5 h-1.5 rounded-full transition-colors", scanPhase === 'metadata' ? "bg-primary shadow-[0_0_8px_primary]" : "bg-muted")} />
                            <div className={cn("w-1.5 h-1.5 rounded-full transition-colors", scanPhase === 'partial' ? "bg-primary shadow-[0_0_8px_primary]" : "bg-muted")} />
                            <div className={cn("w-1.5 h-1.5 rounded-full transition-colors", scanPhase === 'full' ? "bg-primary shadow-[0_0_8px_primary]" : "bg-muted")} />
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (scanQueue.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center animate-in fade-in slide-in-from-bottom-5 duration-700 relative overflow-hidden bg-[#0c0c0c]">
                <div className="absolute inset-0 opacity-[0.05] pointer-events-none"
                    style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

                <div className="relative group mb-8">
                    <div className="absolute -inset-8 bg-primary/20 rounded-full blur-3xl group-hover:bg-primary/40 transition-all duration-700 opacity-0 group-hover:opacity-100" />
                    <div className="w-24 h-24 bg-zinc-900 rounded-[2.5rem] flex items-center justify-center border border-white/5 shadow-2xl relative transition-transform group-hover:scale-110 duration-500">
                        <Database className="w-10 h-10 text-primary opacity-30 group-hover:opacity-100 transition-opacity" />
                    </div>
                </div>
                <h3 className="text-3xl font-black tracking-tighter mb-3 grayscale-[0.5] uppercase italic text-white">Queue Offline</h3>
                <p className="text-[12px] font-bold text-white/40 max-w-[280px] mb-8 leading-relaxed opacity-80 uppercase tracking-widest">
                    Select workstation nodes from the sidebar to initialize your data analysis stack.
                </p>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in duration-500 bg-[#0c0c0c]">
            <div className="px-6 py-4 flex justify-between items-center border-b border-white/5 bg-white/[0.02]">
                <div className="space-y-0.5">
                    <h2 className="text-xl font-black tracking-tighter uppercase italic text-white">Target Queue</h2>
                    <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest opacity-40">
                        {scanQueue.length} Volumes in Memory Buffer
                    </p>
                </div>
                <Button
                    onClick={onStartScan}
                    disabled={isScanning || isIndexing}
                    className="rounded-2xl px-8 h-12 text-[11px] font-black shadow-2xl shadow-primary/20 bg-primary hover:bg-primary/90 text-primary-foreground group transition-all disabled:opacity-50 disabled:grayscale relative overflow-hidden active:scale-95 cursor-pointer"
                >
                    <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                    <div className="relative flex items-center">
                        {isIndexing ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Readying Engine...
                            </>
                        ) : (
                            <>
                                <Search className="w-4 h-4 mr-2" />
                                Launch System Audit
                                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1.5 transition-transform" />
                            </>
                        )}
                    </div>
                </Button>
            </div>

            <ScrollArea className="flex-1 px-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pb-10">
                    {queuedDrives.map((drive) => (
                        <TargetCard
                            key={drive.mount_point}
                            drive={drive}
                            onRemove={() => removeFromQueue(drive.mount_point)}
                            isScanning={isScanning}
                        />
                    ))}
                </div>
            </ScrollArea>

            <div className="px-6 py-3 border-t border-border/10 bg-card/20 backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <Settings2 className="w-3.5 h-3.5 opacity-40 text-primary" />
                    <span className="text-[9px] font-bold uppercase tracking-widest opacity-30 italic">
                        Studio Filter applied: system & developer nodes excluded for maximum precision.
                    </span>
                </div>
            </div>
        </div>
    );
}

function TargetCard({ drive, onRemove, isScanning }: { drive: Drive, onRemove: () => void, isScanning: boolean }) {
    const used = drive.total_space - drive.available_space;
    const usagePercent = drive.total_space > 0 ? Math.round((used / drive.total_space) * 100) : 0;

    const { data: folderSize, isFetching: isFetchingSize } = useQuery({
        queryKey: ["folderSize", drive.mount_point],
        queryFn: () => invoke<number>("get_folder_size", { path: drive.mount_point }),
        staleTime: 60000 // Cache for 1 minute
    });

    return (
        <Card className={cn(
            "bg-zinc-900/50 backdrop-blur-xl border-white/5 rounded-3xl overflow-hidden group hover:border-primary/40 transition-all shadow-sm hover:shadow-xl hover:shadow-primary/5",
            isFetchingSize && "opacity-80"
        )}>
            <CardHeader className="p-4 flex flex-row items-start justify-between space-y-0">
                <div className="flex gap-3 min-w-0">
                    <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 transition-all",
                        isFetchingSize ? "bg-primary/5 border-primary/10 animate-pulse" : "bg-primary/10 border-primary/20 group-hover:scale-105"
                    )}>
                        <HardDrive className={cn("w-4 h-4 text-primary", isFetchingSize && "animate-bounce")} />
                    </div>
                    <div className="flex flex-col min-w-0">
                        <CardTitle className="text-sm font-black tracking-tight group-hover:text-primary transition-colors truncate">
                            {drive.name || "Unnamed Volume"}
                        </CardTitle>
                        <CardDescription className="text-[9px] font-bold uppercase tracking-widest opacity-40 truncate">
                            {drive.mount_point}
                        </CardDescription>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onRemove}
                    disabled={isScanning}
                    className="w-7 h-7 rounded-lg opacity-30 hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all shrink-0 cursor-pointer"
                >
                    <X className="w-3.5 h-3.5" />
                </Button>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-4">
                <div className="space-y-1.5">
                    <div className="flex justify-between items-end">
                        <div className="flex flex-col">
                            <span className="text-[8px] font-black uppercase tracking-tighter opacity-20">Disk Pressure</span>
                            <span className="text-[10px] font-bold tabular-nums text-muted-foreground/80">
                                {formatSize(used)} / {formatSize(drive.total_space)}
                            </span>
                        </div>
                        <Badge variant="secondary" className="text-[8px] h-4 font-black bg-primary/10 text-primary border-primary/20 px-1.5">
                            {usagePercent}%
                        </Badge>
                    </div>
                    <div className="h-1.5 w-full bg-primary/5 rounded-full overflow-hidden border border-primary/5">
                        <div
                            className="h-full bg-primary/40 rounded-full transition-all duration-1000 group-hover:bg-primary/60"
                            style={{ width: `${usagePercent}%` }}
                        />
                    </div>
                </div>

                <div className={cn(
                    "p-2.5 rounded-xl border flex items-center justify-between transition-all",
                    isFetchingSize ? "bg-primary/10 border-primary/30" : "bg-primary/5 border-primary/10 group-hover:bg-primary/10"
                )}>
                    <div className="flex flex-col">
                        <span className="text-[9px] font-black uppercase tracking-widest opacity-30 italic">IO Intensity</span>
                        <div className="flex items-center gap-2 mt-0.5">
                            {isFetchingSize ? (
                                <div className="flex items-center gap-2">
                                    <Loader2 className="w-3 h-3 animate-spin text-primary" />
                                    <span className="text-[10px] font-black text-primary/60 animate-pulse uppercase tracking-[0.1em]">Indexing...</span>
                                </div>
                            ) : (
                                <span className="text-[13px] font-black text-white tracking-tight">
                                    {formatSize(folderSize || 0)}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className={cn(
                            "w-1.5 h-1.5 rounded-full transform transition-all",
                            isFetchingSize ? "bg-primary animate-ping" : "bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                        )} />
                        <span className={cn(
                            "text-[8px] font-black uppercase tracking-[0.2em]",
                            isFetchingSize ? "text-primary/60" : "text-emerald-500/70"
                        )}>
                            {isFetchingSize ? "Active" : "Online"}
                        </span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
