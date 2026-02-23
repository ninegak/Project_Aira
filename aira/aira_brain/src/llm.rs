use anyhow::Result;
use llama_cpp::standard_sampler::StandardSampler;
use llama_cpp::{LlamaModel, LlamaParams, LlamaSession, SessionParams};
use std::time::Instant;

// Represents a single conversation turn
#[derive(Clone, Debug)]
struct ConversationTurn {
    role: Role,
    content: String,
    token_count: usize,
}

#[derive(Clone, Debug, PartialEq)]
enum Role {
    System,
    User,
    Assistant,
}

impl Role {
    fn to_str(&self) -> &'static str {
        match self {
            Role::System => "system",
            Role::User => "user",
            Role::Assistant => "assistant",
        }
    }
}

pub struct LlmEngine {
    model: LlamaModel,
    session: LlamaSession,
    // Conversation history with token counts
    history: Vec<ConversationTurn>,
    // Maximum context tokens (reserve space for response)
    max_context_tokens: usize,
    // System prompt that's always present
    system_prompt: String,
    // Base system prompt token count
    system_prompt_tokens: usize,
    // Current emotional context (injected into system prompt)
    emotional_context: Option<String>,
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

        let session = model.create_session(SessionParams {
            n_ctx: 2048, // Increased from 512 for conversation history
            n_batch: 1024,
            ..Default::default()
        })?;

        // Estimate system prompt tokens (rough: 4 chars ≈ 1 token)
        let system_prompt_tokens = system_prompt.len() / 4;

