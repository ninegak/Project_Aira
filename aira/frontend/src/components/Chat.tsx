import 'bootstrap/dist/css/bootstrap.min.css';
import React from 'react';

interface Message {
	sender: 'user' | 'aira';
	text: string;
}

interface ChatProps {
	messages: Message[];
	inputMessage: string;
	loading: boolean;
	tps: string | null;
	audioLoading: boolean;
	isRecording: boolean;
	emotion: string | null;
	handleSendMessage: () => void;
	setInputMessage: (message: string) => void;
	startRecording: () => void;
	stopRecording: () => void;
	messagesEndRef: React.RefObject<HTMLDivElement>;
}

const Chat: React.FC<ChatProps> = ({
	messages,
	inputMessage,
	loading,
	tps,
	audioLoading,
	isRecording,
	emotion,
	handleSendMessage,
	setInputMessage,
	startRecording,
	stopRecording,
	messagesEndRef,
}) => {
	return (
		<div className="d-flex flex-column h-100">
			<div className="flex-grow-1 p-3 overflow-auto">
				{messages.length === 0 ? (
					<div className="d-flex flex-column align-items-center justify-content-center h-100">
						<h1 className="fw-bold">Howdy! What's on you mind right now?</h1>
						<p className="text-muted">Ask me anything or choose a suggestion below</p>
						<div className="d-flex gap-2 mt-4">
							<button className="btn btn-light">Help me brainstorm ideas</button>
							<button className="btn btn-light">Explain a concept</button>
							<button className="btn btn-light">Write some code</button>
						</div>
					</div>
				) : (
					messages.map((msg, index) => (
						<div
							key={index}
							className={`d-flex mb-2 ${msg.sender === 'user' ? 'justify-content-end' : 'justify-content-start'}`}
						>
							<div
								className={`card ${msg.sender === 'user' ? 'bg-primary text-white' : 'bg-light text-dark'
									}`}
								style={{ maxWidth: '70%' }}
							>
								<div className="card-body p-2">{msg.text}</div>
							</div>
						</div>
					))
				)}
				{loading && (
					<div className="d-flex mb-2 justify-content-start">
						<div className="card bg-light text-dark" style={{ maxWidth: '70%' }}>
							<div className="card-body p-2">
								<div className="spinner-border spinner-border-sm" role="status">
									<span className="visually-hidden">Loading...</span>
								</div>
								{tps && <span className="ms-2">{tps} tokens/s</span>}
							</div>
						</div>
					</div>
				)}
				<div ref={messagesEndRef} />
			</div>
			<div className="p-3 mx-4">
				<div className="gap-2 chat-input-container">
					<input
						type="text"
						className="form-control"
						placeholder="Message Aira..."
						value={inputMessage}
						onChange={(e) => setInputMessage(e.target.value)}
						onKeyPress={(e) => {
							if (e.key === 'Enter') {
								handleSendMessage();
							}
						}}
						disabled={loading}
					/>
					<button className="btn btn-primary" onClick={handleSendMessage} disabled={loading}>
						↑
					</button>
					<button
						className={`btn d-none ${isRecording ? 'btn-danger' : 'btn-outline-secondary'}`}
						onClick={isRecording ? stopRecording : startRecording}
						disabled={loading || audioLoading}
					>
						{isRecording ? 'Stop Recording' : 'Start Recording'}
					</button>
				</div>
				{emotion && <p className="text-center mt-2">Detected Emotion: {emotion}</p>}
				{audioLoading && (
					<p className="text-center mt-2">
						<div className="spinner-border spinner-border-sm" role="status">
							<span className="visually-hidden">Loading Audio...</span>
						</div>{' '}
						Playing Audio...
					</p>
				)}
				<p className="text-center text-muted mt-2">Mistakes happen. Humans make them, and Aira does too. We learn, checking, improve, and move forward.</p>
			</div>
		</div>
	);
};

export default Chat;
