use serde::Serialize;
use crate::transcript::{Transcriber, is_voice_active};

#[derive(Debug, PartialEq)]
pub enum JarvisState {
    Idle,
    WakeCheck,
    Active,
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
    wake_word: String,
    silence_counter: usize,
}

impl StateMachine {
    pub fn new(model_path: &str, wake_word: &str) -> Result<Self, anyhow::Error> {
        let transcriber = Transcriber::new(model_path)?;
        Ok(Self {
            current_state: JarvisState::Idle,
            transcriber,
            wake_word: wake_word.to_lowercase(),
            silence_counter: 0,
        })
    }

    pub fn process_audio(&mut self, samples: &[f32]) -> Result<(), anyhow::Error> {
        // 1. VAD Check
        // Calculate RMS manually here to log it
        let sum_squares: f32 = samples.iter().map(|s| s * s).sum();
        let rms = (sum_squares / samples.len() as f32).sqrt();
        
        // Emit debug event for visibility
        let debug_msg = format!("Audio Level (RMS): {:.5}", rms);
        self.emit_event("debug", Some(&debug_msg));

        // Threshold might need tuning. Lowered to 0.002
        let is_speech = rms > 0.002;

        match self.current_state {
            JarvisState::Idle | JarvisState::WakeCheck | JarvisState::Active => {
                if is_speech {
                    self.current_state = JarvisState::Active;
                    self.emit_event("voice_activity", Some("Listening..."));
                    
                    // Always transcribe
                    match self.transcriber.transcribe(samples) {
                        Ok(text) => {
                            if !text.trim().is_empty() {
                                // Emit as transcription immediately
                                self.emit_event("transcription", Some(&text));
                                self.silence_counter = 0;
                            }
                        },
                        Err(e) => eprintln!("Transcription error: {}", e),
                    }
                } else {
                     self.silence_counter += 1;
                     // Optional: go back to idle visually?
                     if self.silence_counter > 3 {
                         self.current_state = JarvisState::Idle;
                         // self.emit_event("timeout", None); // Don't spam timeout
                     }
                }
            }
        }
        Ok(())
    }

    fn emit_event(&self, event: &str, text: Option<&str>) {
        let json = serde_json::to_string(&JarvisEvent {
            event: event.to_string(),
            text: text.map(|s| s.to_string()),
            state: format!("{:?}", self.current_state),
        }).unwrap_or_default();
        println!("{}", json);
    }
}
