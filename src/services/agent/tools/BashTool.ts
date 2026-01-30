import { Command } from "@tauri-apps/plugin-shell";
import { z } from "zod";
import { ITool, IToolInput, IToolOutput } from "../core/ITool";
import { AGENT_MODELS } from "../../../config/agentLLMConfig"; // Adjust path as needed

export class BashTool implements ITool {
    readonly name = "execute_bash";
    readonly description = "Executes a bash command or script. Use for file operations, searching, and system tasks.";

    readonly schema = z.object({
        command: z.string().describe("The bash command or script to execute."),
        cwd: z.string().optional().describe("The working directory for execution. Defaults to workspace root.")
    });

    readonly preferredModel = AGENT_MODELS.CODER;

    async execute(input: IToolInput): Promise<IToolOutput> {
        const { command, cwd } = input;

        if (!command) {
            return { success: false, error: "No command provided." };
        }

        // CLEANUP: Aggressively strip Markdown code blocks (json, bash, etc)
        let cleanCommand = command.trim();
        // Remove starting ```language
        cleanCommand = cleanCommand.replace(/^```\w*\n?/g, '');
        // Remove ending ```
        cleanCommand = cleanCommand.replace(/```$/g, '');
        // Trim again
        cleanCommand = cleanCommand.trim();

        // Fallback: If the command is mistakenly wrapped in JSON object structure by the LLM
        if (cleanCommand.startsWith('{') && cleanCommand.includes('"command":')) {
            try {
                const parsed = JSON.parse(cleanCommand);
                if (parsed.command) cleanCommand = parsed.command;
            } catch (e) {
                // Not valid JSON, ignore
            }
        }

        try {
            console.log(`[BashTool] Executing: ${cleanCommand} in ${cwd || 'default'}`);

            // Spawn zsh with the command
            const childKey = await Command.create("/bin/zsh", ["-c", cleanCommand], { cwd });

            const output = await childKey.execute();

            if (output.code === 0) {
                // TRUNCATE: Prevent massive outputs from crashing the LLM context
                // But allow enough for the user to see (Summary will protect LLM)
                let data = output.stdout;
                const MAX_CHARS = 50000;
                if (data.length > MAX_CHARS) {
                    data = data.substring(0, MAX_CHARS) + `\n\n[...Output Truncated. Total length: ${output.stdout.length} chars...]`;
                }

                return {
                    success: true,
                    data: data
                };
            } else {
                return {
                    success: false,
                    error: `Exit Code ${output.code}: ${output.stderr || output.stdout}`
                };
            }
        } catch (error: any) {
            console.error("[BashTool] Exception:", error);
            const msg = error.toString();
            if (msg.includes("invalid utf-8") || msg.includes("buffer")) {
                return {
                    success: false,
                    error: "Execution failed: Binary data detected. Do NOT use 'cat' on this target. Use 'ls' or 'file' instead."
                };
            }
            return {
                success: false,
                error: `Execution failed: ${error.message}`
            };
        }
    }
}
