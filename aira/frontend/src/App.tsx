import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { sendChatMessage, transcribeAudio, sendCameraFeatures } from './api/chatAPI';
import { saveConversations, loadConversations, saveDarkMode, loadDarkMode } from './api/storageAPI';
import type { Message, Conversation } from './types/chat';
import type { CameraFeatures, EmotionalState } from './api/chatAPI';
import { AudioQueueManager, VoiceMessageManager, TtsAudioPlayer } from './utils/audiomanager';
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
	const voiceRecorderRef = useRef<MediaRecorder | null>(null);
	const voiceChunksRef = useRef<Blob[]>([]);

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

	// Toggle camera on/off with modal confirmation
	const toggleCamera = useCallback(() => {
		if (!cameraEnabled) {
			setShowPrivacyModal(true);
		} else {
			setCameraEnabled(false);
		}
	}, [cameraEnabled]);

	const handleCameraConfirm = useCallback(() => {
		setShowPrivacyModal(false);
		setCameraEnabled(true);
		setIsCameraFullscreen(true);
	}, []);

	const handleCameraCancel = useCallback(() => {
		setShowPrivacyModal(false);
	}, []);

	const toggleVoiceMode = useCallback(() => {
		setVoiceModeEnabled((prev) => !prev);
	}, []);

	const toggleCameraFullscreen = useCallback(() => {
		setIsCameraFullscreen((prev) => !prev);
	}, []);

	const closeCamera = useCallback(() => {
		setCameraEnabled(false);
		setIsCameraFullscreen(false);
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

					// Auto-restart recording in live mode if still enabled
					if (voiceModeEnabled && cameraEnabled) {
						console.log('🔄 Auto-restarting voice recording');
						setTimeout(() => {
							startVoiceRecording();
						}, 500);
					}
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

	// Throttle camera feature updates
	const lastCameraUpdateRef = useRef<number>(0);

	const handleCameraFeatures = useCallback(async (features: CameraFeatures) => {
		setCameraFeatures(features);

		const now = Date.now();
		if (now - lastCameraUpdateRef.current < 1000) {
			return;
		}
		lastCameraUpdateRef.current = now;

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
						<button
							onClick={toggleVoiceMode}
							className="btn btn-sm d-flex align-items-center gap-2"
							style={{
								background: voiceModeEnabled
									? darkMode ? 'rgba(255, 193, 7, 0.2)' : 'rgba(255, 193, 7, 0.1)'
									: darkMode ? 'rgba(74, 95, 127, 0.2)' : 'rgba(74, 95, 127, 0.1)',
								color: voiceModeEnabled ? '#ffc107' : darkMode ? '#A8B5C4' : '#4A5F7F',
								border: `1px solid ${voiceModeEnabled ? '#ffc107' : darkMode ? 'rgba(74, 95, 127, 0.3)' : 'rgba(74, 95, 127, 0.15)'}`,
								borderRadius: '20px',
								padding: '6px 12px',
								fontSize: '0.85rem',
							}}
						>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
								<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
								<path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
								<line x1="12" y1="19" x2="12" y2="22"></line>
							</svg>
							{voiceModeEnabled ? 'Live On' : 'Live Off'}
						</button>
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
					isSpeaking={isSpeaking}
				/>
			)}
		</div>
	);
}

export default App;
