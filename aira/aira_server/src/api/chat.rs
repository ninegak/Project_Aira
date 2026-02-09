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
use bytes::Bytes;
use std::convert::Infallible;
use tokio::sync::mpsc;
use tokio_stream::{StreamExt, wrappers::ReceiverStream};

/// High-performance chat endpoint with optimized streaming
pub async fn chat(
    State(aira_state): State<SharedAira>,
    Json(req): Json<ChatRequest>,
) -> impl IntoResponse {
    // Use larger channel to reduce backpressure
    let (event_tx, event_rx) = mpsc::channel::<Result<Event, Infallible>>(512);

    tokio::spawn(async move {
        // Clone TTS engine ONCE outside the lock for concurrent use
        let tts_engine = {
            let guard = aira_state.lock().unwrap();
            guard.get_tts()
        };

        // TTS worker channel
        let (tts_tx, mut tts_rx) = mpsc::channel::<String>(32);

        // Spawn TTS worker that processes chunks concurrently
        let event_tx_tts = event_tx.clone();
        tokio::spawn(async move {
            while let Some(text_chunk) = tts_rx.recv().await {
                let tts = tts_engine.clone();
                let event_tx = event_tx_tts.clone();

                // Spawn blocking task for TTS synthesis
                tokio::task::spawn_blocking(move || {
                    if let Ok(samples) = tts.synthesize(&text_chunk) {
                        // Convert to WAV and encode as base64 in one go
                        if let Ok(wav_base64) = samples_to_base64_wav(samples) {
                            let _ = event_tx.blocking_send(Ok(Event::default()
                                .event("audio_complete")
                                .data(wav_base64)));
                        }
                    }
                });
            }
        });

        // LLM inference in blocking thread
        let event_tx_llm = event_tx.clone();
        let message = req.message.clone();

        tokio::task::spawn_blocking(move || {
            // Sentence buffer for TTS (no Arc<Mutex>, just local)
            let mut sentence_buffer = String::with_capacity(128);

            let tps_result = {
                let mut guard = aira_state.lock().unwrap();

                guard.think(&message, |token: &str| {
                    // Send token immediately (zero-copy via &str)
                    let _ =
                        event_tx_llm.blocking_send(Ok(Event::default().data(token.to_string())));

                    // Buffer for sentence detection
                    sentence_buffer.push_str(token);

                    // Send to TTS on sentence boundaries or buffer overflow
                    if sentence_buffer.ends_with('.')
                        || sentence_buffer.ends_with('?')
                        || sentence_buffer.ends_with('!')
                        || sentence_buffer.len() > 150
                    {
                        if !sentence_buffer.trim().is_empty() {
                            let _ = tts_tx.blocking_send(sentence_buffer.clone());
                            sentence_buffer.clear();
                        }
                    }

                    Ok::<_, anyhow::Error>(())
                })
            };

            // Send remaining buffer to TTS
            if !sentence_buffer.trim().is_empty() {
                let _ = tts_tx.blocking_send(sentence_buffer);
            }

            // Close TTS channel
            drop(tts_tx);

            // Send TPS event
            if let Ok(tps) = tps_result {
                let _ = event_tx_llm.blocking_send(Ok(Event::default()
                    .event("tps")
                    .data(format!("{:.2}", tps))));
            }
        });
    });

    Sse::new(ReceiverStream::new(event_rx))
}

/// Optimized WAV creation and base64 encoding in a single pass
fn samples_to_base64_wav(samples: Vec<f32>) -> anyhow::Result<String> {
    use base64::{Engine as _, engine::general_purpose};
    use hound::{SampleFormat, WavSpec, WavWriter};
    use std::io::Cursor;

    let spec = WavSpec {
        channels: 1,
        sample_rate: 22050,
        bits_per_sample: 16,
        sample_format: SampleFormat::Int,
    };

    let mut cursor = Cursor::new(Vec::with_capacity(samples.len() * 2 + 44));
    let mut writer = WavWriter::new(&mut cursor, spec)?;

    // Convert f32 to i16 inline
    for sample in samples {
        writer.write_sample((sample.clamp(-1.0, 1.0) * 32767.0) as i16)?;
    }

    writer.finalize()?;
    Ok(general_purpose::STANDARD.encode(cursor.into_inner()))
}
