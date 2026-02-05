import React, { useState, useRef, useEffect } from "react";
import {
    Play,
    Pause,
    Volume2,
    VolumeX,
    Maximize
} from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";

interface VideoPlayerProps {
    src: string;
    poster?: string;
    className?: string;
    onError?: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
    src,
    poster,
    className,
    onError
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(0);
    const [isMuted, setIsMuted] = useState(true);
    const [showControls, setShowControls] = useState(true);
    const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const togglePlay = () => {
        if (videoRef.current) {
            if (isPlaying) videoRef.current.pause();
            else videoRef.current.play();
            setIsPlaying(!isPlaying);
        }
    };

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            setCurrentTime(videoRef.current.currentTime);
        }
    };

    const handleLoadedMetadata = () => {
        if (videoRef.current) {
            setDuration(videoRef.current.duration);
        }
    };

    const handleSeek = (value: number[]) => {
        if (videoRef.current) {
            videoRef.current.currentTime = value[0];
            setCurrentTime(value[0]);
        }
    };

    const toggleMute = () => {
        if (videoRef.current) {
            videoRef.current.muted = !isMuted;
            setIsMuted(!isMuted);
        }
    };

    const handleVolumeChange = (value: number[]) => {
        const newVolume = value[0];
        if (videoRef.current) {
            videoRef.current.volume = newVolume;
            setVolume(newVolume);
            setIsMuted(newVolume === 0);
        }
    };

    const formatTime = (time: number) => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const resetControlsTimeout = () => {
        setShowControls(true);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = setTimeout(() => {
            if (isPlaying) setShowControls(false);
        }, 3000);
    };

    useEffect(() => {
        resetControlsTimeout();
        return () => {
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        };
    }, [isPlaying]);

    return (
        <div
            className={cn(
                "relative group/player bg-black rounded-2xl overflow-hidden shadow-2xl transition-all duration-500",
                className
            )}
            onMouseMove={resetControlsTimeout}
            onMouseLeave={() => isPlaying && setShowControls(false)}
        >
            <video
                ref={videoRef}
                src={src}
                poster={poster}
                className="w-full h-full object-contain"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onClick={togglePlay}
                onError={onError}
                muted={isMuted}
                playsInline
            />

            {/* Premium Overlay Controls */}
            <div className={cn(
                "absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 transition-opacity duration-500 flex flex-col justify-between p-6",
                showControls ? "opacity-100" : "opacity-0 pointer-events-none"
            )}>
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60 italic">Live Preview Protocol</span>
                    </div>
                </div>

                {/* Center Play Button (Large) */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={togglePlay}
                        className={cn(
                            "w-20 h-20 rounded-full bg-white/10 backdrop-blur-3xl border border-white/20 text-white transition-all duration-500 pointer-events-auto hover:bg-primary hover:text-black hover:scale-110 shadow-2xl",
                            !isPlaying ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                        )}
                    >
                        {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current" />}
                    </Button>
                </div>

                {/* Bottom Bar */}
                <div className="flex flex-col gap-4">
                    {/* Progress Slider */}
                    <div className="flex flex-col gap-2">
                        <Slider
                            value={[currentTime]}
                            min={0}
                            max={duration}
                            step={0.1}
                            onValueChange={handleSeek}
                            className="cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] font-black font-mono text-white/40 uppercase tracking-widest">
                            <span>{formatTime(currentTime)}</span>
                            <span>{formatTime(duration)}</span>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={togglePlay}
                                className="h-10 w-10 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10"
                            >
                                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                            </Button>

                            <div className="flex items-center gap-3 group/volume bg-white/5 border border-white/10 rounded-xl px-3 h-10 transition-all hover:bg-white/10">
                                <button onClick={toggleMute} className="text-white/60 hover:text-white transition-colors">
                                    {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                                </button>
                                <div className="w-0 group-hover/volume:w-20 transition-all overflow-hidden">
                                    <Slider
                                        value={[isMuted ? 0 : volume]}
                                        min={0}
                                        max={1}
                                        step={0.01}
                                        onValueChange={handleVolumeChange}
                                        className="w-20"
                                    />
                                </div>
                            </div>

                            <div className="h-4 w-px bg-white/10 mx-2" />

                            <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] italic">Aether Optical Engine</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/10"
                                onClick={() => {
                                    if (videoRef.current) videoRef.current.requestFullscreen();
                                }}
                            >
                                <Maximize className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
