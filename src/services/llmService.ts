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

    setModel(modelId: string) {
        this.model = modelId;
        console.log(`LLM Model switched to: ${modelId}`);
    }

    async chat(text: string, onToken?: (token: string) => void): Promise<string> {
        this.history.push({ role: 'user', content: text });

        try {
            console.log(`Sending to Ollama [${this.model}] (Streaming)...`);
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.model,
                    messages: this.history,
                    stream: true
                })
            });

            if (!response.ok) {
                throw new Error(`Ollama Error: ${response.statusText}`);
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let fullReply = "";

            if (!reader) throw new Error("No response body");

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                // Ollama sends multiple JSON objects, one per line (NDJSON)
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const json = JSON.parse(line);
                        if (json.done) break;
                        const token = json.message?.content || "";
                        fullReply += token;
                        if (onToken) onToken(token);
                    } catch (e) {
                        console.warn("Failed to parse chunk:", line);
                    }
                }
            }

            this.history.push({ role: 'assistant', content: fullReply });
            return fullReply;
        } catch (e) {
            console.error("LLM Service Failed:", e);
            const errorMsg = `I cannot connect to my brain (${this.model}). Is Ollama running?`;
            return errorMsg;
        }
    }

    clearHistory() {
        this.history = [this.history[0]];
    }
}

export const llmService = new LLMService();
