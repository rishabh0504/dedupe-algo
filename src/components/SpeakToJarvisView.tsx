import { motion } from "framer-motion";
import { Mic, Radio } from "lucide-react";

export function SpeakToJarvisView() {
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden h-full">
            {/* Ambient Background */}
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background pointer-events-none" />
            <div className="absolute inset-0 bg-[url('/src/assets/grid-pattern.svg')] opacity-[0.02] pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center space-y-12 max-w-2xl w-full">

                <div className="flex flex-col items-center gap-8">
                    {/* Visualizer / Avatar Placeholder */}
                    <div className="relative group cursor-pointer">
                        <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl animate-pulse group-hover:bg-primary/30 transition-all duration-500" />
                        <div className="w-48 h-48 rounded-full border-4 border-primary/10 bg-black/40 backdrop-blur-xl flex items-center justify-center relative z-10 shadow-2xl transition-transform duration-500 group-hover:scale-105">
                            <div className="w-32 h-32 rounded-full border border-primary/20 flex items-center justify-center relative overflow-hidden">
                                {/* Animated Circles */}
                                <div className="absolute inset-0 border-[3px] border-t-primary border-r-transparent border-b-primary/30 border-l-transparent rounded-full animate-spin [animation-duration:3s]" />
                                <div className="absolute inset-2 border-[2px] border-b-primary border-l-transparent border-t-primary/30 border-r-transparent rounded-full animate-spin [animation-duration:5s] direction-reverse" />

                                <Mic className="w-12 h-12 text-primary drop-shadow-[0_0_15px_rgba(var(--primary),0.8)]" />
                            </div>
                        </div>
                    </div>

                    {/* Status Indicator */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 border border-primary/20 backdrop-blur-md">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-primary/80">Online</span>
                    </div>
                </div>

                {/* Header Text */}
                <div className="text-center space-y-4">
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-4xl font-black tracking-tighter uppercase italic text-white"
                    >
                        Jarvis Interface
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-muted-foreground text-lg leading-relaxed max-w-lg mx-auto"
                    >
                        Voice command module active. Ready for input sequence.
                    </motion.p>
                </div>

                {/* Interaction Hint */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="flex items-center gap-3 px-6 py-3 rounded-xl bg-white/5 border border-white/5"
                >
                    <Radio className="w-4 h-4 text-primary animate-pulse" />
                    <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                        Listening for wake word...
                    </span>
                </motion.div>

            </div>
        </div>
    );
}
