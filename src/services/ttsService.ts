import { invoke } from '@tauri-apps/api/core';

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

        // Debug: Dump all voices to find exact name match
        console.log("🎤 Available Voices:", voices.map(v => `${v.name} (${v.lang})`));

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

            // Auto-detect Language: Check for Hindi/Devanagari characters (Standard + Extended)
            const hasHindiChars = /[\u0900-\u097F\uA8E0-\uA8FF]/.test(cleanText);

            if (hasHindiChars) {
                console.log("🇮🇳 Hindi Detected. Attempting Native System TTS (Kiyara)...");
                try {
                    // Try to use the Native macOS 'say' command to access Premium voices hidden from the browser
                    // We try 'Kiyara' first. If the user has 'Kiyara' installed, macOS picks the best version.
                    // Using await here, so the Promise needs to be handled carefully.
                    invoke('speak_native_macos', { text: cleanText, voice: "Kiyara" }).then(() => {
                        resolve();
                    }).catch((e) => {
                        console.warn("⚠️ Native TTS failed, falling back to Browser TTS:", e);
                        // Fallthrough to standard logic below by not resolving here
                        this.continueBrowserSpeak(cleanText, hasHindiChars, resolve);
                    });
                    return; // Exit here, as the promise will be resolved by the invoke chain or fallback
                } catch (e) {
                    console.warn("⚠️ Native TTS failed (sync error), falling back to Browser TTS:", e);
                    // Fallthrough to standard logic below
                }
            }

            // If not Hindi, or if native Hindi TTS failed, continue with browser speak
            this.continueBrowserSpeak(cleanText, hasHindiChars, resolve);
        });
    }

    private continueBrowserSpeak(cleanText: string, hasHindiChars: boolean, resolve: (value: void | PromiseLike<void>) => void) {
        const utterance = new SpeechSynthesisUtterance(cleanText);

        if (hasHindiChars) {
            // Standard Browser Highlighting for fallback or non-Hindi
            const voices = this.synthesis.getVoices();

            // Priority 1: Premium/Enhanced variants of Kiyara
            let hindiVoice = voices.find(v =>
                (v.name.includes('Kiyara') || v.name.includes('Kyara')) &&
                (v.name.includes('Premium') || v.name.includes('Enhanced'))
            );

            // Priority 2: Standard Kiyara
            if (!hindiVoice) {
                hindiVoice = voices.find(v => v.name.includes('Kiyara') || v.name.includes('Kyara'));
            }

            // Priority 3: Premium Lekha
            if (!hindiVoice) {
                hindiVoice = voices.find(v =>
                    v.name.includes('Lekha') &&
                    (v.name.includes('Premium') || v.name.includes('Enhanced'))
                );
                // Priority 3: Premium Lekha
                if (!hindiVoice) {
                    hindiVoice = voices.find(v =>
                        v.name.includes('Lekha') &&
                        (v.name.includes('Premium') || v.name.includes('Enhanced'))
                    );
                }

                // Priority 4: Standard Lekha
                if (!hindiVoice) {
                    hindiVoice = voices.find(v => v.name.includes('Lekha'));
                }

                // Priority 5: Other High Quality Hindi Voices (Rishi, Google, etc)
                if (!hindiVoice) {
                    hindiVoice = voices.find(v =>
                        v.name.includes('Rishi') ||
                        v.name.includes('Hindi') ||
                        v.lang.includes('hi')
                    );
                }

                if (hindiVoice) {
                    utterance.voice = hindiVoice;
                    // Ensure the language is set correctly for the voice to work its magic
                    utterance.lang = hindiVoice.lang;
                    console.log(`🇮🇳 Switching to Hindi Voice: ${hindiVoice.name} (${hindiVoice.lang})`);
                } else if (this.voice) {
                    console.warn("⚠️ Hindi characters detected but NO Hindi voice found. Falling back to English (This will sound wrong).");
                    utterance.voice = this.voice;
                }
            } else if (this.voice) {
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
        } else if (this.voice) { // This else if was missing a closing brace for the previous if block
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
    }

    cancel() {
        this.synthesis.cancel();
    }
}

export const ttsService = new TTSService();