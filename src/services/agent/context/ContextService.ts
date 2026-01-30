import { Command } from "@tauri-apps/plugin-shell";

export interface RuntimeContext {
    os: string;
    user: string;
    home: string;
    cwd: string;
    shell: string;
}

export class ContextService {
    private static instance: ContextService;
    private context: RuntimeContext | null = null;

    private constructor() { }

    static getInstance(): ContextService {
        if (!ContextService.instance) {
            ContextService.instance = new ContextService();
        }
        return ContextService.instance;
    }

    async initialize(): Promise<void> {
        if (this.context) return;

        console.log("[ContextService] Initializing Runtime Context...");

        // CACHE CHECK: Use localhost caching if already analyzed
        const CACHE_KEY = "AGENT_RUNTIME_CONTEXT";
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            try {
                this.context = JSON.parse(cached);
                console.log("[ContextService] Context loaded from cache:", this.context);
                return;
            } catch (e) {
                console.warn("[ContextService] Invalid cache, refreshing...");
                localStorage.removeItem(CACHE_KEY);
            }
        }

        try {
            const [user, home, cwd] = await Promise.all([
                this.runCommand("whoami"),
                this.runCommand("echo $HOME"),
                this.runCommand("pwd")
            ]);

            this.context = {
                os: "macOS", // Hardcoded for now as per plan, can be dynamic later
                user: user.trim(),
                home: home.trim(),
                cwd: cwd.trim(),
                shell: "/bin/zsh"
            };

            // SAVE TO CACHE
            localStorage.setItem(CACHE_KEY, JSON.stringify(this.context));

            console.log("[ContextService] Context Acquired & Cached:", this.context);
        } catch (error) {
            console.error("[ContextService] Failed to gather context:", error);
            // Fallback context to prevent crash
            this.context = {
                os: "macOS",
                user: "unknown",
                home: "/Users/unknown",
                cwd: "/",
                shell: "/bin/zsh"
            };
        }
    }

    getContext(): RuntimeContext {
        if (!this.context) {
            console.warn("[ContextService] Context accessed before initialization. Returning fallback.");
            return {
                os: "macOS",
                user: "user",
                home: "/Users/user",
                cwd: "/",
                shell: "/bin/zsh"
            };
        }
        return this.context;
    }

    getContextString(): string {
        const ctx = this.getContext();
        return `
## Runtime Context
- OS: ${ctx.os}
- User: ${ctx.user}
- Home: ${ctx.home}
- CWD (Current Working Directory): ${ctx.cwd}
- Shell: ${ctx.shell}
        `.trim();
    }

    private async runCommand(cmd: string): Promise<string> {
        const command = await Command.create("/bin/zsh", ["-c", cmd]);
        const output = await command.execute();
        if (output.code === 0) {
            return output.stdout;
        }
        throw new Error(`Command '${cmd}' failed: ${output.stderr}`);
    }
}

export const contextService = ContextService.getInstance();
