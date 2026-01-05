use anyhow::Result;
use llama_cpp::standard_sampler::StandardSampler;
use llama_cpp::{LlamaModel, LlamaParams, LlamaSession, SessionParams};
use std::time::Instant;

pub struct LlmEngine {
    session: LlamaSession,
}

impl LlmEngine {
    pub fn load(model_path: &str, system_prompt: &str) -> Result<Self> {
        let model = LlamaModel::load_from_file(
            model_path,
            LlamaParams {
                n_gpu_layers: 32,
                ..Default::default()
            },
        )?;

        let mut session = model.create_session(SessionParams::default())?;
        session.advance_context(system_prompt)?;

        Ok(Self { session })
    }

    pub fn ask<F: FnMut(String) -> anyhow::Result<()>>(&mut self, user: &str, mut callback: F) -> Result<f64> {
        let prompt = format!(
            "<|im_start|>user\n{}<|im_end|>\n<|im_start|>assistant\n",
            user
        );

        self.session.advance_context(&prompt)?;

        let start_time = Instant::now();
        let mut token_count = 0;
        let completion_handle = self
            .session
            .start_completing_with(StandardSampler::default(), 130)?;

        for t in completion_handle {
            let token_str = self.session.model().token_to_piece(t);
            if token_str.contains("<|im_end|>") || token_str.contains("<|im_start|>") {
                break;
            }
            token_count += 1;
            if callback(token_str).is_err() {
                break;
            }
        }

        let duration = start_time.elapsed();
        let mut tps = 0.0;
        if duration.as_secs_f64() > 0.0 {
            tps = token_count as f64 / duration.as_secs_f64();
        }

        Ok(tps)
    }
}
