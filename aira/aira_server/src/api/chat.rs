use crate::models::ChatRequest;
use crate::states::SharedAira;
use axum::{
    Json,
    extract::State,
    response::{
        IntoResponse,
        sse::{Event, Sse},
    },
};
use base64::{Engine as _, engine::general_purpose};
use futures_util::stream::StreamExt;
use std::convert::Infallible;
use std::io::Cursor;
use std::sync::Arc;
use tokio::sync::mpsc;
use tokio_stream::wrappers::ReceiverStream;

fn float_to_i16(samples: &[f32]) -> Vec<i16> {
    samples
        .iter()
        .map(|sample| (sample * 32767.0) as i16)
        .collect()
}

fn create_wav(samples: Vec<f32>, sample_rate: u32) -> anyhow::Result<Vec<u8>> {
    let spec = hound::WavSpec {
        channels: 1,
        sample_rate,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };
    let mut cursor = Cursor::new(Vec::new());
    let mut writer = hound::WavWriter::new(&mut cursor, spec)?;
    for sample in float_to_i16(&samples) {
        writer.write_sample(sample)?;
    }
    writer.finalize()?;
    Ok(cursor.into_inner())
}

pub async fn chat(
    State(aira_state): State<SharedAira>,
    Json(req): Json<ChatRequest>,
) -> impl IntoResponse {
    let (tx, rx) = mpsc::channel(256);

    let aira_state_for_blocking = aira_state.clone(); // Clone the Arc for the blocking task

    tokio::task::spawn_blocking(move || {
        let mut text_buffer = String::new();
        let mut audio_samples_buffer: Vec<f32> = Vec::new();
        let sample_rate = 22050; // Hardcoding sample rate as before

        let callback = |token: String| {
            // Send text token to frontend
            if let Err(e) = tx.blocking_send(Event::default().data(token.clone())) {
                return Err(anyhow::anyhow!("Channel closed: {}", e));
            }

            text_buffer.push_str(&token);

            // Simple chunking logic: send to TTS on sentence end or if buffer gets too large
            if text_buffer.ends_with('.')
                || text_buffer.ends_with('?')
                || text_buffer.ends_with('!')
                || text_buffer.len() > 100
            {
                if !text_buffer.is_empty() {
                    let chunk = text_buffer.drain(..).collect::<String>();
                    // Acquire lock for TTS within the callback
                    let mut aira_guard_for_tts = match aira_state_for_blocking.lock() {
                        Ok(guard) => guard,
                        Err(e) => {
                            let _ = tx.blocking_send(
                                Event::default()
                                    .event("tts_error")
                                    .data(format!("TTS lock poisoned: {}", e)),
                            );
                            return Err(anyhow::anyhow!("TTS lock poisoned: {}", e));
                        }
                    };
                    match aira_guard_for_tts.speak(&chunk) {
                        Ok(samples) => audio_samples_buffer.extend_from_slice(&samples),
                        Err(e) => {
                            let _ = tx.blocking_send(
                                Event::default()
                                    .event("tts_error")
                                    .data(format!("TTS error: {}", e)),
                            );
                        }
                    }
                }
            }
            Ok(())
        };

        // Acquire lock for LLM generation
        let mut aira_guard_for_llm = match aira_state_for_blocking.lock() {
            Ok(guard) => guard,
            Err(e) => {
                let _ = tx.blocking_send(
                    Event::default()
                        .event("error")
                        .data(format!("LLM lock poisoned: {}", e)),
                );
                return;
            }
        };

        match aira_guard_for_llm.think(&req.message, callback) {
            Ok(tps) => {
                let _ = tx.blocking_send(Event::default().event("tps").data(tps.to_string()));

                // Acquire lock for final TTS processing (if not already held by callback)
                let mut aira_guard_for_final_tts = match aira_state_for_blocking.lock() {
                    Ok(guard) => guard,
                    Err(e) => {
                        let _ = tx.blocking_send(
                            Event::default()
                                .event("error")
                                .data(format!("Final TTS lock poisoned: {}", e)),
                        );
                        return;
                    }
                };

                // Process any remaining text in buffer after LLM finishes
                if !text_buffer.is_empty() {
                    let chunk = text_buffer.drain(..).collect::<String>();
                    match aira_guard_for_final_tts.speak(&chunk) {
                        Ok(samples) => audio_samples_buffer.extend_from_slice(&samples),
                        Err(e) => {
                            let _ = tx.blocking_send(
                                Event::default()
                                    .event("tts_error")
                                    .data(format!("Final TTS error: {}", e)),
                            );
                        }
                    }
                }

                // Convert accumulated audio samples to WAV and send as final event
                if !audio_samples_buffer.is_empty() {
                    match create_wav(audio_samples_buffer, sample_rate) {
                        Ok(wav_data) => {
                            let base64_wav = general_purpose::STANDARD.encode(&wav_data);
                            let _ = tx.blocking_send(
                                Event::default().event("audio_complete").data(base64_wav),
                            );
                        }
                        Err(e) => {
                            let _ = tx.blocking_send(
                                Event::default()
                                    .event("audio_error")
                                    .data(format!("WAV conversion error: {}", e)),
                            );
                        }
                    }
                }
            }
            Err(e) => {
                let _ = tx.blocking_send(Event::default().event("error").data(e.to_string()));
            }
        }
    });

    Sse::new(ReceiverStream::new(rx).map(Ok::<_, Infallible>))
}
