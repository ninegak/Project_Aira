use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct ChatRequest {
    pub message: String,
}

#[derive(Deserialize)]
pub struct TtsRequest {
    pub text: String,
}

#[derive(Serialize)]
pub struct ChatResponse {
    pub reply: String,
}
