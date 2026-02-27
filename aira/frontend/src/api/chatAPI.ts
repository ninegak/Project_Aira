import { fetchEventSource, EventSourceMessage } from '@microsoft/fetch-event-source';
import type {
	ChatRequest, ChatCallbacks,
	EmotionResponse,
	CameraFeatures,
	EmotionalState,
} from '../types/api';

import type { CameraStatus } from '../types/camera';

const API_BASE_URL = 'http://127.0.0.1:3000';

export type { ChatRequest, ChatCallbacks, EmotionResponse, CameraFeatures, EmotionalState, CameraStatus };

// Send a message to Aira and receive streaming response
export async function sendChatMessage(
	message: string,
	callbacks: ChatCallbacks,
	abortSignal?: AbortSignal
): Promise<void> {
	return new Promise((resolve, reject) => {
		fetchEventSource(`${API_BASE_URL}/chat`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ message } satisfies ChatRequest),
			signal: abortSignal,
			onmessage(event: EventSourceMessage) {
				switch (event.event) {
					case 'tps':
						callbacks.onTps(event.data);
						break;
					case 'audio_complete':
						callbacks.onAudio(event.data);
						break;
					case 'error':
						callbacks.onError(event.data);
						break;
					case 'tts_error':
					case 'audio_error':
						console.error('Server error:', event.data);
						break;
					default:
						// Regular token
						if (event.data) {
							callbacks.onToken(event.data);
						}
						break;
				}
			},
			onclose() {
				callbacks.onComplete();
				resolve();
			},
			onerror(err) {
				console.error('EventSource error:', err);
				callbacks.onComplete();
				reject(err);
			},
		});
	});
}

// Send audio for emotion analysis
export async function analyzeEmotion(audioBlob: Blob): Promise<EmotionResponse> {
	const formData = new FormData();
	formData.append('audio', audioBlob, 'recording.webm');

	const response = await fetch(`${API_BASE_URL}/api/emotion`, {
		method: 'POST',
		body: formData,
	});

	if (!response.ok) {
		throw new Error(`Failed to analyze emotion: ${response.statusText}`);
	}

	return response.json();
}

// Send camera features to backend
export async function sendCameraFeatures(features: CameraFeatures): Promise<EmotionalState> {
	const response = await fetch(`${API_BASE_URL}/api/camera/features`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(features),
	});

	if (!response.ok) {
		throw new Error(`Failed to send camera features: ${response.statusText}`);
	}

	return response.json();
}

// Get camera status from backend
export async function getCameraStatus(): Promise<CameraStatus> {
	const response = await fetch(`${API_BASE_URL}/api/camera/status`);

	if (!response.ok) {
		throw new Error(`Failed to get camera status: ${response.statusText}`);
	}

	return response.json();
}

// Check if backend is healthy
export async function checkHealth(): Promise<boolean> {
	try {
		const response = await fetch(`${API_BASE_URL}/health`);
		return response.ok;
	} catch {
		return false;
	}
}

// Transcribe audio to text using STT
export async function transcribeAudio(audioBlob: Blob): Promise<{ text: string; confidence: number }> {
	const formData = new FormData();
	formData.append('audio', audioBlob, 'recording.webm');

	const response = await fetch(`${API_BASE_URL}/api/stt/transcribe`, {
		method: 'POST',
		body: formData,
	});

	if (!response.ok) {
		throw new Error(`Failed to transcribe audio: ${response.statusText}`);
	}

	return response.json();
}
