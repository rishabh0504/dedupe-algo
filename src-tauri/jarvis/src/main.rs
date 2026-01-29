mod audio;
mod transcript;
mod state_machine;

use audio::AudioEngine;
use state_machine::{StateMachine, JarvisState};
use clap::Parser;
use ringbuf::HeapRb;
use std::time::Duration;
use tokio::time;

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// Wake word to listen for
    #[arg(short, long, default_value = "Hello Jarvis")]
    wake_word: String,

    /// Path to Whisper Model
    #[arg(short, long, default_value = "models/ggml-base.en.bin")]
    model: String,
}

#[tokio::main]
async fn main() -> Result<(), anyhow::Error> {
    let args = Args::parse();
    println!("{{ \"status\": \"initializing\", \"wake_word\": \"{}\", \"model\": \"{}\" }}", args.wake_word, args.model);

    // Setup RingBuffer
    // 16000Hz * 10 seconds buffer
    let ring = HeapRb::<f32>::new(16000 * 10);
    let (producer, mut consumer) = ring.split();

    // Start Audio Engine
    // Phase 2 output: producer moved here
    let _audio = match AudioEngine::new(producer) {
        Ok(engine) => engine,
        Err(e) => {
             eprintln!("{{ \"error\": \"Audio Init Failed: {}\" }}", e);
             // Verify if it is a permission issue or device issue
             println!("{{ \"status\": \"error\", \"message\": \"Audio Device Error: {}\" }}", e);
             return Err(e);
        }
    };

    // Initialize State Machine
    // This will fail if model is not found, which is expected
    let mut jarvis = match StateMachine::new(&args.model, &args.wake_word) {
        Ok(vm) => vm,
        Err(e) => {
             eprintln!("{{ \"error\": \"Failed to load model: {}\" }}", e);
             return Err(e);
        }
    };
    
    println!("{{ \"status\": \"ready\" }}");
    
    // Processing Loop
    loop {
        // Collect ~1.5 second of audio for VAD/Transcription - Safer for Whisper
        // 24000 samples
        // If we have enough data
        if consumer.len() > 24000 { 
            let chunk: Vec<f32> = consumer.pop_iter().take(24000).collect();
            
            // Process
            if let Err(e) = jarvis.process_audio(&chunk) {
                eprintln!("{{ \"error\": \"Processing error: {}\" }}", e);
            }
        } else {
             // Sleep a bit to prevent tight loop
             time::sleep(Duration::from_millis(100)).await;
        }
    }
}
