use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Stream, StreamConfig};
use ringbuf::{HeapRb, Producer};
use std::sync::Arc;

pub struct AudioEngine {
    _stream: Stream,
}

impl AudioEngine {
    pub fn new(producer: Producer<f32, Arc<HeapRb<f32>>>) -> Result<Self, anyhow::Error> {
        let host = cpal::default_host();
        let device = host.default_input_device()
            .ok_or_else(|| anyhow::anyhow!("No input device available"))?;

        println!("{{ \"status\": \"audio_device\", \"device\": \"{}\" }}", device.name().unwrap_or_default());

        let config: StreamConfig = device.default_input_config()?.into();
        let source_sample_rate = config.sample_rate.0;
        let channels = config.channels as usize;

        // Moving producer into the closure
        let mut producer = producer;
        
        let mut phase = 0.0;
        let step = source_sample_rate as f32 / 16000.0;

        let err_fn = |err| eprintln!("an error occurred on stream: {}", err);

        let stream = device.build_input_stream(
            &config,
            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                // 1. Process as Frames (to handle Mono/Stereo/etc)
                let frame_count = data.len() / channels;
                let mut frame_idx = 0;

                while frame_idx < frame_count {
                    // 2. Mix to Mono
                    let mut sum = 0.0;
                    for c in 0..channels {
                         if frame_idx * channels + c < data.len() {
                             sum += data[frame_idx * channels + c];
                         }
                    }
                    let mono_sample = sum / channels as f32;

                    // 3. Resample (Nearest Neighbor / Simple Decimation)
                    // We need to output at 16kHz. 
                    // 'step' is how many input samples correspond to 1 output sample.
                    // 'phase' tracks how much we have "traversed" of the input.
                    
                    // Algorithm:
                    // If phase < 1.0, it means the current input sample covers the "next" output time slot.
                    // So we take it.
                    // Then we look ahead for the NEXT output slot (phase += step).
                    
                    if phase < 1.0 {
                        let _ = producer.push(mono_sample);
                        phase += step;
                    }
                    
                    phase -= 1.0;
                    frame_idx += 1;
                }
            },
            err_fn,
            None,
        )?;

        stream.play()?;

        Ok(AudioEngine {
            _stream: stream,
        })
    }
}
