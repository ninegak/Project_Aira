import { useState, useEffect, useRef, useCallback } from 'react';
import { sendChatMessage, transcribeAudio, sendCameraFeatures } from './api/chatAPI';
import { saveConversations, loadConversations, saveDarkMode, loadDarkMode } from './api/storageAPI';
import type { Message, Conversation } from './types/chat';
import type { CameraFeatures, EmotionalState } from './api/chatAPI';
import Sidebar from './components/Sidebar';
import Chat from './components/Chat';
import Landing from './components/Landing';
import CameraSensor from './components/CameraSensor';
import PrivacyModal from './components/PrivacyModal';
import './App.css';

type ViewState = 'landing' | 'chat';

function App() {
	const [messages, setMessages] = useState<Message[]>([]);
	const [inputMessage, setInputMessage] = useState<string>('');
	const [loading, setLoading] = useState<boolean>(false);
	const [tps, setTps] = useState<string | null>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null!);
	const [audioLoading, setAudioLoading] = useState<boolean>(false);

	const [playingMessageIndex, setPlayingMessageIndex] = useState<number | null>(null);

	const [isRecording, setIsRecording] = useState<boolean>(false);
	const [emotion, setEmotion] = useState<string | null>(null);
	const mediaRecorder = useRef<MediaRecorder | null>(null);
	const audioChunks = useRef<Blob[]>([]);

	// Load conversations from localStorage on initialization
	const [conversations, setConversations] = useState<Conversation[]>(() => loadConversations());
	const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
	const isFirstMessageRef = useRef<boolean>(true);

	// Camera sensor state
	const [cameraEnabled, setCameraEnabled] = useState<boolean>(false);
	const [_cameraFeatures, setCameraFeatures] = useState<CameraFeatures | null>(null);
	const [_emotionalState, setEmotionalState] = useState<EmotionalState | null>(null);
	const [showPrivacyModal, setShowPrivacyModal] = useState(false);
	const [voiceModeEnabled, setVoiceModeEnabled] = useState<boolean>(false);
	const [isVoiceRecording, setIsVoiceRecording] = useState<boolean>(false);
	const [isCameraFullscreen, setIsCameraFullscreen] = useState<boolean>(false);
	const voiceRecorderRef = useRef<MediaRecorder | null>(null);
	const voiceChunksRef = useRef<Blob[]>([]);
	const currentVoiceMessageIndexRef = useRef<number>(-1); // Track which message we're currently processing
	const audioQueueRef = useRef<string[]>([]); // Queue for audio chunks
	const isPlayingAudioRef = useRef<boolean>(false); // Track if currently playing

	const [darkMode, setDarkMode] = useState<boolean>(() => loadDarkMode());

	const [viewState, setViewState] = useState<ViewState>('landing');

	const handleStartChat = useCallback(() => {
		setViewState('chat');
	}, []);

	// Generate a unique ID for conversations
	const generateId = () => {
		return Date.now().toString(36) + Math.random().toString(36).substr(2);
	};

	// Get conversation title from first user message
	const getConversationTitle = (msgs: Message[]): string => {
		const firstUserMsg = msgs.find((m) => m.sender === 'user');
		if (firstUserMsg) {
			return firstUserMsg.text.length > 30
				? firstUserMsg.text.substring(0, 30) + '...'
				: firstUserMsg.text;
		}
		return 'New Conversation';
	};

	const handleNewConversation = useCallback(() => {

		// Save current conversation if it has messages
		if (messages.length > 0) {
			const title = getConversationTitle(messages);

			if (currentConversationId) {
				// Check if conversation already exists in array
				setConversations((prev) => {
					const exists = prev.some((conv) => conv.id === currentConversationId);
					if (exists) {
						// Update existing
						const updated = prev.map((conv) =>
							conv.id === currentConversationId
								? { ...conv, messages: [...messages], updatedAt: new Date() }
								: conv
						);
						console.log('Updated existing conversation. Total conversations:', updated.length);
						return updated;
					} else {
						// Add new conversation that wasn't in array yet
						const newConv: Conversation = {
							id: currentConversationId,
							title,
							messages: [...messages],
							createdAt: new Date(),
							updatedAt: new Date(),
						};
						const updated = [newConv, ...prev];
						console.log('Added conversation to array. Total conversations:', updated.length);
						return updated;
					}
				});
			} else {
				// Create new conversation
				const newConv: Conversation = {
					id: generateId(),
					title,
					messages: [...messages],
					createdAt: new Date(),
					updatedAt: new Date(),
				};
				setConversations((prev) => {
					const updated = [newConv, ...prev];
					console.log('Created new conversation. Total conversations:', updated.length);
					return updated;
				});
			}
		}

		// Start fresh
		setMessages([]);
		setInputMessage('');
		setTps(null);
		setPlayingMessageIndex(null);
		setEmotion(null);
		setCurrentConversationId(null);
		isFirstMessageRef.current = true;
	}, [messages, currentConversationId]);

	const handleSwitchConversation = useCallback(
		(conversationId: string) => {
			// Save current conversation if it has messages
			if (messages.length > 0 && currentConversationId !== conversationId) {
				const title = getConversationTitle(messages);

				if (currentConversationId) {
					// Check if conversation already exists
					setConversations((prev) => {
						const exists = prev.some((conv) => conv.id === currentConversationId);
						if (exists) {
							return prev.map((conv) =>
								conv.id === currentConversationId
									? { ...conv, messages: [...messages], updatedAt: new Date() }
									: conv
							);
						} else {
							// Add new conversation
							const newConv: Conversation = {
								id: currentConversationId,
								title,
								messages: [...messages],
								createdAt: new Date(),
								updatedAt: new Date(),
							};
							return [newConv, ...prev];
						}
					});
				} else {
					const newConv: Conversation = {
						id: generateId(),
						title,
						messages: [...messages],
						createdAt: new Date(),
						updatedAt: new Date(),
					};
					setConversations((prev) => [newConv, ...prev]);
				}
			}

			// Load selected conversation
			const conversation = conversations.find((c) => c.id === conversationId);
			if (conversation) {
				setMessages([...conversation.messages]);
				setCurrentConversationId(conversationId);
				setInputMessage('');
				setTps(null);
				setPlayingMessageIndex(null);
				setEmotion(null);
				isFirstMessageRef.current = false;
			}
		},
		[conversations, messages, currentConversationId]
	);

	const handleDeleteConversation = useCallback(
		(conversationId: string) => {
			setConversations((prev) => prev.filter((c) => c.id !== conversationId));

			// If deleting current conversation, clear the chat
			if (currentConversationId === conversationId) {
				setMessages([]);
				setCurrentConversationId(null);
				setInputMessage('');
				setTps(null);
				setPlayingMessageIndex(null);
				setEmotion(null);
				isFirstMessageRef.current = true;
			}
		},
		[currentConversationId]
	);

	// Toggle camera on/off with modal confirmation
	const toggleCamera = useCallback(() => {
		console.log('toggleCamera called, current state:', cameraEnabled);
		if (!cameraEnabled) {
			console.log('Camera is off, showing privacy modal...');
			setShowPrivacyModal(true);
		} else {
			console.log('Turning camera off...');
			setCameraEnabled(false);
		}
	}, [cameraEnabled]);

	// Handle modal confirm
	const handleCameraConfirm = useCallback(() => {
		console.log('Privacy modal confirmed, enabling camera...');
		setShowPrivacyModal(false);
		setCameraEnabled(true);
		setIsCameraFullscreen(true); // Auto-start in fullscreen mode
	}, []);

	// Handle modal cancel
	const handleCameraCancel = useCallback(() => {
		console.log('Privacy modal cancelled');
		setShowPrivacyModal(false);
	}, []);

	// Toggle voice mode
	const toggleVoiceMode = useCallback(() => {
		setVoiceModeEnabled((prev) => !prev);
	}, []);

	// Toggle camera fullscreen
	const toggleCameraFullscreen = useCallback(() => {
		setIsCameraFullscreen((prev) => !prev);
	}, []);

	// Close camera completely (for errors)
	const closeCamera = useCallback(() => {
		console.log('Closing camera due to error...');
		setCameraEnabled(false);
		setIsCameraFullscreen(false);
	}, []);

	// Use ref to access latest messages in playTtsAudio
	const messagesRef = useRef(messages);
	messagesRef.current = messages;

	const playTtsAudio = useCallback(
		async (messageIndex: number) => {
			// Access latest messages via ref
			const message = messagesRef.current[messageIndex];
			if (!message?.audioData || message.audioData.length === 0) {
				console.log('No audio data to play at index:', messageIndex);
				return;
			}

			if (playingMessageIndex !== null) {
				console.log('Already playing audio, skipping');
				return;
			}

			console.log('Playing TTS audio, chunks:', message.audioData.length);
			setPlayingMessageIndex(messageIndex);
			setAudioLoading(true);

			try {
				for (const base64 of message.audioData) {
					await new Promise<void>((resolve, reject) => {
						const audio = new Audio('data:audio/wav;base64,' + base64);
						audio.onended = () => resolve();
						audio.onerror = (e) => reject(new Error('Audio playback failed: ' + e));
						audio.play().catch(reject);
					});
				}
				console.log('TTS playback complete');
			} catch (error) {
				console.error('Error playing audio:', error);
			} finally {
				setPlayingMessageIndex(null);
				setAudioLoading(false);
			}
		},
		[playingMessageIndex]
	);

	// Play audio chunks sequentially from queue using a ref to avoid closure issues
	const playNextAudioChunkRef = useRef<() => void>(() => { });

	playNextAudioChunkRef.current = async () => {
		if (audioQueueRef.current.length === 0) {
			isPlayingAudioRef.current = false;
			return;
		}

		isPlayingAudioRef.current = true;
		const audioBase64 = audioQueueRef.current.shift();
		if (!audioBase64) {
			isPlayingAudioRef.current = false;
			return;
		}

		console.log('Playing audio chunk, remaining in queue:', audioQueueRef.current.length);

		try {
			const audio = new Audio('data:audio/wav;base64,' + audioBase64);
			audio.volume = 1.0;

			// Wait for audio to finish before playing next
			await new Promise<void>((resolve) => {
				audio.onended = () => resolve();
				audio.onerror = (e) => {
					console.error('Audio error:', e);
					resolve(); // Continue even on error
				};
				audio.play().catch(e => {
					console.error('Error playing audio chunk:', e);
					resolve(); // Continue on error
				});
			});

			// Small delay between chunks for natural flow
			await new Promise(resolve => setTimeout(resolve, 100));

			// Play next chunk using ref to avoid closure issues
			playNextAudioChunkRef.current();
		} catch (e) {
			console.error('Error in audio playback:', e);
			playNextAudioChunkRef.current(); // Continue on error
		}
	};

	// Handle voice message completion - sends to Aira and optionally auto-plays response
	const handleVoiceMessage = useCallback(
		async (text: string) => {
			if (!text.trim()) return;

			const userMessage: Message = { sender: 'user', text };

			// Create conversation ID if this is the first message
			if (isFirstMessageRef.current && !currentConversationId) {
				const newConvId = generateId();
				setCurrentConversationId(newConvId);
				isFirstMessageRef.current = false;
			}

			// Calculate Aira message index before adding messages
			const currentLength = messages.length;
			const airaMessageIndex = currentLength + 1; // User message + Aira message

			setMessages((prevMessages) => [...prevMessages, userMessage]);
			setLoading(true);
			setTps(null);

			// Create Aira message placeholder
			setMessages((prevMessages) => {
				const airaMessage: Message = { sender: 'aira', text: '', audioData: [] };
				return [...prevMessages, airaMessage];
			});

			console.log('Sending voice message to server:', text);
			console.log('Aira message will be at index:', airaMessageIndex);
			console.log('Current messages length:', currentLength);

			// Track this as the current voice message and reset audio queue
			currentVoiceMessageIndexRef.current = airaMessageIndex;
			audioQueueRef.current = []; // Clear any old audio
			isPlayingAudioRef.current = false;

			console.log('Starting chat request...');
			await sendChatMessage(text, {
				onToken: (token) => {
					console.log('Received token:', token.substring(0, 20) + '...');
					// Use functional update to always get latest state
					setMessages((prevMessages) => {
						if (prevMessages.length === 0) return prevMessages;
						const lastMessage = prevMessages[prevMessages.length - 1];
						if (lastMessage.sender !== 'aira') return prevMessages;
						const updatedLastMessage: Message = {
							...lastMessage,
							text: lastMessage.text + token,
						};
						return [...prevMessages.slice(0, -1), updatedLastMessage];
					});
				},
				onTps: (tpsValue) => {
					setTps(tpsValue);
					setMessages((prevMessages) => {
						// Safety check: if messages array is empty, skip
						if (prevMessages.length === 0 || !prevMessages[prevMessages.length - 1]) {
							return prevMessages;
						}
						const lastMessage = prevMessages[prevMessages.length - 1];
						const updatedLastMessage: Message = {
							...lastMessage,
							tps: tpsValue,
						};
						return [...prevMessages.slice(0, -1), updatedLastMessage];
					});
				},
				onAudio: (audioBase64) => {
					// Queue audio chunks and play sequentially for current message
					if (currentVoiceMessageIndexRef.current === airaMessageIndex) {
						audioQueueRef.current.push(audioBase64);
						console.log('Queued audio chunk for index:', airaMessageIndex, 'queue size:', audioQueueRef.current.length);

						// Start playing if not already playing
						if (!isPlayingAudioRef.current) {
							playNextAudioChunkRef.current();
						}
					} else {
						console.log('Skipping audio chunk - wrong message index. Current:', currentVoiceMessageIndexRef.current, 'Expected:', airaMessageIndex);
					}
					setMessages((prevMessages) => {
						// Safety check: if messages array is empty, skip
						if (prevMessages.length === 0) {
							return prevMessages;
						}
						const lastMessage = prevMessages[prevMessages.length - 1];
						if (lastMessage.sender === 'aira') {
							const updatedLastMessage: Message = {
								...lastMessage,
								audioData: [...(lastMessage.audioData || []), audioBase64],
							};
							return [...prevMessages.slice(0, -1), updatedLastMessage];
						}
						return prevMessages;
					});
				},
				onError: (error) => {
					setMessages((prevMessages) => {
						// Safety check: if messages array is empty, skip
						if (prevMessages.length === 0 || !prevMessages[prevMessages.length - 1]) {
							return prevMessages;
						}
						const lastMessage = prevMessages[prevMessages.length - 1];
						const updatedText = lastMessage.text + `\n\nError: ${error}`;
						const updatedLastMessage: Message = { ...lastMessage, text: updatedText };
						return [...prevMessages.slice(0, -1), updatedLastMessage];
					});
				},
				onComplete: () => {
					console.log('Voice chat message complete');
					setLoading(false);
					// Reset current voice message tracking
					currentVoiceMessageIndexRef.current = -1;
					// Auto-play TTS in live mode after a short delay to ensure audio data is received
					if (voiceModeEnabled && airaMessageIndex >= 0) {
						console.log('Auto-playing TTS response in live mode at index:', airaMessageIndex);
						// Wait a bit for final audio chunks to arrive
						setTimeout(() => {
							playTtsAudio(airaMessageIndex);
						}, 500);
					}
				},
			}).catch((err) => {
				console.error('Failed to send voice message:', err);
				setLoading(false);
				currentVoiceMessageIndexRef.current = -1;
			});
		},
		[currentConversationId, messages.length, voiceModeEnabled, playTtsAudio, cameraEnabled, playingMessageIndex, currentVoiceMessageIndexRef]
	);

	// Start voice recording for Live mode
	const startVoiceRecording = useCallback(async () => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			voiceRecorderRef.current = new MediaRecorder(stream, {
				mimeType: 'audio/webm;codecs=opus',
			});
			voiceChunksRef.current = [];

			voiceRecorderRef.current.ondataavailable = (event) => {
				if (event.data.size > 0) {
					voiceChunksRef.current.push(event.data);
				}
			};

			voiceRecorderRef.current.onstop = async () => {
				const audioBlob = new Blob(voiceChunksRef.current, { type: 'audio/webm' });

				// Transcribe audio and send as message
				try {
					console.log('Voice recording completed, transcribing...');
					const result = await transcribeAudio(audioBlob);
					console.log('Transcription:', result.text);

					if (result.text.trim()) {
						// Send transcribed text as message
						await handleVoiceMessage(result.text);
					}
				} catch (error) {
					console.error('Error transcribing voice:', error);
				} finally {
					stream.getTracks().forEach((track) => track.stop());
					setIsVoiceRecording(false);

					// Auto-restart recording in live mode if still enabled
					if (voiceModeEnabled && cameraEnabled) {
						console.log('Auto-restarting voice recording in live mode');
						setTimeout(() => {
							startVoiceRecording();
						}, 500); // Small delay to allow processing
					}
				}
			};

			voiceRecorderRef.current.start();
			setIsVoiceRecording(true);
		} catch (err) {
			console.error('Error accessing microphone:', err);
			alert('Please allow microphone access for voice mode.');
		}
	}, [cameraEnabled, voiceModeEnabled, handleVoiceMessage]);

	// Stop voice recording
	const stopVoiceRecording = useCallback(() => {
		if (voiceRecorderRef.current && isVoiceRecording) {
			voiceRecorderRef.current.stop();
		}
	}, [isVoiceRecording]);

	const toggleMode = useCallback(() => {
		setDarkMode((prev) => {
			const newMode = !prev;
			saveDarkMode(newMode);
			return newMode;
		});
	}, []);

	const handleSendMessage = useCallback(() => {
		if (inputMessage.trim() && !loading) {
			const userMessage: Message = { sender: 'user', text: inputMessage };
			const messageToSend = inputMessage;

			// Create conversation ID if this is the first message
			if (isFirstMessageRef.current && !currentConversationId) {
				const newConvId = generateId();
				setCurrentConversationId(newConvId);
				isFirstMessageRef.current = false;
			}

			setMessages((prevMessages) => [...prevMessages, userMessage]);
			setInputMessage('');
			setLoading(true);
			setTps(null);

			// Create Aira message placeholder
			const airaMessage: Message = { sender: 'aira', text: '', audioData: [] };
			setMessages((prevMessages) => [...prevMessages, airaMessage]);

			console.log('Sending message to server:', messageToSend);
			sendChatMessage(messageToSend, {
				onToken: (token) => {
					setMessages((prevMessages) => {
						// Safety check: if messages array is empty, skip
						if (prevMessages.length === 0) {
							console.log('Messages array empty, skipping token');
							return prevMessages;
						}
						const lastMessage = prevMessages[prevMessages.length - 1];
						// Safety check: if no last message, skip
						if (!lastMessage) {
							console.log('No last message, skipping token');
							return prevMessages;
						}
						const updatedLastMessage: Message = {
							...lastMessage,
							text: lastMessage.text + token,
						};
						return [...prevMessages.slice(0, -1), updatedLastMessage];
					});
				},
				onTps: (tpsValue) => {
					setTps(tpsValue);
					setMessages((prevMessages) => {
						// Safety check: if messages array is empty, skip
						if (prevMessages.length === 0 || !prevMessages[prevMessages.length - 1]) {
							return prevMessages;
						}
						const lastMessage = prevMessages[prevMessages.length - 1];
						const updatedLastMessage: Message = {
							...lastMessage,
							tps: tpsValue,
						};
						return [...prevMessages.slice(0, -1), updatedLastMessage];
					});
				},
				onAudio: (audioBase64) => {
					setMessages((prevMessages) => {
						// Safety check: if messages array is empty, skip
						if (prevMessages.length === 0 || !prevMessages[prevMessages.length - 1]) {
							return prevMessages;
						}
						const lastMessage = prevMessages[prevMessages.length - 1];
						if (lastMessage.sender === 'aira') {
							const updatedLastMessage: Message = {
								...lastMessage,
								audioData: [...(lastMessage.audioData || []), audioBase64],
							};
							return [...prevMessages.slice(0, -1), updatedLastMessage];
						}
						return prevMessages;
					});
				},
				onError: (error) => {
					setMessages((prevMessages) => {
						// Safety check: if messages array is empty, skip
						if (prevMessages.length === 0 || !prevMessages[prevMessages.length - 1]) {
							return prevMessages;
						}
						const lastMessage = prevMessages[prevMessages.length - 1];
						const updatedText = lastMessage.text + `\n\nError: ${error}`;
						const updatedLastMessage: Message = { ...lastMessage, text: updatedText };
						return [...prevMessages.slice(0, -1), updatedLastMessage];
					});
				},
				onComplete: () => {
					console.log('Chat message complete');
					setLoading(false);
				},
			}).catch((err) => {
				console.error('Failed to send message:', err);
				setLoading(false);
			});
		}
	}, [inputMessage, loading, currentConversationId]);

	const startRecording = useCallback(async () => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			mediaRecorder.current = new MediaRecorder(stream, {
				mimeType: 'audio/webm;codecs=opus',
			});
			audioChunks.current = [];

			mediaRecorder.current.ondataavailable = (event) => {
				if (event.data.size > 0) {
					audioChunks.current.push(event.data);
				}
			};

			mediaRecorder.current.onstop = async () => {
				const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });

				setAudioLoading(true);

				try {
					const result = await analyzeEmotion(audioBlob);
					setEmotion(result.dominant_emotion);
				} catch (error) {
					console.error('Error analyzing emotion:', error);
					setEmotion('Error: Could not analyze emotion');
				} finally {
					setAudioLoading(false);
					stream.getTracks().forEach((track) => track.stop());
				}
			};

			mediaRecorder.current.start();
			setIsRecording(true);
		} catch (err) {
			console.error('Error accessing microphone:', err);
			alert('Please allow microphone access to use this feature.');
		}
	}, []);

	const stopRecording = useCallback(() => {
		if (mediaRecorder.current && isRecording) {
			mediaRecorder.current.stop();
			setIsRecording(false);
		}
	}, [isRecording]);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [messages]);

	useEffect(() => {
		return () => {
			if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
				mediaRecorder.current.stop();
			}
		};
	}, []);

	// Sync current messages to conversations whenever they change
	useEffect(() => {
		if (currentConversationId && messages.length > 0) {
			setConversations((prev) => {
				// Check if conversation already exists
				const exists = prev.some((conv) => conv.id === currentConversationId);

				if (exists) {
					// Update existing conversation
					return prev.map((conv) => {
						if (conv.id === currentConversationId) {
							return {
								...conv,
								messages: messages,
								updatedAt: Date.now(),
							};
						}
						return conv;
					});
				} else {
					// Create new conversation
					const title = getConversationTitle(messages);
					const newConv: Conversation = {
						id: currentConversationId,
						title,
						messages: [...messages],
						createdAt: new Date(),
						updatedAt: new Date(),
					};
					return [newConv, ...prev];
				}
			});
		}
	}, [messages, currentConversationId]);

	// Save conversations to localStorage whenever they change
	useEffect(() => {
		saveConversations(conversations);
	}, [conversations]);

	// Throttle camera feature updates to prevent server overload
	const lastCameraUpdateRef = useRef<number>(0);

	// Handle camera features update
	const handleCameraFeatures = useCallback(async (features: CameraFeatures) => {
		setCameraFeatures(features);

		// Throttle: only send every 1000ms (1 second)
		const now = Date.now();
		if (now - lastCameraUpdateRef.current < 1000) {
			return; // Skip this update
		}
		lastCameraUpdateRef.current = now;

		// Send features to backend for emotional state calculation
		if (features.face_present) {
			try {
				const state = await sendCameraFeatures(features);
				setEmotionalState(state);
			} catch (error) {
				console.error('Error sending camera features:', error);
			}
		}
	}, []);

	if (viewState === 'landing') {
		return <Landing darkMode={darkMode} onStartChat={handleStartChat} />;
	}

	// Debug logging disabled - was causing console spam
	// console.log('Rendering with conversations:', conversations.length, 'Current ID:', currentConversationId);

	return (
		<div className="d-flex vh-100" style={{ background: darkMode ? '#1a1d23' : '#F8F9FA' }}>
			<Sidebar
				darkMode={darkMode}
				conversations={conversations}
				currentConversationId={currentConversationId}
				onNewConversation={handleNewConversation}
				onSwitchConversation={handleSwitchConversation}
				onDeleteConversation={handleDeleteConversation}
			/>
			<div className="flex-grow-1 d-flex flex-column" style={{ marginLeft: '280px' }}>
				<div
					className="p-3 d-flex justify-content-end align-items-center gap-3"
					style={{
						background: darkMode ? '#1a1d23' : '#F8F9FA',
						borderBottom: `1px solid ${darkMode ? '#2A2D35' : '#E8EAED'}`,
					}}
				>
					<button
						className="btn btn-sm d-flex align-items-center gap-2"
						onClick={toggleMode}
						aria-label={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
						style={{
							background: darkMode ? 'rgba(74, 95, 127, 0.2)' : 'rgba(74, 95, 127, 0.1)',
							color: darkMode ? '#A8B5C4' : '#4A5F7F',
							border: `1px solid ${darkMode ? 'rgba(74, 95, 127, 0.3)' : 'rgba(74, 95, 127, 0.15)'}`,
							borderRadius: '20px',
							padding: '6px 12px',
							fontSize: '0.85rem',
						}}
					>
						{darkMode ? '☀️ Light' : '🌙 Dark'}
					</button>
					{cameraEnabled && (
						<>
							<button
								onClick={toggleVoiceMode}
								className="btn btn-sm d-flex align-items-center gap-2"
								style={{
									background: voiceModeEnabled
										? darkMode
											? 'rgba(255, 193, 7, 0.2)'
											: 'rgba(255, 193, 7, 0.1)'
										: darkMode
											? 'rgba(74, 95, 127, 0.2)'
											: 'rgba(74, 95, 127, 0.1)',
									color: voiceModeEnabled ? '#ffc107' : darkMode ? '#A8B5C4' : '#4A5F7F',
									border: `1px solid ${voiceModeEnabled ? '#ffc107' : darkMode ? 'rgba(74, 95, 127, 0.3)' : 'rgba(74, 95, 127, 0.15)'}`,
									borderRadius: '20px',
									padding: '6px 12px',
									fontSize: '0.85rem',
								}}
								title={voiceModeEnabled ? 'Disable voice mode' : 'Enable voice mode'}
							>
								<svg
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
								>
									<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
									<path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
									<line x1="12" y1="19" x2="12" y2="22"></line>
								</svg>
								{voiceModeEnabled ? 'Live On' : 'Live Off'}
							</button>
						</>
					)}
				</div>
				<Chat
					messages={messages}
					inputMessage={inputMessage}
					loading={loading}
					tps={tps}
					audioLoading={audioLoading}
					isRecording={isRecording}
					emotion={emotion}
					handleSendMessage={handleSendMessage}
					setInputMessage={setInputMessage}
					startRecording={startRecording}
					stopRecording={stopRecording}
					messagesEndRef={messagesEndRef}
					onPlayAudio={playTtsAudio}
					darkMode={darkMode}
					playingMessageIndex={playingMessageIndex}
					cameraEnabled={cameraEnabled}
					onToggleCamera={toggleCamera}
				/>
			</div>
			<PrivacyModal
				isOpen={showPrivacyModal}
				onConfirm={handleCameraConfirm}
				onCancel={handleCameraCancel}
				darkMode={darkMode}
			/>

			{/* Fullscreen Camera View - Gemini Live Style */}
			{cameraEnabled && (
				<CameraSensor
					enabled={cameraEnabled}
					darkMode={darkMode}
					onFeaturesUpdate={handleCameraFeatures}
					isVoiceMode={voiceModeEnabled}
					onVoiceStart={startVoiceRecording}
					onVoiceStop={stopVoiceRecording}
					isFullscreen={isCameraFullscreen}
					onToggleFullscreen={toggleCameraFullscreen}
					onClose={closeCamera}
					isProcessing={loading}
				/>
			)}
		</div>
	);
}

export default App;
