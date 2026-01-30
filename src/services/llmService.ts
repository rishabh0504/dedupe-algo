import { JARVIS_CONFIG } from "@/config/jarvisConfig";
import { DEFAULT_MODEL_ID, LLMS } from "@/config/llmConfig";

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export class LLMService {
    private endpoint = `${LLMS.OLLAMA_ENDPOINT}/api/chat`;
    private model = DEFAULT_MODEL_ID;
    private history: ChatMessage[] = [];

    constructor() {
        this.history.push({
            role: 'system',
            content: JARVIS_CONFIG.SYSTEM_PROMPT
        });
    }

    async chat(text: string, onToken?: (token: string) => void): Promise<string> {
        this.history.push({ role: 'user', content: text });

        try {
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.model,
                    messages: this.history,
                    stream: true,
                    options: {
                        temperature: 0.7,
                        num_predict: 150, // Limits Jarvis to shorter spoken responses
                    }
                })
            });

            if (!response.ok) throw new Error(`Ollama Offline: ${response.statusText}`);

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let fullReply = "";
            let partialLine = ""; // The "Secret Sauce" for clean streaming

            if (!reader) throw new Error("Stream unreachable");

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = (partialLine + chunk).split('\n');

                // The last element is either empty or a partial JSON string
                partialLine = lines.pop() || "";

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const json = JSON.parse(line);
                        if (json.done) break;

                        const token = json.message?.content || "";
                        fullReply += token;
                        if (onToken) onToken(token);
                    } catch (e) {
                        // Silently handle fragments; partialLine preserves them for the next chunk
                    }
                }
            }

            this.history.push({ role: 'assistant', content: fullReply });

            // Memory Management: Keep history lean for 16GB RAM
            if (this.history.length > 10) {
                this.history = [this.history[0], ...this.history.slice(-5)];
            }

            return fullReply;
        } catch (e) {
            console.error("Brain Error:", e);
            return "My neural link is unstable. Please check if Ollama is running.";
        }
    }

    clearHistory() {
        this.history = [{ role: 'system', content: JARVIS_CONFIG.SYSTEM_PROMPT }];
    }
}

export const llmService = new LLMService();