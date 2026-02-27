import type { Message } from './chat';
import type { CameraFeatures, EmotionalState } from './camera';

export type { Message, CameraFeatures, EmotionalState };

export interface ChatRequest {
	message: string;
}

export interface ChatCallbacks {
	onToken: (token: string) => void;
	onTps: (tps: string) => void;
	onAudio: (audioBase64: string) => void;
	onError: (error: string) => void;
	onComplete: () => void;
}

export interface EmotionResponse {
	dominant_emotion: string;
}
