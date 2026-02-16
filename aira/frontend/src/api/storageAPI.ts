import type { Message, Conversation } from '../types/chat';


const STORAGE_KEYS = {
	CONVERSATIONS: 'aira_conversations',
	DARK_MODE: 'darkMode',
	CAMERA_ENABLED: 'aira_camera_enabled',
} as const;

/**
 * Save conversations to localStorage
 * Note: Strips audioData to prevent quota exceeded errors
 */
export function saveConversations(conversations: Conversation[]): void {
	try {
		// Strip audioData from messages before saving (too large for localStorage)
		const conversationsWithoutAudio = conversations.map(conv => ({
			...conv,
			messages: conv.messages.map(msg => ({
				...msg,
				audioData: undefined, // Remove audio data
			})),
		}));
		localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(conversationsWithoutAudio));
	} catch (e) {
		console.error('Error saving conversations:', e);
		// If quota exceeded, try clearing old data
		if (e instanceof DOMException && e.name === 'QuotaExceededError') {
			console.warn('Storage quota exceeded, clearing old conversations');
			// Keep only the 5 most recent conversations
			const trimmedConversations = conversations.slice(0, 5).map(conv => ({
				...conv,
				messages: conv.messages.slice(-20).map(msg => ({ // Keep only last 20 messages
					...msg,
					audioData: undefined,
				})),
			}));
			try {
				localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(trimmedConversations));
			} catch (e2) {
				console.error('Still failed to save after trimming:', e2);
			}
		}
	}
}

/**
 * Load conversations from localStorage
 */
export function loadConversations(): Conversation[] {
	try {
		const saved = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS);
		if (saved) {
			const parsed: Array<{
				id: string;
				title: string;
				messages: Message[];
				createdAt: string;
				updatedAt: string;
			}> = JSON.parse(saved);
			// Convert date strings back to Date objects
			return parsed.map((conv) => ({
				...conv,
				createdAt: new Date(conv.createdAt),
				updatedAt: new Date(conv.updatedAt),
			}));
		}
	} catch (e) {
		console.error('Error loading conversations:', e);
	}
	return [];
}

/**
 * Save dark mode preference
 */
export function saveDarkMode(enabled: boolean): void {
	try {
		localStorage.setItem(STORAGE_KEYS.DARK_MODE, JSON.stringify(enabled));
	} catch (e) {
		console.error('Error saving dark mode:', e);
	}
}

/**
 * Load dark mode preference
 */
export function loadDarkMode(): boolean {
	try {
		const saved = localStorage.getItem(STORAGE_KEYS.DARK_MODE);
		return saved !== null ? JSON.parse(saved) : true;
	} catch (e) {
		console.error('Error loading dark mode:', e);
		return true;
	}
}

/**
 * Save camera enabled preference
 */
export function saveCameraEnabled(enabled: boolean): void {
	try {
		localStorage.setItem(STORAGE_KEYS.CAMERA_ENABLED, JSON.stringify(enabled));
	} catch (e) {
		console.error('Error saving camera preference:', e);
	}
}

/**
 * Load camera enabled preference
 */
export function loadCameraEnabled(): boolean {
	try {
		const saved = localStorage.getItem(STORAGE_KEYS.CAMERA_ENABLED);
		return saved !== null ? JSON.parse(saved) : false;
	} catch (e) {
		console.error('Error loading camera preference:', e);
		return false;
	}
}
