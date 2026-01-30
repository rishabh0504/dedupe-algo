import { useState, useCallback } from 'react';
import { agentOrchestrator, AgentStep } from '../services/agent/AgentOrchestrator';

export function useAgentExecutor() {
    const [isExecuting, setIsExecuting] = useState(false);
    const [steps, setSteps] = useState<AgentStep[]>([]);

    const executeTask = useCallback(async (objective: string) => {
        if (isExecuting) return;

        setIsExecuting(true);
        setSteps([]); // Clear previous run

        try {
            await agentOrchestrator.execute(objective, (step) => {
                setSteps(prev => [...prev, step]);
            });
        } finally {
            setIsExecuting(false);
        }
    }, [isExecuting]);

    return {
        isExecuting,
        steps,
        executeTask
    };
}
