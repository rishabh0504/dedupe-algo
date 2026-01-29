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
        // Prefer "Samantha" (standard Mac) or "Daniel" (British nice) or "Ava" (Premium)
        // Or just the first English voice that sounds good.
        this.voice = voices.find(v => v.name === 'Samantha') ||
            voices.find(v => v.name === 'Daniel') ||
            voices.find(v => v.name === 'Google US English') ||
            voices.find(v => v.lang.startsWith('en-')) ||
            null;

        console.log("TTS Voice Selected:", this.voice ? this.voice.name : "Default");
    }

    speak(text: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.voice) this.loadVoice();

            // Cancel previous speech
            this.synthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            if (this.voice) {
                utterance.voice = this.voice;
            }

            // Adjust to sound more natural?
            utterance.rate = 1.0;
            utterance.pitch = 1.0;

            utterance.onend = () => {
                resolve();
            };

            utterance.onerror = (e) => {
                console.error("TTS Error:", e);
                reject(e);
            };

            this.synthesis.speak(utterance);
        });
    }

    cancel() {
        this.synthesis.cancel();
    }
}

export const ttsService = new TTSService();
