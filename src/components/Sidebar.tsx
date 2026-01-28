import React from "react";
import { useDrives, Drive } from "../hooks/useDrives";
import { useStore } from "../store/useStore";
import {
    HardDrive,
    Loader2,
    Activity,
    Plus,
    Minus,
    Database,
    ExternalLink,
    ChevronRight,
    Monitor,
    FileText,
    Download,
    Eye,
    EyeOff,
    Image,
    Video,
    FileArchive
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { Switch } from "@/components/ui/switch";
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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function AppSidebar() {
    const { data: drives, isLoading: isLoadingDrives } = useDrives();
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
        setScanZips
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
                        "group h-auto py-3 px-3 rounded-xl transition-all duration-200",
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
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0" />
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
            <SidebarHeader className="p-6">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
                        <img src="/src/assets/logo.png" alt="Logo" className="w-7 h-7 object-contain" />
                    </div>
                    <div className="flex flex-col">
                        <h2 className="text-lg font-black tracking-tighter uppercase italic leading-none">dedupe-algo</h2>
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1 opacity-50">Studio Interface</span>
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

                <SidebarGroup className="mt-6">
                    <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.2em] font-black opacity-30 px-3 mb-4 text-left block w-full">Telemetry Hub</SidebarGroupLabel>
                    <div className="px-3 space-y-2">
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-secondary/10 border border-border/20 group hover:border-primary/20 transition-colors cursor-default">
                            <div className="flex items-center gap-2">
                                <Activity className="w-3.5 h-3.5 text-primary opacity-50" />
                                <span className="text-[10px] font-bold uppercase tracking-wider opacity-40">Load Priority</span>
                            </div>
                            <Badge variant="outline" className="text-[9px] font-black h-4 px-1 border-primary/20 text-primary">HIGH</Badge>
                        </div>
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-secondary/10 border border-border/20 group hover:border-primary/20 transition-colors cursor-default">
                            <div className="flex items-center gap-2">
                                <Database className="w-3.5 h-3.5 text-primary opacity-50" />
                                <span className="text-[10px] font-bold uppercase tracking-wider opacity-40">IO Stack</span>
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 opacity-20" />
                        </div>
                    </div>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="p-4 border-t border-border/40">
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-2">
                            {scanHidden ? <Eye className="w-3.5 h-3.5 text-primary" /> : <EyeOff className="w-3.5 h-3.5 text-muted-foreground opacity-40" />}
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Scan Hidden</span>
                        </div>
                        <Switch
                            checked={scanHidden}
                            onCheckedChange={setScanHidden}
                            disabled={isScanning}
                            className="scale-75"
                        />
                    </div>

                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-2">
                            <Image className={cn("w-3.5 h-3.5", scanImages ? "text-primary" : "text-muted-foreground opacity-40")} />
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Images</span>
                        </div>
                        <Switch
                            checked={scanImages}
                            onCheckedChange={setScanImages}
                            disabled={isScanning}
                            className="scale-75"
                        />
                    </div>

                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-2">
                            <Video className={cn("w-3.5 h-3.5", scanVideos ? "text-primary" : "text-muted-foreground opacity-40")} />
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Videos</span>
                        </div>
                        <Switch
                            checked={scanVideos}
                            onCheckedChange={setScanVideos}
                            disabled={isScanning}
                            className="scale-75"
                        />
                    </div>

                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-2">
                            <FileArchive className={cn("w-3.5 h-3.5", scanZips ? "text-primary" : "text-muted-foreground opacity-40")} />
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Archives</span>
                        </div>
                        <Switch
                            checked={scanZips}
                            onCheckedChange={setScanZips}
                            disabled={isScanning}
                            className="scale-75"
                        />
                    </div>
                    <div className="flex items-center gap-3 px-2">
                        <div className="w-2 h-2 rounded-full bg-primary/40" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-30">V0.1.0 Build Stable</span>
                    </div>
                </div>
            </SidebarFooter>
        </Sidebar>
    );
}
