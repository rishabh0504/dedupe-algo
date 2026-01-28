import { useStore } from "../store/useStore";
import { useDrives } from "../hooks/useDrives";
import { formatSize } from "../lib/utils";
import {
    HardDrive,
    X,
    Zap,
    ArrowRight,
    Database,
    Search,
    Settings2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
// ... imports ...

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

    const allNodes = [...(drives || []), ...(systemNodes || [])];
    const queuedDrives = allNodes.filter(d => scanQueue.includes(d.mount_point)) || [];

    const getPhaseMessage = () => {
        switch (scanPhase) {
            case 'metadata': return "Indexing Metadata Stack...";
            case 'partial': return "Calculating Content Samples...";
            case 'full': return "Performing Deep Collision Audit...";
            default: return "Initializing Scanning Engine...";
        }
    };

    if (isScanning) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
                <div className="relative mb-8">
                    <div className="absolute -inset-8 bg-primary/20 rounded-full blur-3xl animate-pulse" />
                    <div className="w-20 h-20 bg-card rounded-2xl flex items-center justify-center border border-primary/20 shadow-2xl relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-t from-primary/10 to-transparent" />
                        <Zap className="w-8 h-8 text-primary animate-bounce" />
                    </div>
                </div>

                <div className="space-y-4 max-w-xs w-full">
                    <div className="flex flex-col gap-1">
                        <h3 className="text-lg font-black tracking-tighter uppercase italic">{getPhaseMessage()}</h3>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] opacity-40">
                            DO NOT INTERRUPT SYSTEM BUS
                        </p>
                    </div>

                    <div className="h-1 w-full bg-secondary/20 rounded-full overflow-hidden">
                        <div
                            className={cn(
                                "h-full bg-primary transition-all duration-1000",
                                scanPhase === 'metadata' ? "w-1/3" : scanPhase === 'partial' ? "w-2/3" : "w-full"
                            )}
                        />
                    </div>

                    <div className="flex justify-between items-center px-1">
                        <div className={cn("w-1.5 h-1.5 rounded-full transition-colors", scanPhase === 'metadata' ? "bg-primary shadow-[0_0_8px_primary]" : "bg-muted")} />
                        <div className={cn("w-1.5 h-1.5 rounded-full transition-colors", scanPhase === 'partial' ? "bg-primary shadow-[0_0_8px_primary]" : "bg-muted")} />
                        <div className={cn("w-1.5 h-1.5 rounded-full transition-colors", scanPhase === 'full' ? "bg-primary shadow-[0_0_8px_primary]" : "bg-muted")} />
                    </div>
                </div>
            </div>
        );
    }

    if (scanQueue.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center animate-in fade-in slide-in-from-bottom-5 duration-700">
                <div className="relative group mb-6">
                    <div className="absolute -inset-4 bg-primary/20 rounded-full blur-2xl group-hover:bg-primary/30 transition-all duration-500 opacity-0 group-hover:opacity-100" />
                    <div className="w-20 h-20 bg-card rounded-3xl flex items-center justify-center border border-border/50 shadow-2xl relative">
                        <Database className="w-8 h-8 text-primary opacity-20" />
                    </div>
                </div>
                <h3 className="text-2xl font-black tracking-tighter mb-2 grayscale-[0.5] uppercase italic">Queue Empty</h3>
                <p className="text-[11px] font-medium text-muted-foreground max-w-[240px] mb-8 leading-relaxed opacity-60">
                    Map locations from the sidebar to initialize your analysis stack.
                </p>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in duration-500">
            <div className="px-6 py-4 flex justify-between items-center border-b border-border/10">
                <div className="space-y-0.5">
                    <h2 className="text-xl font-black tracking-tighter uppercase italic">Target Queue</h2>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest opacity-40">
                        {scanQueue.length} Volumes in Memory Buffer
                    </p>
                </div>
                <Button
                    onClick={onStartScan}
                    disabled={isScanning}
                    className="rounded-xl px-6 h-10 text-[11px] font-black shadow-lg shadow-primary/10 bg-primary hover:bg-primary/90 text-primary-foreground group"
                >
                    <Search className="w-3.5 h-3.5 mr-2" />
                    Execute Audit
                    <ArrowRight className="w-3.5 h-3.5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
            </div>

            <ScrollArea className="flex-1 px-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pb-10">
                    {queuedDrives.map((drive) => {
                        const used = drive.total_space - drive.available_space;
                        return (
                            <Card key={drive.mount_point} className="bg-card/30 border-border/30 rounded-2xl overflow-hidden group hover:border-primary/40 transition-all">
                                <CardHeader className="p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center border border-primary/20">
                                            <HardDrive className="w-4 h-4 text-primary" />
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeFromQueue(drive.mount_point)}
                                            disabled={isScanning}
                                            className="w-7 h-7 rounded-lg opacity-30 hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                    <CardTitle className="text-sm font-black tracking-tight group-hover:text-primary transition-colors truncate">
                                        {drive.name || "Unnamed Volume"}
                                    </CardTitle>
                                    <CardDescription className="text-[9px] font-bold uppercase tracking-widest opacity-40 truncate">
                                        {drive.mount_point}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="px-4 pb-4">
                                    <div className="flex justify-between items-end">
                                        <div className="flex flex-col">
                                            <span className="text-[8px] font-black uppercase tracking-tighter opacity-20">Capacity</span>
                                            <span className="text-[10px] font-bold tabular-nums text-muted-foreground/80">
                                                {formatSize(drive.available_space)} Free
                                            </span>
                                        </div>
                                        <Badge variant="secondary" className="text-[8px] h-4 font-black bg-primary/5 text-primary border-primary/10 px-1.5">
                                            {Math.round((used / drive.total_space) * 100)}%
                                        </Badge>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
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
