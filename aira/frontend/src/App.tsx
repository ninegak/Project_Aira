import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import Sidebar from './components/Sidebar';
import Chat from './components/Chat';
import Landing from './components/Landing';
import './App.css';

interface Message {
	sender: 'user' | 'aira';
	text: string;
	tps?: string;
	audioData?: string[];
}

interface Conversation {
	id: string;
	title: string;
	messages: Message[];
	createdAt: Date;
	updatedAt: Date;
}

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
	const [conversations, setConversations] = useState<Conversation[]>(() => {
		try {
			const saved = localStorage.getItem('aira_conversations');
			if (saved) {
				const parsed: Array<{ id: string; title: string; messages: Message[]; createdAt: string; updatedAt: string }> = JSON.parse(saved);
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
	});
	const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
	const isFirstMessageRef = useRef<boolean>(true);

	const [darkMode, setDarkMode] = useState<boolean>(() => {
		const saved = localStorage.getItem('darkMode');
		return saved !== null ? JSON.parse(saved) : true;
	});

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
		const firstUserMsg = msgs.find(m => m.sender === 'user');
		if (firstUserMsg) {
			return firstUserMsg.text.length > 30 
				? firstUserMsg.text.substring(0, 30) + '...' 
				: firstUserMsg.text;
		}
		return 'New Conversation';
	};

	const handleNewConversation = useCallback(() => {
		console.log('Creating new conversation. Current messages:', messages.length, 'Current ID:', currentConversationId);

		// Save current conversation if it has messages
		if (messages.length > 0) {
			const title = getConversationTitle(messages);
			console.log('Saving conversation with title:', title);

			if (currentConversationId) {
				// Check if conversation already exists in array
				setConversations(prev => {
					const exists = prev.some(conv => conv.id === currentConversationId);
					if (exists) {
						// Update existing
						const updated = prev.map(conv =>
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
							updatedAt: new Date()
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
					updatedAt: new Date()
				};
				setConversations(prev => {
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

	const handleSwitchConversation = useCallback((conversationId: string) => {
		// Save current conversation if it has messages
		if (messages.length > 0 && currentConversationId !== conversationId) {
			const title = getConversationTitle(messages);

			if (currentConversationId) {
				// Check if conversation already exists
				setConversations(prev => {
					const exists = prev.some(conv => conv.id === currentConversationId);
					if (exists) {
						return prev.map(conv =>
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
							updatedAt: new Date()
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
					updatedAt: new Date()
				};
				setConversations(prev => [newConv, ...prev]);
			}
		}

		// Load selected conversation
		const conversation = conversations.find(c => c.id === conversationId);
		if (conversation) {
			setMessages([...conversation.messages]);
			setCurrentConversationId(conversationId);
			setInputMessage('');
			setTps(null);
			setPlayingMessageIndex(null);
			setEmotion(null);
			isFirstMessageRef.current = false;
		}
	}, [conversations, messages, currentConversationId]);

	const handleDeleteConversation = useCallback((conversationId: string) => {
		setConversations(prev => prev.filter(c => c.id !== conversationId));
		
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
	}, [currentConversationId]);

	const toggleMode = useCallback(() => {
		setDarkMode(prev => {
			const newMode = !prev;
			localStorage.setItem('darkMode', JSON.stringify(newMode));
			return newMode;
		});
	}, []);

	const playTtsAudio = useCallback(async (messageIndex: number) => {
		const message = messages[messageIndex];
		if (!message?.audioData || message.audioData.length === 0 || playingMessageIndex !== null) return;

		setPlayingMessageIndex(messageIndex);
		setAudioLoading(true);

		try {
			for (const base64 of message.audioData) {
				await new Promise<void>((resolve, reject) => {
					const audio = new Audio('data:audio/wav;base64,' + base64);
					audio.onended = () => resolve();
					audio.onerror = () => reject(new Error('Audio playback failed'));
					audio.play().catch(reject);
				});
			}
		} catch (error) {
			console.error('Error playing audio:', error);
		} finally {
			setPlayingMessageIndex(null);
			setAudioLoading(false);
		}
	}, [messages, playingMessageIndex]);

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
			fetchEventSource('http://127.0.0.1:3000/chat', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ message: messageToSend }),
				onopen() {
					console.log('Connection opened');
				},
				onmessage(event) {
					console.log('Received event:', event.event, 'data:', event.data?.substring(0, 50));
					if (event.event === 'tps') {
						const tpsValue = parseFloat(event.data).toFixed(2);
						setTps(tpsValue);

						// Update the last message with TPS
						setMessages((prevMessages) => {
							const lastMessage = prevMessages[prevMessages.length - 1];
							const updatedLastMessage: Message = {
								...lastMessage,
								tps: tpsValue
							};
							return [...prevMessages.slice(0, -1), updatedLastMessage];
						});
					} else if (event.event === 'error') {
						setMessages((prevMessages) => {
							const lastMessage = prevMessages[prevMessages.length - 1];
							const updatedText = lastMessage.text + `\n\nError: ${event.data}`;
							const updatedLastMessage: Message = { ...lastMessage, text: updatedText };
							return [...prevMessages.slice(0, -1), updatedLastMessage];
						});
					} else if (event.event === 'audio_complete') {
						// Add audio to the last Aira message
						setMessages((prevMessages) => {
							const lastMessage = prevMessages[prevMessages.length - 1];
							if (lastMessage.sender === 'aira') {
								const updatedLastMessage: Message = {
									...lastMessage,
									audioData: [...(lastMessage.audioData || []), event.data]
								};
								return [...prevMessages.slice(0, -1), updatedLastMessage];
							}
							return prevMessages;
						});
					} else if (event.event === 'tts_error' || event.event === 'audio_error') {
						console.error('Error from server:', event.data);
					} else {
						// Update message text
						setMessages((prevMessages) => {
							const lastMessage = prevMessages[prevMessages.length - 1];
							const updatedLastMessage: Message = {
								...lastMessage,
								text: lastMessage.text + event.data
							};
							return [...prevMessages.slice(0, -1), updatedLastMessage];
						});
					}
				},
				onclose() {
					console.log('Connection closed');
					setLoading(false);
				},
				onerror(err) {
					console.error('EventSource failed:', err);
					setMessages((prevMessages) => {
						const lastMessage = prevMessages[prevMessages.length - 1];
						const updatedLastMessage: Message = {
							...lastMessage,
							text: lastMessage.text || 'Error: Could not connect to Aira.'
						};
						return [...prevMessages.slice(0, -1), updatedLastMessage];
					});
					setLoading(false);
					throw err;
				},
			});
		}
	}, [inputMessage, loading, currentConversationId]);

	const startRecording = useCallback(async () => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			mediaRecorder.current = new MediaRecorder(stream, {
				mimeType: 'audio/webm;codecs=opus'
			});
			audioChunks.current = [];

			mediaRecorder.current.ondataavailable = (event) => {
				if (event.data.size > 0) {
					audioChunks.current.push(event.data);
				}
			};

			mediaRecorder.current.onstop = async () => {
				const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
				const formData = new FormData();
				formData.append('audio', audioBlob, 'recording.webm');

				setAudioLoading(true);

				try {
					const response = await fetch('http://127.0.0.1:3000/api/emotion', {
						method: 'POST',
						body: formData,
					});

					if (response.ok) {
						const result = await response.json();
						setEmotion(result.dominant_emotion);
					} else {
						console.error('Failed to analyze emotion:', response.statusText);
						setEmotion('Error: Could not analyze emotion');
					}
				} catch (error) {
					console.error('Error sending audio for emotion analysis:', error);
					setEmotion('Error: API call failed');
				} finally {
					setAudioLoading(false);
					stream.getTracks().forEach(track => track.stop());
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

	// Save conversations to localStorage whenever they change
	useEffect(() => {
		try {
			localStorage.setItem('aira_conversations', JSON.stringify(conversations));
		} catch (e) {
			console.error('Error saving conversations:', e);
		}
	}, [conversations]);

	if (viewState === 'landing') {
		return (
			<Landing 
				darkMode={darkMode} 
				onStartChat={handleStartChat}
			/>
		);
	}

	console.log('Rendering with conversations:', conversations.length, 'Current ID:', currentConversationId);
	
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
			<div className="flex-grow-1 d-flex flex-column">
			<div className="p-2 text-end" style={{ background: darkMode ? '#1a1d23' : '#F8F9FA' }}>
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
						fontSize: '0.85rem'
					}}
				>
					{darkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
				</button>
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
				/>
			</div>
		</div>
	);
}

export default App;
