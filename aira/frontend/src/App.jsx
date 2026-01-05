import React, { useState, useEffect, useRef } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import './App.css';

function App() {
	const [messages, setMessages] = useState([]);
	const [inputMessage, setInputMessage] = useState('');
	const [loading, setLoading] = useState(false);
	const [tps, setTps] = useState(null);
	const messagesEndRef = useRef(null);

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	};

	useEffect(() => {
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
		<div className="app-containter">
			<div className="chat-window">
				<header className="app-header">
					<h1>Aira Chat</h1>
				</header>
				{messages.map((msg, index) => (
					<div key={index} className={`message ${msg.sender}`}>
						{msg.text}
						{msg.sender === 'aira' && tps && index === messages.length - 1 && (
							<span className="tps-badge">{tps} TPS</span>
						)}
					</div>
				))}
				{loading && messages[messages.length - 1]?.sender !== 'aira' && <div className="message aira loading">Aira is thinking...</div>}
				<div ref={messagesEndRef} />
			</div>
			<div className="chat-input">
				<input
					type="text"
					value={inputMessage}
					onChange={(e) => setInputMessage(e.target.value)}
					onKeyPress={(e) => {
						if (e.key === 'Enter' && !loading) {
							handleSendMessage();
						}
					}}
					placeholder={loading ? "Aira is thinking..." : "Type your message..."}
					disabled={loading}
				/>
				<button onClick={handleSendMessage} disabled={loading}>
					{loading ? 'Sending...' : 'Send'}
				</button>
			</div>
		</div>
	);
}

export default App;
