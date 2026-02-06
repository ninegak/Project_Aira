import 'bootstrap/dist/css/bootstrap.min.css';
import React, { useMemo, useCallback } from 'react';

interface Message {
	sender: 'user' | 'aira';
	text: string;
	tps?: string | null;
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
	messagesEndRef: React.RefObject<HTMLDivElement> | null;
	onPlayAudio: () => void;
	hasAudio: boolean;
	darkMode: boolean;
}

// Memoized message component for better performance
const MessageBubble = React.memo<{
	msg: Message;
	cardUser: string;
	cardAira: string;
}>(({ msg, cardUser, cardAira }) => (
	<div
		className={`d-flex mb-2 align-items-end ${msg.sender === 'user' ? 'justify-content-end' : 'justify-content-start'}`}
	>
		{msg.sender === 'aira' && msg.tps && (
			<div className="p-2 small text-muted">
				{msg.tps} tps
			</div>
		)}
		<div
			className={`card ${msg.sender === 'user' ? cardUser : cardAira}`}
			style={{ maxWidth: '70%' }}
		>
			<div className="card-body p-2" style={{ whiteSpace: 'pre-wrap' }}>
				{msg.text}
			</div>
		</div>
	</div>
));

MessageBubble.displayName = 'MessageBubble';

// Memoized suggestion buttons component
const SuggestionButtons = React.memo<{
	btnSecondaryClass: string;
	onSuggestionClick: (text: string) => void;
}>(({ btnSecondaryClass, onSuggestionClick }) => {
	const suggestions = [
		'Help me brainstorm ideas',
		'Explain a concept',
		'Write some code'
	];

	return (
		<div className="d-flex gap-2 mt-4 flex-wrap justify-content-center">
			{suggestions.map((text) => (
				<button
					key={text}
					className={`btn ${btnSecondaryClass}`}
					onClick={() => onSuggestionClick(text)}
				>
					{text}
				</button>
			))}
		</div>
	);
});

SuggestionButtons.displayName = 'SuggestionButtons';

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
	onPlayAudio,
	hasAudio,
	darkMode
}) => {
	// Memoize class names to avoid recalculation
	const classes = useMemo(() => ({
		bgClass: darkMode ? 'bg-dark text-light' : 'bg-light text-dark',
		inputBg: darkMode ? 'bg-secondary text-light' : 'bg-white text-dark',
		cardUser: darkMode ? 'bg-primary text-white' : 'bg-primary text-white',
		cardAira: darkMode ? 'bg-secondary text-light' : 'bg-light text-dark',
		btnSecondaryClass: darkMode ? 'btn-secondary' : 'btn-secondary',
		textMuted: darkMode ? 'text-light-50' : 'text-muted',
		textColor: darkMode ? 'text-light' : 'text-dark'
	}), [darkMode]);

	// Memoize key press handler
	const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter' && !loading) {
			handleSendMessage();
		}
	}, [handleSendMessage, loading]);

	// Memoize suggestion click handler
	const handleSuggestionClick = useCallback((text: string) => {
		setInputMessage(text);
	}, [setInputMessage]);

	return (
		<div className={`d-flex flex-column h-100 ${classes.bgClass}`}>
			<div className="flex-grow-1 p-3 overflow-auto">
				{messages.length === 0 ? (
					<div className="d-flex flex-column align-items-center justify-content-center h-100">
						<h1 className={`fw-bold ${classes.textColor}`}>
							Howdy! What's on your mind right now?
						</h1>
						<p className={classes.textMuted}>
							Ask me anything or choose a suggestion below
						</p>
						<SuggestionButtons
							btnSecondaryClass={classes.btnSecondaryClass}
							onSuggestionClick={handleSuggestionClick}
						/>
					</div>
				) : (
					messages.map((msg, index) => (
						<MessageBubble
							key={`${msg.sender}-${index}`}
							msg={msg}
							cardUser={classes.cardUser}
							cardAira={classes.cardAira}
						/>
					))
				)}

				{loading && (
					<div className="d-flex mb-2 justify-content-start">
						<div className={`card ${classes.cardAira}`} style={{ maxWidth: '70%' }}>
							<div className="card-body p-2 d-flex align-items-center">
								<div className="spinner-border spinner-border-sm me-2" role="status">
									<span className="visually-hidden">Loading...</span>
								</div>
							</div>
						</div>
					</div>
				)}

				<div ref={messagesEndRef} />

				{hasAudio && !loading && (
					<div className="text-center mt-2">
						<button
							className="btn btn-outline-primary"
							onClick={onPlayAudio}
							disabled={audioLoading}
							aria-label="Play Aira's voice response"
						>
							{audioLoading ? (
								<>
									<span className="spinner-border spinner-border-sm me-2" role="status" />
									Playing...
								</>
							) : (
								<>▶ Play Aira's Voice</>
							)}
						</button>
					</div>
				)}
			</div>

			<div className="p-3 mx-4">
				<div className={`gap-2 chat-input-container d-flex ${darkMode ? 'bg-dark' : 'bg-light'}`}>
					<input
						type="text"
						className={`form-control ${classes.inputBg}`}
						placeholder="Message Aira..."
						value={inputMessage}
						onChange={(e) => setInputMessage(e.target.value)}
						onKeyPress={handleKeyPress}
						disabled={loading}
						aria-label="Message input"
					/>
					<button
						className="btn btn-primary"
						onClick={handleSendMessage}
						disabled={loading || !inputMessage.trim()}
						aria-label="Send message"
						title="Send message"
					>
						↑
					</button>
					<button
						className={`btn ${isRecording ? 'btn-danger' : 'btn-outline-secondary'}`}
						onClick={isRecording ? stopRecording : startRecording}
						disabled={loading || audioLoading}
						aria-label={isRecording ? 'Stop recording' : 'Start recording'}
						title={isRecording ? 'Stop recording' : 'Start voice recording'}
					>
						{isRecording ? '⏹ Stop' : '🎤 Record'}
					</button>
				</div>

				{emotion && (
					<p className={`text-center mt-2 ${classes.textColor}`}>
						<span className="badge bg-info">Emotion: {emotion}</span>
					</p>
				)}

				<p className={`text-center mt-2 small ${classes.textMuted}`}>
					Mistakes happen. Humans make them, and Aira does too. We learn, check, improve, and move forward.
				</p>
			</div>
		</div>
	);
};

// Wrap the entire Chat component with React.memo
export default React.memo(Chat);
