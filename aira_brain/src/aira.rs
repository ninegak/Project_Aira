use anyhow::Result;

use crate::{stt::SttEngine, llm::LlmEngine, tts::TtsEngine};

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

    pub fn think(&mut self, user_text: &str) -> Result<String> {
        self.llm.ask(user_text)
    }

    pub fn speak(&self, text: &str) -> Result<Vec<f32>> {
        self.tts.synthesize(text)
    }
}

