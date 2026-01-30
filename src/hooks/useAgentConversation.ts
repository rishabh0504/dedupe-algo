import { useCallback, useRef, useState } from "react";
import { JARVIS_CONFIG } from "../config/jarvisConfig";
import { JarvisEvent, jarvisService } from "../services/jarvisService";
import { llmService } from "../services/llmService";
import { ttsService } from "../services/ttsService";

export type ConversationState = "Idle" | "Listening" | "Thinking" | "Speaking";

export type Message = {
    role: 'user' | 'assistant';
    content: string;
};

export function useAgentConversation(_isVoiceEnabled: boolean) {
    const [state, setState] = useState<ConversationState>("Idle");
    const [status, setStatus] = useState<string>("Ready");
    const [messages, setMessages] = useState<Message[]>([]);

    const stateRef = useRef<ConversationState>("Idle");
    const isBusyRef = useRef(true); // Start locked for Step 0 (Startup)
    const commandBufferRef = useRef<string>("");
    const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const hasStartedRef = useRef(false);

    const updateState = useCallback((newState: ConversationState, newStatus?: string) => {
        console.log(`[Mutex Step]: ${stateRef.current} -> ${newState} (${newStatus || ''})`);
        stateRef.current = newState;
        setState(newState);
        if (newStatus) setStatus(newStatus);
    }, []);

    const addMessage = useCallback((role: 'user' | 'assistant', content: string) => {
        setMessages(prev => [...prev, { role, content }]);
    }, []);

    const addSystemMessage = useCallback((content: string) => {
        addMessage('assistant', `[SYSTEM]: ${content}`);
    }, [addMessage]);

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
        addSystemMessage("Activating Microphone...");
        updateState("Idle", "Resetting...");
        isBusyRef.current = true;

        // Strict 500ms echo cooldown
        await new Promise(r => setTimeout(r, 500));

        try {
            console.log("🔓 Requesting Sidecar START_LISTENER...");
            await jarvisService.setMuted(false);
            console.log("🔓 Sidecar Unmuted. Enabling Listener...");
            addSystemMessage("System Ready - I am Listening, Sir.");
            commandBufferRef.current = "";
            isBusyRef.current = false;
            updateState("Listening", "Listening...");
        } catch (error) {
            console.error("Critical: Failed to open ear during Reset:", error);
            isBusyRef.current = false;
            updateState("Listening", "Listening (Safe)");
        }
    }, [updateState, addSystemMessage]);

    const processCommand = useCallback(async (text: string) => {
        if (!text.trim()) {
            await resetToListening();
            return;
        }

        isBusyRef.current = true;

        // 1. LOCK MIC
        addSystemMessage("Requesting Mic Lock...");
        updateState("Thinking", "Locking...");
        await jarvisService.setMuted(true);
        addSystemMessage("Mic Locked (Confirmed)");

        // 2. THINKING
        updateState("Thinking", "Thinking...");
        addMessage('assistant', "");

        try {
            let fullReply = "";
            await llmService.chat(text, (token) => {
                fullReply += token;
                updateLastMessage(fullReply);
            });

            // 3. SPEAKING (MIC IS ALREADY LOCKED)
            addSystemMessage("Jarvis Speaking...");
            updateState("Speaking", "Speaking...");
            await ttsService.speak(fullReply);

        } catch (error) {
            console.error("Jarvis Logic Failure:", error);
            setStatus("Error");
            updateLastMessage("I'm sorry Sir, I encountered an internal error.");
        } finally {
            // 4. UNLOCK MIC
            await resetToListening();
        }
    }, [addMessage, updateLastMessage, resetToListening, updateState, addSystemMessage]);

    // Handle incoming events from Jarvis Service
    const handleVoiceEvent = useCallback(async (event: JarvisEvent) => {
        // 1. Handle Startup/Ready Signal
        if (event.event === "ready" && !hasStartedRef.current) {
            hasStartedRef.current = true;
            console.log("🚀 Jarvis Sidecar is READY. Starting greeting...");

            isBusyRef.current = true;
            updateState("Speaking", "Awaiting Mic Lock...");

            // Initial Lock
            addSystemMessage("Requesting Mic Lock...");
            await jarvisService.setMuted(true);
            addSystemMessage("Mic Locked (Startup)");

            const greeting = JARVIS_CONFIG.INITIAL_GREETING;
            addMessage('assistant', greeting);
            addSystemMessage("Greeting Boss...");
            await ttsService.speak(greeting);

            await resetToListening();
            return;
        }

        // 2. MUTEX: Only process transcription if we are in Step 1 (Listen)
        if (isBusyRef.current) return;

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
                // optional: addSystemMessage("Discarded empty noise");
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
                    processCommand(finalCmd);
                } else {
                    // Canceled/Empty fragments
                    setMessages(prev => prev.slice(0, -1));
                    resetToListening();
                }
            }, JARVIS_CONFIG.COMMAND_SILENCE_TIMEOUT);
        }
    }, [addMessage, updateLastMessage, processCommand, resetToListening, updateState]);

    const handleManualSend = useCallback(async (text: string) => {
        if (!text.trim() || isBusyRef.current) return;
        addMessage('user', text);
        await processCommand(text);
    }, [addMessage, processCommand]);

    return {
        state,
        status,
        messages,
        handleVoiceEvent,
        handleManualSend
    };
}