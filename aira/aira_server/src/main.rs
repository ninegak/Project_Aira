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

use aira_brain::{aira::Aira, llm::LlmEngine, stt::SttEngine, tts::TtsEngine};

mod api;
mod models;
mod states;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    println!("Starting Aira server...");

    let stt = SttEngine::load("/home/ninegak/Project_Aira/aira/models/ggml-small.en-q5_1.bin")?;
    let llm = LlmEngine::load(
        "/home/ninegak/Project_Aira/aira/models/qwen2.5-7b-instruct-q4_k_m.gguf",
        "<|im_start|>system\nYou are Aira, a warm, empathetic AI assistant.<|im_end|>\n",
    )?;
    let tts = TtsEngine::load(
        "/home/ninegak/Project_Aira/aira/tts_models/en_US-hfc_female-medium.onnx.json",
    )?;

    let aira = Arc::new(Mutex::new(Aira::new(stt, llm, tts)));

    let app = Router::new()
        .route("/health", get(api::health))
        .route("/chat", post(api::chat))
        .with_state(aira)
        .layer(CorsLayer::permissive());

    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    println!("Listening on http://{}", addr);

    let listener = TcpListener::bind(&addr).await?;
    axum::serve(listener, app.into_make_service()).await?;

    Ok(())
}
