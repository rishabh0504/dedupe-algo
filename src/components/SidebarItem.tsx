import { useState } from "react";
import { Drive } from "../hooks/useDrives";
import { invoke } from "@tauri-apps/api/core";
import {
    ChevronRight,
    ChevronDown,
    Folder,
    Loader2,
    Plus,
    Minus,
    ExternalLink,
    Monitor,
    FileText,
    Download,
    HardDrive
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { useStore } from "@/store/useStore";

interface SidebarItemProps {
    node: Drive;
    level?: number;
}

export function SidebarItem({ node, level = 0 }: SidebarItemProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [children, setChildren] = useState<Drive[]>([]);
    const [hasLoaded, setHasLoaded] = useState(false);
    const { scanQueue, addToQueue, removeFromQueue, isScanning } = useStore();

    const isQueued = scanQueue.includes(node.mount_point);

    const handleExpand = async (e: React.MouseEvent) => {
        e.stopPropagation();

        if (isExpanded) {
            setIsExpanded(false);
            return;
        }

        setIsExpanded(true);

        if (!hasLoaded) {
            setIsLoading(true);
            try {
                const subdirs = await invoke<Drive[]>("get_subdirectories", { path: node.mount_point });
                setChildren(subdirs);
                setHasLoaded(true);
            } catch (error) {
                console.error("Failed to load subdirectories", error);
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleToggleQueue = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isScanning) return;

        if (isQueued) {
            removeFromQueue(node.mount_point);
        } else {
            addToQueue(node.mount_point);
        }
    };

    const getIcon = (label: string, isRemovable: boolean) => {
        if (isRemovable) return <ExternalLink className="w-4 h-4" />;
        // Specific icons for known system roots (at level 0)
        if (level === 0) {
            if (label === "Desktop") return <Monitor className="w-4 h-4" />;
            if (label === "Documents") return <FileText className="w-4 h-4" />;
            if (label === "Downloads") return <Download className="w-4 h-4" />;
            if (label.startsWith("/Volumes")) return <HardDrive className="w-4 h-4" />;
        }
        return <Folder className="w-4 h-4" />;
    };

    return (
        <div className="flex flex-col select-none">
            <SidebarMenuItem>
                <SidebarMenuButton
                    onClick={handleExpand}
                    className={cn(
                        "group h-auto py-2 pr-2 pl-0 rounded-lg transition-all duration-200 cursor-pointer hover:bg-muted/50",
                        isQueued && "bg-primary/5 hover:bg-primary/10"
                    )}
                >
                    <div className="flex items-center w-full gap-2" style={{ paddingLeft: `${level * 12 + 8}px` }}>
                        {/* Expand Chevron */}
                        <div
                            className={cn(
                                "p-0.5 rounded-md hover:bg-muted/50 text-muted-foreground transition-colors",
                                isLoading && "animate-spin"
                            )}
                        >
                            {isLoading ? (
                                <Loader2 className="w-3 h-3" />
                            ) : (
                                isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />
                            )}
                        </div>

                        {/* Icon */}
                        <div className={cn(
                            "w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors",
                            isQueued ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/50 text-muted-foreground group-hover:bg-muted"
                        )}>
                            {getIcon(node.name, node.is_removable)}
                        </div>

                        {/* Label */}
                        <div className="flex flex-col flex-1 min-w-0">
                            <span className={cn(
                                "text-xs font-medium truncate transition-colors",
                                isQueued ? "text-primary font-bold" : "text-foreground/80 group-hover:text-foreground"
                            )}>
                                {node.name}
                            </span>
                            {level === 0 && (
                                <span className="text-[9px] text-muted-foreground opacity-50 truncate hidden group-hover:block">
                                    {node.mount_point}
                                </span>
                            )}
                        </div>

                        {/* Action */}
                        <div
                            role="button"
                            onClick={handleToggleQueue}
                            className={cn(
                                "flex items-center justify-center w-6 h-6 rounded-md transition-all",
                                isQueued
                                    ? "hover:bg-destructive/10 text-primary hover:text-destructive"
                                    : "opacity-0 group-hover:opacity-100 hover:bg-primary/10 text-muted-foreground hover:text-primary"
                            )}
                        >
                            {isQueued ? (
                                <Minus className="w-3.5 h-3.5" />
                            ) : (
                                <Plus className="w-3.5 h-3.5" />
                            )}
                        </div>
                    </div>
                </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Children */}
            {isExpanded && (
                <div className="flex flex-col relative">
                    {/* Guide Line */}
                    <div className="absolute left-0 top-0 bottom-0 w-px bg-border/20" style={{ left: `${level * 12 + 15}px` }} />

                    {children.length > 0 ? (
                        children.map((child) => (
                            <SidebarItem
                                key={child.mount_point}
                                node={child}
                                level={level + 1}
                            />
                        ))
                    ) : hasLoaded && !isLoading && (
                        <div className="py-2 text-[10px] text-muted-foreground italic opacity-50" style={{ paddingLeft: `${(level + 1) * 12 + 24}px` }}>
                            Empty folder
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
