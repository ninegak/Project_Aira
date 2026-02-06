use anyhow::Result;
use llama_cpp::standard_sampler::StandardSampler;
use llama_cpp::{LlamaModel, LlamaParams, LlamaSession, SessionParams};
use std::time::Instant;

pub struct LlmEngine {
    session: LlamaSession,
    history: Vec<String>,
    max_context_tokens: usize,
    system_prompt: String,
}

impl LlmEngine {
    pub fn load(model_path: &str, system_prompt: &str) -> Result<Self> {
        let model = LlamaModel::load_from_file(
            model_path,
            LlamaParams {
                n_gpu_layers: 24, // Adjust for your Q4_0 model on RTX 3050
                use_mmap: true,   // Memory-map model file (saves RAM)
                use_mlock: false, // Don't lock pages in memory (saves memory)
                main_gpu: 0,      // Use RTX 3050 (first CUDA device)
                vocab_only: false,
                ..Default::default()
            },
        )?;

        // Create session with optimized parameters for 4GB VRAM
        let mut session = model.create_session(SessionParams {
            n_ctx: 2048,  // Reduced context window for 4GB VRAM
            n_batch: 128, // Batch size for prompt processing
            ..Default::default()
        })?;

        session.advance_context(system_prompt)?;

        Ok(Self {
            session,
            history: vec![system_prompt.to_string()],
            max_context_tokens: 1536, // Leave ~512 tokens for generation
            system_prompt: system_prompt.to_string(),
        })
    }

    pub fn ask<F: FnMut(String) -> anyhow::Result<()>>(
        &mut self,
        user: &str,
        mut callback: F,
    ) -> Result<f64> {
        // Add user message to history
        self.history
            .push(format!("<|im_start|>user\n{}\n<|im_end|>", user));

        // Build prompt from history
        let mut prompt = self.history.join("\n");

        // Estimate tokens (rough: 4 chars ≈ 1 token)
        while (prompt.len() / 4) > self.max_context_tokens && self.history.len() > 2 {
            // Remove oldest message (keep system prompt at index 0)
            self.history.remove(1);
            prompt = self.history.join("\n");
        }

        // Add assistant prefix
        prompt.push_str("\n<|im_start|>assistant\n");

        // Advance context
        self.session.advance_context(&prompt)?;

        // Start token generation
        let start_time = Instant::now();
        let mut token_count = 0;
        let mut assistant_response = String::new();

        // Use default sampler (llama_cpp 0.3.2 doesn't expose sampler parameters directly)
        let sampler = StandardSampler::default();

        let completion_handle = self.session.start_completing_with(sampler, 256)?; // Max tokens to generate

        for t in completion_handle {
            let token_str = self.session.model().token_to_piece(t);

            // Stop on special tokens
            if token_str.contains("<|im_end|>") || token_str.contains("<|im_start|>") {
                break;
            }

            token_count += 1;
            assistant_response.push_str(&token_str);

            if callback(token_str).is_err() {
                break;
            }
        }

        // Add complete assistant response to history
        if !assistant_response.is_empty() {
            self.history.push(format!(
                "<|im_start|>assistant\n{}\n<|im_end|>",
                assistant_response
            ));
        }

        // Calculate tokens per second
        let duration = start_time.elapsed();
        let tps = if duration.as_secs_f64() > 0.0 {
            token_count as f64 / duration.as_secs_f64()
        } else {
            0.0
        };

        Ok(tps)
    }

    /// Clear conversation history (keeps system prompt)
    pub fn clear_history(&mut self) {
        self.history.clear();
        self.history.push(self.system_prompt.clone());
    }

    /// Get current conversation history
    pub fn get_history(&self) -> &[String] {
        &self.history
    }
}
