use serde::Serialize;
use crate::transcript::{Transcriber, is_voice_active};

// Configuration constants
const SAMPLE_RATE: usize = 16000;
const SILENCE_THRESHOLD_MS: usize = 1000; // More natural pause
const MIN_PHRASE_DURATION_MS: usize = 200; // Capture short words like "Hi"

#[derive(Debug, PartialEq, Clone)] // Added Clone for state tracking
pub enum JarvisState {
    Idle,
    Listening, // Accumulating audio
    Processing, // Transcribing
}

#[derive(Serialize)]
struct JarvisEvent {
    event: String,
    text: Option<String>,
    state: String,
}

pub struct StateMachine {
    pub current_state: JarvisState,
    transcriber: Transcriber,
    
    // The "Accumulator"
    audio_buffer: Vec<f32>,
    silence_frames: usize,
    max_silence_frames: usize,
}

impl StateMachine {
    pub fn new(model_path: &str) -> Result<Self, anyhow::Error> {
        let transcriber = Transcriber::new(model_path)?;
        
        // Assuming process_audio receives ~100ms chunks (1600 samples)
        // If your chunk size is different, adjust these calculations.
        // Let's assume chunk_size is passed or standard. 
        // We will calculate frames dynamically based on input length.
        
        Ok(Self {
            current_state: JarvisState::Idle,
            transcriber,
            audio_buffer: Vec::with_capacity(SAMPLE_RATE * 10), // Pre-allocate 10s
            silence_frames: 0,
            max_silence_frames: 0, // Will set this in process based on chunk size
        })
    }

    pub fn process_audio(&mut self, samples: &[f32]) -> Result<(), anyhow::Error> {
        // 1. Dynamic VAD (RMS Energy)
        let is_speech = is_voice_active(samples, 0.001); // Maximum sensitivity

        // Calculate how many frames of silence we need based on input chunk size
        let chunk_duration_ms = (samples.len() * 1000) / SAMPLE_RATE;
        if chunk_duration_ms > 0 {
            self.max_silence_frames = SILENCE_THRESHOLD_MS / chunk_duration_ms;
        }

        match self.current_state {
            JarvisState::Idle => {
                if is_speech {
                    self.current_state = JarvisState::Listening;
                    self.audio_buffer.extend_from_slice(samples);
                    self.emit_event("voice_start", Some("Listening..."));
                    self.silence_frames = 0;
                }
            },
            JarvisState::Listening => {
                self.audio_buffer.extend_from_slice(samples);

                if is_speech {
                    self.silence_frames = 0;
                } else {
                    self.silence_frames += 1;
                }

                // Safety: Don't exceed 15 seconds of audio (prevents memory issues/lag)
                let total_duration_ms = (self.audio_buffer.len() * 1000) / SAMPLE_RATE;
                
                if self.silence_frames > self.max_silence_frames || total_duration_ms > 15000 {
                    if total_duration_ms > MIN_PHRASE_DURATION_MS {
                        self.finalize_sentence();
                    } else {
                        self.reset_buffer();
                    }
                }
            },
            JarvisState::Processing => {
                // Blocking state (if not async) or buffering for next phrase
                // Ideally, run transcription in a separate thread so you don't drop audio.
            }
        }
        Ok(())
    }

    fn finalize_sentence(&mut self) {
        self.current_state = JarvisState::Processing;
        self.emit_event("processing", Some("Transcribing..."));

        // Transcribe the FULL buffer
        match self.transcriber.transcribe(&self.audio_buffer) {
            Ok(text) => {
                let trimmed = text.trim();
                
                // Aggressive Hallucination Filters
                let is_hallucination = trimmed.is_empty() 
                    || trimmed == "Thank you." 
                    || trimmed == "Thanks."
                    || trimmed.starts_with("[") // [Music], [Silence]
                    || trimmed.starts_with("(")
                    || (trimmed.len() < 4 && !trimmed.contains("Ok")); // Filter "A", "The"

                if !is_hallucination {
                    self.emit_event("transcription", Some(trimmed));
                } else {
                    self.emit_event("debug", Some("Hallucination filtered"));
                }
            },
            Err(e) => eprintln!("Transcription error: {}", e),
        }

        self.reset_buffer();
    }

    pub fn reset_buffer(&mut self) {
        self.audio_buffer.clear();
        self.current_state = JarvisState::Idle;
        self.silence_frames = 0;
        self.emit_event("voice_end", None);
    }

    fn emit_event(&self, event: &str, text: Option<&str>) {
        let json = serde_json::to_string(&JarvisEvent {
            event: event.to_string(),
            text: text.map(|s| s.to_string()),
            state: format!("{:?}", self.current_state),
        }).unwrap_or_default();
        println!("{}", json);
        use std::io::{Write, stdout};
        stdout().flush().unwrap_or_default();
    }
}