import { z } from "zod";

export interface IToolInput {
    [key: string]: any;
}

export interface IToolOutput {
    success: boolean;
    data?: string;
    error?: string;
}

export interface ITool {
    /**
     * Unique name of the tool (e.g., 'execute_bash', 'read_file').
     * Used by the LLM to select the tool.
     */
    readonly name: string;

    /**
     * Description of what the tool does and when to use it.
     * Injected into the LLM system prompt.
     */
    readonly description: string;

    /**
     * Zod schema for validating the input arguments from the LLM.
     */
    readonly schema: z.ZodSchema;

    /**
     * Optional: The preferred model to be used when this tool is active.
     */
    readonly preferredModel?: string;

    /**
     * Execute the tool with the validated input.
     */
    execute(input: IToolInput): Promise<IToolOutput>;
}
