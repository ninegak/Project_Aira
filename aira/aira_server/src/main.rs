use aira_brain::{aira::Aira, llm::LlmEngine, stt::SttEngine, tts::TtsEngine};
use axum::{
    Router,
    routing::{get, post},
};
use std::{
    env,
    net::SocketAddr,
    path::PathBuf,
    sync::{Arc, Mutex},
};
use tokio::net::TcpListener;
use tokio::sync::Semaphore;
use tower_http::cors::CorsLayer;

mod api;
mod models;
mod states;

// Global semaphore to limit concurrent AI operations and prevent memory corruption
// Only allow 1 concurrent chat request at a time to prevent race conditions
static CHAT_SEMAPHORE: Semaphore = Semaphore::const_new(1);

// Get model path from environment variable or use default
// Priority: 1. Environment variable, 2. Current working dir, 3. Executable directory
fn get_model_path(env_var: &str, default_subpath: &str) -> PathBuf {
    // Check environment variable first
    if let Ok(path) = env::var(env_var) {
        return PathBuf::from(path);
    }
    
    // Check current working directory (for development)
    let cwd = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let cwd_path = cwd.join(default_subpath);
    if cwd_path.exists() {
        return cwd_path;
    }
    
    // Fall back to executable directory (for production)
    let exe_dir = env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| PathBuf::from("."));
    exe_dir.join(default_subpath)
}

// Print usage information
fn print_usage() {
    eprintln!("Usage: aira_server [OPTIONS]");
    eprintln!();
    eprintln!("Options:");
    eprintln!("  --stt-model <PATH>     Path to Whisper STT model (default: models/ggml-small.en-q5_1.bin)");
    eprintln!("  --llm-model <PATH>     Path to LLM model (default: models/qwen2.5-3b-instruct-q4_0.gguf)");
    eprintln!("  --tts-model <PATH>     Path to TTS model config (default: tts_models/en_US-hfc_female-medium.onnx.json)");
    eprintln!("  --help                 Show this help message");
    eprintln!();
    eprintln!("Environment Variables:");
    eprintln!("  AIRA_STT_MODEL         Override STT model path");
    eprintln!("  AIRA_LLM_MODEL         Override LLM model path");
    eprintln!("  AIRA_TTS_MODEL         Override TTS model path");
    eprintln!("  AIRA_SYSTEM_PROMPT     Custom system prompt for the AI");
}

#[tokio::main(flavor = "multi_thread", worker_threads = 2)]
async fn main() -> anyhow::Result<()> {
    // Parse command line arguments
    let args: Vec<String> = env::args().collect();
    
    // Check for help flag anywhere in args
    if args.iter().any(|arg| arg == "--help" || arg == "-h") {
        print_usage();
        return Ok(());
    }
    
    // Parse arguments
    let mut stt_path: Option<String> = None;
    let mut llm_path: Option<String> = None;
    let mut tts_path: Option<String> = None;
    
    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--stt-model" => {
                i += 1;
                if i < args.len() {
                    stt_path = Some(args[i].clone());
                }
            }
            "--llm-model" => {
                i += 1;
                if i < args.len() {
                    llm_path = Some(args[i].clone());
                }
            }
            "--tts-model" => {
                i += 1;
                if i < args.len() {
                    tts_path = Some(args[i].clone());
                }
            }
            _ => {
                eprintln!("Unknown argument: {}", args[i]);
                print_usage();
                return Ok(());
            }
        }
        i += 1;
    }
    
    println!("🚀 Starting Aira server...");
    println!("⚡ Using single-threaded AI processing to prevent memory corruption");
    
    // Get model paths (CLI args > env vars > defaults)
    let stt_model_path = stt_path.map(PathBuf::from)
        .unwrap_or_else(|| get_model_path("AIRA_STT_MODEL", "models/ggml-small.en-q5_1.bin"));
    
    let llm_model_path = llm_path.map(PathBuf::from)
        .unwrap_or_else(|| get_model_path("AIRA_LLM_MODEL", "models/qwen2.5-3b-instruct-q4_0.gguf"));
    
    let tts_model_path = tts_path.map(PathBuf::from)
        .unwrap_or_else(|| get_model_path("AIRA_TTS_MODEL", "tts_models/en_US-hfc_female-medium.onnx.json"));
    
    // Print which models are being loaded
    println!("📦 Model paths:");
    println!("   STT: {}", stt_model_path.display());
    println!("   LLM: {}", llm_model_path.display());
    println!("   TTS: {}", tts_model_path.display());
    
    // Check if models exist
    if !stt_model_path.exists() {
        eprintln!("❌ Error: STT model not found at: {}", stt_model_path.display());
        eprintln!("   Download it from: https://huggingface.co/ggerganov/whisper.cpp");
        eprintln!("   Or set AIRA_STT_MODEL environment variable");
        eprintln!("   Or use --stt-model <path> argument");
        return Err(anyhow::anyhow!("STT model not found"));
    }
    
    if !llm_model_path.exists() {
        eprintln!("❌ Error: LLM model not found at: {}", llm_model_path.display());
        eprintln!("   Download it from: https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF");
        eprintln!("   Or set AIRA_LLM_MODEL environment variable");
        eprintln!("   Or use --llm-model <path> argument");
        return Err(anyhow::anyhow!("LLM model not found"));
    }
    
    if !tts_model_path.exists() {
        eprintln!("❌ Error: TTS model not found at: {}", tts_model_path.display());
        eprintln!("   Download it from: https://huggingface.co/rhasspy/piper-voices");
        eprintln!("   Or set AIRA_TTS_MODEL environment variable");
        eprintln!("   Or use --tts-model <path> argument");
        return Err(anyhow::anyhow!("TTS model not found"));
    }
    
    // Load models
    println!("🎤 Loading STT model...");
    let stt = SttEngine::load(stt_model_path.to_str().unwrap())?;
    
    println!("🧠 Loading LLM model...");
    let system_prompt = env::var("AIRA_SYSTEM_PROMPT")
        .unwrap_or_else(|_| "<|im_start|>system\nYou are Aira, a warm, empathetic AI assistant.<|im_end|>\n".to_string());
    let llm = LlmEngine::load(llm_model_path.to_str().unwrap(), &system_prompt)?;
    
    println!("🔊 Loading TTS model...");
    let tts = TtsEngine::load(tts_model_path.to_str().unwrap())?;
    
    let aira = Arc::new(Mutex::new(Aira::new(stt, llm, tts)));
    
    let app = Router::new()
        .route("/health", get(api::health))
        .route("/chat", post(api::chat))
        .route("/api/tts", post(api::tts))
        .route("/api/stt/transcribe", post(api::transcribe_audio))
        .route("/api/camera/features", post(api::process_camera_features))
        .route("/api/camera/status", get(api::get_camera_status))
        .route("/api/emotion/current", get(api::get_emotion_details))
        .with_state((aira, &CHAT_SEMAPHORE))
        .layer(CorsLayer::permissive());
    
    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    println!("✅ Server ready at http://{}", addr);
    
    let listener = TcpListener::bind(&addr).await?;
    axum::serve(listener, app.into_make_service()).await?;
    
    Ok(())
}
