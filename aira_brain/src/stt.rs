use anyhow::{Context, Result};
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

pub struct SttEngine {
    ctx: WhisperContext,
}

impl SttEngine {
    pub fn load(model_path: &str) -> Result<Self> {
        let ctx = WhisperContext::new_with_params(
            model_path,
            WhisperContextParameters::default(),
        )?;

        Ok(Self { ctx })
    }

    pub fn transcribe(&self, audio: &[f32]) -> Result<String> {
        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
        params.set_language(Some("en"));
        params.set_n_threads(4);

        let mut state = self
            .ctx
            .create_state()
            .context("failed to create whisper state")?;

        state.full(params, audio)?;

        let mut text = String::new();
        for seg in state.as_iter() {
            text.push_str(seg.to_str()?);
        }

        Ok(text.trim().to_string())
    }
}

