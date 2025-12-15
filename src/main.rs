use anyhow::{Context, Result};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use crossterm::{
    event::{self, Event, KeyCode, KeyEventKind},
    terminal,
};
use llama_cpp::{LlamaModel, LlamaParams, SessionParams, standard_sampler::StandardSampler};
use piper_rs::{self, synth::PiperSpeechSynthesizer};
use rodio::{OutputStream, Sink, buffer::SamplesBuffer};
use std::{
    path::Path,
    sync::{Arc, Mutex},
};
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

struct AiStack {
    session: llama_cpp::LlamaSession,
    tts: PiperSpeechSynthesizer,
    stt: WhisperContext,
}

impl AiStack {
    fn load(llm_path: &str, tts_path: &str, stt_path: &str) -> Result<Self> {
        // Load LLaMA model
        let llm = LlamaModel::load_from_file(
            llm_path,
            LlamaParams {
                n_gpu_layers: 20,
                ..Default::default()
            },
        )?;
        let session = llm.create_session(SessionParams::default())?;

        // Load Piper TTS model
        let model = piper_rs::from_config_path(Path::new(tts_path))?;
        let tts = PiperSpeechSynthesizer::new(model)?;

        // Load Whisper STT model
        let stt = WhisperContext::new_with_params(stt_path, WhisperContextParameters::default())?;

        Ok(Self { session, tts, stt })
    }

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
            text.push_str(segment.to_str()?);
        }

        Ok(text)
    }

    fn ask(&mut self, user: &str) -> Result<String> {
        let prompt = format!(
            "<|im_start|>user\n{}<|im_end|>\n<|im_start|>assistant\n",
            user
        );

        self.session.advance_context(&prompt)?;

        let mut response = String::new();
        let completions = self
            .session
            .start_completing_with(StandardSampler::default(), 150)?
            .into_strings();

        for token in completions {
            // Stop at end token or if we see another user message starting
            if token.contains("<|im_end|>")
                || token.contains("<|im_start|>")
                || token.contains("User:")
            {
                break;
            }
            response.push_str(&token);

            // Also stop at double newlines (end of response)
            if response.ends_with("\n\n") {
                break;
            }
        }

        // Clean up the response
        let cleaned = response
            .trim()
            .replace("<|im_end|>", "")
            .replace("<|im_start|>", "")
            .trim()
            .to_string();

        Ok(cleaned)
    }

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

fn stereo_to_mono(input: &[f32]) -> Vec<f32> {
    input.chunks(2).map(|c| (c[0] + c[1]) * 0.5).collect()
}

fn downsample_to_16khz(input: &[f32], input_rate: u32) -> Vec<f32> {
    let ratio = input_rate as f32 / 16_000.0;
    let mut out = Vec::new();
    let mut i = 0.0;
    while (i as usize) < input.len() {
        out.push(input[i as usize]);
        i += ratio;
    }
    out
}

fn process_audio(input: &[f32], sample_rate: u32) -> Vec<f32> {
    let mono = if input.len() > 1 {
        stereo_to_mono(input)
    } else {
        input.to_vec()
    };
    downsample_to_16khz(&mono, sample_rate)
}

fn wait_for_space() -> Result<()> {
    loop {
        if event::poll(std::time::Duration::from_millis(10))? {
            if let Event::Key(key) = event::read()? {
                if key.code == KeyCode::Char(' ') && key.kind == KeyEventKind::Press {
                    break;
                }
            }
        }
    }
    Ok(())
}

fn wait_for_any_key() -> Result<()> {
    loop {
        if event::poll(std::time::Duration::from_millis(10))? {
            if let Event::Key(_) = event::read()? {
                break;
            }
        }
    }
    Ok(())
}

