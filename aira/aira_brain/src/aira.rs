use crate::{llm::LlmEngine, stt::SttEngine, tts::TtsEngine};
use anyhow::Result;
use std::sync::{Arc, Mutex};

/// Emotional context for adaptive responses
#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize)]
pub struct EmotionalContext {
    /// Fatigue level (0.0 - 1.0)
    pub fatigue: f32,
    /// Engagement level (0.0 - 1.0)
    pub engagement: f32,
    /// Stress/tension level (0.0 - 1.0)
    pub stress: f32,
    /// Positive affect (0.0 - 1.0)
    pub positive_affect: f32,
    /// Timestamp of last update
    pub timestamp: u64,
}

pub struct Aira {
    stt: Arc<Mutex<SttEngine>>, // Wrap in Mutex for thread safety
    llm: LlmEngine,
    tts: TtsEngine,
    emotional_context: Arc<Mutex<Option<EmotionalContext>>>,
}

impl Aira {
    pub fn new(stt: SttEngine, llm: LlmEngine, tts: TtsEngine) -> Self {
        Self {
            stt: Arc::new(Mutex::new(stt)),
            llm,
            tts,
            emotional_context: Arc::new(Mutex::new(None)),
        }
    }

    pub fn transcribe(&self, audio: &[f32]) -> Result<String> {
        let stt = self
            .stt
            .lock()
            .map_err(|e| anyhow::anyhow!("STT lock poisoned: {}", e))?;
        stt.transcribe(audio)
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

    /// Update emotional context from camera features
    pub fn update_emotional_context(&self, context: EmotionalContext) {
        if let Ok(mut guard) = self.emotional_context.lock() {
            *guard = Some(context);
        }
    }

    /// Get current emotional context
    pub fn get_emotional_context(&self) -> Option<EmotionalContext> {
        self.emotional_context.lock().ok()?.clone()
    }
}
