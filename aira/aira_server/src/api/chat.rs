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
use std::convert::Infallible;
use std::sync::{Arc, Mutex};
use tokio::sync::mpsc;
use tokio_stream::{StreamExt, wrappers::ReceiverStream};

fn float_to_i16(samples: &[f32]) -> Vec<i16> {
    samples.iter().map(|s| (s * 32767.0) as i16).collect()
}

fn create_wav(samples: Vec<f32>, sample_rate: u32) -> anyhow::Result<Vec<u8>> {
    let spec = hound::WavSpec {
        channels: 1,
        sample_rate,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };
    let mut cursor = std::io::Cursor::new(Vec::new());
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
    let (tx, rx) = mpsc::channel::<Event>(256);
    let (tts_tx, mut tts_rx) = mpsc::channel::<String>(16);

    let tx_clone = tx.clone();
    let aira_state_clone = aira_state.clone();

    // --- Background TTS worker ---
    tokio::spawn(async move {
        while let Some(chunk) = tts_rx.recv().await {
            let tx_tts = tx_clone.clone();
            let aira_state_tts = aira_state_clone.clone();

            tokio::task::spawn_blocking(move || {
                if let Ok(samples) = aira_state_tts.lock().unwrap().speak(&chunk) {
                    if let Ok(wav) = create_wav(samples, 22050) {
                        let b64 = general_purpose::STANDARD.encode(&wav);
                        let _ = tokio::spawn(async move {
                            let _ = tx_tts
                                .send(Event::default().event("audio_complete").data(b64))
                                .await;
                        });
                    }
                }
            });
        }
    });

    // --- LLM streaming ---
    let tx_llm = tx.clone();
    let tts_tx_llm = tts_tx.clone();
    let aira_state_llm = aira_state.clone();

    tokio::spawn(async move {
        tokio::task::spawn_blocking(move || {
            // ✅ Use Arc<Mutex<String>> for thread-safe buffer sharing
            let buffer = Arc::new(Mutex::new(String::new()));
            let buffer_clone = buffer.clone();

            let mut guard = aira_state_llm.lock().unwrap();

            // ✅ CAPTURE the TPS result
            let result = guard.think(&req.message, |token: String| {
                let tx_llm = tx_llm.clone();
                let tts_tx_llm = tts_tx_llm.clone();
                let buffer = buffer_clone.clone();

                // ✅ Clone token BEFORE moving it
                let token_for_buffer = token.clone();

                // send token immediately (moves token)
                let _ = tokio::spawn(async move {
                    let _ = tx_llm.send(Event::default().data(token)).await;
                });

                // ✅ Use the cloned token for buffer operations
                let mut buf = buffer.lock().unwrap();
                buf.push_str(&token_for_buffer);

                // send chunk to TTS if end of sentence or buffer too long
                if buf.ends_with('.') || buf.ends_with('?') || buf.ends_with('!') || buf.len() > 100
                {
                    let chunk = buf.drain(..).collect::<String>();
                    drop(buf); // Release lock before blocking send
                    let _ = tts_tx_llm.blocking_send(chunk);
                } else {
                    drop(buf); // Release lock
                }

                Ok::<_, anyhow::Error>(())
            });

            // send remaining buffer
            {
                let mut buf = buffer.lock().unwrap();
                if !buf.is_empty() {
                    let chunk = buf.drain(..).collect::<String>();
                    drop(buf); // Release lock before blocking send
                    let _ = tts_tx_llm.blocking_send(chunk);
                }
            }

            // send tps
            if let Ok(tps) = result {
                let tx_tps = tx_llm.clone();
                let _ = tokio::spawn(async move {
                    let _ = tx_tps
                        .send(Event::default().event("tps").data(tps.to_string()))
                        .await;
                });
            }
        });
    });

    // --- Return SSE ---
    Sse::new(ReceiverStream::new(rx).map(Ok::<_, Infallible>))
}
