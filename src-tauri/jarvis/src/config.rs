// Jarvis Gold Standard Configuration
// These values have been tuned for maximum responsiveness and sensitivity on Intel Macs.
// DO NOT CHANGE without explicit cause.

pub const SAMPLE_RATE: usize = 16000;
pub const CHANNELS: u16 = 1;

// Voice Activity Detection (VAD)
pub const VAD_THRESHOLD: f32 = 0.001;        // High sensitivity (whisper level)
pub const SILENCE_THRESHOLD_MS: usize = 1000; // 1 second pause to detect end of speech
pub const MIN_PHRASE_DURATION_MS: usize = 200;// Ignore sub-200ms clicks

// Safety Limits
pub const MAX_PHRASE_DURATION_MS: usize = 15000; // 15s max to prevent buffer bloat
pub const HEARTBEAT_INTERVAL_MS: u64 = 2000;     // 2s health check

// Model Settings
// Model Settings
pub const DEFAULT_MODEL_PATH: &str = "models/ggml-base.en.bin";
pub const DEFAULT_WAKE_WORD: &str = "Hello Jarvis";

pub const MODEL_THREADS: u8 = 4;
pub const MODEL_STRATEGY: &str = "Greedy";
