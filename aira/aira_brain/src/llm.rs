use anyhow::Result;
use llama_cpp::{LlamaModel, LlamaParams, LlamaSession, SessionParams};
use llama_cpp::standard_sampler::StandardSampler;

pub struct LlmEngine {
    session: LlamaSession,
}

impl LlmEngine {
    pub fn load(model_path: &str, system_prompt: &str) -> Result<Self> {
        let model = LlamaModel::load_from_file(
            model_path,
            LlamaParams {
                n_gpu_layers: 20,
                ..Default::default()
            },
        )?;

        let mut session = model.create_session(SessionParams::default())?;
        session.advance_context(system_prompt)?;

        Ok(Self { session })
    }

    pub fn ask(&mut self, user: &str) -> Result<String> {
        let prompt = format!(
            "<|im_start|>user\n{}<|im_end|>\n<|im_start|>assistant\n",
            user
        );

        self.session.advance_context(&prompt)?;

        let mut out = String::new();
        let tokens = self
            .session
            .start_completing_with(StandardSampler::default(), 150)?
            .into_strings();

        for t in tokens {
            if t.contains("<|im_end|>") || t.contains("<|im_start|>") {
                break;
            }
            out.push_str(&t);
        }

        Ok(out.trim().to_string())
    }
}

