export class TTSService {
    private synthesis: SpeechSynthesis;
    private voice: SpeechSynthesisVoice | null = null;
    private isInitialized = false;

    constructor() {
        this.synthesis = window.speechSynthesis;

        // Browsers load voices asynchronously
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            this.synthesis.onvoiceschanged = () => {
                this.loadVoice();
            };
            // Initial attempt
            this.loadVoice();
        }
    }

    private loadVoice() {
        const voices = this.synthesis.getVoices();
        if (voices.length === 0) return;

        // Optimized Voice Selection for macOS
        // 1. 'Daniel' is the premium British Male voice on Mac
        // 2. 'Samantha' is the standard female voice
        // 3. Fallbacks for various browser engines
        this.voice = voices.find(v => v.name.includes('Daniel')) ||
            voices.find(v => v.name.includes('Samantha')) ||
            voices.find(v => v.name.includes('Google UK English Male')) ||
            voices.find(v => v.lang === 'en-GB') ||
            voices.find(v => v.lang.startsWith('en-')) ||
            voices[0]; // Absolute fallback

        if (this.voice) {
            this.isInitialized = true;
            console.log("🔊 Jarvis Voice Ready:", this.voice.name);
        }
    }

    /**
     * Converts text to speech and returns a promise that resolves when finished.
     */
    speak(text: string): Promise<void> {
        return new Promise((resolve) => {
            // Ensure voices are loaded (Mac Chrome fix)
            if (!this.isInitialized) {
                this.loadVoice();
            }

            // Immediately stop any existing speech to prevent overlapping
            this.synthesis.cancel();

            // Web Speech API can hang if text is empty
            const cleanText = text.trim();
            if (!cleanText) {
                resolve();
                return;
            }

            const utterance = new SpeechSynthesisUtterance(cleanText);

            if (this.voice) {
                utterance.voice = this.voice;
            }

            // --- Voice Tuning ---
            utterance.rate = 1.05;  // Slightly faster for a "smart" feel
            utterance.pitch = 1.0;
            utterance.volume = 1.0;

            // Safety Watchdog
            const timeoutDuration = Math.max(3000, 1000 + (cleanText.length * 80));
            const timeout = setTimeout(() => {
                console.warn("TTS Watchdog triggered (Internal Speech Engine timed out)");
                this.synthesis.cancel();
                resolve();
            }, timeoutDuration);

            utterance.onend = () => {
                clearTimeout(timeout);
                resolve();
            };

            utterance.onerror = (event) => {
                clearTimeout(timeout);
                console.error("TTS Error Event:", event);
                // Resolve anyway so the Jarvis state machine doesn't get stuck in "Speaking"
                resolve();
            };

            // Critical fix: some browsers won't play speech unless we pause briefly 
            // after a 'cancel()' call to clear the audio buffer.
            setTimeout(() => {
                this.synthesis.speak(utterance);
            }, 50);
        });
    }

    cancel() {
        this.synthesis.cancel();
    }
}

export const ttsService = new TTSService();