        Ok(Self {
            model,
            session,
            history: Vec::new(),
            max_context_tokens: 1536, // Reserve 512 tokens for response
            system_prompt: system_prompt.to_string(),
            system_prompt_tokens,
            emotional_context: None,
        })
    }

    // Update emotional context that will be injected into system prompt
    pub fn update_emotional_context(&mut self, context: &str) {
        self.emotional_context = Some(context.to_string());
    }

    // Clear emotional context
    pub fn clear_emotional_context(&mut self) {
        self.emotional_context = None;
    }

    // Build the full system prompt with optional emotional context
    fn build_system_prompt(&self) -> String {
        if let Some(emotion_ctx) = &self.emotional_context {
            format!(
                "{}\n\n[User's Current State]\n{}",
                self.system_prompt, emotion_ctx
            )
        } else {
            self.system_prompt.clone()
        }
    }

    // Estimate token count for a string (rough approximation)
    fn estimate_tokens(&self, text: &str) -> usize {
        // More accurate: 4 chars per token average for English
        // Add buffer for formatting tokens
        (text.len() / 4) + 10
    }

    // Calculate total tokens used by conversation history
    fn total_history_tokens(&self) -> usize {
        self.history.iter().map(|turn| turn.token_count).sum()
    }

    // Prune old messages to fit within context window using sliding window
    // Keeps system prompt + most recent messages that fit
    fn prune_history_to_fit(&mut self, new_message_tokens: usize) {
        let system_tokens = self.system_prompt_tokens
            + self
                .emotional_context
                .as_ref()
                .map(|c| self.estimate_tokens(c))
                .unwrap_or(0);

        let available_tokens = self
            .max_context_tokens
            .saturating_sub(system_tokens)
            .saturating_sub(new_message_tokens)
            .saturating_sub(50); // Safety buffer

        let mut current_tokens = 0;
        let mut keep_from_index = self.history.len();

        // Work backwards from most recent messages
        for (i, turn) in self.history.iter().enumerate().rev() {
            if current_tokens + turn.token_count > available_tokens {
                keep_from_index = i + 1;
                break;
            }
            current_tokens += turn.token_count;
        }

        // Keep only messages that fit
        if keep_from_index > 0 {
            println!(
                "🗑️  Pruned {} old messages to maintain context window",
                keep_from_index
            );
            self.history.drain(0..keep_from_index);
        }
    }

    // Build the complete prompt from history
    fn build_prompt_from_history(&self, new_user_message: &str) -> String {
        let mut prompt = String::with_capacity(2048);

        // Start with system prompt
        let system_prompt = self.build_system_prompt();
        prompt.push_str(&format!(
            "<|im_start|>{}\n{}\n<|im_end|>\n",
            Role::System.to_str(),
            system_prompt
        ));

        // Add conversation history
        for turn in &self.history {
            prompt.push_str(&format!(
                "<|im_start|>{}\n{}\n<|im_end|>\n",
                turn.role.to_str(),
                turn.content
            ));
        }

        // Add new user message
        prompt.push_str(&format!(
            "<|im_start|>{}\n{}\n<|im_end|>\n<|im_start|>{}\n",
            Role::User.to_str(),
            new_user_message,
            Role::Assistant.to_str()
        ));

        prompt
    }

    // Optimized ask with conversation history and emotional context
    pub fn ask<F>(&mut self, user: &str, mut callback: F) -> Result<f64>
    where
        F: FnMut(&str) -> Result<()>,
    {
        // Estimate tokens for new user message
        let user_message_tokens = self.estimate_tokens(user);

        // Prune history if needed to fit new message
        self.prune_history_to_fit(user_message_tokens);

        // Build complete prompt with history
        let prompt = self.build_prompt_from_history(user);

        // Clear current session and advance with complete prompt
        // Note: In production, you'd want to use session forking/checkpointing
        // For now, we rebuild the context each time
        self.session = self.model.create_session(SessionParams {
            n_ctx: 2048,
            n_batch: 1024,
            ..Default::default()
        })?;

        self.session.advance_context(&prompt)?;

        println!(
            "💬 Context: {} history turns, ~{} tokens",
            self.history.len(),
            self.total_history_tokens() + self.system_prompt_tokens + user_message_tokens
        );

        let start_time = Instant::now();
        let mut token_count = 0;
        let mut assistant_response = String::with_capacity(512);

        // Use default sampler with optimized settings
        let sampler = StandardSampler::default();
        let completion_handle = self.session.start_completing_with(sampler, 512)?;

        for token in completion_handle {
            let piece = self.session.model().token_to_piece(token);

            // Check for stop tokens efficiently
            if piece.contains("<|im_end|>") || piece.contains("<|im_start|>") {
                break;
            }

            token_count += 1;
            assistant_response.push_str(&piece);

            // Call callback with the piece directly (no cloning)
            if callback(piece.as_str()).is_err() {
                break;
            }
        }

        // Calculate tokens per second
        let duration = start_time.elapsed();
        let tps = if duration.as_secs_f64() > 0.0 {
            token_count as f64 / duration.as_secs_f64()
        } else {
            0.0
        };

        println!("🚀 Speed: {:.2} t/s", tps);

        // Add both user message and assistant response to history
        self.history.push(ConversationTurn {
            role: Role::User,
            content: user.to_string(),
            token_count: user_message_tokens,
        });

        let assistant_tokens = self.estimate_tokens(&assistant_response);
        self.history.push(ConversationTurn {
            role: Role::Assistant,
            content: assistant_response,
            token_count: assistant_tokens,
        });

        Ok(tps)
    }

    // Clear conversation history (keeps system prompt)
    pub fn clear_history(&mut self) {
        self.history.clear();
        println!("🔄 Conversation history cleared");
    }

    // Get conversation history length
    pub fn history_length(&self) -> usize {
        self.history.len()
    }

    // Get total tokens in history
    pub fn history_tokens(&self) -> usize {
        self.total_history_tokens()
    }
}

// Example of how to inject emotional context
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_emotional_context_injection() {
        let system_prompt = "You are Aira, a warm, empathetic AI assistant.";

        // Simulate building system prompt with emotional context
        let mut engine_prompt = system_prompt.to_string();
        let emotional_context = "The user appears fatigued (70%) with low engagement (30%). They may need encouragement or a break suggestion.";

        engine_prompt.push_str(&format!(
            "\n\n[User's Current State]\n{}",
            emotional_context
        ));

        assert!(engine_prompt.contains("fatigued"));
        assert!(engine_prompt.contains("User's Current State"));
    }

    #[test]
    fn test_token_estimation() {
        let text = "Hello, how are you today?";
        let estimated = (text.len() / 4) + 10;
        assert!(estimated > 0);
        assert!(estimated < 20); // Should be around 16
    }
}
