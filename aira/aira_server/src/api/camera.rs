use crate::models::CameraFeatures;
use crate::states::SharedAira;
use aira_brain::aira::EmotionalContext;
use axum::{Json, extract::State};
use serde::Serialize;
use tokio::sync::Semaphore;

/// Process camera features and return emotional state with rate limiting
pub async fn process_camera_features(
    State((aira_state, _semaphore)): State<(SharedAira, &'static Semaphore)>,
    Json(features): Json<CameraFeatures>,
) -> Json<EmotionalContext> {
    // Calculate emotional state from camera features
    let emotional_state = calculate_emotional_state(&features);

    // Log real-time emotion data
    log_emotional_state(&features, &emotional_state);

    // Update Aira's state with the emotional context
    {
        let guard = aira_state.lock().unwrap();
        guard.update_emotional_context(emotional_state.clone());
    }

    Json(emotional_state)
}

/// Log emotional state with visual indicators for real-time monitoring
fn log_emotional_state(features: &CameraFeatures, state: &EmotionalContext) {
    // Create visual bars (0-10 scale)
    let fatigue_bar = format!("{}{}", "█".repeat((state.fatigue * 10.0) as usize), "░".repeat(10 - (state.fatigue * 10.0) as usize));
    let engagement_bar = format!("{}{}", "█".repeat((state.engagement * 10.0) as usize), "░".repeat(10 - (state.engagement * 10.0) as usize));
    let stress_bar = format!("{}{}", "█".repeat((state.stress * 10.0) as usize), "░".repeat(10 - (state.stress * 10.0) as usize));
    let positive_bar = format!("{}{}", "█".repeat((state.positive_affect * 10.0) as usize), "░".repeat(10 - (state.positive_affect * 10.0) as usize));
    
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
    println!("║  😴 Fatigue:      [{}] {:.1}%                       ║", fatigue_bar, state.fatigue * 100.0);
    println!("║  🎯 Engagement:   [{}] {:.1}%                       ║", engagement_bar, state.engagement * 100.0);
    println!("║  😰 Stress:       [{}] {:.1}%                       ║", stress_bar, state.stress * 100.0);
    println!("║  😊 Positivity:   [{}] {:.1}%                       ║", positive_bar, state.positive_affect * 100.0);
    println!("╠════════════════════════════════════════════════════════╣");
    println!("║  Raw Signals:                                          ║");
    println!("║    Eyes: {:.0}% open | Blinks: {:.0}/min | Smile: {:.0}%        ║", 
        features.avg_eye_openness * 100.0,
        features.blink_rate,
        features.smile_score * 100.0
    );
    println!("║    Head: pitch={:.0}° yaw={:.0}°                           ║",
        features.head_pitch,
        features.head_yaw
    );
    println!("╚════════════════════════════════════════════════════════╝\n");
}

/// Calculate emotional state from camera features
/// This is a privacy-preserving inference - no images, only numerical analysis
fn calculate_emotional_state(features: &CameraFeatures) -> EmotionalContext {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    if !features.face_present {
        // No face detected - assume disengaged
        return EmotionalContext {
            fatigue: 0.5, // Unknown
            engagement: 0.0,
            stress: 0.0,
            positive_affect: 0.5,
            timestamp: now,
        };
    }

    // Fatigue calculation
    // - Low eye openness = fatigue
    // - High blink rate = fatigue (after a threshold)
    let eye_fatigue = 1.0 - features.avg_eye_openness;
    let blink_fatigue = if features.blink_rate > 30.0 {
        (features.blink_rate - 30.0) / 30.0 // Normalize 30-60 bpm to 0-1
    } else {
        0.0
    };
    let fatigue = (eye_fatigue * 0.7 + blink_fatigue * 0.3).clamp(0.0, 1.0);

    // Engagement calculation
    // - Face presence = base engagement
    // - Head movement (yaw/pitch within range) = attention
    // - Eye openness = alertness
    let face_engagement = features.face_confidence;
    let attention_engagement = if features.head_yaw.abs() < 20.0 && features.head_pitch.abs() < 15.0 {
        0.8 // Looking at screen
    } else {
        0.4 // Looking away
    };
    let alertness = features.avg_eye_openness;
    let engagement = (face_engagement * 0.4 + attention_engagement * 0.3 + alertness * 0.3).clamp(0.0, 1.0);

    // Stress calculation
    // - Low eye openness with high blink rate = stress
    // - Facial tension (inferred from lack of smile)
    let tension = 1.0 - features.smile_score;
    let stress = ((1.0 - features.avg_eye_openness) * 0.5 + tension * 0.5).clamp(0.0, 1.0);

    // Positive affect calculation
    // - Smile score
    // - Engagement
    let positive_affect = (features.smile_score * 0.6 + engagement * 0.4).clamp(0.0, 1.0);

    EmotionalContext {
        fatigue,
        engagement,
        stress,
        positive_affect,
        timestamp: now,
    }
}

/// Get current emotional state (for prompt injection)
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

/// Get camera sensor status
pub async fn get_camera_status(
    State((aira_state, _semaphore)): State<(SharedAira, &'static Semaphore)>,
) -> Json<CameraStatusResponse> {
    let guard = aira_state.lock().unwrap();
    let context = guard.get_emotional_context();
    
    Json(CameraStatusResponse {
        enabled: context.is_some(),
        face_detected: context.as_ref().map(|c| c.engagement > 0.1).unwrap_or(false),
        last_update: context.as_ref().map(|c| c.timestamp),
    })
}

/// Detailed emotion response for real-time monitoring
#[derive(Serialize)]
pub struct EmotionDetailsResponse {
    pub dominant_emotion: String,
    pub fatigue: f32,
    pub engagement: f32,
    pub stress: f32,
    pub positive_affect: f32,
    pub timestamp: u64,
    pub raw_features: Option<CameraFeatures>,
}

/// Get detailed emotional state with all metrics
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
        ("unknown".to_string(), EmotionalContext {
            fatigue: 0.0,
            engagement: 0.0,
            stress: 0.0,
            positive_affect: 0.0,
            timestamp: 0,
        })
    };
    
    Json(EmotionDetailsResponse {
        dominant_emotion: dominant,
        fatigue: details.fatigue,
        engagement: details.engagement,
        stress: details.stress,
        positive_affect: details.positive_affect,
        timestamp: details.timestamp,
        raw_features: None,
    })
}
