export const JARVIS_CONFIG = {
    // How long to wait for silence before processing a command (ms)
    COMMAND_SILENCE_TIMEOUT: 1000,

    // Initial greeting for direct interaction
    INITIAL_GREETING: "Welcome Rishi Sir, I am Jarvis, How May I help you",

    // Minimum text length to consider a valid command
    MIN_COMMAND_LENGTH: 1,

    // Whisper hallucinations to ignore


    SYSTEM_PROMPT: `You are Jarvis, a conversational and efficient AI assistant for your Boss. Speak naturally and helpfuly. Keep responses to one or two sentences. Address your Boss as "Sir". Do not use special characters, asterisks, hashtags, or markdown formatting. Use only plain text.`
};
