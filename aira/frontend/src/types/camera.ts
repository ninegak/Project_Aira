export interface CameraFeatures {
	face_present: boolean;
	face_confidence: number;
	left_eye_openness: number;
	right_eye_openness: number;
	avg_eye_openness: number;
	blink_rate: number;
	head_pitch: number;
	head_yaw: number;
	smile_score: number;
	timestamp: number;
}

export interface EmotionalState {
	fatigue: number;
	engagement: number;
	stress: number;
	positive_affect: number;
	timestamp: number;
}

export interface CameraStatus {
	enabled: boolean;
	face_detected: boolean;
	last_update?: number;
}

