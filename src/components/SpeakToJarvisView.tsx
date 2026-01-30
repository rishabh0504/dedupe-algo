import { motion } from "framer-motion";
import { Mic, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Message } from "../hooks/useAgentConversation";

interface SpeakToJarvisViewProps {
    state: 'Idle' | 'Listening' | 'Thinking' | 'Speaking';
    messages: Message[];
    onSend: (text: string) => void;
    resetToListening: () => void;
}

export function SpeakToJarvisView({ state, messages, onSend, resetToListening }: SpeakToJarvisViewProps) {
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
        const text = inputText.trim();
        if (!text) return;
        setInputText("");
        onSend(text);
    };

    return (
        <div className="flex flex-col h-full w-full relative overflow-hidden bg-background/95 backdrop-blur-sm">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
            <div className="absolute inset-0 bg-[url('/src/assets/grid-pattern.svg')] opacity-[0.03] pointer-events-none" />

            {/* Chat Body - Edge to Edge */}
            <div
                className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar scroll-smooth w-full max-w-none"
                id="chat-scroller"
                ref={chatContainerRef}
            >
                {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-30 space-y-4 text-center">
                        <div className="w-16 h-16 rounded-full border border-primary/20 flex items-center justify-center">
                            <Mic className="w-8 h-8 text-primary" />
                        </div>
                        <span className="text-xs font-mono text-primary/60 uppercase tracking-widest">Awaiting Command</span>
                    </div>
                ) : (
                    messages.map((msg, idx) => msg.content?.startsWith('[SYSTEM]') ? (
                        <div key={idx} className="w-full flex justify-center query-event my-6">
                            <span className="text-[10px] font-mono text-white/40 italic px-3 py-1 bg-white/5 rounded-full border border-white/5">
                                {msg.content.replace('[SYSTEM]: ', '')}
                            </span>
                        </div>
                    ) : (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} w-full`}
                        >
                            <div className={`max-w-[85%] md:max-w-[70%] lg:max-w-[60%] flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                <span className="text-[9px] uppercase tracking-widest text-primary/40 mb-1.5 px-1">
                                    {msg.role === 'user' ? 'You' : 'Jarvis'}
                                </span>
                                <div className={`px-6 py-5 text-[14px] leading-relaxed font-sans shadow-sm backdrop-blur-md ${msg.role === 'user'
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

            {/* Input Area - Full Width */}
            <div className="p-4 sm:p-6 border-t border-primary/10 bg-black/20 backdrop-blur-xl shrink-0 w-full z-20">
                <form onSubmit={handleFormSubmit} className="relative flex items-center gap-4 w-full">
                    <input
                        autoFocus
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder={state === 'Listening' ? "Listening..." : "Type a command..."}
                        className={`flex-1 bg-black/40 border border-primary/10 rounded-xl px-6 py-4 text-sm font-mono focus:outline-none focus:border-primary/40 transition-colors 
                            ${state === 'Listening' ? 'placeholder-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.05)]' : 'placeholder-white/20'}`}
                    />
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                if (state === 'Idle') resetToListening();
                            }}
                            className={`p-4 rounded-xl border border-primary/10 transition-all ${state === 'Listening' ? 'bg-emerald-500/10 text-emerald-500 animate-pulse border-emerald-500/30' :
                                state === 'Thinking' ? 'bg-blue-500/10 text-blue-500 border-blue-500/30' :
                                    state === 'Speaking' ? 'bg-green-500/10 text-green-500 border-green-500/30' :
                                        'bg-white/5 text-primary hover:bg-primary/10 hover:scale-105 active:scale-95'}`}
                        >
                            <Mic className="w-5 h-5" />
                        </button>
                        <button
                            type="button" // Changed to button type to avoid double submit if needed, or submit if that was intent. Keeping type='button' for send unless form submit is desired. Actually form has onsubmit.
                            onClick={handleFormSubmit}
                            className="p-4 rounded-xl bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all hover:scale-105 active:scale-95"
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}