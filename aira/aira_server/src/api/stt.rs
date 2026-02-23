use crate::states::SharedAira;
use axum::{
    extract::{multipart::Multipart, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::Serialize;
use std::io::Cursor;
use std::process::Command;
use tokio::sync::Semaphore;

// STT transcription response
#[derive(Serialize)]
pub struct TranscribeResponse {
    pub text: String,
    pub confidence: f32,
}

// Transcribe audio to text using Whisper STT with rate limiting
pub async fn transcribe_audio(
    State((aira_state, _semaphore)): State<(SharedAira, &'static Semaphore)>,
    mut multipart: Multipart,
) -> impl IntoResponse {
    let result = async {
        let mut audio_data: Vec<u8> = Vec::new();

        // Extract audio data from multipart form
        while let Some(field) = multipart.next_field().await.map_err(|e| anyhow::anyhow!("Multipart error: {}", e))? {
            let name = field.name().ok_or_else(|| anyhow::anyhow!("Field name not found"))?;
            if name == "audio" {
                audio_data = field.bytes().await.map_err(|e| anyhow::anyhow!("Failed to read audio: {}", e))?.to_vec();
                break;
            }
        }

        if audio_data.is_empty() {
            return Err::<_, anyhow::Error>(anyhow::anyhow!("No audio data received"));
        }

        println!("Received audio data: {} bytes", audio_data.len());

        // Convert audio to f32 samples
        let samples = decode_audio(&audio_data).await?;

        println!("Decoded {} samples", samples.len());

        if samples.is_empty() {
            return Err::<_, anyhow::Error>(anyhow::anyhow!("No audio samples decoded"));
        }

        // Transcribe using Whisper
        let transcription = {
            let guard = aira_state.lock().unwrap();
            guard.transcribe(&samples)?
        };

        Ok(Json(TranscribeResponse {
            text: transcription,
            confidence: 0.95,
        }))
    }.await;

    match result {
        Ok(response) => response.into_response(),
        Err(e) => {
            eprintln!("STT Error: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, format!("Transcription failed: {}", e)).into_response()
        }
    }
}

// Decode audio bytes to f32 samples
// Tries multiple methods: WAV, FFmpeg conversion
async fn decode_audio(audio_data: &[u8]) -> anyhow::Result<Vec<f32>> {
    // Try WAV first (simplest)
    if audio_data.starts_with(b"RIFF") {
        println!("Detected WAV format, decoding...");
        return decode_wav(audio_data);
    }

    // For webm/opus, try ffmpeg conversion
    println!("Attempting FFmpeg conversion...");
    decode_with_ffmpeg(audio_data).await
}

// Decode WAV file to f32 samples
fn decode_wav(audio_data: &[u8]) -> anyhow::Result<Vec<f32>> {
    let cursor = Cursor::new(audio_data);
    let mut reader = hound::WavReader::new(cursor)?;
    
    let spec = reader.spec();
    println!("WAV format: {} channels, {} Hz, {} bits", spec.channels, spec.sample_rate, spec.bits_per_sample);
    
    let samples: Vec<f32> = reader
        .samples::<i16>()
        .filter_map(|s| s.ok())
        .map(|s| s as f32 / i16::MAX as f32)
        .collect();
    
    println!("Decoded {} WAV samples", samples.len());
    Ok(samples)
}

// Use FFmpeg to convert webm/opus to WAV, then decode
async fn decode_with_ffmpeg(audio_data: &[u8]) -> anyhow::Result<Vec<f32>> {
    // Create unique temporary files to avoid collisions
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let input_path = format!("/tmp/stt_input_{}.webm", timestamp);
    let output_path = format!("/tmp/stt_output_{}.wav", timestamp);
    
    // Write input audio to temp file
    std::fs::write(&input_path, audio_data)?;
    
    // Run ffmpeg to convert to WAV (16kHz mono, which Whisper expects)
    let output = Command::new("ffmpeg")
        .args(&[
            "-i", &input_path,
            "-ar", "16000",      // 16kHz sample rate (Whisper expects this)
            "-ac", "1",          // Mono
            "-c:a", "pcm_s16le", // 16-bit PCM
            "-y",                // Overwrite output
            &output_path,
        ])
        .output();
    
    match output {
            Ok(result) => {
                // Clean up input temp file regardless of success
                let _ = std::fs::remove_file(&input_path);
                
                if result.status.success() {
                    // Read the converted WAV file
                    let wav_data = std::fs::read(&output_path)?;
                    println!("FFmpeg conversion successful: {} bytes -> {} bytes", audio_data.len(), wav_data.len());
                    
                    // Clean up output temp file
                    let _ = std::fs::remove_file(&output_path);
                    
                    // Decode the WAV
                    decode_wav(&wav_data)
                } else {
                    let stderr = String::from_utf8_lossy(&result.stderr);
                    eprintln!("FFmpeg error: {}", stderr);
                    Err(anyhow::anyhow!("FFmpeg conversion failed: {}", stderr))
                }
            }
            Err(e) => {
                // Clean up temp file on error
                let _ = std::fs::remove_file(&input_path);
                eprintln!("Failed to run ffmpeg: {}", e);
                Err(anyhow::anyhow!("FFmpeg not available: {}", e))
            }
        }
}
