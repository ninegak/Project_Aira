import React, { useState, useEffect, useRef } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import Sidebar from './components/Sidebar';
import Chat from './components/Chat';
import './App.css';

interface Message {
	sender: 'user' | 'aira';
	text: string;
}

function App() {
	const [messages, setMessages] = useState<Message[]>([]);
	const [inputMessage, setInputMessage] = useState<string>('');
	const [loading, setLoading] = useState<boolean>(false);
	const [tps, setTps] = useState<string | null>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const [audioLoading, setAudioLoading] = useState<boolean>(false);

	// Emotion detection states
	const [isRecording, setIsRecording] = useState<boolean>(false);
	const [emotion, setEmotion] = useState<string | null>(null);
	const mediaRecorder = useRef<MediaRecorder | null>(null);
	const audioChunks = useRef<Blob[]>([]);
	//
	const handleSendMessage = () => {
		if (inputMessage.trim() && !loading) {
			const userMessage: Message = { sender: 'user', text: inputMessage };
			setMessages((prevMessages) => [...prevMessages, userMessage]);
			setInputMessage('');
			setLoading(true);
			setTps(null);

			const airaMessage: Message = { sender: 'aira', text: '' };
			setMessages((prevMessages) => [...prevMessages, airaMessage]);

			fetchEventSource('http://127.0.0.1:3000/chat', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ message: inputMessage }),
				onmessage(event) {
					if (event.event === 'tps') {
						setTps(parseFloat(event.data).toFixed(2));
					} else if (event.event === 'error') {
						setMessages((prevMessages) => {
							const lastMessage = prevMessages[prevMessages.length - 1];
							const updatedText = lastMessage.text + `\n\nError: ${event.data}`;
							const updatedLastMessage = { ...lastMessage, text: updatedText };
							return [...prevMessages.slice(0, -1), updatedLastMessage];
						});
					} else if (event.event === 'audio_complete') {
						const audio = new Audio('data:audio/wav;base64,' + event.data);
						audio.play();
					} else if (event.event === 'tts_error' || event.event === 'audio_error') {
						console.error('Error from server:', event.data);
					}
					else {
						setMessages((prevMessages) => {
							const lastMessage = prevMessages[prevMessages.length - 1];
							const updatedLastMessage = { ...lastMessage, text: lastMessage.text + event.data };
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
					const updatedLastMessage = { ...lastMessage, text: 'Error: Could not connect to Aira.' };
					return [...prevMessages.slice(0, -1), updatedLastMessage];
				});
				setLoading(false);
				throw err;
			},
		});
		}
	};

	const startRecording = async () => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			mediaRecorder.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
			audioChunks.current = [];

			mediaRecorder.current.ondataavailable = (event) => {
				audioChunks.current.push(event.data);
			};

			mediaRecorder.current.onstop = async () => {
				const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
				// For emotion detection, we need to convert webm to wav if the backend only accepts wav.
				// For simplicity, let's assume the backend can handle webm or we convert it before sending.
				// Given the backend code in emotion.rs reads WavReader, a conversion will be necessary.
				// However, MediaRecorder does not directly output WAV. This requires a client-side library
				// or server-side conversion. For now, we will send webm and note this potential issue.
				// A proper solution would involve a library like 'opus-media-recorder' or 'ffmpeg.wasm'.

				const formData = new FormData();
				formData.append('audio', audioBlob, 'recording.webm'); // Send as webm initially

				setAudioLoading(true); // Indicate that audio is being processed/uploaded

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
				}
			};

			mediaRecorder.current.start();
			setIsRecording(true);
		} catch (err) {
			console.error('Error accessing microphone:', err);
			alert('Please allow microphone access to use this feature.');
		}
	};

	const stopRecording = () => {
		if (mediaRecorder.current && isRecording) {
			mediaRecorder.current.stop();
			setIsRecording(false);
			// TODO: Implement client-side conversion from webm to wav if the backend strictly requires wav.
			// Currently, the backend (emotion.rs) uses hound::WavReader, implying it expects WAV.
			// Sending webm directly might cause a server-side error.
		}
	};

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [messages]);

	return (
		<div className="d-flex vh-100">
			<Sidebar />
			<div className="flex-grow-1">
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
				/>
			</div>
		</div>
	)
}

export default App;