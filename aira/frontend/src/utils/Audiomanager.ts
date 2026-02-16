/**
 * AudioQueueManager - Simplified audio playback queue
 * 
 * Replaces complex ref-based audio management with a clean class-based approach.
 * Handles sequential audio playback, interruption, and cleanup.
 */

export class AudioQueueManager {
	private queue: string[] = [];
	private isPlaying: boolean = false;
	private currentAudio: HTMLAudioElement | null = null;
	private onComplete?: () => void;

	/**
	 * Add audio chunk to queue and start playing if not already playing
	 */
	enqueue(audioBase64: string): void {
		this.queue.push(audioBase64);
		console.log(`📥 Queued audio chunk. Queue size: ${this.queue.length}`);

		// Start playing if not already playing
		if (!this.isPlaying) {
			this.playNext();
		}
	}

	/**
	 * Play next audio chunk in queue
	 */
	private async playNext(): Promise<void> {
		// Base case: queue is empty
		if (this.queue.length === 0) {
			this.isPlaying = false;
			console.log('✅ Audio queue completed');
			this.onComplete?.();
			return;
		}

		this.isPlaying = true;
		const audioBase64 = this.queue.shift()!;

		console.log(`🔊 Playing audio chunk. Remaining: ${this.queue.length}`);

		try {
			await this.playAudioChunk(audioBase64);
			// Small delay between chunks for natural flow
			await this.delay(100);
			// Recursively play next chunk
			this.playNext();
		} catch (error) {
			console.error('❌ Audio playback error:', error);
			// Continue with next chunk even on error
			this.playNext();
		}
	}

	/**
	 * Play a single audio chunk
	 */
	private playAudioChunk(audioBase64: string): Promise<void> {
		return new Promise((resolve, reject) => {
			const audio = new Audio(`data:audio/wav;base64,${audioBase64}`);
			audio.volume = 1.0;

			this.currentAudio = audio;

			audio.onended = () => {
				this.currentAudio = null;
				resolve();
			};

			audio.onerror = (error) => {
				this.currentAudio = null;
				console.error('Audio element error:', error);
				reject(error);
			};

			audio.play().catch((error) => {
				this.currentAudio = null;
				console.error('Audio play() error:', error);
				reject(error);
			});
		});
	}

	/**
	 * Stop current playback and clear queue
	 */
	stop(): void {
		console.log('⏹️ Stopping audio playback');

		// Stop current audio
		if (this.currentAudio) {
			this.currentAudio.pause();
			this.currentAudio.currentTime = 0;
			this.currentAudio = null;
		}

		// Clear queue
		this.queue = [];
		this.isPlaying = false;
	}

	/**
	 * Clear queue without stopping current playback
	 */
	clearQueue(): void {
		console.log('🗑️ Clearing audio queue');
		this.queue = [];
	}

	/**
	 * Check if currently playing
	 */
	getIsPlaying(): boolean {
		return this.isPlaying;
	}

	/**
	 * Get current queue size
	 */
	getQueueSize(): number {
		return this.queue.length;
	}

	/**
	 * Set completion callback
	 */
	setOnComplete(callback: () => void): void {
		this.onComplete = callback;
	}

	/**
	 * Utility delay function
	 */
	private delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
}

/**
 * VoiceMessageManager - Handles voice recording and message tracking
 * 
 * Manages voice recording state, transcription, and message index tracking
 * to coordinate with audio playback.
 */

export class VoiceMessageManager {
	private currentMessageIndex: number = -1;
	private audioManager: AudioQueueManager;

	constructor(audioManager: AudioQueueManager) {
		this.audioManager = audioManager;
	}

	/**
	 * Start processing a new voice message
	 * Returns the message index that will be used for Aira's response
	 */
	startMessage(currentMessagesLength: number): number {
		// Calculate Aira's message index (user message + Aira response)
		const airaMessageIndex = currentMessagesLength + 1;
		this.currentMessageIndex = airaMessageIndex;

		// Clear any old audio from previous message
		this.audioManager.clearQueue();

		console.log(`🎤 Started voice message. Aira response will be at index: ${airaMessageIndex}`);
		return airaMessageIndex;
	}

	/**
	 * Handle incoming audio chunk for current message
	 */
	handleAudioChunk(audioBase64: string, messageIndex: number): boolean {
		// Only queue audio if it matches the current message
		if (messageIndex === this.currentMessageIndex) {
			this.audioManager.enqueue(audioBase64);
			return true;
		} else {
			console.warn(`⚠️ Skipping audio chunk - wrong message index. Current: ${this.currentMessageIndex}, Received: ${messageIndex}`);
			return false;
		}
	}

	/**
	 * Complete current voice message
	 */
	completeMessage(): void {
		console.log(`✅ Voice message completed at index: ${this.currentMessageIndex}`);
		this.currentMessageIndex = -1;
	}

	/**
	 * Get current message index
	 */
	getCurrentMessageIndex(): number {
		return this.currentMessageIndex;
	}

	/**
	 * Reset state
	 */
	reset(): void {
		this.currentMessageIndex = -1;
		this.audioManager.stop();
	}
}

/**
 * TTS Audio Player - Handles TTS playback for manual triggers
 * 
 * Separate from voice mode, this handles when user clicks "play" on a message.
 */

export class TtsAudioPlayer {
	private currentlyPlaying: number | null = null;
	private currentAudio: HTMLAudioElement | null = null;

	/**
	 * Play TTS audio for a specific message
	 */
	async play(messageIndex: number, audioChunks: string[]): Promise<void> {
		if (this.currentlyPlaying !== null) {
			console.log('⏹️ Already playing audio, stopping first');
			this.stop();
		}

		if (!audioChunks || audioChunks.length === 0) {
			console.warn('⚠️ No audio data to play');
			return;
		}

		this.currentlyPlaying = messageIndex;
		console.log(`🔊 Playing TTS audio for message ${messageIndex}, ${audioChunks.length} chunks`);

		try {
			for (const base64 of audioChunks) {
				// Check if we've been stopped
				if (this.currentlyPlaying !== messageIndex) {
					console.log('⏹️ Playback interrupted');
					return;
				}

				await this.playChunk(base64);
			}

			console.log('✅ TTS playback complete');
		} catch (error) {
			console.error('❌ TTS playback error:', error);
		} finally {
			if (this.currentlyPlaying === messageIndex) {
				this.currentlyPlaying = null;
			}
		}
	}

	/**
	 * Play a single audio chunk
	 */
	private playChunk(audioBase64: string): Promise<void> {
		return new Promise((resolve, reject) => {
			const audio = new Audio(`data:audio/wav;base64,${audioBase64}`);
			this.currentAudio = audio;

			audio.onended = () => {
				this.currentAudio = null;
				resolve();
			};

			audio.onerror = (error) => {
				this.currentAudio = null;
				reject(error);
			};

			audio.play().catch(reject);
		});
	}

	/**
	 * Stop current playback
	 */
	stop(): void {
		if (this.currentAudio) {
			this.currentAudio.pause();
			this.currentAudio.currentTime = 0;
			this.currentAudio = null;
		}
		this.currentlyPlaying = null;
	}

	/**
	 * Check if currently playing a specific message
	 */
	isPlaying(messageIndex: number): boolean {
		return this.currentlyPlaying === messageIndex;
	}

	/**
	 * Get currently playing message index
	 */
	getCurrentlyPlaying(): number | null {
		return this.currentlyPlaying;
	}
}
