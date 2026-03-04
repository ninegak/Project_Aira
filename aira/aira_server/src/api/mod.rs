use crate::states::SharedAira;
use axum::extract::State;
use axum::Json;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tokio::sync::Semaphore;

pub mod camera;
pub mod chat;
pub mod stt;
pub mod tts;

pub use camera::{get_camera_status, get_emotion_details, process_camera_features};
pub use chat::chat;
pub use stt::transcribe_audio;
pub use tts::tts;

pub async fn health(_state: State<(SharedAira, &'static Semaphore)>) -> &'static str {
    "OK"
}

#[derive(Deserialize, Default)]
pub struct TestStressRequest {
    pub duration_seconds: Option<u32>,
}

#[derive(Serialize, Clone)]
pub struct TestStressResponse {
    pub message: String,
    pub simulated_stress_level: f32,
    pub alert_message: String,
    pub audio_base64: Option<String>,
}

static PENDING_ALERT: Mutex<Option<(String, Option<String>)>> = Mutex::new(None);

#[derive(Serialize)]
pub struct AlertResponse {
    pub has_alert: bool,
    pub message: Option<String>,
    pub audio_base64: Option<String>,
}

/// Get pending alert - frontend polls this
pub async fn get_alert(_state: State<(SharedAira, &'static Semaphore)>) -> Json<AlertResponse> {
    let mut alert = PENDING_ALERT.lock().unwrap();
    let alert_data = alert.clone();
    *alert = None; // Clear after reading
    
    let (message, audio_base64) = alert_data.map(|(m, a)| (Some(m), a)).unwrap_or((None, None));
    
    Json(AlertResponse {
        has_alert: message.is_some(),
        message,
        audio_base64,
    })
}

fn base64_encode(data: &[u8]) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::new();
    let chunks = data.chunks(3);
    for chunk in chunks {
        let b0 = chunk[0] as usize;
        let b1 = chunk.get(1).copied().unwrap_or(0) as usize;
        let b2 = chunk.get(2).copied().unwrap_or(0) as usize;
        
        result.push(CHARS[b0 >> 2] as char);
        result.push(CHARS[((b0 & 0x03) << 4) | (b1 >> 4)] as char);
        
        if chunk.len() > 1 {
            result.push(CHARS[((b1 & 0x0f) << 2) | (b2 >> 6)] as char);
        } else {
            result.push('=');
        }
        
        if chunk.len() > 2 {
            result.push(CHARS[b2 & 0x3f] as char);
        } else {
            result.push('=');
        }
    }
    result
}

/// Test endpoint to simulate stress detection - synthesizes and returns audio directly
pub async fn test_stress(
    State((aira, _semaphore)): State<(SharedAira, &'static Semaphore)>,
    Json(req): Json<TestStressRequest>,
) -> Json<TestStressResponse> {
    let duration = req.duration_seconds.unwrap_or(60);
    
    let stress_level = 0.85;
    let alert = if duration >= 180 {
        "You've been stressed for over 3 minutes! Take a deep breath."
    } else if duration >= 60 {
        "You seem like you've been through a lot. Take a deep breath."
    } else {
        "Remember to take breaks when needed."
    };
    
    // Synthesize speech
    let aira_for_tts = {
        let guard = aira.lock().unwrap();
        guard.get_tts()
    };
    
    let text = alert.to_string();
    let audio_base64: Option<String> = {
        type TtsResult = anyhow::Result<Vec<f32>>;
        let result: std::result::Result<TtsResult, tokio::task::JoinError> = 
            tokio::task::spawn_blocking(move || aira_for_tts.synthesize(&text)).await;
        
        match result {
            Ok(Ok(samples)) => {
                let wav_data = create_wav_sync(&samples);
                Some(base64_encode(&wav_data))
            }
            _ => None,
        }
    };
    
    // Store alert for frontend polling (as backup)
    {
        let mut pending = PENDING_ALERT.lock().unwrap();
        *pending = Some((alert.to_string(), audio_base64.clone()));
    }
    
    Json(TestStressResponse {
        message: format!("Simulated {} seconds of high stress ({}%)", duration, (stress_level * 100.0) as u32),
        simulated_stress_level: stress_level,
        alert_message: alert.to_string(),
        audio_base64,
    })
}

fn create_wav_sync(samples: &[f32]) -> Vec<u8> {
    let spec = hound::WavSpec {
        channels: 1,
        sample_rate: 22050,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };
    
    let mut wav_data = Vec::with_capacity(samples.len() * 2 + 44);
    let mut cursor = std::io::Cursor::new(&mut wav_data);
    {
        let mut writer = hound::WavWriter::new(&mut cursor, spec).unwrap();
        for sample in samples {
            writer.write_sample((sample.clamp(-1.0, 1.0) * 32767.0) as i16).unwrap();
        }
        writer.finalize().unwrap();
    }
    wav_data
}

