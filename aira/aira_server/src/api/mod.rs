pub mod chat;
pub mod tts;
pub use chat::chat;
pub use tts::tts;

pub async fn health() -> &'static str {
    "OK"
}