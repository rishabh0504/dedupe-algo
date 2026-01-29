import { useDrives, Drive } from "../hooks/useDrives";
import { useStore } from "../store/useStore";
import {
    HardDrive,
    Loader2,
    Plus,
    Minus,
    ExternalLink,
    Monitor,
    FileText,
    Download,
    Eye,
    EyeOff,
    Image,
    Video,
    FileArchive,
    RotateCcw,
    AlertTriangle,
    Database
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { useState } from "react";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarGroupContent,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogCancel,
    AlertDialogAction,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function AppSidebar() {
    const { data: drives, isLoading: isLoadingDrives } = useDrives();
    const [isResetting, setIsResetting] = useState(false);
    const [isResetOpen, setIsResetOpen] = useState(false);
    const {
        scanQueue,
        addToQueue,
        removeFromQueue,
        isScanning,
        scanHidden,
        setScanHidden,
        scanImages,
        setScanImages,
        scanVideos,
        setScanVideos,
        scanZips,
        setScanZips,
        minFileSize,
        setMinFileSize
    } = useStore();

    const { data: systemNodes, isLoading: isLoadingNodes } = useQuery({
        queryKey: ["systemNodes"],
        queryFn: () => invoke<Drive[]>("get_system_nodes")
    });

    const isLoading = isLoadingDrives || isLoadingNodes;

    const getIcon = (label: string, isRemovable: boolean) => {
        if (isRemovable) return <ExternalLink className="w-4 h-4" />;
        if (label === "Desktop") return <Monitor className="w-4 h-4" />;
        if (label === "Documents") return <FileText className="w-4 h-4" />;
        if (label === "Downloads") return <Download className="w-4 h-4" />;
        return <HardDrive className="w-4 h-4" />;
    };

    const renderNode = (node: Drive) => {
        const isQueued = scanQueue.includes(node.mount_point);
        const usedPercent = node.total_space > 0
            ? Math.round(((node.total_space - node.available_space) / node.total_space) * 100)
            : null;

        return (
            <SidebarMenuItem key={node.mount_point}>
                <SidebarMenuButton
                    onClick={() => isQueued ? removeFromQueue(node.mount_point) : addToQueue(node.mount_point)}
                    disabled={isScanning}
                    className={cn(
                        "group h-auto py-3 px-3 rounded-xl transition-all duration-200 cursor-pointer",
                        isQueued ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-muted/50"
                    )}
                >
                    <div className="flex items-center gap-3 w-full">
                        <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                            isQueued ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/50 text-muted-foreground group-hover:bg-muted"
                        )}>
                            {getIcon(node.name, node.is_removable)}
                        </div>

                        <div className="flex flex-col flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className={cn(
                                    "text-sm font-bold truncate tracking-tight transition-colors",
                                    isQueued ? "text-primary" : "text-foreground group-hover:text-primary/80"
                                )}>
                                    {node.name || "Unknown"}
                                </span>
                                {isQueued && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse shrink-0" />
                                )}
                            </div>
                            <span className="text-[10px] text-muted-foreground font-medium opacity-50 truncate">
                                {node.mount_point}
                            </span>
                        </div>

                        <div className="flex flex-col items-end shrink-0 ml-1">
                            {usedPercent !== null && (
                                <span className="text-[9px] font-black tabular-nums opacity-40">{usedPercent}%</span>
                            )}
                            <div className="flex items-center gap-1">
                                {isQueued ? (
                                    <Minus className="w-3.5 h-3.5 text-primary opacity-50 group-hover:opacity-100" />
                                ) : (
                                    <Plus className="w-3.5 h-3.5 text-muted-foreground opacity-20 group-hover:opacity-100" />
                                )}
                            </div>
                        </div>
                    </div>
                </SidebarMenuButton>
            </SidebarMenuItem>
        );
    };

    return (
        <Sidebar className="border-r border-border/40 bg-background/50 backdrop-blur-3xl" variant="inset">
            <SidebarHeader className="p-6 relative overflow-hidden">
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                    style={{ backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '16px 16px' }} />

                <div className="relative flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/[0.05] rounded-2xl flex items-center justify-center border border-white/5 shadow-xl shadow-black/5 transition-transform hover:rotate-3">
                        <img src="/src/assets/logo.png" alt="Logo" className="w-7 h-7 object-contain" />
                    </div>
                    <div className="flex flex-col">
                        <h2 className="text-xl font-black tracking-tighter uppercase italic leading-none text-white">Dedupe-Algo</h2>
                        <span className="text-[9px] font-black text-primary uppercase tracking-[0.2em] mt-1 opacity-60">High Performance Audit</span>
                    </div>
                </div>
            </SidebarHeader>

            <SidebarContent className="px-3">
                <SidebarGroup>
                    <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.2em] font-black opacity-30 px-3 mb-2">Workspace Nodes</SidebarGroupLabel>
                    <SidebarGroupContent>
                        {isLoading ? (
                            <div className="flex items-center gap-3 px-3 py-4 opacity-50">
                                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Scanning Bus...</span>
                            </div>
                        ) : (
                            <SidebarMenu>
                                <div className="space-y-4">
                                    {drives && drives.filter(d => d.is_removable).length > 0 && (
                                        <div>
                                            <span className="px-3 text-[9px] font-black uppercase text-muted-foreground/40 tracking-widest">External Volumes</span>
                                            <div className="mt-2 space-y-1">
                                                {drives.filter(d => d.is_removable).map(renderNode)}
                                            </div>
                                        </div>
                                    )}
                                    {systemNodes && systemNodes.length > 0 && (
                                        <div>
                                            <span className="px-3 text-[9px] font-black uppercase text-muted-foreground/40 tracking-widest">System Folders</span>
                                            <div className="mt-2 space-y-1">
                                                {systemNodes.map(renderNode)}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </SidebarMenu>
                        )}
                    </SidebarGroupContent>
                </SidebarGroup>


            </SidebarContent>

            <SidebarFooter className="p-4 border-t border-border/40">
                <div className="space-y-4">
                    <div className="px-3 py-2 space-y-3 bg-muted/20 rounded-xl mb-4 border border-white/5">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Min File Size</span>
                            <span className="text-[10px] font-bold tabular-nums opacity-80">{Math.round(minFileSize / 1024)} KB</span>
                        </div>
                        <Slider
                            value={[minFileSize]}
                            max={5242880} // 5MB Max for slider
                            min={1024} // 1KB Min
                            step={1024}
                            onValueChange={(val) => setMinFileSize(val[0])}
                            disabled={isScanning}
                            className="[&>span:first-child]:h-1 [&>span:first-child]:bg-white/10"
                        />
                    </div>

                    <div className="flex items-center justify-between px-2 py-1 hover:bg-muted/30 rounded-lg transition-colors group">
                        <div className="flex items-center gap-2">
                            {scanHidden ? <Eye className="w-3.5 h-3.5 text-primary" /> : <EyeOff className="w-3.5 h-3.5 text-muted-foreground opacity-40 shrink-0" />}
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity">Scan Hidden</span>
                        </div>
                        <Switch
                            checked={scanHidden}
                            onCheckedChange={setScanHidden}
                            disabled={isScanning}
                            className="scale-75"
                        />
                    </div>

                    <div className="flex items-center justify-between px-2 py-1 hover:bg-muted/30 rounded-lg transition-colors group">
                        <div className="flex items-center gap-2">
                            <Image className={cn("w-3.5 h-3.5 shrink-0", scanImages ? "text-primary" : "text-muted-foreground opacity-40")} />
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity">Images</span>
                        </div>
                        <Switch
                            checked={scanImages}
                            onCheckedChange={setScanImages}
                            disabled={isScanning}
                            className="scale-75"
                        />
                    </div>

                    <div className="flex items-center justify-between px-2 py-1 hover:bg-muted/30 rounded-lg transition-colors group">
                        <div className="flex items-center gap-2">
                            <Video className={cn("w-3.5 h-3.5 shrink-0", scanVideos ? "text-primary" : "text-muted-foreground opacity-40")} />
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity">Videos</span>
                        </div>
                        <Switch
                            checked={scanVideos}
                            onCheckedChange={setScanVideos}
                            disabled={isScanning}
                            className="scale-75"
                        />
                    </div>

                    <div className="flex items-center justify-between px-2 py-1 hover:bg-muted/30 rounded-lg transition-colors group">
                        <div className="flex items-center gap-2">
                            <FileArchive className={cn("w-3.5 h-3.5 shrink-0", scanZips ? "text-primary" : "text-muted-foreground opacity-40")} />
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity">Archives</span>
                        </div>
                        <Switch
                            checked={scanZips}
                            onCheckedChange={setScanZips}
                            disabled={isScanning}
                            className="scale-75"
                        />
                    </div>


                    <AlertDialog open={isResetOpen} onOpenChange={setIsResetOpen}>
                        <AlertDialogTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                disabled={isScanning || isResetting}
                                className="w-full justify-start gap-2 text-destructive/50 hover:text-destructive hover:bg-destructive/10 h-8 px-2"
                            >
                                {isResetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                                <span className="text-[10px] font-black uppercase tracking-widest">
                                    {isResetting ? "Resetting..." : "Reset Database"}
                                </span>
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="border-emerald-500/40 bg-[#0a0a0a] !p-0 overflow-hidden !max-w-[720px] !gap-0 !flex !flex-row items-stretch h-[360px]">
                            {/* Left Column: Scope List */}
                            <div className="bg-muted/10 border-r border-white/5 flex flex-col w-[260px] shrink-0 h-full">
                                <div className="p-4 border-b border-white/5 bg-white/[0.02]">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Target Scope</span>
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-none">
                                    {drives?.filter(d => d.is_removable).map(drive => (
                                        <div key={drive.mount_point} className="px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <HardDrive className="w-3 h-3 text-primary/70" />
                                                <span className="text-xs font-bold text-foreground/90 truncate">{drive.name}</span>
                                            </div>
                                            <div className="text-[9px] font-mono text-muted-foreground truncate pl-5">
                                                {drive.mount_point}
                                            </div>
                                        </div>
                                    ))}
                                    {systemNodes?.map(node => (
                                        <div key={node.mount_point} className="px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <FileText className="w-3 h-3 text-blue-400/70" />
                                                <span className="text-xs font-bold text-foreground/90 truncate">{node.name}</span>
                                            </div>
                                            <div className="text-[9px] font-mono text-muted-foreground truncate pl-5">
                                                {node.mount_point}
                                            </div>
                                        </div>
                                    ))}
                                    {(!drives?.length && !systemNodes?.length) && (
                                        <div className="p-4 text-center text-muted-foreground text-xs opacity-50">
                                            No active drives found.
                                        </div>
                                    )}
                                </div>
                                <div className="p-3 border-t border-white/5 bg-white/[0.02]">
                                    <div className="flex items-center gap-2 opacity-50">
                                        <Database className="w-3 h-3" />
                                        <span className="text-[9px] font-medium">PURGE PROTOCOL</span>
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Warning & Actions */}
                            <div className="flex flex-col p-6 flex-1 h-full justify-between relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-32 bg-destructive/5 blur-3xl rounded-full pointer-events-none -mr-16 -mt-16" />

                                <div className="relative z-10">
                                    <AlertDialogHeader className="items-start text-left mb-6">
                                        <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center mb-4 border border-destructive/20 shadow-[0_0_15px_-3px_rgba(239,68,68,0.2)]">
                                            <AlertTriangle className="w-5 h-5 text-destructive" />
                                        </div>
                                        <AlertDialogTitle className="text-xl font-black tracking-tight text-white mb-2">
                                            INITIATE PURGE?
                                        </AlertDialogTitle>
                                        <AlertDialogDescription className="text-muted-foreground text-xs leading-relaxed">
                                            This will permanently delete the fingerprint cache for all drives listed on the left.
                                            <br /><br />
                                            <span className="text-destructive/80 font-bold bg-destructive/10 px-1 rounded">Action Irreversible:</span> System will require a full file-by-file re-scan to identify duplicates again.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                </div>

                                <AlertDialogFooter className="flex-col gap-2 relative z-10 sm:flex-col sm:space-x-0">
                                    <AlertDialogAction
                                        disabled={isResetting}
                                        onClick={async (e) => {
                                            e.preventDefault();
                                            setIsResetting(true);
                                            try {
                                                await new Promise(resolve => setTimeout(resolve, 800));
                                                await invoke("reset_cache");
                                                setIsResetOpen(false);
                                                setTimeout(() => {
                                                    toast.success("Purge Complete", {
                                                        description: "Database cleared successfully. Ready for new scan.",
                                                    });
                                                }, 200);
                                            } catch (error) {
                                                console.error("Failed to reset cache", error);
                                                toast.error("Reset Failed", {
                                                    description: "Check console for details.",
                                                });
                                            } finally {
                                                setIsResetting(false);
                                            }
                                        }}
                                        className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90 h-9 text-xs font-black uppercase tracking-wider shadow-lg shadow-destructive/20"
                                    >
                                        {isResetting ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : "EXECUTE PURGE"}
                                    </AlertDialogAction>
                                    <AlertDialogCancel disabled={isResetting} className="w-full h-8 text-xs font-bold uppercase tracking-wider border-white/5 hover:bg-white/5 hover:text-white bg-transparent">
                                        ABORT
                                    </AlertDialogCancel>
                                </AlertDialogFooter>
                            </div>
                        </AlertDialogContent>
                    </AlertDialog>

                </div>
            </SidebarFooter>
        </Sidebar>
    );
}
