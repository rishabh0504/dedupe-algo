import { useCallback, useState } from "react";
import { llmService } from "../services/llmService";
import { agentOrchestrator } from "../services/agent/AgentOrchestrator";

export type ConversationState = "Idle" | "Thinking";

export type Message = {
    role: 'user' | 'assistant';
    content: string;
};

export function useTextConversationAgent() {
    const [state, setState] = useState<ConversationState>("Idle");
    const [messages, setMessages] = useState<Message[]>([]);

    const addMessage = useCallback((role: 'user' | 'assistant', content: string) => {
        setMessages(prev => [...prev, { role, content }]);
    }, []);

    const updateLastMessage = useCallback((content: string) => {
        setMessages(prev => {
            if (prev.length === 0) return prev;
            const newMessages = [...prev];
            newMessages[newMessages.length - 1] = {
                ...newMessages[newMessages.length - 1],
                content
            };
            return newMessages;
        });
    }, []);

    const handleManualSend = useCallback(async (text: string) => {
        console.log("[useTextConversationAgent] Received:", text);
        if (!text.trim() || state === 'Thinking') return;

        // 1. User Message
        addMessage('user', text);

        // 2. Set State
        setState("Thinking");
        // No provisional "assistant" message yet, waiting for router...

        try {
            // 3. ROUTER: Task vs Chat?
            console.log("[AgentRouter] Analyzing intent for:", text);

            let route = "CHAT";
            if (text.startsWith("/")) {
                console.log("[AgentRouter] Force-Task Triggered by '/'");
                route = "TASK";
            } else {
                route = await llmService.generate(
                    `Is this a request to perform a system task (file op, command, search) or just a chat?
                     Input: "${text}"
                     Return EXACTLY 'TASK' or 'CHAT'. Do not add punctuation.`,
                    { model: "gemma3:1b", system: "You are a rigid Classifier." }
                );
            }

            console.log("[AgentRouter] Decision:", route);

            if (route.includes("TASK")) {
                // --- AGENT EXECUTION ---
                let agentLog = "🧠 Agent Activated...\n";
                addMessage('assistant', agentLog); // Start the message

                const result = await agentOrchestrator.execute(text, (step: any) => {
                    // Stream steps to the UI
                    const icon = step.type === 'thought' ? '🤔' : step.type === 'action' ? '⚡' : step.type === 'error' ? '❌' : '✅';
                    agentLog += `\n${icon} ${step.content}`;
                    updateLastMessage(agentLog);
                });

                if (result === "CHAT_DELEGATION") {
                    // Fallback to chat
                    let fullReply = "";
                    await llmService.chat(text, (token) => {
                        fullReply += token;
                        updateLastMessage(fullReply);
                    });
                } else {
                    updateLastMessage(result);
                }

            } else {
                // --- STANDARD CHAT ---
                addMessage('assistant', "");
                let fullReply = "";
                await llmService.chat(text, (token) => {
                    fullReply += token;
                    updateLastMessage(fullReply);
                });
            }

        } catch (error) {
            console.error("Agent Logic Failure:", error);
            updateLastMessage("I'm sorry Sir, I encountered an internal error.");
        } finally {
            setState("Idle");
        }
    }, [state, addMessage, updateLastMessage]);

    // Stub for compatibility with SpeakToAetherView
    const resetToListening = useCallback(() => {
        // No-op in text mode
    }, []);

    const stopListening = useCallback(() => {
        // No-op in text mode
    }, []);

    return {
        state: state as "Idle" | "Thinking" | "Listening" | "Speaking", // Cast for compatibility
        status: state === 'Thinking' ? "Thinking..." : "Ready",
        messages,
        handleVoiceEvent: async () => { }, // No-op
        handleManualSend,
        resetToListening,
        stopListening
    };
}