import { invoke } from "@tauri-apps/api/core";
import { motion } from "framer-motion";
import { Mic, Radio, Send, Volume2 } from "lucide-react";
import { useEffect, useState, useCallback, useRef } from "react";
import { JarvisEvent, jarvisService } from "../services/jarvisService";
import { useStore } from "../store/useStore";
import { useAgentConversation } from "../hooks/useAgentConversation";

export function SpeakToJarvisView() {
    const { isVoiceEnabled } = useStore();
    const [audioDevice, setAudioDevice] = useState<string | null>(null);
    const [lastHeartbeat, setLastHeartbeat] = useState<number>(Date.now());
    const [inputText, setInputText] = useState("");

    // Track active status to prevent double-starts on React strict mode
    const isStartedRef = useRef(false);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    const {
        state,
        status,
        messages,
        handleVoiceEvent,
        handleManualSend
    } = useAgentConversation(isVoiceEnabled);

    // Auto-scroll logic
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    // Optimized Sidecar Initialization
    const initJarvis = useCallback(async () => {
        if (isStartedRef.current) return;

        try {
            // Priority 1: Resolved path from Tauri (Sidecar Resources)
            // Priority 2: Hardcoded local models folder
            let modelPath = "models/ggml-base.en.bin";
            try {
                modelPath = await invoke('get_model_path');
            } catch (e) {
                console.warn("Using fallback model path...");
            }

            await jarvisService.start({
                wakeWord: "Hello", // Ensure this matches your configured wake word
                modelPath: modelPath
            });

            isStartedRef.current = true;
        } catch (error) {
            console.error("Critical Failure: Jarvis sidecar could not start:", error);
        }
    }, []);

    useEffect(() => {
        if (!isVoiceEnabled) {
            jarvisService.stop();
            isStartedRef.current = false;
            return;
        }

        // Listen for sidecar events
        const unsubscribe = jarvisService.onEvent((event: JarvisEvent) => {
            if (event.event === 'audio_device') {
                setAudioDevice(event.device || "Default Interface");
            } else if (event.event === 'heartbeat') {
                setLastHeartbeat(Date.now());
                console.debug(`💓 Jarvis Sidecar Heartbeat: State=${event.state}, Buffer=${(event as any).buffer_fill || 0}`);
            } else {
                // Pass event to the conversation state machine
                handleVoiceEvent(event);
            }
        });

        initJarvis();

        return () => {
            unsubscribe();
            // Ensure process is killed on unmount to free up the i5 CPU
            jarvisService.stop();
            isStartedRef.current = false;
        };
    }, [isVoiceEnabled, handleVoiceEvent, initJarvis]);

    const onSend = async () => {
        const text = inputText.trim();
        if (!text) return;

        setInputText("");
        // Manual send follows the same logic as voice to keep conversation history
        await handleManualSend(text);
    };

    // UI REMAINS EXACTLY AS PROVIDED
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden h-full">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background pointer-events-none" />
            <div className="absolute inset-0 bg-[url('/src/assets/grid-pattern.svg')] opacity-[0.02] pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center space-y-8 max-w-2xl w-full h-full justify-center">
                <div className="flex-1 flex flex-col items-center justify-center gap-8 w-full">
                    <div className="relative group cursor-pointer">
                        <div className={`absolute inset-0 bg-primary/20 rounded-full blur-3xl transition-all duration-500 
                            ${state === 'Thinking' ? 'animate-pulse scale-125 bg-blue-500/20' :
                                state === 'Speaking' ? 'animate-pulse scale-125 bg-green-500/20' :
                                    state === 'Listening' ? 'animate-pulse scale-110 bg-emerald-500/20' :
                                        state === 'Idle' ? 'opacity-20' : ''}`}
                        />
                        <div className="w-48 h-48 rounded-full border-4 border-primary/10 bg-black/40 backdrop-blur-xl flex items-center justify-center relative z-10 shadow-2xl transition-transform duration-500 group-hover:scale-105">
                            <div className="w-32 h-32 rounded-full border border-primary/20 flex items-center justify-center relative overflow-hidden">
                                <div className={`absolute inset-0 border-[3px] border-t-primary border-r-transparent border-b-primary/30 border-l-transparent rounded-full 
                                    ${state !== 'Idle' ? 'animate-spin' : ''} 
                                    ${state === 'Thinking' ? '[animation-duration:1s] border-t-blue-500' :
                                        state === 'Speaking' ? '[animation-duration:1.5s] border-t-green-500' :
                                            state === 'Listening' ? '[animation-duration:2s] border-t-emerald-500' : '[animation-duration:3s]'}`}
                                />
                                <div className={`absolute inset-2 border-[2px] border-b-primary border-l-transparent border-t-primary/30 border-r-transparent rounded-full direction-reverse
                                    ${state !== 'Idle' ? 'animate-spin [animation-duration:5s]' : ''}`}
                                />

                                {state === 'Speaking' ? (
                                    <Volume2 className="w-12 h-12 text-green-500 animate-bounce" />
                                ) : (
                                    <Mic className={`w-12 h-12 transition-colors duration-300 
                                        ${state === 'Thinking' ? 'text-blue-500' :
                                            state === 'Listening' ? 'text-emerald-500' : 'text-primary'}`}
                                    />
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col items-center gap-2">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 border border-primary/20 backdrop-blur-md">
                            <div className={`w-2 h-2 rounded-full 
                                ${state !== 'Idle' ? 'animate-pulse' : ''}                                    ${state === 'Thinking' ? 'bg-blue-500' :
                                    state === 'Speaking' ? 'bg-green-500' :
                                        state === 'Listening' ? 'bg-emerald-500' : 'bg-primary'}`}
                            />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-primary/80">
                                {state === 'Idle' ? 'Ready' : state}
                            </span>
                        </div>
                        {audioDevice && (
                            <span className="text-[10px] text-muted-foreground/60 font-mono tracking-tight">
                                🎤 {audioDevice}
                            </span>
                        )}
                    </div>
                </div>

                {/* Chat Interface Layer */}
                {/* Persistent Chat Interface Layer */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="fixed right-8 top-24 bottom-24 w-88 bg-black/60 backdrop-blur-3xl rounded-3xl border border-primary/20 p-5 flex flex-col gap-4 shadow-[0_0_50px_rgba(0,0,0,0.3)] z-50 overflow-hidden"
                >
                    <div className="flex items-center justify-between border-b border-primary/10 pb-3">
                        <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${state === 'Idle' ? 'bg-primary/30' : 'bg-emerald-500 animate-pulse'}`} />
                                <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-primary/80">Command Center</h3>
                            </div>
                            <span className="text-[9px] font-mono text-muted-foreground tracking-tight opacity-60">
                                Protocol: {state}
                            </span>
                        </div>
                        <div className={`px-2 py-1 rounded border transition-colors ${Date.now() - lastHeartbeat < 3000
                            ? 'bg-primary/10 border-primary/20 text-primary'
                            : 'bg-red-500/10 border-red-500/20 text-red-500'
                            }`}>
                            <span className="text-[8px] font-bold italic uppercase tracking-tighter">
                                {Date.now() - lastHeartbeat < 3000 ? 'Live Sync' : 'Reconnecting...'}
                            </span>
                        </div>
                    </div>

                    <div
                        className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar scroll-smooth"
                        id="chat-scroller"
                        ref={chatContainerRef}
                    >
                        {messages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center opacity-40 space-y-4 text-center p-6">
                                <div className="w-12 h-12 rounded-full border border-dashed border-primary/30 animate-spin [animation-duration:10s] flex items-center justify-center">
                                    <Mic className="w-5 h-5 text-primary/30" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-[11px] font-mono text-primary/60">System Ready</span>
                                    <span className="text-[9px] font-mono italic opacity-40">Say "Hello Jarvis" or type below</span>
                                </div>
                            </div>
                        ) : (
                            messages.map((msg, idx) => msg.content?.startsWith('[SYSTEM]') ? (
                                <div key={idx} className="w-full flex justify-center my-2">
                                    <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10">
                                        <span className="text-[9px] font-mono text-white/40 italic">
                                            {msg.content.replace('[SYSTEM]: ', '')}
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, x: msg.role === 'user' ? 10 : -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                                >
                                    <span className="text-[8px] uppercase tracking-widest text-primary/40 mb-1 px-2">
                                        {msg.role === 'user' ? 'Boss' : 'Jarvis'}
                                    </span>
                                    <div className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed font-mono ${msg.role === 'user'
                                        ? 'bg-primary/10 border border-primary/20 text-primary rounded-tr-none'
                                        : 'bg-white/5 border border-white/10 text-white/90 rounded-tl-none'
                                        }`}>
                                        {msg.content || (msg.role === 'assistant' && state === 'Thinking' ? '...' : '')}
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </div>

                    <div className="pt-2 border-t border-primary/10">
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const form = e.target as HTMLFormElement;
                            const input = form.elements.namedItem('message') as HTMLInputElement;
                            handleManualSend(input.value);
                            input.value = '';
                        }} className="relative">
                            <input
                                name="message"
                                placeholder="Type command..."
                                className="w-full bg-white/5 border border-primary/20 rounded-xl px-4 py-2 text-[10px] font-mono focus:outline-none focus:border-primary/50 transition-colors"
                            />
                            <button type="submit" className="absolute right-2 top-1.5 p-1 text-primary hover:text-white transition-colors">
                                <Radio className="w-3 h-3" />
                            </button>
                        </form>
                    </div>
                </motion.div>

                {/* Legacy Transcript Block (Removed in favor of Chat) */}

                <div className="w-full max-w-lg relative mt-auto pb-4">
                    <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && onSend()}
                        placeholder="Type a command for Jarvis..."
                        className="w-full bg-white/5 border border-white/10 rounded-full py-4 pl-6 pr-12 text-white placeholder-white/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all font-mono text-sm"
                    />
                    <button
                        onClick={onSend}
                        className="absolute right-2 top-1.5 p-3 rounded-full hover:bg-white/10 text-primary transition-colors"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="absolute inset-x-0 bottom-6 flex justify-center pointer-events-none">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-4 bg-black/40 backdrop-blur-md px-4 py-2 rounded-2xl border border-primary/10"
                >
                    <Radio className={`w-4 h-4 
                        ${state !== 'Idle' ? 'animate-pulse' : ''} 
                        ${state === 'Thinking' ? 'text-blue-500' :
                            state === 'Speaking' ? 'text-green-500' :
                                state === 'Listening' ? 'text-emerald-500' : 'text-primary'}`}
                    />
                    <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                        {status}
                    </span>
                </motion.div>
            </div>
        </div>
    );
}