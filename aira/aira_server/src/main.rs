use aira_brain::{aira::Aira, llm::LlmEngine, stt::SttEngine, tts::TtsEngine};
use axum::{
    Router,
    routing::{get, post},
};
use std::{
    net::SocketAddr,
    sync::{Arc, Mutex},
};
use tokio::net::TcpListener;
use tower_http::cors::CorsLayer;

mod api;
mod models;
mod states;

#[tokio::main(flavor = "multi_thread", worker_threads = 4)]
async fn main() -> anyhow::Result<()> {
    println!("🚀 Starting Aira server...");

    // Load models
    println!("📦 Loading STT model...");
    let stt = SttEngine::load("/home/ninegak/Project_Aira/aira/models/ggml-small.en-q5_1.bin")?;

    println!("📦 Loading LLM model...");
    let llm = LlmEngine::load(
        "/home/ninegak/Project_Aira/aira/models/qwen2.5-3b-instruct-q4_0.gguf",
        "<|im_start|>system\nYou are Aira, a warm, empathetic AI assistant.<|im_end|>\n",
    )?;

    println!("📦 Loading TTS model...");
    let tts = TtsEngine::load(
        "/home/ninegak/Project_Aira/aira/tts_models/en_US-hfc_female-medium.onnx.json",
    )?;

    let aira = Arc::new(Mutex::new(Aira::new(stt, llm, tts)));

    let app = Router::new()
        .route("/health", get(api::health))
        .route("/chat", post(api::chat))
        .route("/api/tts", post(api::tts))
        .with_state(aira)
        .layer(CorsLayer::permissive());

    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    println!("✅ Server ready at http://{}", addr);

    let listener = TcpListener::bind(&addr).await?;
    axum::serve(listener, app.into_make_service()).await?;

    Ok(())
}
