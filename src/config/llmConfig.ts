export interface LLMModel {
    id: string;
    name: string;
    description: string;
    bestFor: string;
}

export const AVAILABLE_MODELS: Record<string, LLMModel> = {
    'llama3.2': {
        id: 'llama3.2:latest',
        name: 'Llama 3.2 3B',
        description: 'Excellent general assistant, good instruction following.',
        bestFor: 'General Chat'
    },
    'qwen2.5': {
        id: 'qwen2.5-coder:3b',
        name: 'Qwen 2.5 Coder',
        description: 'Specialized for coding and technical tasks.',
        bestFor: 'Coding / System Commands'
    },
    'phi4-mini': {
        id: 'phi4-mini:latest',
        name: 'Phi-3.5 Mini',
        description: 'High reasoning capabilities for its size.',
        bestFor: 'Complex Logic / Reasoning'
    },
    'gemma3': {
        id: 'gemma3:4b',
        name: 'Gemma 3 4B',
        description: 'Ultra-fast and lightweight model.',
        bestFor: 'Real-time Interaction'
    },
    'gemma2': {
        id: 'gemma2:2b',
        name: 'Gemma 2 2B',
        description: 'Ultra-fast and lightweight model.',
        bestFor: 'Real-time Interaction'
    }
};

export const DEFAULT_MODEL_ID = 'gemma2:2b';

export const LLMS = {
    OLLAMA_ENDPOINT: "http://localhost:11434",
}