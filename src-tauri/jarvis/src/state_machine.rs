use serde::Serialize;
use crate::transcript::{Transcriber, is_voice_active};

#[derive(Debug, PartialEq)]
pub enum JarvisState {
    Idle,
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
    silence_counter: usize,
}

impl StateMachine {
    pub fn new(model_path: &str) -> Result<Self, anyhow::Error> {
        let transcriber = Transcriber::new(model_path)?;
        Ok(Self {
            current_state: JarvisState::Idle,
            transcriber,
            silence_counter: 0,
        })
    }

    pub fn process_audio(&mut self, samples: &[f32]) -> Result<(), anyhow::Error> {
        // 1. VAD Check (Threshold 0.005 to filter typing/breathing)
        let is_speech = is_voice_active(samples, 0.005);
        
        // Debug
        // let sum_squares: f32 = samples.iter().map(|s| s * s).sum();
        // let rms = (sum_squares / samples.len() as f32).sqrt();
        // self.emit_event("debug", Some(&format!("RMS: {:.5}", rms)));

        match self.current_state {
            JarvisState::Idle | JarvisState::Active => {
                if is_speech {
                    self.current_state = JarvisState::Active;
                    self.emit_event("voice_activity", Some("Listening..."));
                    
                    // Always transcribe
                    match self.transcriber.transcribe(samples) {
                        Ok(text) => {
                            let trimmed = text.trim();
                            // Filter out non-speech (e.g. "[...]" or "(...)")
                            let is_clean = !trimmed.is_empty() 
                                && !trimmed.starts_with('[') 
                                && !trimmed.starts_with('(');

                            if is_clean {
                                // Emit as transcription immediately
                                self.emit_event("transcription", Some(trimmed));
                                self.silence_counter = 0;
                            }
                        },
                        Err(e) => eprintln!("Transcription error: {}", e),
                    }
                } else {
                     self.silence_counter += 1;
                     // 1 second of silence (since chunks are ~1s? No, chunks are usually smaller like 100ms in correct config, but here buffer is 16000 samples = 1s)
                     // If we process 1s chunks, silence_counter > 1 is enough.
                     // Let's assume we process whenever we have enough data.
                     
                     if self.silence_counter > 2 { // ~2-3 seconds of silence
                         if self.current_state == JarvisState::Active {
                             self.emit_event("speech_end", None);
                         }
                         self.current_state = JarvisState::Idle;
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
