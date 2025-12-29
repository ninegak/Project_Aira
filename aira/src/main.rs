use anyhow::{Context, Result};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use crossterm::{
    event::{self, Event, KeyCode, KeyEventKind},
    terminal,
};
use rodio::{OutputStream, Sink, buffer::SamplesBuffer};
use std::{
    io::{self, Write},
    sync::{Arc, Mutex},
    time::Duration,
};

use aira_brain::{aira::Aira, llm::LlmEngine, stt::SttEngine, tts::TtsEngine};

enum InputMode {
    Voice,
    Text,
}

fn choose_mode() -> InputMode {
    println!("Choose input mode:");
    println!("1) Voice (microphone)");
    println!("2) Text  (CLI)");

    print!("> ");
    io::stdout().flush().unwrap();

    let mut input = String::new();
    io::stdin().read_line(&mut input).unwrap();

    match input.trim() {
        "1" => InputMode::Voice,
        "2" => InputMode::Text,
        _ => {
            println!("Invalid choice, defaulting to Text mode.");
            InputMode::Text
        }
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
        if event::poll(Duration::from_millis(10))? {
            if let Event::Key(k) = event::read()? {
                if k.code == KeyCode::Char(' ') && k.kind == KeyEventKind::Press {
                    break;
                }
            }
        }
    }
    Ok(())
}

fn wait_for_any_key() -> Result<()> {
    loop {
        if event::poll(Duration::from_millis(10))? {
            if let Event::Key(_) = event::read()? {
                break;
            }
        }
    }
    Ok(())
}

fn record_microphone() -> Result<Vec<f32>> {
    let host = cpal::default_host();
    let device = host.default_input_device().context("No microphone found")?;

    let config = device.default_input_config()?;
    let sample_rate = config.sample_rate().0;
    let config = config.config();

    println!("\nPress SPACE to start recording...");
    wait_for_space()?;
    println!("Recording... (press any key to stop)");

    let buffer: Arc<Mutex<Vec<f32>>> = Arc::new(Mutex::new(Vec::new()));
    let buffer_clone = buffer.clone();

    let stream = device.build_input_stream(
        &config,
        move |data: &[f32], _| {
            buffer_clone.lock().unwrap().extend_from_slice(data);
        },
        |err| eprintln!("Mic error: {}", err),
        None,
    )?;

    stream.play()?;
    wait_for_any_key()?;
    drop(stream);

    terminal::disable_raw_mode()?;

    let raw = buffer.lock().unwrap().clone();
    Ok(process_audio(&raw, sample_rate))
}

fn play_audio(samples: Vec<f32>) -> Result<()> {
    let (_stream, handle) = OutputStream::try_default()?;
    let sink = Sink::try_new(&handle)?;
    let buffer = SamplesBuffer::new(1, 22050, samples);
    sink.append(buffer);
    sink.sleep_until_end();
    Ok(())
}

fn text_loop(mut aira: Aira) -> Result<()> {
    println!("💬 Text mode. Type 'exit' to quit.\n");

    loop {
        print!("You: ");
        std::io::stdout().flush()?;

        let mut input = String::new();
        std::io::stdin().read_line(&mut input)?;

        let text = input.trim();
        if text.is_empty() {
            continue;
        }

        if text.eq_ignore_ascii_case("exit") || text.eq_ignore_ascii_case("quit") {
            println!("Goodbye 👋");
            break;
        }

        // think() will print "Aira: " and stream tokens in real-time
        let reply = aira.think(text)?;
        println!(); // Add newline after streaming

        let speech = aira.speak(&reply)?;
        play_audio(speech)?;
    }

    Ok(())
}

fn voice_loop(mut aira: aira_brain::aira::Aira) -> Result<()> {
    println!("🎤 Voice mode. Press SPACE to talk.\n");

    loop {
        terminal::enable_raw_mode()?;
        let audio = record_microphone()?;

        println!("Transcribing...");
        let text = aira.transcribe(&audio)?;

        if text.trim().is_empty() {
            println!("(No speech detected)\n");
            continue;
        }

        println!("You: {}", text);

        if text.to_lowercase().contains("exit") || text.to_lowercase().contains("quit") {
            println!("Goodbye 👋");
            break;
        }

        // think() will print "Aira: " and stream tokens in real-time
        let reply = aira.think(&text)?;
        println!(); // Add newline after streaming

        let speech = aira.speak(&reply)?;
        play_audio(speech)?;
    }

    Ok(())
}

fn main() -> Result<()> {
    println!("Loading Aira...");

    let stt = SttEngine::load("/home/ninegak/Project_Aira/aira/models/ggml-small.en-q5_1.bin")?;
    let llm = LlmEngine::load(
        "/home/ninegak/Project_Aira/aira/models/llama-3.2-3b-instruct-q4_k_m.gguf",
        "<|im_start|>system\nYou are Aira, a warm, empathetic AI assistant.<|im_end|>\n",
    )?;
    let tts = TtsEngine::load(
        "/home/ninegak/Project_Aira/aira/tts_models/en_US-hfc_female-medium.onnx.json",
    )?;

    let aira = Aira::new(stt, llm, tts);

    match choose_mode() {
        InputMode::Voice => voice_loop(aira)?,
        InputMode::Text => text_loop(aira)?,
    }

    Ok(())
}
