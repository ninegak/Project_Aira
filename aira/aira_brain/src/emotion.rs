use anyhow::Result;
use tract_onnx::prelude::*;

// Represents the possible emotions that can be detected.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Emotion {
    Neutral,
    Happy,
    Sad,
    Angry,
    Fear,
    Disgust,
    Surprise,
}

impl Emotion {
    fn from_index(index: usize) -> Option<Self> {
        match index {
            0 => Some(Emotion::Angry),
            1 => Some(Emotion::Disgust),
            2 => Some(Emotion::Fear),
            3 => Some(Emotion::Happy),
            4 => Some(Emotion::Neutral),
            5 => Some(Emotion::Sad),
            6 => Some(Emotion::Surprise),
            _ => None,
        }
    }
}

// The output of the emotion analysis.
#[derive(Debug, Clone)]
pub struct EmotionAnalysis {
    pub dominant_emotion: Emotion,
    // A score from 0.0 to 1.0 indicating the confidence of the detection.
    pub score: f32,
}

type EmotionModel = SimplePlan<TypedFact, Box<dyn TypedOp>, Graph<TypedFact, Box<dyn TypedOp>>>;

pub struct EmotionEngine {
    model: EmotionModel,
}

impl EmotionEngine {
    pub fn new() -> Result<Self> {
        let model_path = "models/emotion/model.onnx";
        let model = tract_onnx::onnx()
            .model_for_path(model_path)?
            .into_optimized()?
            .into_runnable()?;
        Ok(Self { model })
    }

    // This function will take audio or video data as input.
    // For now, let's assume it takes a similar input to the stt engine, raw audio.
    // We can add a video variant later.
    pub fn analyze_audio(&self, audio: &[f32]) -> Result<EmotionAnalysis> {
        // The model expects a 1D tensor of f32 values.
        let input: Tensor = tract_ndarray::Array1::from(audio.to_vec()).into();

        // Run the model
        let result = self.model.run(tvec!(input.into()))?;

        // Find the emotion with the highest score
        let logits = result[0].to_array_view::<f32>()?;
        let (dominant_emotion_idx, max_logit) = logits
            .iter()
            .enumerate()
            .max_by(|a, b| a.1.partial_cmp(b.1).unwrap())
            .unwrap_or((0, &0.0));

        let dominant_emotion =
            Emotion::from_index(dominant_emotion_idx).unwrap_or(Emotion::Neutral);

        Ok(EmotionAnalysis {
            dominant_emotion,
            score: *max_logit,
        })
    }
}
