import { Command, Child } from '@tauri-apps/plugin-shell';

export interface JarvisConfig {
    wakeWord: string;
    modelPath: string;
}

export type JarvisEvent =
    | { event: 'transcription', text?: string, state: string }
    | { event: 'wake_word_detected', text?: string, state: string }
    | { event: 'audio_device', device?: string, state?: string }
    | { event: 'voice_activity', text?: string, state?: string }
    | { event: 'voice_start', text?: string, state: string }
    | { event: 'voice_end', state: string }
    | { event: 'processing', text?: string, state: string }
    | { event: 'timeout', state: string }
    | { event: 'speech_end', state?: string }
    | { event: 'ready', state?: string }
    | { event: 'heartbeat', state?: string };

class JarvisService {
    private process: Child | null = null;
    private isRunning = false;
    private listeners: ((event: JarvisEvent) => void)[] = [];
    private stdoutBuffer = ""; // Essential for handling partial JSON chunks

    /**
     * Starts the Rust sidecar.
     * Ensure your binary is named: src-tauri/binaries/jarvis-x86_64-apple-darwin
     */
    async start(config: JarvisConfig) {
        if (this.isRunning) return;

        console.log('🚀 Initializing Jarvis Sidecar (Intel x86_64)...');

        try {
            // "jarvis" must match the 'externalBin' entry in your tauri.conf.json
            const command = Command.sidecar('binaries/jarvis', [
                '--wake-word', config.wakeWord,
                '--model', config.modelPath
            ]);

            // Handle Process Exit
            command.on('close', (data) => {
                console.log(`📡 Jarvis sidecar exited (Code: ${data.code})`);
                this.cleanup();
            });

            // Handle Spawning Errors
            command.on('error', (error) => {
                console.error(`❌ Jarvis Runtime Error: ${error}`);
                this.cleanup();
            });

            // STDOUT: Handle incoming JSON events with line buffering
            command.stdout.on('data', (data: string) => {
                this.stdoutBuffer += data;
                const lines = this.stdoutBuffer.split('\n');

                // Keep the last element in the buffer if it doesn't end with a newline
                this.stdoutBuffer = lines.pop() || "";

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;

                    try {
                        const raw = JSON.parse(trimmed);
                        // Support both 'status' and 'event' keys for backward compatibility with Rust crates
                        const event = {
                            ...raw,
                            event: raw.event || raw.status
                        } as JarvisEvent;

                        this.notifyListeners(event);
                    } catch (e) {
                        // Log unexpected non-JSON output for debugging purposes
                        console.debug(`[Jarvis Debug]: ${trimmed}`);
                    }
                }
            });

            // STDERR: Filter out noise but keep critical system errors
            command.stderr.on('data', (line: string) => {
                if (this.isInitializationLog(line)) return;
                console.error(`[Jarvis System Error]: ${line}`);
            });

            this.process = await command.spawn();
            this.isRunning = true;
            console.log('✅ Jarvis Sidecar is Running');

        } catch (e) {
            console.error('❌ Failed to spawn Jarvis sidecar:', e);
            this.isRunning = false;
        }
    }

    /**
     * Filters out standard Whisper.cpp/GGML logs to keep the console clean.
     */
    private isInitializationLog(line: string): boolean {
        const lower = line.toLowerCase();
        return (
            lower.includes('whisper_') ||
            lower.includes('n_vocab') ||
            lower.includes('n_audio_') ||
            lower.includes('n_text_') ||
            lower.includes('compute buffer') ||
            lower.includes('loading model') ||
            lower.includes('using blas') ||
            lower.includes('core ml') ||
            lower.includes('avx') // Relevant for your Intel i5
        );
    }

    /**
     * Gracefully kills the process and resets service state.
     */
    async stop() {
        if (this.process) {
            console.log('🛑 Stopping Jarvis...');
            await this.process.kill();
            this.cleanup();
        }
    }

    private cleanup() {
        this.process = null;
        this.isRunning = false;
        this.stdoutBuffer = "";
    }

    /**
     * Subscribe to incoming Jarvis events.
     * Returns a cleanup function to unsubscribe.
     */
    onEvent(callback: (event: JarvisEvent) => void) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    private pendingResolvers: Map<string, (value: void) => void> = new Map();

    /**
     * Physically mutes/unmutes the sidecar's audio intake.
     * While muted, the sidecar discards all incoming audio at the source.
     * This method waits for a physical acknowledgment from the sidecar before resolving.
     */
    async setMuted(muted: boolean): Promise<void> {
        if (!this.process) return;

        const cmd = muted ? "STOP_LISTENER" : "START_LISTENER";
        const expectedEvent = muted ? "muted" : "listening";

        return new Promise(async (resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingResolvers.delete(expectedEvent);
                console.warn(`⚠️ Sidecar ${cmd} handshake timed out (1500ms)`);
                resolve(); // Resolve anyway to prevent deadlocking the frontend
            }, 1500);

            this.pendingResolvers.set(expectedEvent, () => {
                clearTimeout(timeout);
                console.log(`✅ Sidecar ${cmd} confirmed`);
                resolve();
            });

            try {
                console.log(`📡 Sending command to Sidecar: "${cmd}"`);
                await this.process!.write(`${cmd}\n`);
            } catch (e) {
                console.error(`❌ Failed to write to Sidecar: ${e}`);
                this.pendingResolvers.delete(expectedEvent);
                clearTimeout(timeout);
                reject(e);
            }
        });
    }

    private notifyListeners(event: JarvisEvent) {
        // Handle internal handshakes
        const resolver = this.pendingResolvers.get(event.event);
        if (resolver) {
            this.pendingResolvers.delete(event.event);
            resolver();
        }

        this.listeners.forEach(listener => {
            try {
                listener(event);
            } catch (e) {
                console.error('Listener callback failed:', e);
            }
        });
    }
}

export const jarvisService = new JarvisService();