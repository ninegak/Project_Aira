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
use std::convert::Infallible;
use std::time::Duration;
use tokio::sync::{Semaphore, mpsc};
use tokio::time::timeout;

// Remove markdown formatting artifacts from LLM output
fn clean_llm_output(text: &str) -> String {
    let mut result = String::with_capacity(text.len());
    let mut chars = text.chars().peekable();

    while let Some(c) = chars.next() {
        match c {
            '*' => {
                // Check if it's a double asterisk (bold)
                if chars.peek() == Some(&'*') {
                    chars.next(); // Skip the second asterisk
                    continue; // Don't add either asterisk
                }
                // Check if it's a bullet point (asterisk at start of line or after space)
                else if result.is_empty() || result.ends_with('\n') || result.ends_with(' ') {
                    result.push('•'); // Convert to bullet point
                    // Skip the space after asterisk if present
                    if chars.peek() == Some(&' ') {
                        chars.next();
                        result.push(' ');
                    }
                }
                // Otherwise it's an italic marker, skip it
                else {
                    continue;
                }
            }
            '_' => {
                // Check if it's a double underscore (bold)
                if chars.peek() == Some(&'_') {
                    chars.next(); // Skip the second underscore
                    continue; // Don't add either underscore
                }
                // Otherwise it's an italic marker, skip it
                else {
                    continue;
                }
            }
            _ => result.push(c),
        }
    }

    result
}

// Chat endpoint with semaphore-based rate limiting to prevent memory corruption
pub async fn chat(
    State((aira_state, semaphore)): State<(SharedAira, &'static Semaphore)>,
    Json(req): Json<ChatRequest>,
) -> impl IntoResponse {
    // Try to acquire a permit with timeout
    let _permit = match timeout(Duration::from_secs(5), semaphore.acquire()).await {
        Ok(Ok(permit)) => permit,
        Ok(Err(_)) => {
            let stream: std::pin::Pin<
                Box<dyn tokio_stream::Stream<Item = Result<Event, Infallible>> + Send>,
            > = Box::pin(tokio_stream::iter(vec![Ok::<_, Infallible>(
                Event::default()
                    .event("error")
                    .data("Server is shutting down"),
            )]));
            return Sse::new(stream);
        }
        Err(_) => {
            let stream: std::pin::Pin<
                Box<dyn tokio_stream::Stream<Item = Result<Event, Infallible>> + Send>,
            > = Box::pin(tokio_stream::iter(vec![Ok::<_, Infallible>(
                Event::default()
                    .event("error")
                    .data("Server is busy, please try again"),
            )]));
            return Sse::new(stream);
        }
    };

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

        // Spawn TTS worker that processes chunks sequentially (not concurrently)
        let event_tx_tts = event_tx.clone();
        let tts_worker_handle = tokio::spawn(async move {
            while let Some(text_chunk) = tts_rx.recv().await {
                let tts = tts_engine.clone();
                let event_tx = event_tx_tts.clone();

                // Process TTS sequentially with error handling
                let result = tokio::task::spawn_blocking(move || {
                    match tts.synthesize(&text_chunk) {
                        Ok(samples) => {
                            // Convert to WAV and encode as base64
                            match samples_to_base64_wav(samples) {
                                Ok(wav_base64) => {
                                    let _ = event_tx.blocking_send(Ok(Event::default()
                                        .event("audio_complete")
                                        .data(wav_base64)));
                                }
                                Err(e) => eprintln!("WAV encoding error: {}", e),
                            }
                        }
                        Err(e) => eprintln!("TTS synthesis error: {}", e),
                    }
                })
                .await;

                if let Err(e) = result {
                    eprintln!("TTS task panicked: {}", e);
                }
            }
            println!("TTS worker finished processing all chunks");
        });

        // LLM inference in blocking thread
        let event_tx_llm = event_tx.clone();
        let message = req.message.clone();

        let llm_result = tokio::task::spawn_blocking(move || {
            // Sentence buffer for TTS
            let mut sentence_buffer = String::with_capacity(128);

            let tps_result = {
                let mut guard = aira_state.lock().unwrap();

                guard.think(&message, |token: &str| {
                    // Clean markdown formatting from token
                    let cleaned_token = clean_llm_output(token);

                    // Send cleaned token immediately
                    let _ = event_tx_llm
                        .blocking_send(Ok(Event::default().data(cleaned_token.clone())));

                    // Buffer for sentence detection (use original token for detection)
                    sentence_buffer.push_str(&cleaned_token);

                    // Send to TTS on sentence boundaries
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

            // Send tps after generation completes
            if let Ok(tps) = tps_result {
                let _ = event_tx_llm.blocking_send(Ok(Event::default()
                    .event("tps")
                    .data(format!("{:.2}", tps))));
            }

            // Send remaining buffer to TTS
            if !sentence_buffer.trim().is_empty() {
                let _ = tts_tx.blocking_send(sentence_buffer);
            }

            // Close TTS channel to signal no more chunks
            drop(tts_tx);
        })
        .await;

        if let Err(e) = llm_result {
            eprintln!("LLM task panicked: {}", e);
            let _ = event_tx
                .send(Ok(Event::default()
                    .event("error")
                    .data("Processing failed, please try again")))
                .await;
        }

        // Wait for TTS worker to finish processing all queued chunks
        println!("Waiting for TTS worker to complete...");
        if let Err(e) = tokio::time::timeout(Duration::from_secs(15), tts_worker_handle).await {
            eprintln!("TTS worker timed out or failed: {:?}", e);
        } else {
            println!("TTS worker completed successfully");
        }
    });

    // Convert ReceiverStream to a generic stream trait object
    let stream: std::pin::Pin<
        Box<dyn tokio_stream::Stream<Item = Result<Event, Infallible>> + Send>,
    > = Box::pin(tokio_stream::wrappers::ReceiverStream::new(event_rx));
    Sse::new(stream)
}

// Optimized WAV creation and base64 encoding in a single pass
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
