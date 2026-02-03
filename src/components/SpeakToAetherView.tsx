import { motion } from "framer-motion";
import { Mic, Send, Volume2 } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { Message } from "../hooks/useTextConversationAgent";
import { SidebarTrigger } from "@/components/ui/sidebar";

interface SpeakToAetherViewProps {
    state: 'Idle' | 'Listening' | 'Thinking' | 'Speaking';
    status: string;
    messages: Message[];
    onSend: (text: string) => void;
    resetToListening: () => void;
    stopListening: () => void;
    isVoiceEnabled: boolean;
    onToggleVoice: () => void;
}

export function SpeakToAetherView({ state, status, messages, onSend, resetToListening, stopListening, isVoiceEnabled, onToggleVoice }: SpeakToAetherViewProps) {
    const [inputText, setInputText] = useState("");
    const chatContainerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll logic
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log("[SpeakToAetherView] Submitting:", inputText);
        const text = inputText.trim();
        if (!text) return;
        setInputText("");
        onSend(text);
    };

    const isIdle = state === 'Idle';

    return (
        <div className="flex flex-col h-full w-full relative overflow-hidden bg-background/95 backdrop-blur-sm">
            <header className="flex h-16 shrink-0 items-center justify-between gap-2 px-6 border-b border-primary/20 bg-black/40 backdrop-blur-xl sticky top-0 z-10 transition-all duration-500 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-4">
                    <SidebarTrigger className="h-8 w-8 text-white/40 hover:text-white" />
                    <div className="h-4 w-px bg-white/10 mx-1" />
                    <div className="relative w-10 h-10 flex items-center justify-center">
                        <div className={`absolute inset-0 rounded-full border border-primary/20
                                ${state !== 'Idle' ? 'animate-spin [animation-duration:3s]' : ''}
                                ${state === 'Thinking' ? 'border-t-blue-500' :
                                state === 'Speaking' ? 'border-t-green-500' :
                                    state === 'Listening' ? 'border-t-emerald-500' : ''}`}
                        />
                        <div className={`absolute inset-1 rounded-full border border-primary/20
                                ${state !== 'Idle' ? 'animate-spin [animation-duration:2s] direction-reverse' : ''}`}
                        />
                        {state === 'Speaking' ? (
                            <Volume2 className="w-5 h-5 text-green-500 animate-bounce" />
                        ) : (
                            <Mic className={`w-5 h-5 transition-colors duration-300 
                                    ${state === 'Thinking' ? 'text-blue-500' :
                                    state === 'Listening' ? 'text-emerald-500' : 'text-primary'}`}
                            />
                        )}
                    </div>
                    <div className="flex flex-col">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary/90">Aether Protocol</h3>
                        <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-mono tracking-tight uppercase
                                    ${state === 'Thinking' ? 'text-blue-400' :
                                    state === 'Speaking' ? 'text-green-400' :
                                        state === 'Listening' ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                                {status}
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            <div className="flex-1 flex flex-col relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
                <div className="absolute inset-0 bg-[url('/src/assets/grid-pattern.svg')] opacity-[0.03] pointer-events-none" />

                {/* Chat Body - Edge to Edge - No Padding */}
                <div className="absolute top-2 right-2 z-50 opacity-50 hover:opacity-100 transition-opacity cursor-pointer" onClick={onToggleVoice}>
                    <span className={`text-[9px] font-mono px-2 py-1 rounded border ${isVoiceEnabled ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-blue-500/20 text-blue-300 border-blue-500/30'}`}>
                        {isVoiceEnabled ? 'VOICE: ON' : 'VOICE: OFF (TEXT ONLY)'}
                    </span>
                </div>

                <div
                    className="flex-1 overflow-y-auto space-y-4 custom-scrollbar scroll-smooth w-full"
                    id="chat-scroller"
                    ref={chatContainerRef}
                >
                    {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center opacity-30 space-y-4 text-center">
                            <div className="w-16 h-16 rounded-full border border-primary/20 flex items-center justify-center">
                                <Mic className="w-8 h-8 text-primary" />
                            </div>
                            <span className="text-xs font-mono text-primary/60 uppercase tracking-widest">{status || "Awaiting Command"}</span>
                        </div>
                    ) : (
                        messages.map((msg, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} w-full px-4`}
                            >
                                {/* Reduced Constraints: Removed explicit max-w-[] classes that forced narrow columns */}
                                <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} w-full max-w-full`}>
                                    <span className="text-[9px] uppercase tracking-widest text-primary/40 mb-1.5 px-1">
                                        {msg.role === 'user' ? 'You' : 'Aether'}
                                    </span>
                                    <div className={`px-6 py-5 text-[14px] leading-relaxed font-sans shadow-sm backdrop-blur-md w-auto inline-block max-w-[95%] ${msg.role === 'user'
                                        ? 'bg-primary/10 border border-primary/20 text-primary rounded-2xl rounded-tr-sm'
                                        : 'bg-white/5 border border-white/10 text-slate-200 rounded-2xl rounded-tl-sm'
                                        }`}>
                                        {msg.content || (msg.role === 'assistant' && state === 'Thinking' ? (
                                            <div className="flex gap-1.5 py-1">
                                                <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.3s]" />
                                                <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.15s]" />
                                                <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" />
                                            </div>
                                        ) : '')}
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>

                {/* Input Area - Full Width - Minimized Padding */}
                <div className="p-2 sm:p-4 border-t border-primary/10 bg-black/20 backdrop-blur-xl shrink-0 w-full z-20">
                    <form onSubmit={handleFormSubmit} className="relative flex items-center gap-2 w-full">
                        <input
                            autoFocus
                            disabled={!isIdle}
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder={!isIdle ? "Audio Channel Active..." : "Type a command..."}
                            className={`flex-1 bg-black/40 border border-primary/10 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-primary/40 transition-all 
                            ${!isIdle ? 'opacity-50 cursor-not-allowed placeholder-white/10' : 'placeholder-white/20'}
                            ${state === 'Listening' ? 'border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.05)]' : ''}`}
                        />
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    if (isIdle) {
                                        resetToListening();
                                    } else {
                                        stopListening();
                                    }
                                }}
                                className={`p-3 rounded-xl border transition-all duration-300 ${state === 'Listening' ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/50 hover:bg-red-500/20 hover:text-red-500 hover:border-red-500/50' :
                                    state === 'Thinking' ? 'bg-blue-500/10 text-blue-500 border-blue-500/30' :
                                        state === 'Speaking' ? 'bg-green-500/10 text-green-500 border-green-500/30' :
                                            'bg-white/5 text-primary border-primary/10 hover:bg-primary/10 hover:scale-105 active:scale-95'}`}
                                title={isIdle ? "Start Voice Mode" : "Stop Voice Mode"}
                            >
                                {state === 'Listening' ? <Mic className="w-5 h-5 animate-pulse" /> : <Mic className="w-5 h-5" />}
                            </button>
                            <button
                                type="submit"
                                disabled={!isIdle}
                                className={`p-3 rounded-xl bg-primary/10 border border-primary/20 text-primary transition-all ${!isIdle ? 'opacity-30 cursor-not-allowed' : 'hover:bg-primary/20 hover:scale-105 active:scale-95'
                                    }`}
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}