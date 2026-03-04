import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { sendChatMessage, transcribeAudio, sendCameraFeatures, pollAlerts } from './api/chatAPI';
import { saveConversations, loadConversations, saveDarkMode, loadDarkMode } from './api/storageAPI';
import type { Message, Conversation } from './types/chat';
import type { CameraFeatures, EmotionalState } from './api/chatAPI';
import { AudioQueueManager, VoiceMessageManager, TtsAudioPlayer } from './utils/audiomanager';
import Sidebar from './components/Sidebar';
import Chat from './components/Chat';
import Landing from './components/Landing';
import CameraSensor from './components/CameraSensor';
import EyeVisualization from './components/EyeVisualization';
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

	// Audio management - simplified with manager classes
	const audioQueueManager = useMemo(() => new AudioQueueManager(), []);
	const voiceMessageManager = useMemo(() => new VoiceMessageManager(audioQueueManager), [audioQueueManager]);
	const ttsPlayer = useMemo(() => new TtsAudioPlayer(), []);

	const [playingMessageIndex, setPlayingMessageIndex] = useState<number | null>(null);
	const isSpeaking = playingMessageIndex !== null;

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
	const [displayMode, setDisplayMode] = useState<'eyes' | 'camera'>('eyes');
	const voiceRecorderRef = useRef<MediaRecorder | null>(null);
	const voiceChunksRef = useRef<Blob[]>([]);

	// Mental health monitoring state
	const [mentalAlert, setMentalAlert] = useState<{ type: string; message: string } | null>(null);
	const [showMoodWidget, setShowMoodWidget] = useState<boolean>(false);
	const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(false);
	const [cameraUIVisible, setCameraUIVisible] = useState<boolean>(false);

	// Track mood history during conversation for summary
	const moodHistoryRef = useRef<{ emotion: string; timestamp: number }[]>([]);
	const [conversationSummary, setConversationSummary] = useState<{ message: string; moods: string[] } | null>(null);

	// Track emotion durations (in seconds)
	const fatigueDurationRef = useRef<number>(0);
	const engagementLowDurationRef = useRef<number>(0);
	const eyeStrainDurationRef = useRef<number>(0);
	const activeSessionRef = useRef<number>(0);

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
		// Generate mood summary before starting new conversation
		if (moodHistoryRef.current.length > 5) {
			const moodCounts: Record<string, number> = {};
			moodHistoryRef.current.forEach(m => {
				moodCounts[m.emotion] = (moodCounts[m.emotion] || 0) + 1;
			});

			const total = moodHistoryRef.current.length;
			const moods = Object.entries(moodCounts)
				.sort((a, b) => b[1] - a[1])
				.filter(([_, count]) => count / total > 0.2)
				.map(([mood]) => mood);

			if (moods.length > 0) {
				let summaryMessage = '';
				if (moods.includes('focused') && moods.includes('happy')) {
					summaryMessage = "You seemed focused and positive during our chat! Great energy! 🎯";
				} else if (moods.includes('stressed')) {
					summaryMessage = "You seemed a bit stressed. Remember to take breaks when needed! 💙";
				} else if (moods.includes('fatigued')) {
					summaryMessage = "You seemed tired. Make sure to rest when you can! 😴";
				} else if (moods.includes('happy')) {
					summaryMessage = "You seemed happy! It was great chatting with you! 😊";
				} else if (moods.includes('disengaged')) {
					summaryMessage = "You seemed distracted. Hope everything's okay! 🤔";
				} else if (moods.includes('focused')) {
					summaryMessage = "You seemed focused! Great work! 🎯";
				}

				if (summaryMessage) {
					setConversationSummary({ message: summaryMessage, moods });
				}
			}

			// Clear mood history for new conversation
			moodHistoryRef.current = [];
		}

		// Save current conversation if it has messages
		if (messages.length > 0) {
			const title = getConversationTitle(messages);

			if (currentConversationId) {
				setConversations((prev) => {
					const exists = prev.some((conv) => conv.id === currentConversationId);
					if (exists) {
						return prev.map((conv) =>
							conv.id === currentConversationId
								? { ...conv, messages: [...messages], updatedAt: new Date() }
								: conv
						);
					} else {
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

		// Start fresh
		setMessages([]);
		setInputMessage('');
		setTps(null);
		setPlayingMessageIndex(null);
		setEmotion(null);
		setCurrentConversationId(null);
		isFirstMessageRef.current = true;

		// Stop any audio playback
		audioQueueManager.stop();
		ttsPlayer.stop();
		voiceMessageManager.reset();
	}, [messages, currentConversationId, audioQueueManager, ttsPlayer, voiceMessageManager]);

	const handleSwitchConversation = useCallback(
		(conversationId: string) => {
			// Stop any audio playback
			audioQueueManager.stop();
			ttsPlayer.stop();
			voiceMessageManager.reset();

			// Save current conversation if it has messages
			if (messages.length > 0 && currentConversationId !== conversationId) {
				const title = getConversationTitle(messages);

				if (currentConversationId) {
					setConversations((prev) => {
						const exists = prev.some((conv) => conv.id === currentConversationId);
						if (exists) {
							return prev.map((conv) =>
								conv.id === currentConversationId
									? { ...conv, messages: [...messages], updatedAt: new Date() }
									: conv
							);
						} else {
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
		[conversations, messages, currentConversationId, audioQueueManager, ttsPlayer, voiceMessageManager]
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
				audioQueueManager.stop();
				ttsPlayer.stop();
			}
		},
		[currentConversationId, audioQueueManager, ttsPlayer]
	);

	// Toggle camera UI on/off (camera keeps running in background)
	const toggleCamera = useCallback(() => {
		if (!cameraEnabled) {
			// First time - show privacy modal
			setShowPrivacyModal(true);
		} else if (!cameraUIVisible) {
			// Camera enabled but UI hidden - show UI
			setCameraUIVisible(true);
		} else {
			// Camera enabled and UI visible - toggle between Eyes and Camera view
			setDisplayMode(displayMode === 'eyes' ? 'camera' : 'eyes');
		}
	}, [cameraEnabled, cameraUIVisible, displayMode]);

	const handleCameraConfirm = useCallback(() => {
		setShowPrivacyModal(false);
		setCameraEnabled(true);
		setCameraUIVisible(true);
		setIsCameraFullscreen(true);
	}, []);

	const handleCameraCancel = useCallback(() => {
		setShowPrivacyModal(false);
	}, []);

	const toggleVoiceMode = useCallback(() => {
		setVoiceModeEnabled((prev) => {
			const newValue = !prev;
			if (!newValue) {
				// Turning off voice mode - stop recording and clear flag
				shouldAutoRestartRef.current = false;
				if (voiceRecorderRef.current && isVoiceRecording) {
					voiceRecorderRef.current.stop();
				}
			}
			return newValue;
		});
	}, [isVoiceRecording]);

	const toggleCameraFullscreen = useCallback(() => {
		setIsCameraFullscreen((prev) => !prev);
	}, []);

	const closeCamera = useCallback(() => {
		// Hide camera UI but keep camera running in background for mental monitoring
		// Reset display mode to eyes for next time
		setCameraUIVisible(false);
		setDisplayMode('eyes');
	}, []);

	// Actually disable camera completely
	const disableCamera = useCallback(() => {
		setCameraEnabled(false);
		setCameraUIVisible(false);
		setDisplayMode('eyes');
	}, []);

	// Simplified TTS playback using the new player
	const playTtsAudio = useCallback(
		async (messageIndex: number) => {
			const message = messages[messageIndex];
			if (!message?.audioData || message.audioData.length === 0) {
				console.log('No audio data to play at index:', messageIndex);
				return;
			}

			if (ttsPlayer.isPlaying(messageIndex)) {
				console.log('Already playing this message');
				return;
			}

			setPlayingMessageIndex(messageIndex);
			setAudioLoading(true);

			try {
				await ttsPlayer.play(messageIndex, message.audioData);
			} catch (error) {
				console.error('Error playing audio:', error);
			} finally {
				setPlayingMessageIndex(null);
				setAudioLoading(false);
			}
		},
		[messages, ttsPlayer]
	);
	const shouldAutoRestartRef = useRef<boolean>(false);

	// Simplified voice message handler using managers
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

			// Start tracking this voice message
			const airaMessageIndex = voiceMessageManager.startMessage(messages.length);

			setMessages((prevMessages) => [...prevMessages, userMessage]);
			setLoading(true);
			setTps(null);

			// Create Aira message placeholder
			setMessages((prevMessages) => {
				const airaMessage: Message = { sender: 'aira', text: '', audioData: [] };
				return [...prevMessages, airaMessage];
			});

			console.log('📤 Sending voice message:', text);

			await sendChatMessage(text, {
				onToken: (token) => {
					setMessages((prevMessages) => {
						if (prevMessages.length === 0) return prevMessages;
						const lastMessage = prevMessages[prevMessages.length - 1];
						if (lastMessage.sender !== 'aira') return prevMessages;
						return [...prevMessages.slice(0, -1), { ...lastMessage, text: lastMessage.text + token }];
					});
				},
				onTps: (tpsValue) => {
					setTps(tpsValue);
					setMessages((prevMessages) => {
						if (prevMessages.length === 0) return prevMessages;
						const lastMessage = prevMessages[prevMessages.length - 1];
						return [...prevMessages.slice(0, -1), { ...lastMessage, tps: tpsValue }];
					});
				},
				onAudio: (audioBase64) => {
					// Use manager to handle audio chunk
					voiceMessageManager.handleAudioChunk(audioBase64, airaMessageIndex);

					// Store in message data
					setMessages((prevMessages) => {
						if (prevMessages.length === 0) return prevMessages;
						const lastMessage = prevMessages[prevMessages.length - 1];
						if (lastMessage.sender === 'aira') {
							return [
								...prevMessages.slice(0, -1),
								{ ...lastMessage, audioData: [...(lastMessage.audioData || []), audioBase64] }
							];
						}
						return prevMessages;
					});
				},
				onError: (error) => {
					setMessages((prevMessages) => {
						if (prevMessages.length === 0) return prevMessages;
						const lastMessage = prevMessages[prevMessages.length - 1];
						return [...prevMessages.slice(0, -1), { ...lastMessage, text: lastMessage.text + `\n\nError: ${error}` }];
					});
				},
				onComplete: () => {
					console.log('✅ Voice message complete');
					setLoading(false);
					voiceMessageManager.completeMessage();

					// Wait for audio to finish playing
					const checkAudioComplete = () => {
						if (audioQueueManager.getQueueSize() === 0 && !audioQueueManager.getIsPlaying()) {
							console.log('🔊 Audio complete, restarting recording');
							if (voiceModeEnabled && cameraEnabled && shouldAutoRestartRef.current) {
								setTimeout(() => startVoiceRecording(), 500);
							}
						} else {
							console.log('⏳ Waiting for audio... Queue:', audioQueueManager.getQueueSize());
							setTimeout(checkAudioComplete, 500);
						}
					};
					setTimeout(checkAudioComplete, 100);
				},
			}).catch((err) => {
				console.error('❌ Failed to send voice message:', err);
				setLoading(false);
				voiceMessageManager.reset();
			});
		},
		[currentConversationId, messages.length, voiceMessageManager]
	);

	// Voice recording for Live mode - simplified
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

				try {
					console.log('🎤 Voice recording completed, transcribing...');
					const result = await transcribeAudio(audioBlob);
					console.log('📝 Transcription:', result.text);

					if (result.text.trim()) {
						await handleVoiceMessage(result.text);
					}
				} catch (error) {
					console.error('❌ Error transcribing voice:', error);
				} finally {
					stream.getTracks().forEach((track) => track.stop());
					setIsVoiceRecording(false);

				}
			};

			voiceRecorderRef.current.start();
			setIsVoiceRecording(true);
		} catch (err) {
			console.error('❌ Error accessing microphone:', err);
			alert('Please allow microphone access for voice mode.');
		}
	}, [cameraEnabled, voiceModeEnabled, handleVoiceMessage]);

	const stopVoiceRecording = useCallback(() => {
		shouldAutoRestartRef.current = false; // Disable auto-restart
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

	const lastMoodContextRef = useRef<string>('');

	const handleSendMessage = useCallback(() => {
		if (inputMessage.trim() && !loading) {
			const userMessage: Message = { sender: 'user', text: inputMessage };
			let messageToSend = inputMessage;

			// Create conversation ID if this is the first message
			const isNewConversation = isFirstMessageRef.current && !currentConversationId;
			if (isNewConversation) {
				const newConvId = generateId();
				setCurrentConversationId(newConvId);
				isFirstMessageRef.current = false;

				// Add mood context to first message if camera is enabled and we have emotion data
				if (cameraEnabled && _emotionalState) {
					const state = _emotionalState;
					let moodContext = '';

					if (state.fatigue > 0.7) {
						moodContext = '[User seems fatigued - be concise and supportive] ';
					} else if (state.stress > 0.6) {
						moodContext = '[User seems stressed - be calm and reassuring] ';
					} else if (state.engagement > 0.7) {
						moodContext = '[User seems focused and engaged] ';
					} else if (state.engagement < 0.3) {
						moodContext = '[User seems disengaged - try to re-engage them] ';
					} else if (state.positive_affect > 0.6) {
						moodContext = '[User seems happy - match their positive energy] ';
					}

					if (moodContext) {
						messageToSend = moodContext + messageToSend;
						lastMoodContextRef.current = moodContext;
					}
				}
			}

			setMessages((prevMessages) => [...prevMessages, userMessage]);
			setInputMessage('');
			setLoading(true);
			setTps(null);

			// Create Aira message placeholder
			const airaMessage: Message = { sender: 'aira', text: '', audioData: [] };
			setMessages((prevMessages) => [...prevMessages, airaMessage]);

			sendChatMessage(messageToSend, {
				onToken: (token) => {
					setMessages((prevMessages) => {
						if (prevMessages.length === 0) return prevMessages;
						const lastMessage = prevMessages[prevMessages.length - 1];
						if (!lastMessage) return prevMessages;
						return [...prevMessages.slice(0, -1), { ...lastMessage, text: lastMessage.text + token }];
					});
				},
				onTps: (tpsValue) => {
					setTps(tpsValue);
					setMessages((prevMessages) => {
						if (prevMessages.length === 0 || !prevMessages[prevMessages.length - 1]) return prevMessages;
						const lastMessage = prevMessages[prevMessages.length - 1];
						return [...prevMessages.slice(0, -1), { ...lastMessage, tps: tpsValue }];
					});
				},
				onAudio: (audioBase64) => {
					setMessages((prevMessages) => {
						if (prevMessages.length === 0 || !prevMessages[prevMessages.length - 1]) return prevMessages;
						const lastMessage = prevMessages[prevMessages.length - 1];
						if (lastMessage.sender === 'aira') {
							return [
								...prevMessages.slice(0, -1),
								{ ...lastMessage, audioData: [...(lastMessage.audioData || []), audioBase64] }
							];
						}
						return prevMessages;
					});
				},
				onError: (error) => {
					setMessages((prevMessages) => {
						if (prevMessages.length === 0 || !prevMessages[prevMessages.length - 1]) return prevMessages;
						const lastMessage = prevMessages[prevMessages.length - 1];
						return [...prevMessages.slice(0, -1), { ...lastMessage, text: lastMessage.text + `\n\nError: ${error}` }];
					});
				},
				onComplete: () => {
					console.log('✅ Chat message complete');
					setLoading(false);
				},
			}).catch((err) => {
				console.error('❌ Failed to send message:', err);
				setLoading(false);
			});
		}
	}, [inputMessage, loading, currentConversationId, cameraEnabled, _emotionalState]);

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
					// Emotion analysis removed - placeholder if needed
					setEmotion('Feature disabled');
				} catch (error) {
					console.error('Error:', error);
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
			// Cleanup audio managers
			audioQueueManager.stop();
			ttsPlayer.stop();
		};
	}, [audioQueueManager, ttsPlayer]);

	// Sync current messages to conversations
	useEffect(() => {
		if (currentConversationId && messages.length > 0) {
			setConversations((prev) => {
				const exists = prev.some((conv) => conv.id === currentConversationId);

				if (exists) {
					return prev.map((conv) => {
						if (conv.id === currentConversationId) {
							return {
								...conv,
								messages: messages,
								updatedAt: new Date(),
							};
						}
						return conv;
					});
				} else {
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

	// Save conversations to localStorage
	useEffect(() => {
		saveConversations(conversations);
	}, [conversations]);

	// Poll for backend alerts (every 2 seconds)
	const handleSendMessageRef = useRef(handleSendMessage);
	handleSendMessageRef.current = handleSendMessage;
	const inputMessageRef = useRef(inputMessage);
	inputMessageRef.current = inputMessage;
	const setInputMessageRef = useRef(setInputMessage);
	setInputMessageRef.current = setInputMessage;

	useEffect(() => {
		const checkAlert = async () => {
			const result = await pollAlerts();
			if (result.has_alert && result.message) {
				// Show alert toast (don't add to chat)
				setMentalAlert({ type: 'backend', message: result.message });
				
				// Play audio directly - never inject as user message
				if (result.audio_base64) {
					console.log('🔊 Playing alert audio directly');
					try {
						await ttsPlayer.play(-1, [result.audio_base64]);
					} catch (e) {
						console.error('Failed to play alert audio:', e);
					}
				} else {
					// No audio - still don't inject as user message
					console.log('ℹ️ No audio for alert, showing toast only');
				}
			}
		};

		const interval = setInterval(checkAlert, 2000);
		return () => clearInterval(interval);
	}, []);

	// Throttle camera feature updates
	const lastCameraUpdateRef = useRef<number>(0);
	const lastMentalCheckRef = useRef<number>(0);

	const handleCameraFeatures = useCallback(async (features: CameraFeatures) => {
		setCameraFeatures(features);

		const now = Date.now();
		if (now - lastCameraUpdateRef.current < 1000) {
			return;
		}
		lastCameraUpdateRef.current = now;

		// Track active session time (only when face is present)
		activeSessionRef.current += 1;

		if (features.face_present) {
			try {
				const state = await sendCameraFeatures(features);
				setEmotionalState(state);

				// Determine dominant emotion from state
				let dominantEmotion = 'neutral';
				if (state.fatigue > 0.7) {
					dominantEmotion = 'fatigued';
				} else if (state.stress > 0.6) {
					dominantEmotion = 'stressed';
				} else if (state.positive_affect > 0.6) {
					dominantEmotion = 'happy';
				} else if (state.engagement > 0.7) {
					dominantEmotion = 'focused';
				} else if (state.engagement < 0.3) {
					dominantEmotion = 'disengaged';
				}
				setEmotion(dominantEmotion);

				// Track mood during conversation (every 10 seconds)
				if (currentConversationId && now % 10000 < 1000) {
					moodHistoryRef.current.push({ emotion: dominantEmotion, timestamp: now });
					// Keep only last 30 minutes of history
					moodHistoryRef.current = moodHistoryRef.current.filter(m => now - m.timestamp < 1800000);
				}

				// Mental health monitoring - check every second
				if (now - lastMentalCheckRef.current >= 1000) {
					lastMentalCheckRef.current = now;

					// Fatigue tracking: trigger after 5 min (300 seconds)
					if (state.fatigue > 0.7) {
						fatigueDurationRef.current += 1;
						if (fatigueDurationRef.current >= 300) {
							setMentalAlert({
								type: 'fatigue',
								message: '😴 You look tired. Take a 5-min break?',
							});
							fatigueDurationRef.current = 0;
						}
					} else {
						fatigueDurationRef.current = 0;
					}

					// Low engagement tracking: trigger after 3 min (180 seconds)
					if (state.engagement < 0.3) {
						engagementLowDurationRef.current += 1;
						if (engagementLowDurationRef.current >= 180) {
							setMentalAlert({
								type: 'disengaged',
								message: '🎯 You seem distracted. Need help focusing?',
							});
							engagementLowDurationRef.current = 0;
						}
					} else {
						engagementLowDurationRef.current = 0;
					}

					// Eye strain tracking: low blink rate for 2 min (120 seconds)
					const blinkRate = features.blink_rate || 0;
					if (blinkRate < 5 && blinkRate > 0) {
						eyeStrainDurationRef.current += 1;
						if (eyeStrainDurationRef.current >= 120) {
							setMentalAlert({
								type: 'eye_strain',
								message: '👁️ Low blink rate detected. Eye strain risk - blink more!',
							});
							eyeStrainDurationRef.current = 0;
						}
					} else {
						eyeStrainDurationRef.current = 0;
					}

					// Active session tracking: trigger after 45 min (2700 seconds)
					if (activeSessionRef.current >= 2700) {
						setMentalAlert({
							type: 'break',
							message: '⏰ You\'ve been active for 45 min. Take a stretch break?',
						});
						activeSessionRef.current = 0;
					}

					// Proactive voice prompts - in voice mode, give suggestions faster
					if (voiceModeEnabled && cameraEnabled) {
						// Stress in voice mode: after 30 seconds suggest breathing
						if (state.stress > 0.6) {
							if (!mentalAlert || mentalAlert.type !== 'voice_stress') {
								setMentalAlert({
									type: 'voice_stress',
									message: '😰 You seem like you\'ve been through a lot. Take a deep breath...',
								});
							}
						}
						// Fatigue in voice mode: after 60 seconds suggest break
						if (state.fatigue > 0.7) {
							if (!mentalAlert || mentalAlert.type !== 'voice_fatigue') {
								setMentalAlert({
									type: 'voice_fatigue',
									message: '😴 You look tired. Maybe take a short break?',
								});
							}
						}
					}

					// Browser notifications for important alerts (with permission)
					if (notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
						// Send notification for long sessions (every 30 min)
						if (activeSessionRef.current > 0 && activeSessionRef.current % 1800 === 0 && activeSessionRef.current <= 3600) {
							new Notification('Aira - Time Check', {
								body: 'You\'ve been active for a while. Take a break?',
								icon: '/favicon.ico',
							});
						}
					}
				}
			} catch (error) {
				console.error('Error sending camera features:', error);
			}
		}
	}, []);

	if (viewState === 'landing') {
		return <Landing darkMode={darkMode} onStartChat={handleStartChat} />;
	}

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
								onClick={() => {
									if (!notificationsEnabled && 'Notification' in window) {
										Notification.requestPermission().then((permission) => {
											if (permission === 'granted') {
												setNotificationsEnabled(true);
											}
										});
									} else {
										setNotificationsEnabled(!notificationsEnabled);
									}
								}}
								className="btn btn-sm d-flex align-items-center gap-2"
								style={{
									background: notificationsEnabled
										? darkMode ? 'rgba(40, 167, 69, 0.2)' : 'rgba(40, 167, 69, 0.1)'
										: darkMode ? 'rgba(74, 95, 127, 0.2)' : 'rgba(74, 95, 127, 0.1)',
									color: notificationsEnabled ? '#28a745' : darkMode ? '#A8B5C4' : '#4A5F7F',
									border: `1px solid ${notificationsEnabled ? '#28a745' : darkMode ? 'rgba(74, 95, 127, 0.3)' : 'rgba(74, 95, 127, 0.15)'}`,
									borderRadius: '20px',
									padding: '6px 12px',
									fontSize: '0.85rem',
								}}
							>
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
									<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path>
									<path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path>
								</svg>
								{notificationsEnabled ? '🔔 On' : '🔕 Off'}
							</button>
							<button
								onClick={disableCamera}
								className="btn btn-sm d-flex align-items-center gap-2"
								style={{
									background: cameraEnabled
										? darkMode ? 'rgba(220, 53, 69, 0.2)' : 'rgba(220, 53, 69, 0.1)'
										: darkMode ? 'rgba(74, 95, 127, 0.2)' : 'rgba(74, 95, 127, 0.1)',
									color: cameraEnabled ? '#dc3545' : darkMode ? '#A8B5C4' : '#4A5F7F',
									border: `1px solid ${cameraEnabled ? '#dc3545' : darkMode ? 'rgba(74, 95, 127, 0.3)' : 'rgba(74, 95, 127, 0.15)'}`,
									borderRadius: '20px',
									padding: '6px 12px',
									fontSize: '0.85rem',
								}}
								title="Disable camera completely"
							>
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
									<path d="M1 1l22 22"></path>
									<path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34m-7.72-2.06a4 4 0 1 1-5.56-5.56"></path>
								</svg>
								{cameraEnabled ? '📷 On' : '📷 Off'}
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
					displayMode={displayMode}
					onToggleCamera={toggleCamera}
					onToggleDisplayMode={() => setDisplayMode(displayMode === 'eyes' ? 'camera' : 'eyes')}
				/>
			</div>
			<PrivacyModal
				isOpen={showPrivacyModal}
				onConfirm={handleCameraConfirm}
				onCancel={handleCameraCancel}
				darkMode={darkMode}
			/>

			{/* Mental Health Alert */}
			{mentalAlert && (
				<div
					className="position-fixed d-flex align-items-center justify-content-between p-3"
					style={{
						top: '80px',
						right: '20px',
						maxWidth: '320px',
						background: darkMode ? 'rgba(255, 193, 7, 0.95)' : '#fff',
						borderRadius: '12px',
						boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
						zIndex: 1005,
						border: `1px solid ${darkMode ? 'rgba(255, 193, 7, 0.3)' : '#ffc107'}`,
					}}
				>
					<div className="me-2">
						<p className="mb-0" style={{ color: darkMode ? '#1a1d23' : '#2C3A4F', fontSize: '0.9rem', fontWeight: 500 }}>
							{mentalAlert.message}
						</p>
					</div>
					<button
						onClick={() => setMentalAlert(null)}
						className="btn btn-sm d-flex align-items-center justify-content-center"
						style={{
							background: 'transparent',
							border: 'none',
							color: darkMode ? '#1a1d23' : '#6B7B94',
							padding: '4px',
							minWidth: 'auto',
						}}
					>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
							<line x1="18" y1="6" x2="6" y2="18"></line>
							<line x1="6" y1="6" x2="18" y2="18"></line>
						</svg>
					</button>
				</div>
			)}

			{/* Conversation Summary */}
			{conversationSummary && (
				<div
					className="position-fixed d-flex align-items-center justify-content-between p-3"
					style={{
						top: '80px',
						left: '50%',
						transform: 'translateX(-50%)',
						maxWidth: '400px',
						background: darkMode ? 'rgba(40, 167, 69, 0.95)' : '#fff',
						borderRadius: '12px',
						boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
						zIndex: 1005,
						border: `1px solid ${darkMode ? 'rgba(40, 167, 69, 0.3)' : '#28a745'}`,
					}}
				>
					<div className="me-2">
						<p className="mb-1" style={{ color: darkMode ? '#1a1d23' : '#2C3A4F', fontSize: '0.85rem', fontWeight: 600 }}>
							💬 Chat Summary
						</p>
						<p className="mb-0" style={{ color: darkMode ? '#1a1d23' : '#2C3A4F', fontSize: '0.9rem' }}>
							{conversationSummary.message}
						</p>
					</div>
					<button
						onClick={() => setConversationSummary(null)}
						className="btn btn-sm d-flex align-items-center justify-content-center"
						style={{
							background: 'transparent',
							border: 'none',
							color: darkMode ? '#1a1d23' : '#6B7B94',
							padding: '4px',
							minWidth: 'auto',
						}}
					>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
							<line x1="18" y1="6" x2="6" y2="18"></line>
							<line x1="6" y1="6" x2="18" y2="18"></line>
						</svg>
					</button>
				</div>
			)}

			{/* Mental State Widget Toggle Button - moved to bottom left */}
			{cameraEnabled && (
				<button
					onClick={() => setShowMoodWidget(!showMoodWidget)}
					className="position-fixed d-flex align-items-center justify-content-center"
					style={{
						bottom: '100px',
						left: '20px',
						width: '44px',
						height: '44px',
						borderRadius: '50%',
						background: darkMode ? 'rgba(74, 95, 127, 0.9)' : '#4A5F7F',
						border: 'none',
						boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
						zIndex: 1004,
						color: 'white',
					}}
					title="Mental State"
				>
					{emotion === 'happy' ? '😊' : emotion === 'focused' ? '🎯' : emotion === 'fatigued' ? '😴' : emotion === 'stressed' ? '😰' : emotion === 'disengaged' ? '😶' : '😐'}
				</button>
			)}

			{/* Mental State Widget Panel - moved to bottom left */}
			{showMoodWidget && cameraEnabled && _emotionalState && (
				<div
					className="position-fixed p-3"
					style={{
						bottom: '160px',
						left: '20px',
						width: '220px',
						background: darkMode ? '#2A2D35' : '#FFFFFF',
						borderRadius: '12px',
						boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
						zIndex: 1004,
						border: `1px solid ${darkMode ? '#3A3D45' : '#E8EAED'}`,
					}}
				>
					<div className="d-flex justify-content-between align-items-center mb-3">
						<h6 className="mb-0" style={{ color: darkMode ? '#F5F3F0' : '#2C3A4F' }}>Mental State</h6>
						<button
							onClick={() => setShowMoodWidget(false)}
							style={{ background: 'transparent', border: 'none', color: darkMode ? '#7A8BA3' : '#6B7B94', cursor: 'pointer' }}
						>
							✕
						</button>
					</div>
					<div className="d-flex flex-column gap-2">
						<div>
							<div className="d-flex justify-content-between mb-1">
								<span style={{ fontSize: '0.8rem', color: darkMode ? '#A8B5C4' : '#6B7B94' }}>Fatigue</span>
								<span style={{ fontSize: '0.8rem', color: darkMode ? '#F5F3F0' : '#2C3A4F' }}>{Math.round(_emotionalState.fatigue * 100)}%</span>
							</div>
							<div className="progress" style={{ height: '6px', background: darkMode ? '#1a1d23' : '#E8EAED' }}>
								<div className="progress-bar" style={{ width: `${_emotionalState.fatigue * 100}%`, background: _emotionalState.fatigue > 0.7 ? '#dc3545' : '#4A5F7F' }} />
							</div>
						</div>
						<div>
							<div className="d-flex justify-content-between mb-1">
								<span style={{ fontSize: '0.8rem', color: darkMode ? '#A8B5C4' : '#6B7B94' }}>Engagement</span>
								<span style={{ fontSize: '0.8rem', color: darkMode ? '#F5F3F0' : '#2C3A4F' }}>{Math.round(_emotionalState.engagement * 100)}%</span>
							</div>
							<div className="progress" style={{ height: '6px', background: darkMode ? '#1a1d23' : '#E8EAED' }}>
								<div className="progress-bar" style={{ width: `${_emotionalState.engagement * 100}%`, background: _emotionalState.engagement > 0.7 ? '#28a745' : _emotionalState.engagement < 0.3 ? '#dc3545' : '#ffc107' }} />
							</div>
						</div>
						<div>
							<div className="d-flex justify-content-between mb-1">
								<span style={{ fontSize: '0.8rem', color: darkMode ? '#A8B5C4' : '#6B7B94' }}>Stress</span>
								<span style={{ fontSize: '0.8rem', color: darkMode ? '#F5F3F0' : '#2C3A4F' }}>{Math.round(_emotionalState.stress * 100)}%</span>
							</div>
							<div className="progress" style={{ height: '6px', background: darkMode ? '#1a1d23' : '#E8EAED' }}>
								<div className="progress-bar" style={{ width: `${_emotionalState.stress * 100}%`, background: _emotionalState.stress > 0.6 ? '#dc3545' : '#4A5F7F' }} />
							</div>
						</div>
						<div>
							<div className="d-flex justify-content-between mb-1">
								<span style={{ fontSize: '0.8rem', color: darkMode ? '#A8B5C4' : '#6B7B94' }}>Positivity</span>
								<span style={{ fontSize: '0.8rem', color: darkMode ? '#F5F3F0' : '#2C3A4F' }}>{Math.round(_emotionalState.positive_affect * 100)}%</span>
							</div>
							<div className="progress" style={{ height: '6px', background: darkMode ? '#1a1d23' : '#E8EAED' }}>
								<div className="progress-bar" style={{ width: `${_emotionalState.positive_affect * 100}%`, background: _emotionalState.positive_affect > 0.6 ? '#28a745' : '#4A5F7F' }} />
							</div>
						</div>
						<div className="mt-2 pt-2" style={{ borderTop: `1px solid ${darkMode ? '#3A3D45' : '#E8EAED'}` }}>
							<div className="d-flex justify-content-between">
								<span style={{ fontSize: '0.8rem', color: darkMode ? '#A8B5C4' : '#6B7B94' }}>Mood</span>
								<span style={{ fontSize: '0.85rem', fontWeight: 500, color: darkMode ? '#F5F3F0' : '#2C3A4F' }}>
									{emotion === 'happy' ? '😊 Happy' : emotion === 'focused' ? '🎯 Focused' : emotion === 'fatigued' ? '😴 Fatigued' : emotion === 'stressed' ? '😰 Stressed' : emotion === 'disengaged' ? '😶 Disengaged' : '😐 Neutral'}
								</span>
							</div>
						</div>
					</div>
				</div>
			)}

			{cameraEnabled && (
				<>
					{/* Show EyeVisualization when in eyes mode AND UI is visible */}
					{displayMode === 'eyes' && cameraUIVisible && (
						<EyeVisualization
							emotion={emotion}
							darkMode={darkMode}
							onClose={closeCamera}
							onToggleDisplayMode={() => setDisplayMode('camera')}
							isSpeaking={isSpeaking}
							isRecording={isRecording}
							isProcessing={loading}
							onVoiceStart={startVoiceRecording}
							onVoiceStop={stopVoiceRecording}
						/>
					)}

					{/* Show CameraSensor when in camera mode AND UI is visible */}
					{displayMode === 'camera' && cameraUIVisible && (
						<CameraSensor
							darkMode={darkMode}
							onClose={closeCamera}
							onToggleDisplayMode={() => setDisplayMode('eyes')}
							isSpeaking={isSpeaking}
							isRecording={isRecording}
							isProcessing={loading}
							onVoiceStart={startVoiceRecording}
							onVoiceStop={stopVoiceRecording}
							onFeaturesUpdate={handleCameraFeatures}
							isFullscreen={isCameraFullscreen}
							showUI={true}
						/>
					)}

					{/* Background monitor - ALWAYS runs when camera is enabled, even when UI is hidden */}
					<CameraSensor
						darkMode={darkMode}
						onClose={closeCamera}
						onToggleDisplayMode={() => setDisplayMode('camera')}
						isSpeaking={isSpeaking}
						isRecording={isRecording}
						isProcessing={loading}
						onVoiceStart={startVoiceRecording}
						onVoiceStop={stopVoiceRecording}
						onFeaturesUpdate={handleCameraFeatures}
						isFullscreen={false}
						showUI={false}
					/>
				</>
			)}
		</div>
	);
}

export default App;
