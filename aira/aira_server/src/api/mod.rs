use crate::states::SharedAira;
use axum::extract::State;
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

