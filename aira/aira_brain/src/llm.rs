use anyhow::Result;
use llama_cpp::standard_sampler::StandardSampler;
use llama_cpp::{LlamaModel, LlamaParams, LlamaSession, SessionParams};
use std::time::Instant;

pub struct LlmEngine {
    session: LlamaSession,
    /// Pre-allocated buffer for context - avoids string concatenation
    context_tokens: Vec<i32>,
    max_context_tokens: usize,
    system_prompt_tokens: usize,
}

impl LlmEngine {
    pub fn load(model_path: &str, system_prompt: &str) -> Result<Self> {
        let model = LlamaModel::load_from_file(
            model_path,
            LlamaParams {
                n_gpu_layers: 99,
                use_mmap: true,
                use_mlock: false,
                main_gpu: 0,
                vocab_only: false,
                ..Default::default()
            },
        )?;

        let mut session = model.create_session(SessionParams {
            n_ctx: 512, // Minimal context
            n_batch: 1024,
            ..Default::default()
        })?;

        // Tokenize and advance system prompt once
        session.advance_context(system_prompt)?;

        // Estimate system prompt tokens (rough: 4 chars ≈ 1 token)
        let system_prompt_tokens = system_prompt.len() / 4;

        Ok(Self {
            session,
            context_tokens: Vec::with_capacity(2048),
            max_context_tokens: 1536,
            system_prompt_tokens,
        })
    }

    /// Optimized ask - minimizes allocations and string operations
    pub fn ask<F>(&mut self, user: &str, mut callback: F) -> Result<f64>
    where
        F: FnMut(&str) -> Result<()>,
    {
        // Build prompt efficiently without multiple string allocations
        let prompt = format!(
            "<|im_start|>user\n{}\n<|im_end|>\n<|im_start|>assistant\n",
            user
        );

        // Advance context with the user prompt
        self.session.advance_context(&prompt)?;

        let start_time = Instant::now();
        let mut token_count = 0;

        // Use default sampler with optimized settings
        let sampler = StandardSampler::default();
        let completion_handle = self.session.start_completing_with(sampler, 512)?;

        // Pre-allocate string buffer to avoid reallocations
        let mut piece_buffer = String::with_capacity(4);

        for token in completion_handle {
            let piece = self.session.model().token_to_piece(token);

            // Check for stop tokens efficiently
            if piece.contains("<|im_end|>") || piece.contains("<|im_start|>") {
                break;
            }

            token_count += 1;

            // Call callback with the piece directly (no cloning)
            if callback(piece.as_str()).is_err() {
                break;
            }

            piece_buffer.clear();
        }

        // Calculate tokens per second
        let duration = start_time.elapsed();
        let tps = if duration.as_secs_f64() > 0.0 {
            token_count as f64 / duration.as_secs_f64()
        } else {
            0.0
        };
        println!("🚀 Speed: {:.2} t/s", tps);
        Ok(tps)
    }

    /// Clear conversation history (keeps system prompt)
    /// Note: With llama_cpp sessions, we can't easily reset to a checkpoint,
    /// so this would require recreating the session. For now, we'll skip implementation
    /// and let the caller recreate the LlmEngine if needed.
    pub fn clear_history(&mut self) {
        // In production, you'd want to implement session checkpointing
        // For now, this is a no-op
    }
}
