import { useCallback, useRef, useState } from "react";
import { JARVIS_CONFIG } from "../config/jarvisConfig";
import { JarvisEvent, jarvisService } from "../services/jarvisService";
import { llmService } from "../services/llmService";
import { ttsService } from "../services/ttsService";
import { agentOrchestrator } from "../services/agent/AgentOrchestrator";

export type ConversationState = "Idle" | "Listening" | "Thinking" | "Speaking";

export type Message = {
    role: 'user' | 'assistant';
    content: string;
};

export function useVoiceConversationAgent() {
    const [state, setState] = useState<ConversationState>("Idle");
    const [status, setStatus] = useState<string>("Ready");
    const [messages, setMessages] = useState<Message[]>([]);

    const stateRef = useRef<ConversationState>("Idle");
    const isBusyRef = useRef(true); // Start locked for Step 0 (Startup)
    const commandBufferRef = useRef<string>("");
    const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const hasStartedRef = useRef(false);

    const updateState = useCallback((newState: ConversationState, newStatus?: string) => {
        console.log(`[VoiceAgent]: ${stateRef.current} -> ${newState} (${newStatus || ''})`);
        stateRef.current = newState;
        setState(newState);
        if (newStatus) setStatus(newStatus);
    }, []);

    const addMessage = useCallback((role: 'user' | 'assistant', content: string) => {
        setMessages(prev => [...prev, { role, content }]);
    }, []);

    const addSystemMessage = useCallback((content: string) => {
        setStatus(content);
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

    // Step 4: Reset -> Step 1: Listen
    const resetToListening = useCallback(async () => {
        updateState("Idle", "Resetting...");
        isBusyRef.current = true;

        // Strict 500ms echo cooldown
        await new Promise(r => setTimeout(r, 500));

        try {
            console.log("🔓 Requesting Sidecar START_LISTENER...");
            await jarvisService.setMuted(false);
            console.log("🔓 Sidecar Unmuted. Enabling Listener...");
            commandBufferRef.current = "";

            isBusyRef.current = false;
            updateState("Listening", "Listening...");
        } catch (error) {
            console.error("Critical: Failed to open ear during Reset:", error);
            isBusyRef.current = false;
            updateState("Listening", "Listening (Safe)");
        }
    }, [updateState]);

    // ... (This will be empty, I will use separate replace for top of file)

    // ...

    const processCommand = useCallback(async (text: string, shouldSpeak: boolean = true) => {
        if (!text.trim()) {
            await resetToListening();
            return;
        }

        isBusyRef.current = true;
        console.log("[VoiceAgent] Processing:", text);

        // 1. LOCK MIC (If speaking)
        if (shouldSpeak) {
            updateState("Thinking", "Locking...");
            await jarvisService.setMuted(true);
        } else {
            updateState("Thinking", "Thinking...");
        }

        // 2. THINKING
        addMessage('assistant', "");

        try {
            // ROUTER LOGIC
            let route = "CHAT";
            const routerPrompt = `Is this a request to perform a system task (file op, command, search) or just a chat?
                 Input: "${text}"
                 Return EXACTLY 'TASK' or 'CHAT'. Do not add punctuation.`;

            if (text.startsWith("/")) {
                route = "TASK";
            } else {
                route = await llmService.generate(routerPrompt, {
                    model: "gemma3:1b",
                    system: "You are a rigid Classifier."
                });
            }

            console.log("[VoiceAgent] Route:", route);

            if (route.includes("TASK")) {
                let agentLog = "🧠 Agent Activated...";
                // Update UI once
                updateLastMessage(agentLog);

                const result = await agentOrchestrator.execute(text, (step: any) => {
                    const icon = step.type === 'thought' ? '🤔' : step.type === 'action' ? '⚡' : step.type === 'error' ? '❌' : '✅';
                    agentLog += `\n${icon} ${step.content}`;
                    updateLastMessage(agentLog);
                });

                // Update with Final Answer
                if (shouldSpeak) {
                    updateState("Speaking", "Speaking...");
                    await ttsService.speak(result);
                }
                updateLastMessage(result); // Final result replaces log or appends? usually separate. 
                // Actually the orchestrator loop updates log. The result is the final text.
                // Let's append if it's text.

            } else {
                // CHAT
                let fullReply = "";
                await llmService.chat(text, (token) => {
                    fullReply += token;
                    updateLastMessage(fullReply);
                });

                if (shouldSpeak) {
                    updateState("Speaking", "Speaking...");
                    await ttsService.speak(fullReply);
                }
            }

        } catch (error) {
            console.error("Jarvis Logic Failure:", error);
            setStatus("Error");
            updateLastMessage("I'm sorry Sir, I encountered an internal error.");
        } finally {
            // 4. RESET STATE
            if (shouldSpeak) {
                // Return to listening
                await resetToListening();
            } else {
                // Text mode, just unlock
                isBusyRef.current = false;
                updateState("Idle", "Standby");
            }
        }
    }, [addMessage, updateLastMessage, resetToListening, updateState]);

    // Handle incoming events from Jarvis Service
    const handleVoiceEvent = useCallback(async (event: JarvisEvent) => {
        // 1. Handle Startup/Ready Signal (Stay in Standby)
        if (event.event === "ready" && !hasStartedRef.current) {
            hasStartedRef.current = true;
            console.log("🚀 Jarvis Sidecar is READY. Awaiting manual activation.");
            addSystemMessage("Neural Interface Ready");
            return;
        }

        // 2. MUTEX: Only process transcription if we are in Step 1 (Listen)
        if (isBusyRef.current || stateRef.current === 'Idle') return;

        if (event.event === "voice_start") {
            addSystemMessage("Voice Detected...");
            setStatus("I'm listening Sir...");
            return;
        }

        if (event.event === "voice_end") {
            // Only revert if we were in the listening status
            if (status === "I'm listening Sir...") {
                setStatus("Listening...");
            }
            return;
        }

        if (event.event === "processing") {
            addSystemMessage("Thinking...");
            setStatus("Thinking...");
            return;
        }

        if (event.event === "transcription") {
            const newText = (event.text || "").trim();
            console.log(`[Jarvis Event]: Transcription: "${newText}" (Busy: ${isBusyRef.current})`);

            if (!newText) {
                return;
            }

            // Immediate capture
            if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);

            const isNewCommand = commandBufferRef.current === "";
            commandBufferRef.current += (isNewCommand ? newText : " " + newText);

            if (isNewCommand) {
                addMessage('user', newText);
                updateState("Listening", "Capturing...");
            } else {
                updateLastMessage(commandBufferRef.current);
            }

            // Step 1: Listen until 1s silence
            silenceTimeoutRef.current = setTimeout(() => {
                const finalCmd = commandBufferRef.current.trim();
                if (finalCmd.length >= JARVIS_CONFIG.MIN_COMMAND_LENGTH) {
                    processCommand(finalCmd, true); // Speak when voice triggered
                } else {
                    // Canceled/Empty fragments
                    setMessages(prev => prev.slice(0, -1));
                    resetToListening();
                }
            }, JARVIS_CONFIG.COMMAND_SILENCE_TIMEOUT);
        }
    }, [addMessage, updateLastMessage, processCommand, resetToListening, updateState, addSystemMessage]);

    const stopListening = useCallback(async () => {
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
        commandBufferRef.current = "";

        // Lock mutex to prevent incoming events during shutdown
        isBusyRef.current = true;
        updateState("Idle", "Standby");

        try {
            console.log("🔒 Requesting Sidecar MUTE (Stop Listening)...");
            await jarvisService.setMuted(true);
        } catch (error) {
            console.error("Failed to mute sidecar on stop:", error);
        } finally {
            isBusyRef.current = false; // State is Idle, so gate check will block events
        }
    }, [updateState]);

    const handleManualSend = useCallback(async (text: string) => {
        if (!text.trim() || isBusyRef.current) return;
        addMessage('user', text);
        await processCommand(text, false); // Disable TTS for manual input
    }, [addMessage, processCommand]);

    return {
        state,
        status,
        messages,
        handleVoiceEvent,
        handleManualSend,
        resetToListening,
        stopListening
    };
}
