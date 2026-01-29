import { useRef, useState, useEffect, useCallback } from "react";
import { JarvisEvent } from "../services/jarvisService";
import { llmService } from "../services/llmService";
import { ttsService } from "../services/ttsService";
import { JARVIS_CONFIG } from "../config/jarvisConfig";

export type ConversationState = "Idle" | "Acknowledging" | "Listening" | "Thinking" | "Speaking";

export function useAgentConversation(_isVoiceEnabled: boolean) {
    const [state, setState] = useState<ConversationState>("Idle");
    const [status, setStatus] = useState<string>("Ready");
    const [transcript, setTranscript] = useState<string>("");

    // Refs for internal state tracking (synchronous)
    const stateRef = useRef<ConversationState>("Idle");
    const commandBufferRef = useRef<string>("");
    const inactivityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const hasGreetedRef = useRef(false);

    // Sync helper to update state AND ref
    const updateState = useCallback((newState: ConversationState, newStatus?: string) => {
        stateRef.current = newState;
        setState(newState);
        if (newStatus) setStatus(newStatus);
    }, []);

    // Initial Greeting
    useEffect(() => {
        const greet = async () => {
            if (!hasGreetedRef.current) {
                hasGreetedRef.current = true;

                // SYNCHRONOUS LOCK: Prevents transcription from processing while greeting starts
                updateState("Speaking", "Greeting...");

                await ttsService.speak("Welcome back, Rishi sir.");

                // Ensure transcript is clean after greeting (just in case of echoes)
                setTranscript("");

                // COOL OFF: Small delay before returning to Idle to ignore echo artifacts
                setTimeout(() => {
                    updateState("Idle", "Ready");
                }, 500);
            }
        };
        greet();
    }, [updateState]);

    const stopInactivityTimer = useCallback(() => {
        if (inactivityTimeoutRef.current) {
            clearTimeout(inactivityTimeoutRef.current);
            inactivityTimeoutRef.current = null;
        }
    }, []);

    const stopSilenceTimer = useCallback(() => {
        if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
            silenceTimeoutRef.current = null;
        }
    }, []);

    const resetSession = useCallback(() => {
        stopInactivityTimer();
        stopSilenceTimer();
        commandBufferRef.current = "";
        updateState("Idle", "Ready");
    }, [stopInactivityTimer, stopSilenceTimer, updateState]);

    const processCommand = useCallback(async (text: string) => {
        if (!text.trim()) return;

        updateState("Thinking", "Thinking...");

        try {
            // Add AI prefix to transcript
            setTranscript(prev => `${prev}\n\n🤖 `);

            const reply = await llmService.chat(text, (token) => {
                setTranscript(prev => prev + token);
            });

            updateState("Speaking", "Speaking...");

            await ttsService.speak(reply);
        } catch (error) {
            console.error("Agent thought failure:", error);
            setStatus("Brain Error");
        } finally {
            // COOL OFF after processing to prevent hearing the end of the AI's own sentence
            setTimeout(() => {
                resetSession();
            }, 800);
        }
    }, [resetSession, updateState]);

    const handleSilenceCompletion = useCallback(() => {
        const fullCommand = commandBufferRef.current.trim();
        if (fullCommand.length >= JARVIS_CONFIG.MIN_COMMAND_LENGTH) {
            console.log("Silence window met. Sending to LLM:", fullCommand);
            processCommand(fullCommand);
        } else {
            console.log("Silence met but text too short. Resetting.");
            resetSession();
        }
    }, [processCommand, resetSession]);

    const startSilenceTimer = useCallback(() => {
        stopSilenceTimer();
        silenceTimeoutRef.current = setTimeout(() => {
            handleSilenceCompletion();
        }, JARVIS_CONFIG.COMMAND_SILENCE_TIMEOUT);
    }, [handleSilenceCompletion, stopSilenceTimer]);

    const handleInactivityTimeout = useCallback(() => {
        console.log("User did not speak for 10s. Shutting down session.");
        resetSession();
    }, [resetSession]);

    const startInactivityTimer = useCallback(() => {
        stopInactivityTimer();
        inactivityTimeoutRef.current = setTimeout(() => {
            handleInactivityTimeout();
        }, JARVIS_CONFIG.SESSION_INACTIVITY_TIMEOUT);
    }, [handleInactivityTimeout, stopInactivityTimer]);

    const handleVoiceEvent = useCallback(async (event: JarvisEvent) => {
        // MUTEX: Primary defense against self-listening
        // If we are currently processing or speaking, discard all audio events
        if (stateRef.current === "Thinking" || stateRef.current === "Speaking" || stateRef.current === "Acknowledging") {
            return;
        }

        if (event.event === "transcription") {
            const newText = (event.text || "").trim();
            if (!newText) return;

            if (stateRef.current === "Idle") {
                // Check for wake word
                const normalized = newText.toLowerCase().replace(/[,\.\?!\-\:]/g, "").trim();
                const foundWakePhrase = JARVIS_CONFIG.WAKE_PHRASES.find(phrase => normalized.startsWith(phrase));

                if (foundWakePhrase) {
                    console.log("Wake Word Detected:", foundWakePhrase);

                    // FRESH START: Clear LLM history, visual transcript and buffer
                    llmService.clearHistory();
                    setTranscript("");
                    commandBufferRef.current = "";

                    updateState("Acknowledging", `Jarvis: ${JARVIS_CONFIG.ACKNOWLEDGMENT_TEXT}`);

                    // Respond with acknowledgment
                    await ttsService.speak(JARVIS_CONFIG.ACKNOWLEDGMENT_TEXT);

                    // Transition to Listening
                    updateState("Listening", "Listening... (waiting for command)");

                    // Start inactivity window (10s)
                    startInactivityTimer();

                    // Seed command buffer
                    const wakeWordRegex = new RegExp(`^${foundWakePhrase.split('').join('[\\s,\\.\\?!\\-:]*')}[\\s,\\.\\?!\\-:]*`, 'i');
                    const seed = newText.replace(wakeWordRegex, "").trim();
                    if (seed) {
                        commandBufferRef.current = seed;
                        setTranscript(`User: ${seed}`);
                        stopInactivityTimer();
                        startSilenceTimer();
                    }
                } else {
                    // Just update visual transcript without starting session
                    setTranscript(prev => prev ? `${prev} ${newText}` : newText);
                }
            } else if (stateRef.current === "Listening") {
                // User is speaking! Stop the inactivity watchdog and reset silence debouncer
                setTranscript(prev => prev ? `${prev} ${newText}` : newText);
                stopInactivityTimer();
                commandBufferRef.current += (" " + newText);
                setStatus("Listening... (keep speaking)");
                startSilenceTimer();
            }
        }
    }, [startInactivityTimer, startSilenceTimer, stopInactivityTimer, updateState]);

    const handleManualSend = useCallback(async (text: string) => {
        if (!text.trim()) return;
        setTranscript(prev => prev ? `${prev}\nUser: ${text}` : `User: ${text}`);
        await processCommand(text);
    }, [processCommand]);

    return {
        state,
        status,
        transcript,
        handleVoiceEvent,
        handleManualSend,
        setTranscript
    };
}
