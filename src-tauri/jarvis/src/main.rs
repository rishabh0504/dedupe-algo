mod audio;
mod transcript;
mod state_machine;

use audio::AudioEngine;
use state_machine::StateMachine;
use clap::Parser;
use ringbuf::HeapRb;
use std::time::Duration;
use tokio::time;
use std::io::{Write, stdout};

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
    stdout().flush().unwrap_or_default();

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
    let mut jarvis = match StateMachine::new(&args.model) {
        Ok(vm) => vm,
        Err(e) => {
             eprintln!("{{ \"error\": \"Failed to load model: {}\" }}", e);
             return Err(e);
        }
    };
    
    
    println!("{{ \"status\": \"ready\" }}");
    stdout().flush().unwrap_or_default();
    
    use tokio::io::{AsyncBufReadExt, BufReader};
    let (tx, mut rx) = tokio::sync::mpsc::channel::<String>(32);
    
    // Pattern: Start MUTED by default to prevent initial echo leaks
    let mut is_muted = true;
    println!("{{ \"event\": \"muted\" }}");
    stdout().flush().unwrap_or_default();

    // Dedicated Stdin Task
    tokio::spawn(async move {
        let mut lines = BufReader::new(tokio::io::stdin()).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let _ = tx.send(line).await;
        }
    });

    let mut last_heartbeat = tokio::time::Instant::now();

    // Processing Loop
    loop {
        // Heartbeat every 2 seconds
        if last_heartbeat.elapsed() > Duration::from_secs(2) {
            println!("{{ \"event\": \"heartbeat\", \"state\": \"{:?}\", \"buffer_fill\": {} }}", jarvis.current_state, consumer.len());
            stdout().flush().unwrap_or_default();
            last_heartbeat = tokio::time::Instant::now();
        }

        // 1. Handshake Acknowledgment Logic
        while let Ok(line) = rx.try_recv() {
            let cmd = line.trim();
            match cmd {
                "MUTE" | "STOP_LISTENER" => {
                    is_muted = true;
                    jarvis.reset_buffer();
                    // CRITICAL: Physical Handshake Event
                    println!("{{ \"event\": \"muted\", \"message\": \"Mic listener stopped\" }}");
                    stdout().flush().unwrap_or_default();
                },
                "LISTEN" | "UNMUTE" | "START_LISTENER" => {
                    is_muted = false;
                    jarvis.reset_buffer(); // Clear any stale noise caught during transitions
                    // CRITICAL: Physical Handshake Event
                    println!("{{ \"event\": \"listening\", \"message\": \"Mic listener started\" }}");
                    stdout().flush().unwrap_or_default();
                },
                "RESET" | "CLEAR" => {
                    jarvis.reset_buffer();
                    println!("{{ \"event\": \"buffer_cleared\" }}");
                    stdout().flush().unwrap_or_default();
                },
                _ => {
                    println!("{{ \"event\": \"debug\", \"message\": \"Received unknown command: {}\" }}", cmd);
                    stdout().flush().unwrap_or_default();
                }
            }
        }
        
        // 2. Process or Discard
        if is_muted {
            let _discarded: Vec<f32> = consumer.pop_iter().collect();
            time::sleep(Duration::from_millis(10)).await;
        } else if consumer.len() > 1600 {
            let chunk: Vec<f32> = consumer.pop_iter().take(1600).collect();
            if let Err(e) = jarvis.process_audio(&chunk) {
                eprintln!("{{ \"error\": \"Processing error: {}\" }}", e);
            }
        } else {
            time::sleep(Duration::from_millis(10)).await;
        }
    }
}
