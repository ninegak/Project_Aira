use crate::{llm::LlmEngine, stt::SttEngine, tts::TtsEngine};
use anyhow::Result;

pub struct Aira {
    stt: SttEngine,
    llm: LlmEngine,
    tts: TtsEngine,
}

impl Aira {
    pub fn new(stt: SttEngine, llm: LlmEngine, tts: TtsEngine) -> Self {
        Self { stt, llm, tts }
    }

    pub fn transcribe(&self, audio: &[f32]) -> Result<String> {
        self.stt.transcribe(audio)
    }

    pub fn think<F>(&mut self, user_text: &str, callback: F) -> Result<f64>
    where
        F: FnMut(&str) -> Result<()>,
    {
        self.llm.ask(user_text, callback)
    }

    pub fn speak(&self, text: &str) -> Result<Vec<f32>> {
        self.tts.synthesize(text)
    }

    /// Get a clone of the TTS engine for concurrent synthesis
    pub fn get_tts(&self) -> TtsEngine {
        self.tts.clone()
    }
}
