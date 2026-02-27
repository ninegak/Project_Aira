use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct ChatRequest {
    pub message: String,
}

#[derive(Deserialize)]
pub struct TtsRequest {
    pub text: String,
}

// Camera features sent from frontend for emotion detection
#[derive(Deserialize, Serialize, Clone, Debug)]
pub struct CameraFeatures {
    pub face_present: bool,
    pub face_confidence: f32,
    pub avg_eye_openness: f32,
    pub blink_rate: f32,
    pub smile_score: f32,
    pub head_pitch: f32,
    pub head_yaw: f32,
}

// EmotionalContext is available through aira_brain when needed
