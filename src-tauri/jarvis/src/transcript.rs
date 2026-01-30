use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};
use std::path::Path;

pub struct Transcriber {
    ctx: WhisperContext,
}

impl Transcriber {
    pub fn new(model_path: &str) -> Result<Self, anyhow::Error> {
        let path = Path::new(model_path);
        if !path.exists() {
            return Err(anyhow::anyhow!("Model file not found at: {}", model_path));
        }

        let ctx = WhisperContext::new_with_params(
            model_path,
            WhisperContextParameters::default()
        ).map_err(|e| anyhow::anyhow!("Failed to load Whisper model: {:?}", e))?;

        Ok(Self { ctx })
    }

    pub fn transcribe(&mut self, samples: &[f32]) -> Result<String, anyhow::Error> {
        // Create a state
        let mut state = self.ctx.create_state()
            .map_err(|e| anyhow::anyhow!("Failed to create Whisper state: {:?}", e))?;

        // Configure parameters
        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
        params.set_n_threads(4);
        params.set_language(Some("en"));
        params.set_print_special(false);
        params.set_print_progress(false);
        params.set_print_realtime(false);
        params.set_print_timestamps(false);

        // Run inference
        state.full(params, samples)
            .map_err(|e| anyhow::anyhow!("Failed to run inference: {:?}", e))?;

        // Fetch result
        let num_segments = state.full_n_segments()
            .map_err(|e| anyhow::anyhow!("Failed to get segment count: {:?}", e))?;

        let mut text = String::new();
        for i in 0..num_segments {
            let segment = state.full_get_segment_text(i)
                .map_err(|e| anyhow::anyhow!("Failed to get segment text: {:?}", e))?;
            text.push_str(&segment);
        }

        let text = text.replace("[BLANK_AUDIO]", "");
        Ok(text.trim().to_string())
    }
}

// Simple energy-based VAD for MVP
pub fn is_voice_active(samples: &[f32], threshold: f32) -> bool {
    let sum_squares: f32 = samples.iter().map(|s| s * s).sum();
    let rms = (sum_squares / samples.len() as f32).sqrt();
    
    // Debug Log: Prove Mic is Working
    if rms > 0.0001 {
        use std::io::{Write, stdout};
        println!("{{ \"event\": \"debug\", \"message\": \"Energy: {:.6}\" }}", rms);
        stdout().flush().unwrap_or_default();
    }
    
    rms > threshold
}
