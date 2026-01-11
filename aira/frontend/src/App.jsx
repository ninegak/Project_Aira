import React, { useState, useEffect, useRef } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import './App.css';

function App() {
	const [messages, setMessages] = useState([]);
	const [inputMessage, setInputMessage] = useState('');
	const [loading, setLoading] = useState(false);
	const [tps, setTps] = useState(null);
	const messagesEndRef = useRef(null);
	const [audioLoading, setAudioLoading] = useState(false);

	const handlePlayAudio = async (text) => {
		if (audioLoading) return;
		setAudioLoading(true);
		try {
			const response = await fetch('http://127.0.0.1:3000/api/tts', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ text }),
			});
			if (response.ok) {
				const blob = await response.blob();
				const url = URL.createObjectURL(blob);
				const audio = new Audio(url);
				audio.play();
				audio.onended = () => {
					setAudioLoading(false);
				};
			} else {
				console.error('TTS request failed');
				setAudioLoading(false);
			}
		} catch (error) {
			console.error('Error playing audio:', error);
			setAudioLoading(false);
		}
	};

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	};

	-	useEffect(() => {
		scrollToBottom();
	}, [messages]);

	const handleSendMessage = () => {
		if (inputMessage.trim() && !loading) {
			const userMessage = { sender: 'user', text: inputMessage };
			setMessages((prevMessages) => [...prevMessages, userMessage]);
			setInputMessage('');
			setLoading(true);
			setTps(null);

			const airaMessage = { sender: 'aira', text: '' };
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
					} else {
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

	return (
		<div className="container-fluid vh-100 d-flex flex-column bg-dark text-light">
			<div className="row justify-content-center text-center py-3">
				<div className="col">
					<h1>Aira Assistant</h1>
					<p className="lead">AI-Powered Conversational Interface</p>
				</div>
			</div>
			<div className="row flex-grow-1 overflow-auto justify-content-center">
				<div className="col-lg-8 col-md-10 col-12">
					<div className="h-100 d-flex flex-column p-3">
						<div className="flex-grow-1 overflow-auto">
							{messages.map((msg, index) => (
								<div key={index} className={`d-flex mb-3 ${msg.sender === 'user' ? 'justify-content-end' : ''}`}>
									<div className={`p-3 rounded ${msg.sender === 'user' ? 'bg-primary' : 'bg-secondary'}`}>
										{msg.text}
									</div>
									{msg.sender === 'aira' && msg.text && (
										<button className="btn btn-dark btn-sm ms-2" onClick={() => handlePlayAudio(msg.text)}>
											<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-volume-up" viewBox="0 0 16 16">
												<path d="M11.536 14.01A8.473 8.473 0 0 0 14.026 8a8.473 8.473 0 0 0-2.49-6.01l-.708.707A7.476 7.476 0 0 1 13.025 8c0 2.071-.84 3.946-2.197 5.303l.708.707z" />
												<path d="M10.121 12.596A6.48 6.48 0 0 0 12.025 8a6.48 6.48 0 0 0-1.904-4.596l-.707.707A5.483 5.483 0 0 1 11.025 8a5.483 5.483 0 0 1-1.61 3.89l.706.706z" />
												<path d="M8.707 11.182A4.486 4.486 0 0 0 10.025 8a4.486 4.486 0 0 0-1.318-3.182L8 5.525A3.489 3.489 0 0 1 9.025 8 3.49 3.49 0 0 1 8 10.475l.707.707zM6.717 3.55A.5.5 0 0 1 7 4v8a.5.5 0 0 1-.812.39L3.825 10.5H1.5A.5.5 0 0 1 1 10V6a.5.5 0 0 1 .5-.5h2.325l2.363-1.89a.5.5 0 0 1 .529-.06z" />
											</svg>
										</button>
									)}
									{msg.sender === 'aira' && tps && index === messages.length - 1 && (
										<span className="badge bg-info align-self-end ms-2">{tps} TPS</span>
									)}
								</div>
							))}
							{loading && (
								<div className="d-flex justify-content-start mb-3">
									<div className="p-3 rounded bg-secondary">Aira is thinking...</div>
								</div>
							)}
							<div ref={messagesEndRef} />
						</div>
						<div className="mt-auto">
							<div className="input-group">
								<input
									type="text"
									className="form-control bg-dark text-light"
									value={inputMessage}
									onChange={(e) => setInputMessage(e.target.value)}
									onKeyPress={(e) => {
										if (e.key === 'Enter' && !loading) {
											handleSendMessage();
										}
									}}
									placeholder={loading ? 'Aira is thinking...' : 'Type your message...'}
									disabled={loading}
								/>
								<button className="btn btn-primary" onClick={handleSendMessage} disabled={loading}>
									{loading ? 'Sending...' : 'Send'}
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

export default App;
