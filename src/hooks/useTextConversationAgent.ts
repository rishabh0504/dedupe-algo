import { useCallback, useState } from "react";
import { llmService } from "../services/llmService";

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
        if (!text.trim() || state === 'Thinking') return;

        // 1. User Message
        addMessage('user', text);

        // 2. Set State
        setState("Thinking");
        addMessage('assistant', "");

        try {
            let fullReply = "";
            await llmService.chat(text, (token) => {
                fullReply += token;
                updateLastMessage(fullReply);
            });
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