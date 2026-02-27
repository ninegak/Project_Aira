use crate::{llm::LlmEngine, stt::SttEngine, tts::TtsEngine};
use anyhow::Result;
use std::sync::{Arc, Mutex};

// Emotional context for adaptive responses
#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize)]
pub struct EmotionalContext {
    // Fatigue level (0.0 - 1.0)
    pub fatigue: f32,
    // Engagement level (0.0 - 1.0)
    pub engagement: f32,
    // Stress/tension level (0.0 - 1.0)
    pub stress: f32,
    // Positive affect (0.0 - 1.0)
    pub positive_affect: f32,
    // Timestamp of last update
    pub timestamp: u64,
}

impl EmotionalContext {
    // Convert emotional context to human-readable format for LLM injection
    pub fn to_llm_context(&self) -> String {
        let dominant_emotion = self.get_dominant_emotion();
        let recommendations = self.get_recommendations();

        format!(
            "The user appears {} ({:.0}% confidence).\n\
            Emotional metrics:\n\
            - Fatigue: {:.0}%\n\
            - Engagement: {:.0}%\n\
            - Stress: {:.0}%\n\
            - Positive affect: {:.0}%\n\n\
            Recommended approach: {}",
            dominant_emotion,
            self.get_confidence() * 100.0,
            self.fatigue * 100.0,
            self.engagement * 100.0,
            self.stress * 100.0,
            self.positive_affect * 100.0,
            recommendations
        )
    }

    // Get dominant emotion as a string
    fn get_dominant_emotion(&self) -> &'static str {
        if self.fatigue > 0.7 {
            "fatigued and low-energy"
        } else if self.stress > 0.6 {
            "stressed or tense"
        } else if self.positive_affect > 0.6 {
            "happy and positive"
        } else if self.engagement > 0.7 {
            "focused and engaged"
        } else if self.engagement < 0.3 {
            "disengaged or distracted"
        } else {
            "neutral"
        }
    }

    // Get confidence level of emotional detection
    fn get_confidence(&self) -> f32 {
        // Higher variance in metrics = lower confidence
        let values = [
            self.fatigue,
            self.engagement,
            self.stress,
            self.positive_affect,
        ];
        let mean = values.iter().sum::<f32>() / values.len() as f32;
        let variance = values.iter().map(|v| (v - mean).powi(2)).sum::<f32>() / values.len() as f32;

        // Lower variance = higher confidence
        (1.0 - variance).clamp(0.5, 1.0)
    }

    // Get recommendations for interaction style
    fn get_recommendations(&self) -> &'static str {
        if self.fatigue > 0.7 {
            "Be supportive and gentle. Suggest taking a break if appropriate. Keep responses concise."
        } else if self.stress > 0.6 {
            "Be calming and reassuring. Break complex topics into manageable pieces. Offer practical help."
        } else if self.engagement < 0.3 {
            "Be engaging and interesting. Use questions to draw them in. Add relevant examples or stories."
        } else if self.positive_affect > 0.6 {
            "Match their energy! Be warm and enthusiastic. Build on their positive momentum."
        } else {
            "Maintain a balanced, helpful tone. Adapt based on conversation flow."
        }
    }
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
        // Inject emotional context into LLM before generating response
        if let Ok(guard) = self.emotional_context.lock() {
            if let Some(context) = guard.as_ref() {
                let llm_context = context.to_llm_context();
                self.llm.update_emotional_context(&llm_context);
                println!("🎭 Injected emotional context into LLM");
            } else {
                self.llm.clear_emotional_context();
            }
        }

        self.llm.ask(user_text, callback)
    }

    pub fn speak(&self, text: &str) -> Result<Vec<f32>> {
        self.tts.synthesize(text)
    }

    // Get a clone of the TTS engine for concurrent synthesis
    pub fn get_tts(&self) -> TtsEngine {
        self.tts.clone()
    }

    // Update emotional context from camera features
    pub fn update_emotional_context(&self, context: EmotionalContext) {
        if let Ok(mut guard) = self.emotional_context.lock() {
            *guard = Some(context);
        }
    }

    // Get current emotional context
    pub fn get_emotional_context(&self) -> Option<EmotionalContext> {
        self.emotional_context.lock().ok()?.clone()
    }

    // Clear conversation history (useful when starting new conversation)
    pub fn clear_history(&mut self) {
        self.llm.clear_history();
    }

    // Get conversation statistics
    pub fn get_conversation_stats(&self) -> (usize, usize) {
        (self.llm.history_length(), self.llm.history_tokens())
    }
}
