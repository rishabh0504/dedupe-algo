export const JARVIS_CONFIG = {
    // Phrases that trigger Jarvis to start a command session
    WAKE_PHRASES: ["ok sam", "okay sam", "hey sam"],

    // How long to wait for silence before processing a command (ms)
    COMMAND_SILENCE_TIMEOUT: 5000,

    // How long to wait for the user to start speaking before cancelling (ms)
    SESSION_INACTIVITY_TIMEOUT: 10000,

    // Text to acknowledge the wake word
    ACKNOWLEDGMENT_TEXT: "yeah",

    // Minimum text length to consider a valid command
    MIN_COMMAND_LENGTH: 3,

    SYSTEM_PROMPT: "You are Jarvis, a helpful and concise AI assistant. Answer briefly and clearly.",
};
