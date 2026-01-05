pub mod chat;
pub use chat::chat;

pub async fn health() -> &'static str {
    "OK"
}