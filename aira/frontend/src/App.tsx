import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import Sidebar from './components/Sidebar';
import Chat from './components/Chat';
import './App.css';

interface Message {
	sender: 'user' | 'aira';
	text: string;
	tps?: string; // ✅ Add TPS to message
}

function App() {
	const [messages, setMessages] = useState<Message[]>([]);
	const [inputMessage, setInputMessage] = useState<string>('');
	const [loading, setLoading] = useState<boolean>(false);
	const [tps, setTps] = useState<string | null>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null!);
	const [audioLoading, setAudioLoading] = useState<boolean>(false);

	const [ttsAudioQueue, setTtsAudioQueue] = useState<string[]>([]);
	const [isPlayingAudio, setIsPlayingAudio] = useState(false);

	const [isRecording, setIsRecording] = useState<boolean>(false);
	const [emotion, setEmotion] = useState<string | null>(null);
	const mediaRecorder = useRef<MediaRecorder | null>(null);
	const audioChunks = useRef<Blob[]>([]);

	const [darkMode, setDarkMode] = useState<boolean>(() => {
		const saved = localStorage.getItem('darkMode');
		return saved !== null ? JSON.parse(saved) : true;
	});

	const toggleMode = useCallback(() => {
		setDarkMode(prev => {
			const newMode = !prev;
			localStorage.setItem('darkMode', JSON.stringify(newMode));
			return newMode;
		});
	}, []);

	const playTtsAudio = useCallback(async () => {
		if (isPlayingAudio || ttsAudioQueue.length === 0) return;

		setIsPlayingAudio(true);
		setAudioLoading(true);

		try {
			for (const base64 of ttsAudioQueue) {
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
			setTtsAudioQueue([]);
			setIsPlayingAudio(false);
			setAudioLoading(false);
		}
	}, [isPlayingAudio, ttsAudioQueue]);

	const handleSendMessage = useCallback(() => {
		if (inputMessage.trim() && !loading) {
			const userMessage: Message = { sender: 'user', text: inputMessage };
			const messageToSend = inputMessage;

			setMessages((prevMessages) => [...prevMessages, userMessage]);
			setInputMessage('');
			setLoading(true);
			setTps(null);

			// ✅ Create Aira message without TPS initially
			const airaMessage: Message = { sender: 'aira', text: '' };
			setMessages((prevMessages) => [...prevMessages, airaMessage]);

			fetchEventSource('http://127.0.0.1:3000/chat', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ message: messageToSend }),
				onmessage(event) {
					if (event.event === 'tps') {
						const tpsValue = parseFloat(event.data).toFixed(2);
						setTps(tpsValue);

						// ✅ Update the last message with TPS
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
						setTtsAudioQueue(prev => [...prev, event.data]);
					} else if (event.event === 'tts_error' || event.event === 'audio_error') {
						console.error('Error from server:', event.data);
					} else {
						// ✅ Update message text
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
	}, [inputMessage, loading]);

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

	return (
		<div className="d-flex vh-100">
			<Sidebar darkMode={darkMode} />
			<div className={`flex-grow-1 d-flex flex-column ${darkMode ? 'bg-dark' : 'bg-light'}`}>
				<div className="p-2 text-end">
					<button
						className={`btn btn-sm ${darkMode ? 'btn-light' : 'btn-dark'}`}
						onClick={toggleMode}
						aria-label={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
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
					hasAudio={ttsAudioQueue.length > 0}
				/>
			</div>
		</div>
	);
}

export default App;
