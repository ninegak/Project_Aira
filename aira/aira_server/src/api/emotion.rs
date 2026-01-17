use axum::{
    extract::{multipart::Multipart, State},
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use aira_brain::aira::Aira;
use anyhow::Result;
use async_trait::async_trait;
use hound::{WavReader, self};
use std::io::Cursor;
use aira_brain::emotion::EmotionAnalysis;
use futures_util::stream::StreamExt; // Import StreamExt

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct EmotionResponse {
    pub dominant_emotion: String,
    pub score: f32,
}

#[async_trait]
pub async fn analyze_emotion(
    State(aira): State<Arc<Mutex<Aira>>>,
    mut multipart: Multipart,
) -> Result<Json<EmotionResponse>, anyhow::Error> {
    let mut audio_data: Vec<u8> = Vec::new();

    while let Some(field) = multipart.next_field().await? {
        let name = field.name().ok_or_else(|| anyhow::anyhow!("Field name not found"))?;
        if name == "audio" {
            audio_data = field.bytes().await?.to_vec();
            break;
        }
    }

    if audio_data.is_empty() {
        return Err(anyhow::anyhow!("No audio data received"));
    }

    // Convert audio data (WAV) to f32 samples
    let cursor = Cursor::new(audio_data);
    let mut reader = WavReader::new(cursor)?;
    let samples: Vec<f32> = reader
        .samples::<i16>()
        .filter_map(|s| s.ok())
        .map(|s| s as f32 / i16::MAX as f32) // Normalize i16 to f32
        .collect();

    let aira_instance = aira.lock().unwrap();
    let emotion_analysis: EmotionAnalysis = aira_instance.analyze_emotion_from_audio(&samples)?;

    Ok(Json(EmotionResponse {
        dominant_emotion: format!("{:?}", emotion_analysis.dominant_emotion),
        score: emotion_analysis.score,
    }))
}
