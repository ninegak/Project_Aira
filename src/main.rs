use llama_cpp::{
    LlamaModel, LlamaParams, SessionParams, standard_sampler::StandardSampler
};
use piper_rs::synth::PiperSpeechSynthesizer;
use rodio::buffer::SamplesBuffer;
use std::path::Path;
use std::io::{self, Write};

/// Speak text with Piper TTS
fn speak(text: &str) {
    let config_path = "tts_models/en_US-hfc_female-medium.onnx.json";
    let model = piper_rs::from_config_path(Path::new(config_path))
        .expect("Failed to load Piper model");
    let synth = PiperSpeechSynthesizer::new(model).unwrap();

    let mut samples: Vec<f32> = Vec::new();
    let audio = synth.synthesize_parallel(text.to_string(), None).unwrap();
    for result in audio {
        samples.append(&mut result.unwrap().into_vec());
    }

    let (_stream, handle) = rodio::OutputStream::try_default().unwrap();
    let sink = rodio::Sink::try_new(&handle).unwrap();
    let buf = SamplesBuffer::new(1, 22050, samples);
    sink.append(buf);
    sink.sleep_until_end();
}

fn main() -> anyhow::Result<()> {
    let model = LlamaModel::load_from_file(
        "models/qwen2.5-7b-instruct-q4_k_m.gguf",
            LlamaParams {
                n_gpu_layers: 20,
                ..Default::default()
            },
    )?;

    let mut ctx = model.create_session(SessionParams::default())?;

    // System prompt to guide conversation style
    let system_prompt = "Your name is Aira, You are a friendly, chatty AI assistant. Respond naturally and concisely.";
    ctx.advance_context(system_prompt)?;

    let mut history = String::new();

    loop {
        print!("You: ");
        io::stdout().flush()?;

        let mut user_input = String::new();
        io::stdin().read_line(&mut user_input)?;
        let user_input = user_input.trim();

        if user_input.is_empty() {
            continue;
        }
        if user_input.eq_ignore_ascii_case("exit") {
            break;
        }

        let prompt = format!("Human: {}\nAssistant:", user_input);
        ctx.advance_context(&prompt)?;

        // Generate response
        let max_tokens = 64;
        let completions = ctx
            .start_completing_with(StandardSampler::default(), max_tokens)?
            .into_strings();

        let reply: String = completions.collect::<Vec<_>>().concat();
        println!("Assistant: {}", reply);

        speak(&reply);

        // Save history for reference (not fed back again)
        history.push_str(&format!("Human: {}\nAssistant: {}\n", user_input, reply));
    }

    Ok(())
}

