use anyhow::Result;
use piper_rs::{self, synth::PiperSpeechSynthesizer};
use std::path::Path;
use std::sync::Arc;

// Thread-safe TTS engine using Arc for shared ownership
#[derive(Clone)]
pub struct TtsEngine {
    tts: Arc<PiperSpeechSynthesizer>,
}

impl TtsEngine {
    pub fn load(config_path: &str) -> Result<Self> {
        let model = piper_rs::from_config_path(Path::new(config_path))?;
        let tts = PiperSpeechSynthesizer::new(model)?;
        Ok(Self { tts: Arc::new(tts) })
    }

    // Synthesize text to audio samples
    // Returns f32 samples at 22050 Hz
    pub fn synthesize(&self, text: &str) -> Result<Vec<f32>> {
        let chunks = self.tts.synthesize_parallel(text.to_string(), None)?;
        let mut samples = Vec::new();

        for chunk in chunks {
            samples.extend(chunk?);
        }

        Ok(samples)
    }
}

