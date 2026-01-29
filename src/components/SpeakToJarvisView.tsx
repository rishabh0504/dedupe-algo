import { motion } from "framer-motion";
import { Mic, Radio, Send, Terminal } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { jarvisService, JarvisEvent } from "../services/jarvisService";
import { ttsService } from "../services/ttsService";

import { useStore } from "../store/useStore";

import { invoke } from "@tauri-apps/api/core";

export function SpeakToJarvisView() {
    const { isVoiceEnabled } = useStore();
    const [status, setStatus] = useState<string>("Initializing...");
    const [state, setState] = useState<string>("Idle");
    const [transcript, setTranscript] = useState<string>("");
    const [audioDevice, setAudioDevice] = useState<string | null>(null);
    const [inputText, setInputText] = useState("");

    // Greeting Flag to avoid double speaking on re-renders
    const hasGreeted = useRef(false);

    useEffect(() => {
        if (!isVoiceEnabled) {
            setStatus("Microphone Disabled in Settings");
            setState("Offline");
            return;
        }

        // Start Jarvis Service
        const startJarvis = async () => {
            try {
                // Greeting
                if (!hasGreeted.current) {
                    hasGreeted.current = true;
                    await ttsService.speak("Hello Rishi sir, how may I help you?");
                }

                // Resolve path using backend command
                let modelPath = "models/ggml-base.en.bin";
                try {
                    modelPath = await invoke('get_model_path');
                    console.log("Resolved Model Path:", modelPath);
                } catch (e) {
                    console.warn("Failed to resolve resource:", e);
                }

                await jarvisService.start({
                    wakeWord: "Hello",
                    modelPath: modelPath
                });
                setStatus("Listening...");
            } catch (error) {
                console.error("Failed to start Jarvis:", error);
                setStatus("System Error: Check Console");
            }
        };

        const unsubscribe = jarvisService.onEvent((event: JarvisEvent) => {
            if (event.event === 'transcription') {
                setStatus("Listening...");
                setState("Active");
                // Accumulate text for a continuous feed
                setTranscript(prev => {
                    const newText = event.text || "";
                    return prev ? `${prev} ${newText}` : newText;
                });
            } else if (event.event === 'audio_device') {
                setAudioDevice(event.device || "Unknown Device");
            } else if (event.event === 'voice_activity') {
                setStatus(event.text || "Listening...");
                if (state !== 'Active') setState("Listening");
            }
        });

        startJarvis();

        return () => {
            unsubscribe();
            jarvisService.stop();
        };
    }, [isVoiceEnabled]);

    const handleSend = async () => {
        if (!inputText.trim()) return;

        // Speak the text
        await ttsService.speak(inputText);

        // Also add to transcript for visibility? Or separate chat log?
        // For now, let's just speak it.
        setInputText("");
    };

    return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden h-full">
            {/* Ambient Background */}
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background pointer-events-none" />
            <div className="absolute inset-0 bg-[url('/src/assets/grid-pattern.svg')] opacity-[0.02] pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center space-y-8 max-w-2xl w-full h-full justify-center">

                <div className="flex-1 flex flex-col items-center justify-center gap-8 w-full">
                    {/* Visualizer / Avatar Placeholder */}
                    <div className="relative group cursor-pointer">
                        <div className={`absolute inset-0 bg-primary/20 rounded-full blur-3xl transition-all duration-500 ${state === 'Active' ? 'animate-pulse scale-125 bg-green-500/20' : state === 'Listening' ? 'animate-pulse scale-110 bg-blue-500/20' : ''}`} />
                        <div className="w-48 h-48 rounded-full border-4 border-primary/10 bg-black/40 backdrop-blur-xl flex items-center justify-center relative z-10 shadow-2xl transition-transform duration-500 group-hover:scale-105">
                            <div className="w-32 h-32 rounded-full border border-primary/20 flex items-center justify-center relative overflow-hidden">
                                {/* Animated Circles */}
                                <div className={`absolute inset-0 border-[3px] border-t-primary border-r-transparent border-b-primary/30 border-l-transparent rounded-full animate-spin [animation-duration:3s] ${state === 'Active' ? '[animation-duration:1s] border-t-green-500' : state === 'Listening' ? '[animation-duration:1.5s] border-t-blue-500' : ''}`} />
                                <div className="absolute inset-2 border-[2px] border-b-primary border-l-transparent border-t-primary/30 border-r-transparent rounded-full animate-spin [animation-duration:5s] direction-reverse" />

                                <Mic className={`w-12 h-12 text-primary drop-shadow-[0_0_15px_rgba(var(--primary),0.8)] transition-colors ${state === 'Active' ? 'text-green-500' : ''}`} />
                            </div>
                        </div>
                    </div>

                    {/* Status Indicator */}
                    <div className="flex flex-col items-center gap-2">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 border border-primary/20 backdrop-blur-md">
                            <div className={`w-2 h-2 rounded-full animate-pulse ${state === 'Active' ? 'bg-green-500' : 'bg-emerald-500'}`} />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-primary/80">{state}</span>
                        </div>
                        {audioDevice && (
                            <span className="text-[10px] text-muted-foreground/60 font-mono tracking-tight">
                                🎤 {audioDevice}
                            </span>
                        )}
                    </div>

                    {/* Header Text */}
                    <div className="text-center space-y-4 w-full">
                        <motion.h2
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-4xl font-black tracking-tighter uppercase italic text-white"
                        >
                            Jarvis Interface
                        </motion.h2>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="bg-black/20 border border-white/5 rounded-2xl p-6 min-h-[100px] w-full max-w-lg mx-auto overflow-y-auto max-h-[300px] scrollbar-thin scrollbar-thumb-primary/20"
                        >
                            <p className="text-muted-foreground text-lg leading-relaxed whitespace-pre-wrap font-mono">
                                {transcript || "System Ready. Awaiting Input..."}
                            </p>
                        </motion.div>
                    </div>

                    {/* Interaction Hint */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="flex items-center gap-3 px-6 py-3 rounded-xl bg-white/5 border border-white/5"
                    >
                        <Radio className={`w-4 h-4 animate-pulse ${state === 'Active' ? 'text-green-500' : 'text-primary'}`} />
                        <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                            {status}
                        </span>
                    </motion.div>
                </div>

                {/* Input Area */}
                <div className="w-full max-w-lg relative">
                    <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Type a command for Jarvis..."
                        className="w-full bg-black/40 border border-white/10 rounded-full py-4 pl-6 pr-12 text-white placeholder-white/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all font-mono"
                    />
                    <button
                        onClick={handleSend}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-white/10 text-primary transition-colors"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </div>

            </div>
        </div>
    );
}
