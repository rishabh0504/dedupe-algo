import { llmService } from "../llmService";
import { toolRegistry } from "./ToolRegistry";
import { AGENT_MODELS, getModelForTool } from "../../config/agentLLMConfig";
import { SYSTEM_PROMPTS } from "./prompts/systemPrompts";
import { contextService } from "./context/ContextService";

export interface AgentStep {
    id: string;
    type: 'thought' | 'action' | 'observation' | 'error';
    content: string;
    timestamp: number;
}

export class AgentOrchestrator {
    private isRunning = false;

    async execute(objective: string, onStep: (step: AgentStep) => void): Promise<string> {
        console.log("[AgentOrchestrator] Starting Execution:", objective);
        if (this.isRunning) throw new Error("Agent is already running");
        this.isRunning = true;

        try {
            // 0. INIT CONTEXT
            await contextService.initialize();
            const runtimeContext = contextService.getContextString();

            // 0.5 INTENT REFINEMENT
            this.emitStep(onStep, 'thought', `Refining intent: "${objective}"`);

            const refinementPrompt = SYSTEM_PROMPTS.INTENT_REFINER.replace('{{CONTEXT}}', runtimeContext);

            const refinedObjective = await llmService.generate(objective, {
                model: AGENT_MODELS.INTENT, // Use ultra-fast model for refinement
                system: refinementPrompt
            });

            this.emitStep(onStep, 'thought', `Optimized Objective: "${refinedObjective}"`);

            // --- RECURSIVE LOOP START ---
            let steps = 0;
            const MAX_STEPS = 5;
            const history: string[] = [];

            while (steps < MAX_STEPS) {
                steps++;

                // 1. ROUTING (Recursive)
                // SUMMARY: Truncate only if massive to prevent crash. 15k is effectively "Full" for text.
                const summarizedHistory = history.map(entry => {
                    const SUMMARY_LIMIT = 15000; // Unleashed. Matches BashTool output.
                    if (entry.length > SUMMARY_LIMIT) {
                        return entry.substring(0, SUMMARY_LIMIT) + "... [Output Truncated]";
                    }
                    return entry;
                });

                const historyBlock = summarizedHistory.length > 0 ? `\n## History\n${summarizedHistory.join('\n')}` : '';
                const routingPrompt = `
Objective: ${refinedObjective}
${historyBlock}
Available Tools:
${toolRegistry.getToolDefinitions()}

Which tool should I use next? Return ONLY the tool name. If done, return "FINAL_ANSWER".
`.trim();

                const routingResponse = await llmService.generate(routingPrompt, {
                    model: AGENT_MODELS.ROUTER,
                    system: SYSTEM_PROMPTS.RECURSIVE_ORCHESTRATOR,
                    json: true // Force JSON mode
                });

                let decision: any;
                try {
                    decision = JSON.parse(routingResponse);
                } catch (e) {
                    console.error("Router JSON Parse Error:", routingResponse);
                    // Fallback to simple string check if JSON fails (rare with json:true)
                    decision = { is_complete: false, tool: null };
                }

                // 2. CHECK FOR COMPLETION (Explicit Flag)
                if (decision.is_complete) {
                    this.emitStep(onStep, 'thought', 'Objective met. Generating final output...');

                    let finalAnswer = decision.final_answer;

                    // SMART FALLBACK: If LLM is lazy ("Task completed"), grab the actual data
                    if (!finalAnswer || finalAnswer.length < 50 || finalAnswer.toLowerCase().includes("task completed")) {
                        // Find last successful observation to show as result
                        const lastObs = history.slice().reverse().find(h => h.includes("Observation: Success"));
                        if (lastObs) {
                            const parts = lastObs.split("Output: ");
                            if (parts.length > 1) {
                                finalAnswer = parts[1]; // Use the actual command output
                            }
                        }
                    }

                    if (!finalAnswer) finalAnswer = "Task completed.";

                    this.emitStep(onStep, 'observation', `Done: ${finalAnswer}`);
                    return finalAnswer;
                }

                const toolName = decision.tool;
                if (!toolName) {
                    // Start next loop or fail if stuck
                    continue;
                }

                if (!toolRegistry.getTool(toolName)) {
                    const errorMsg = `Error: Tool '${toolName}' not found.`;
                    this.emitStep(onStep, 'error', errorMsg);
                    history.push(`System: ${errorMsg}`);
                    continue; // Retry
                }

                const tool = toolRegistry.getTool(toolName)!;
                // this.emitStep(onStep, 'thought', `Selected Tool: ${tool.name}`); // Optional: noise reduction

                // 2. GENERATION
                const generationModel = getModelForTool(tool.name);
                let systemPrompt = tool.name === 'execute_bash' ? SYSTEM_PROMPTS.BASH_EXPERT : SYSTEM_PROMPTS.ORCHESTRATOR;
                systemPrompt = systemPrompt.replace('{{CONTEXT}}', runtimeContext);

                // Inject history so BashTool knows previous failures (Summarized)
                systemPrompt += `\n\n## History (Learn from this)\n${summarizedHistory.join('\n')}`;

                this.emitStep(onStep, 'thought', `Planning ${tool.name}...`);

                const actionInputRaw = await llmService.generate(
                    `Generate the input for tool "${tool.name}" to satisfy: ${refinedObjective}`,
                    {
                        model: generationModel,
                        system: systemPrompt,
                        json: false
                    }
                );

                // 3. PARSING & EXECUTION
                let input: any = {};
                try {
                    if (tool.name === 'execute_bash') {
                        // NORMALIZATION: Try to parse as JSON first to prevent double-wrapping
                        try {
                            const parsed = JSON.parse(actionInputRaw);
                            if (parsed.command) {
                                input = { command: parsed.command };
                            } else {
                                input = { command: actionInputRaw.trim() };
                            }
                        } catch {
                            input = { command: actionInputRaw.trim() };
                        }
                    } else {
                        input = JSON.parse(actionInputRaw);
                    }
                } catch (e) {
                    const parseError = `Failed to parse input: ${actionInputRaw}`;
                    this.emitStep(onStep, 'error', parseError);
                    history.push(`System: ${parseError}`);
                    continue;
                }

                // LOOP DETECTION: Check if we just executed the EXACT same command
                const currentActionStr = `Action: ${tool.name} ${JSON.stringify(input)}`;
                const previousMatch = history.find(h => h.startsWith(currentActionStr));

                if (previousMatch) {
                    console.log("[AgentOrchestrator] Loop detected. Retrieving previous result.");

                    this.emitStep(onStep, 'thought', 'Action already performed. Generating final output from history...');

                    // Extract the previous observation to show as final result
                    // Format in history is: "Action: ... \nObservation: ... "
                    const obsParts = previousMatch.split('Observation: ');
                    const previousOutput = obsParts.length > 1 ? obsParts[1] : "Task completed successfully.";

                    const finalMsg = previousOutput;
                    this.emitStep(onStep, 'observation', `Done: ${finalMsg}`);
                    return finalMsg;
                }

                this.emitStep(onStep, 'action', `Executing ${tool.name}: ${JSON.stringify(input)}`);
                const result = await tool.execute(input);

                // 4. OBSERVATION & HISTORY UPDATE
                if (result.success) {
                    const obs = `Observation: Success. Output: ${result.data}`;
                    // Send FULL output to UI (User needs to see the files)
                    this.emitStep(onStep, 'observation', `Success: ${result.data}`);
                    history.push(`Action: ${tool.name} ${JSON.stringify(input)}\n${obs}`);
                } else {
                    const errorObs = `Observation: Failed. Error: ${result.error}`;
                    this.emitStep(onStep, 'error', `Failure: ${result.error}`);
                    history.push(`Action: ${tool.name} ${JSON.stringify(input)}\n${errorObs}`);
                }
            }

            return "Max steps reached. I stopped to prevent an infinite loop.";


        } catch (error: any) {
            this.emitStep(onStep, 'error', `Agent Crash: ${error.message}`);
            return `Agent System Error: ${error.message}`;
        } finally {
            this.isRunning = false;
        }
    }

    private emitStep(callback: (step: AgentStep) => void, type: AgentStep['type'], content: string) {
        callback({
            id: crypto.randomUUID(),
            type,
            content,
            timestamp: Date.now()
        });
    }
}

export const agentOrchestrator = new AgentOrchestrator();
