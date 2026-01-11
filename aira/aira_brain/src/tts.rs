use anyhow::Result;
use piper_rs::{self, synth::PiperSpeechSynthesizer};
use std::path::Path;

pub struct TtsEngine {
    tts: PiperSpeechSynthesizer,
}

impl TtsEngine {
    pub fn load(config_path: &str) -> Result<Self> {
        let model = piper_rs::from_config_path(Path::new(config_path))?;
        let tts = PiperSpeechSynthesizer::new(model)?;
        Ok(Self { tts })
    }

    pub fn synthesize(&self, text: &str) -> Result<Vec<f32>> {
        let chunks = self.tts.synthesize_parallel(text.to_string(), None)?;
        let mut samples = Vec::new();

        for c in chunks {
            samples.extend(c?);
        }

        Ok(samples)
    }
}