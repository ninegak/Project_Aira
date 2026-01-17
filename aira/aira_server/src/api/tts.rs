use crate::models::TtsRequest;
use crate::states::SharedAira;
use anyhow::Result;
use axum::{
    body::Body,
    extract::State,
    http::{header, StatusCode},
    response::IntoResponse,
    Json,
};
use std::io::Cursor;

fn float_to_i16(samples: &[f32]) -> Vec<i16> {
    samples
        .iter()
        .map(|sample| (sample * 32767.0) as i16)
        .collect()
}

fn create_wav(samples: Vec<f32>, sample_rate: u32) -> Result<Vec<u8>> {
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

pub async fn tts(
    State(aira): State<SharedAira>,
    Json(req): Json<TtsRequest>,
) -> impl IntoResponse {
    let aira = aira.lock().unwrap();
    // Hardcoding sample rate to 22050 as there is no public API to get it from piper-rs.
    let sample_rate = 22050; 
    match aira.speak(&req.text) {
        Ok(samples) => match create_wav(samples, sample_rate) {
            Ok(wav_data) => (
                StatusCode::OK,
                {
                    let content_length_str = wav_data.len().to_string();
                    let mut headers = axum::http::HeaderMap::new();
                    headers.insert(header::CONTENT_TYPE, header::HeaderValue::from_static("audio/wav"));
                    headers.insert(
                        header::CONTENT_LENGTH,
                        header::HeaderValue::from_str(&content_length_str).unwrap(),
                    );
                    headers
                },
                Body::from(wav_data),
            )
                .into_response(),
            Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
        },
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}
