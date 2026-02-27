use crate::models::CameraFeatures;
use crate::states::SharedAira;
use aira_brain::aira::EmotionalContext;
use axum::{Json, extract::State};
use serde::Serialize;
use std::sync::{Arc, Mutex};
use tokio::sync::Semaphore;

// Smoothed emotional state tracker with temporal filtering
struct EmotionalStateTracker {
    // Current smoothed state
    current: EmotionalContext,
    // Previous raw state for change detection
    previous_raw: Option<EmotionalContext>,
    // EMA alpha parameter (0.0-1.0, higher = more responsive)
    alpha: f32,
    // Minimum change threshold to trigger update (prevents jitter)
    change_threshold: f32,
    // State machine for emotion transitions
    state_machine: EmotionStateMachine,
}

// Emotion state machine for smooth transitions
#[derive(Debug, Clone, Copy, PartialEq)]
enum EmotionState {
    Neutral,
    Engaged,
    Fatigued,
    Stressed,
    Happy,
    Disengaged,
}

struct EmotionStateMachine {
    current_state: EmotionState,
    state_duration: u64,  // How long in current state (seconds)
    last_transition: u64, // Timestamp of last state change
    // Minimum duration before allowing state change (prevents rapid flickering)
    min_state_duration: u64,
}

impl EmotionStateMachine {
    fn new() -> Self {
        Self {
            current_state: EmotionState::Neutral,
            state_duration: 0,
            last_transition: 0,
            min_state_duration: 3, // Require 3 seconds before state change
        }
    }

    // Update state based on emotional metrics with hysteresis
    fn update(&mut self, context: &EmotionalContext) -> EmotionState {
        let now = context.timestamp;
        self.state_duration = now.saturating_sub(self.last_transition);

        let new_state = self.determine_state(context);

        // Only transition if enough time has passed OR if signal is very strong
        let should_transition = if new_state != self.current_state {
            let signal_strength = self.get_signal_strength(context, new_state);

            // Allow immediate transition if signal is very strong (>0.85)
            if signal_strength > 0.85 {
                true
            } else {
                // Otherwise require minimum duration
                self.state_duration >= self.min_state_duration
            }
        } else {
            false
        };

        if should_transition {
            println!(
                "🔄 Emotion transition: {:?} → {:?} (after {}s)",
                self.current_state, new_state, self.state_duration
            );
            self.current_state = new_state;
            self.last_transition = now;
            self.state_duration = 0;
        }

        self.current_state
    }

    // Determine target state from emotional context
    fn determine_state(&self, context: &EmotionalContext) -> EmotionState {
        // Priority order with hysteresis thresholds
        if context.fatigue > 0.7 {
            EmotionState::Fatigued
        } else if context.stress > 0.6 {
            EmotionState::Stressed
        } else if context.positive_affect > 0.6 {
            EmotionState::Happy
        } else if context.engagement > 0.7 {
            EmotionState::Engaged
        } else if context.engagement < 0.3 {
            EmotionState::Disengaged
        } else {
            EmotionState::Neutral
        }
    }

    // Calculate signal strength for a given state
    fn get_signal_strength(&self, context: &EmotionalContext, state: EmotionState) -> f32 {
        match state {
            EmotionState::Fatigued => context.fatigue,
            EmotionState::Stressed => context.stress,
            EmotionState::Happy => context.positive_affect,
            EmotionState::Engaged => context.engagement,
            EmotionState::Disengaged => 1.0 - context.engagement,
            EmotionState::Neutral => 0.5,
        }
    }
}

impl EmotionalStateTracker {
    fn new() -> Self {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        Self {
            current: EmotionalContext {
                fatigue: 0.5,
                engagement: 0.5,
                stress: 0.5,
                positive_affect: 0.5,
                timestamp: now,
            },
            previous_raw: None,
            alpha: 0.3,             // 30% new data, 70% old data (smooth)
            change_threshold: 0.05, // 5% change required
            state_machine: EmotionStateMachine::new(),
        }
    }

    // Apply exponential moving average to smooth values
    fn apply_ema(&mut self, new_state: EmotionalContext) -> EmotionalContext {
        let alpha = self.alpha;
        let one_minus_alpha = 1.0 - alpha;

        EmotionalContext {
            fatigue: alpha * new_state.fatigue + one_minus_alpha * self.current.fatigue,
            engagement: alpha * new_state.engagement + one_minus_alpha * self.current.engagement,
            stress: alpha * new_state.stress + one_minus_alpha * self.current.stress,
            positive_affect: alpha * new_state.positive_affect
                + one_minus_alpha * self.current.positive_affect,
            timestamp: new_state.timestamp,
        }
    }

    // Check if change is significant enough to warrant update
    fn has_significant_change(&self, new_state: &EmotionalContext) -> bool {
        let diff = |a: f32, b: f32| (a - b).abs();

        diff(new_state.fatigue, self.current.fatigue) > self.change_threshold
            || diff(new_state.engagement, self.current.engagement) > self.change_threshold
            || diff(new_state.stress, self.current.stress) > self.change_threshold
            || diff(new_state.positive_affect, self.current.positive_affect) > self.change_threshold
    }

