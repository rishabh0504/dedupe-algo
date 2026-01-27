import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";

export interface Drive {
    name: string;
    mount_point: string;
    total_space: number;
    available_space: number;
    is_removable: boolean;
}

export function useDrives() {
    return useQuery({
        queryKey: ["drives"],
        queryFn: async () => {
            // Prioritize the bash-level command for performance
            return await invoke<Drive[]>("get_available_drives_bash");
        },
        refetchInterval: 30000, // Refresh every 30 seconds
    });
}
