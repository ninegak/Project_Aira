use crate::models::TtsRequest;
use crate::states::SharedAira;
use anyhow::Result;
use axum::{
    Json,
    body::Body,
    extract::State,
    http::{StatusCode, header},
    response::IntoResponse,
};
use hound::{SampleFormat, WavSpec, WavWriter};
use std::io::Cursor;

pub async fn tts(State(aira): State<SharedAira>, Json(req): Json<TtsRequest>) -> impl IntoResponse {
    // Clone TTS engine to avoid holding lock during synthesis
    let tts_engine = {
        let guard = aira.lock().unwrap();
        guard.get_tts()
    };

    // Run TTS in blocking thread
    let text = req.text.clone();
    let result = tokio::task::spawn_blocking(move || tts_engine.synthesize(&text)).await;

    match result {
        Ok(Ok(samples)) => match create_wav(samples) {
            Ok(wav_data) => {
                let content_length = wav_data.len().to_string();
                (
                    StatusCode::OK,
                    [
                        (header::CONTENT_TYPE, "audio/wav"),
                        (header::CONTENT_LENGTH, &content_length),
                    ],
                    Body::from(wav_data),
                )
                    .into_response()
            }
            Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
        },
        Ok(Err(e)) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

fn create_wav(samples: Vec<f32>) -> Result<Vec<u8>> {
    let spec = WavSpec {
        channels: 1,
        sample_rate: 22050,
        bits_per_sample: 16,
        sample_format: SampleFormat::Int,
    };

    let mut cursor = Cursor::new(Vec::with_capacity(samples.len() * 2 + 44));
    let mut writer = WavWriter::new(&mut cursor, spec)?;

    for sample in samples {
        writer.write_sample((sample.clamp(-1.0, 1.0) * 32767.0) as i16)?;
    }

    writer.finalize()?;
    Ok(cursor.into_inner())
}
