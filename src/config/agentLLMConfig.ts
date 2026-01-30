import { DEFAULT_MODEL_ID } from "./llmConfig";

export const AGENT_MODELS = {
    // Ultra-fast model for simple NLP tasks like Intent Refinement
    INTENT: "gemma3:1b",

    // Fast model for routine chat and routing decisions
    ROUTER: "gemma3:4b",

    // Smart model for complex reasoning and coding
    CODER: "qwen2.5-coder:3b", // Optimized for Code/Bash generation

    // Fallback
    DEFAULT: DEFAULT_MODEL_ID
};

export const TOOL_MODEL_MAP: Record<string, string> = {
    'execute_bash': AGENT_MODELS.CODER,
    'read_file': AGENT_MODELS.DEFAULT,
    'write_file': AGENT_MODELS.CODER
};

export function getModelForTool(toolName: string): string {
    return TOOL_MODEL_MAP[toolName] || AGENT_MODELS.DEFAULT;
}
