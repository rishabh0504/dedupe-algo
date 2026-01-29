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
    | { event: 'timeout', state: string }
    | { event: 'speech_end', state?: string };

class JarvisService {
    private process: Child | null = null;
    private isRunning = false;
    private listeners: ((event: JarvisEvent) => void)[] = [];

    async start(config: JarvisConfig) {
        if (this.isRunning) return;

        console.log('Starting Jarvis Sidecar...');
        try {
            // "jarvis" matches the externalBin name in tauri.conf.json
            const command = Command.sidecar('binaries/jarvis', [
                '--wake-word', config.wakeWord,
                '--model', config.modelPath
            ]);



            command.on('close', (data: { code: number | null; signal: number | null }) => {
                console.log(`Jarvis process finished with code ${data.code} and signal ${data.signal}`);
                this.isRunning = false;
                this.process = null;
            });

            command.on('error', (error: unknown) => {
                console.error(`Jarvis process error: "${error}"`);
                this.isRunning = false;
            });

            command.stdout.on('data', (line: string) => {
                try {
                    const raw = JSON.parse(line);
                    // Normalize 'status' from Rust to 'event' for TS
                    const event = {
                        ...raw,
                        event: raw.event || raw.status
                    } as JarvisEvent;

                    // // Only log non-debug events to console to keep it clean
                    // if (event.event !== 'wake_word_detected') {
                    //     console.log('[Jarvis Event]:', event);
                    // }

                    this.notifyListeners(event);
                } catch (e) {
                    // console.log(`[Jarvis Raw]: ${line}`);
                }
            });

            command.stderr.on('data', (line: string) => {
                const lower = line.toLowerCase();
                // Filter out standard Whisper.cpp initialization logs
                if (
                    line.includes('whisper_') ||
                    line.includes('n_vocab') ||
                    line.includes('n_audio_') ||
                    line.includes('n_text_') ||
                    line.includes('compute buffer') ||
                    line.includes('loading model') ||
                    lower.includes('using blas') ||
                    lower.includes('core ml')
                ) {
                    // Ignore noisy initialization logs
                    return;
                }
                console.error(`[Jarvis Error]: ${line}`);
            });

            this.process = await command.spawn();
            this.isRunning = true;

        } catch (e) {
            console.error('Failed to spawn Jarvis sidecar:', e);
            this.isRunning = false;
        }
    }

    async stop() {
        if (this.process) {
            await this.process.kill();
            this.process = null;
            this.isRunning = false;
        }
    }

    onEvent(callback: (event: JarvisEvent) => void) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    private notifyListeners(event: JarvisEvent) {
        this.listeners.forEach(l => l(event));
    }
}

export const jarvisService = new JarvisService();
