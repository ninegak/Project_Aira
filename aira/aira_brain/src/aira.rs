use anyhow::Result;

use crate::{
    emotion::{EmotionAnalysis, EmotionEngine},
    llm::LlmEngine,
    stt::SttEngine,
    tts::TtsEngine,
};

pub struct Aira {
    stt: SttEngine,
    llm: LlmEngine,
    tts: TtsEngine,
    emotion: EmotionEngine,
}

impl Aira {
    pub fn new(stt: SttEngine, llm: LlmEngine, tts: TtsEngine, emotion: EmotionEngine) -> Self {
        Self {
            stt,
            llm,
            tts,
            emotion,
        }
    }

    pub fn transcribe(&self, audio: &[f32]) -> Result<String> {
        self.stt.transcribe(audio)
    }

    pub fn analyze_emotion_from_audio(&self, audio: &[f32]) -> Result<EmotionAnalysis> {
        self.emotion.analyze_audio(audio)
    }

    pub fn think<F: FnMut(String) -> anyhow::Result<()>>(
        &mut self,
        user_text: &str,
        callback: F,
    ) -> Result<f64> {
        self.llm.ask(user_text, callback)
    }

    pub fn speak(&self, text: &str) -> Result<Vec<f32>> {
        self.tts.synthesize(text)
    }

    pub fn smil() {}
}