    // Update with new emotional context, applying smoothing
    fn update(&mut self, raw_state: EmotionalContext) -> Option<EmotionalContext> {
        // Apply EMA smoothing
        let smoothed = self.apply_ema(raw_state);

        // Update state machine
        let _emotion_state = self.state_machine.update(&smoothed);

        // Check if change is significant
        if self.has_significant_change(&smoothed) {
            self.current = smoothed;
            self.previous_raw = Some(raw_state);
            Some(smoothed)
        } else {
            // No significant change, return None to skip update
            None
        }
    }

    fn get_current(&self) -> EmotionalContext {
        self.current
    }
}

// Global state tracker (one per application instance)
lazy_static::lazy_static! {
    static ref STATE_TRACKER: Arc<Mutex<EmotionalStateTracker>> =
        Arc::new(Mutex::new(EmotionalStateTracker::new()));
}

// Process camera features and return emotional state with rate limiting
pub async fn process_camera_features(
    State((aira_state, _semaphore)): State<(SharedAira, &'static Semaphore)>,
    Json(features): Json<CameraFeatures>,
) -> Json<EmotionalContext> {
    // Calculate raw emotional state from camera features
    let raw_state = calculate_emotional_state(&features);

    // Apply temporal smoothing and change detection
    let smoothed_state = {
        let mut tracker = STATE_TRACKER.lock().unwrap();
        tracker.update(raw_state)
    };

    // Only update Aira and log if there's a significant change
    let final_state = if let Some(smoothed) = smoothed_state {
        // Log real-time emotion data
        log_emotional_state(&features, &smoothed);

        // Update Aira's state with the smoothed emotional context
        {
            let guard = aira_state.lock().unwrap();
            guard.update_emotional_context(smoothed);
        }

        smoothed
    } else {
        // No significant change, return current smoothed state without logging
        STATE_TRACKER.lock().unwrap().get_current()
    };

    Json(final_state)
}

// Log emotional state with visual indicators for real-time monitoring
fn log_emotional_state(features: &CameraFeatures, state: &EmotionalContext) {
    // Create visual bars (0-10 scale)
    let fatigue_bar = format!(
        "{}{}",
        "█".repeat((state.fatigue * 10.0) as usize),
        "░".repeat(10 - (state.fatigue * 10.0) as usize)
    );
    let engagement_bar = format!(
        "{}{}",
        "█".repeat((state.engagement * 10.0) as usize),
        "░".repeat(10 - (state.engagement * 10.0) as usize)
    );
    let stress_bar = format!(
        "{}{}",
        "█".repeat((state.stress * 10.0) as usize),
        "░".repeat(10 - (state.stress * 10.0) as usize)
    );
    let positive_bar = format!(
        "{}{}",
        "█".repeat((state.positive_affect * 10.0) as usize),
        "░".repeat(10 - (state.positive_affect * 10.0) as usize)
    );

    // Determine dominant emotion
    let dominant = if state.fatigue > 0.7 {
        "😴 FATIGUED"
    } else if state.stress > 0.6 {
        "😰 STRESSED"
    } else if state.positive_affect > 0.6 {
        "😊 HAPPY"
    } else if state.engagement > 0.7 {
        "🎯 FOCUSED"
    } else if state.engagement < 0.3 {
        "😶 DISENGAGED"
    } else {
        "😐 NEUTRAL"
    };

    println!("\n╔════════════════════════════════════════════════════════╗");
    println!("║           AIRA EMOTIONAL STATE DETECTED                ║");
    println!("╠════════════════════════════════════════════════════════╣");
    println!("║  Dominant: {:<40} ║", dominant);
    println!("╠════════════════════════════════════════════════════════╣");
    println!(
        "║  😴 Fatigue:      [{}] {:.1}%                       ║",
        fatigue_bar,
        state.fatigue * 100.0
    );
    println!(
        "║  🎯 Engagement:   [{}] {:.1}%                       ║",
        engagement_bar,
        state.engagement * 100.0
    );
    println!(
        "║  😰 Stress:       [{}] {:.1}%                       ║",
        stress_bar,
        state.stress * 100.0
    );
    println!(
        "║  😊 Positivity:   [{}] {:.1}%                       ║",
        positive_bar,
        state.positive_affect * 100.0
    );
    println!("╠════════════════════════════════════════════════════════╣");
    println!("║  Raw Signals:                                          ║");
    println!(
        "║    Eyes: {:.0}% open | Blinks: {:.0}/min | Smile: {:.0}%        ║",
        features.avg_eye_openness * 100.0,
        features.blink_rate,
        features.smile_score * 100.0
    );
    println!(
        "║    Head: pitch={:.0}° yaw={:.0}°                           ║",
        features.head_pitch, features.head_yaw
    );
    println!("╚════════════════════════════════════════════════════════╝\n");
}

// Calculate emotional state from camera features
// This is a privacy-preserving inference - no images, only numerical analysis
fn calculate_emotional_state(features: &CameraFeatures) -> EmotionalContext {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    if !features.face_present {
        // No face detected - return neutral state
        return EmotionalContext {
            fatigue: 0.5,
            engagement: 0.0,
            stress: 0.5,
            positive_affect: 0.5,
            timestamp: now,
        };
    }

    // Fatigue calculation with improved sensitivity
    // - Low eye openness = fatigue
    // - High blink rate = fatigue (after a threshold)
    let eye_fatigue = 1.0 - features.avg_eye_openness;
    let blink_fatigue = if features.blink_rate > 30.0 {
        ((features.blink_rate - 30.0) / 30.0).min(1.0) // Normalize 30-60 bpm to 0-1
    } else {
        0.0
    };
    let fatigue = (eye_fatigue * 0.7 + blink_fatigue * 0.3).clamp(0.0, 1.0);

    // Engagement calculation with head position weighting
    // - Face presence = base engagement
    // - Head movement (yaw/pitch within range) = attention
    // - Eye openness = alertness
    let face_engagement = features.face_confidence;
    let attention_engagement = if features.head_yaw.abs() < 20.0 && features.head_pitch.abs() < 15.0
    {
        0.8 // Looking at screen
    } else {
        0.4 // Looking away
    };
    let alertness = features.avg_eye_openness;
    let engagement =
        (face_engagement * 0.4 + attention_engagement * 0.3 + alertness * 0.3).clamp(0.0, 1.0);

    // Stress calculation with improved detection
    // - Low eye openness with normal blink rate = tiredness (not stress)
    // - Normal eye openness with facial tension = stress
    let facial_tension = 1.0 - features.smile_score;
    let eye_strain = if eye_fatigue > 0.5 && blink_fatigue < 0.3 {
        eye_fatigue * 0.5 // Moderate contribution if tired but not blinking
    } else {
        0.0
    };
    let stress = (facial_tension * 0.6 + eye_strain * 0.4).clamp(0.0, 1.0);

    // Positive affect calculation
    // - Smile score is primary indicator
    // - High engagement amplifies positivity
    let base_positivity = features.smile_score;
    let engagement_bonus = if engagement > 0.6 { 0.1 } else { 0.0 };
    let positive_affect = (base_positivity + engagement_bonus).clamp(0.0, 1.0);

    EmotionalContext {
        fatigue,
        engagement,
        stress,
        positive_affect,
        timestamp: now,
    }
}

// Get current emotional state (for prompt injection)
#[allow(dead_code)]
pub fn get_current_emotional_state(aira_state: &SharedAira) -> Option<EmotionalContext> {
    let guard = aira_state.lock().unwrap();
    guard.get_emotional_context()
}

#[derive(Serialize)]
pub struct CameraStatusResponse {
    pub enabled: bool,
    pub face_detected: bool,
    pub last_update: Option<u64>,
}

// Get camera sensor status
pub async fn get_camera_status(
    State((aira_state, _semaphore)): State<(SharedAira, &'static Semaphore)>,
) -> Json<CameraStatusResponse> {
    let guard = aira_state.lock().unwrap();
    let context = guard.get_emotional_context();

    Json(CameraStatusResponse {
        enabled: context.is_some(),
        face_detected: context
            .as_ref()
            .map(|c| c.engagement > 0.1)
            .unwrap_or(false),
        last_update: context.as_ref().map(|c| c.timestamp),
    })
}

// Detailed emotion response for real-time monitoring
#[derive(Serialize)]
pub struct EmotionDetailsResponse {
    pub dominant_emotion: String,
    pub fatigue: f32,
    pub engagement: f32,
    pub stress: f32,
    pub positive_affect: f32,
    pub timestamp: u64,
    pub smoothed: bool, // Indicates if values are smoothed
}

// Get detailed emotional state with all metrics
pub async fn get_emotion_details(
    State((aira_state, _semaphore)): State<(SharedAira, &'static Semaphore)>,
) -> Json<EmotionDetailsResponse> {
    let guard = aira_state.lock().unwrap();
    let context = guard.get_emotional_context();

    let (dominant, details) = if let Some(state) = context {
        let dom = if state.fatigue > 0.7 {
            "fatigued"
        } else if state.stress > 0.6 {
            "stressed"
        } else if state.positive_affect > 0.6 {
            "happy"
        } else if state.engagement > 0.7 {
            "focused"
        } else if state.engagement < 0.3 {
            "disengaged"
        } else {
            "neutral"
        };
        (dom.to_string(), state)
    } else {
        (
            "unknown".to_string(),
            EmotionalContext {
                fatigue: 0.0,
                engagement: 0.0,
                stress: 0.0,
                positive_affect: 0.0,
                timestamp: 0,
            },
        )
    };

    Json(EmotionDetailsResponse {
        dominant_emotion: dominant,
        fatigue: details.fatigue,
        engagement: details.engagement,
        stress: details.stress,
        positive_affect: details.positive_affect,
        timestamp: details.timestamp,
        smoothed: true,
    })
}