fn record_microphone_hold_space() -> Result<Vec<f32>> {
    let host = cpal::default_host();

    //find a microphone
    let device = host
        .input_devices()?
        .find(|d| {
            if let Ok(name) = d.name() {
                let name_lower = name.to_lowercase();
                // Look for actual mic devices, avoid monitor/loopback devices
                (name_lower.contains("mic") || name_lower.contains("input"))
                    && !name_lower.contains("monitor")
                    && !name_lower.contains("loopback")
            } else {
                false
            }
        })
        .or_else(|| host.default_input_device())
        .ok_or_else(|| anyhow::anyhow!("No input device found"))?;

    // Show which device we're using
    if let Ok(name) = device.name() {
        println!("Using device: {}", name);
    }

    let config = device.default_input_config()?;
    let sample_format = config.sample_format();
    let sample_rate = config.sample_rate().0;
    let config = config.config();

    println!("\nPress SPACE to start recording...");
    wait_for_space()?;
    println!("Recording... (press any key to stop)");

    let recorded: Arc<Mutex<Vec<f32>>> = Arc::new(Mutex::new(Vec::new()));
    let recorded_clone = recorded.clone();
    let samples_received = Arc::new(Mutex::new(0usize));
    let samples_received_clone = samples_received.clone();

    let stream = match sample_format {
        cpal::SampleFormat::F32 => device.build_input_stream(
            &config,
            move |input: &[f32], _| {
                *samples_received_clone.lock().unwrap() += input.len();
                recorded_clone.lock().unwrap().extend_from_slice(input);
            },
            |err| eprintln!("Mic error: {}", err),
            None,
        )?,
        cpal::SampleFormat::I16 => device.build_input_stream(
            &config,
            move |input: &[i16], _| {
                *samples_received_clone.lock().unwrap() += input.len();
                recorded_clone
                    .lock()
                    .unwrap()
                    .extend(input.iter().map(|&s| s as f32 / 32768.0));
            },
            |err| eprintln!("Mic error: {}", err),
            None,
        )?,
        cpal::SampleFormat::U16 => device.build_input_stream(
            &config,
            move |input: &[u16], _| {
                *samples_received_clone.lock().unwrap() += input.len();
                recorded_clone
                    .lock()
                    .unwrap()
                    .extend(input.iter().map(|&s| (s as f32 - 32768.0) / 32768.0));
            },
            |err| eprintln!("Mic error: {}", err),
            None,
        )?,
        _ => panic!("Unsupported sample format: {:?}", sample_format),
    };

    stream.play()?;
    wait_for_any_key()?;
    drop(stream);

    println!("Stopped recording");
    terminal::disable_raw_mode()?;

    let audio = recorded.lock().unwrap().clone();
    Ok(process_audio(&audio, sample_rate))
}

fn main() -> Result<()> {
    let llm_path = "models/qwen2.5-7b-instruct-q4_k_m.gguf";
    let tts_path = "tts_models/en_US-hfc_female-medium.onnx.json";
    let stt_path = "models/ggml-small.en-q5_1.bin";

    println!("Loading AI models...");
    let mut ai = AiStack::load(llm_path, tts_path, stt_path)?;

    ai.session.advance_context(
        "<|im_start|>system\nYou are Aira, an empathetic AI consultant specializing in emotional support. Made by NineGeoff \
        Listen carefully to the user's emotions and respond with understanding and care. \
        Keep responses concise but warm.<|im_end|>\n"
    )?;

    println!("Voice AI Ready!\n");

    loop {
        terminal::enable_raw_mode()?;
        let audio = record_microphone_hold_space()?;

        println!("Transcribing...");
        let text = ai.transcribe(&audio)?;

        if text.trim().is_empty() {
            println!("(No speech detected)\n");
            continue;
        }

        println!("You said: {}", text);

        if text.to_lowercase().contains("exit") || text.to_lowercase().contains("quit") {
            println!("Goodbye!");
            break;
        }

        println!("Thinking...");
        let reply = ai.ask(&text)?;
        println!("Aira: {}\n", reply);

        ai.speak(&reply)?;
    }


    Ok(())
}
