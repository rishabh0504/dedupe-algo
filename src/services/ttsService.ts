export class TTSService {
    private synthesis: SpeechSynthesis;
    private voice: SpeechSynthesisVoice | null = null;

    constructor() {
        this.synthesis = window.speechSynthesis;
        // Wait for voices to load
        if (this.synthesis.onvoiceschanged !== undefined) {
            this.synthesis.onvoiceschanged = () => {
                this.loadVoice();
            };
        }
        this.loadVoice();
    }

    private loadVoice() {
        const voices = this.synthesis.getVoices();
        // User requested "Denial" (Daniel) British male voice
        this.voice = voices.find(v => v.name === 'Daniel') ||
            voices.find(v => v.name === 'Samantha') ||
            voices.find(v => v.name === 'Google UK English Male') ||
            voices.find(v => v.lang === 'en-GB') ||
            voices.find(v => v.lang.startsWith('en-')) ||
            null;

        console.log("TTS Voice Selected:", this.voice ? this.voice.name : "Default");
    }

    speak(text: string): Promise<void> {
        return new Promise((resolve) => {
            if (!this.voice) this.loadVoice();

            // Cancel previous speech
            this.synthesis.cancel();

            // Safety Timeout (e.g. if browser doesn't fire onend)
            const timeout = setTimeout(() => {
                console.warn("TTS Timeout - Force Resolving");
                resolve();
            }, 10000 + (text.length * 100)); // Dynamic timeout based on length

            const utterance = new SpeechSynthesisUtterance(text);
            if (this.voice) {
                utterance.voice = this.voice;
            }

            // Adjust to sound more natural?
            utterance.rate = 1.0;
            utterance.pitch = 1.0;

            utterance.onend = () => {
                clearTimeout(timeout);
                resolve();
            };

            utterance.onerror = (e) => {
                clearTimeout(timeout);
                console.error("TTS Error:", e);
                // Don't reject, just resolve so we don't block the app
                resolve();
            };

            this.synthesis.speak(utterance);
        });
    }

    cancel() {
        this.synthesis.cancel();
    }
}

export const ttsService = new TTSService();
