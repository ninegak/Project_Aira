use anyhow::{Context, Result};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use llama_cpp::{LlamaModel, LlamaParams, SessionParams, standard_sampler::StandardSampler};
use piper_rs::{self, synth::PiperSpeechSynthesizer};
use rodio::{OutputStream, Sink, buffer::SamplesBuffer};
use std::{
    path::Path,
    sync::{Arc, Mutex},
};
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

/// Holds all AI components
struct AiStack {
    session: llama_cpp::LlamaSession,
    tts: PiperSpeechSynthesizer,
    stt: WhisperContext,
}

impl AiStack {
    fn load(llm_path: &str, tts_path: &str, stt_path: &str) -> Result<Self> {
        // ---- Load LLM ----
        let llm = LlamaModel::load_from_file(
            llm_path,
            LlamaParams {
                n_gpu_layers: 20,
                ..Default::default()
            },
        )?;
        let session = llm.create_session(SessionParams::default())?;

        // ---- Load TTS ----
        let model = piper_rs::from_config_path(Path::new(tts_path))?;
        let tts = PiperSpeechSynthesizer::new(model)?;

        // ---- Load Whisper STT ----
        let stt = WhisperContext::new_with_params(stt_path, WhisperContextParameters::default())?;

        Ok(Self {
            session,
            tts,
            stt,
        })
    }

    // Transcribe audio buffer using Whisper
    fn transcribe(&self, audio: &[f32]) -> Result<String> {
        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
        params.set_language(Some("en"));
        params.set_n_threads(4);

        let mut state = self
            .stt
            .create_state()
            .context("failed to create whisper state")?;

        state.full(params, audio).context("whisper full() failed")?;

        let mut text = String::new();
        for segment in state.as_iter() {
            let s = segment
                .to_str()
                .context("failed to convert whisper segment to str")?;
            text.push_str(s);
        }

        Ok(text)
    }

    // Ask LLM
    fn ask(&mut self, user: &str) -> Result<String> {
        let prompt = format!("Human: {}\nAssistant:", user);
        self.session.advance_context(&prompt)?;

        let completions = self
            .session
            .start_completing_with(StandardSampler::default(), 128)?
            .into_strings();

        Ok(completions.collect::<Vec<_>>().concat())
    }

    // Speak reply
    fn speak(&self, text: &str) -> Result<()> {
        let chunks = self.tts.synthesize_parallel(text.to_string(), None)?;
        let mut samples: Vec<f32> = Vec::new();

        for c in chunks {
            samples.extend(c?);
        }

        let (_stream, handle) = OutputStream::try_default()?;
        let sink = Sink::try_new(&handle)?;
        let buffer = SamplesBuffer::new(1, 22050, samples);
        sink.append(buffer);
        sink.sleep_until_end();

        Ok(())
    }
}

// Record mic audio for STT using CPAL
fn record_microphone(seconds: f32) -> Result<Vec<f32>> {
    let host = cpal::default_host();
    let device = host.default_input_device().context("No mic detected")?;
    let config = device.default_input_config()?.config();

    let sample_rate = config.sample_rate.0 as usize;
    let _sample_count = (seconds * sample_rate as f32) as usize;

    let data: Arc<Mutex<Vec<f32>>> = Arc::new(Mutex::new(Vec::new()));
    let data_ref = data.clone();

    let stream = device.build_input_stream(
        &config,
        move |input: &[f32], _| {
            let mut buf = data_ref.lock().unwrap();
            buf.extend_from_slice(input);
        },
        move |err| eprintln!("Mic error: {}", err),
        None,
    )?;

    stream.play()?;

    std::thread::sleep(std::time::Duration::from_secs_f32(seconds));

    drop(stream);

    let audio = data.lock().unwrap().clone();
    Ok(audio)
}

fn main() -> Result<()> {
    // Model paths
    let llm_path = "models/qwen2.5-7b-instruct-q4_k_m.gguf";
    let tts_path = "tts_models/en_US-hfc_female-medium.onnx.json";
    let stt_path = "models/ggml-small.en-q5_1.bin";

    let mut ai = AiStack::load(llm_path, tts_path, stt_path)?;

    ai.session
        .advance_context("Your name is Aira. You are a friendly, helpful AI.")?;

    println!("🎤 Speak now! (3 seconds each turn)");

    loop {
        println!("---");
        println!("Listening...");

        let audio = record_microphone(3.0)?;
        let text = ai.transcribe(&audio)?;

        if text.trim().is_empty() {
            println!("(Silence)");
            continue;
        }

        println!("You said: {}", text);

        if text.eq_ignore_ascii_case("exit") {
            break;
        }

        let reply = ai.ask(&text)?;
        println!("Assistant: {}", reply);

        ai.speak(&reply)?;
    }

    Ok(())
}

