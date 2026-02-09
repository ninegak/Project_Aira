import 'bootstrap/dist/css/bootstrap.min.css';
import React, { useMemo, useCallback } from 'react';

interface Message {
	sender: 'user' | 'aira';
	text: string;
	tps?: string | null;
	audioData?: string[]; // Audio data for this message
}

// Color palette matching Landing page theme
const COLORS = {
	primary: '#4A5F7F',
	primaryLight: '#6B7B94',
	primaryDark: '#3A4A5F',
	accent: '#E8D5C4',
	accentLight: '#F5EDE6',
	textLight: '#F5F3F0',
	textDark: '#2C3A4F',
};

interface ChatProps {
	messages: Message[];
	inputMessage: string;
	loading: boolean;
	tps?: string | null;
	audioLoading: boolean;
	isRecording: boolean;
	emotion: string | null;
	handleSendMessage: () => void;
	setInputMessage: (message: string) => void;
	startRecording: () => void;
	stopRecording: () => void;
	messagesEndRef: React.RefObject<HTMLDivElement> | null;
	onPlayAudio: (messageIndex: number) => void;
	darkMode: boolean;
	playingMessageIndex: number | null;
}

// Memoized message component for better performance
const MessageBubble = React.memo<{
	msg: Message;
	cardUserBg: string;
	cardAiraBg: string;
	darkMode: boolean;
	messageIndex: number;
	onPlayAudio: (index: number) => void;
	isPlaying: boolean;
	isLoading: boolean;
}>(({ msg, cardUserBg, cardAiraBg, darkMode, messageIndex, onPlayAudio, isPlaying, isLoading }) => (
	<div
		className={`d-flex mb-4 align-items-start ${msg.sender === 'user' ? 'justify-content-end' : 'justify-content-start'}`}
	>
		{msg.sender === 'aira' && (
			<div className="me-3 d-flex flex-column align-items-center">
				<div 
					className="rounded-circle d-flex align-items-center justify-content-center shadow-sm"
					style={{ 
						width: '36px', 
						height: '36px',
						background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryLight} 100%)`,
						border: `2px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.8)'}`,
					}}
				>
					<span className="text-white fw-bold" style={{ fontSize: '14px' }}>A</span>
				</div>
			</div>
		)}
		<div className="d-flex flex-column" style={{ maxWidth: '75%' }}>
			<div
				className="border-0 shadow-sm"
				style={{
					borderRadius: msg.sender === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
					background: msg.sender === 'user' ? cardUserBg : cardAiraBg,
					color: msg.sender === 'user' ? 'white' : (darkMode ? '#F5F3F0' : '#2C3A4F'),
					padding: '12px 16px',
					whiteSpace: 'pre-wrap',
					wordBreak: 'break-word',
					minWidth: msg.text ? 'auto' : '100px',
				}}
			>
				{msg.text || (msg.sender === 'aira' ? <span style={{ opacity: 0.5 }}>...</span> : '')}
			</div>
			{msg.sender === 'aira' && (
				<div className="mt-2 d-flex align-items-center gap-2">
					{msg.tps && (
						<span 
							className="badge"
							style={{ 
								background: darkMode ? 'rgba(74, 95, 127, 0.25)' : 'rgba(74, 95, 127, 0.12)',
								color: darkMode ? '#8B9AAF' : COLORS.primary,
								fontSize: '0.7rem',
								fontWeight: 500,
								border: `1px solid ${darkMode ? 'rgba(74, 95, 127, 0.4)' : 'rgba(74, 95, 127, 0.2)'}`,
								borderRadius: '12px',
								padding: '4px 10px'
							}}
						>
							<span style={{ marginRight: '4px' }}>⚡</span>
							{msg.tps} tokens/sec
						</span>
					)}
					{msg.audioData && msg.audioData.length > 0 && (
						<button
							onClick={() => onPlayAudio(messageIndex)}
							disabled={isLoading}
							className="d-inline-flex align-items-center justify-content-center"
							style={{
								background: isPlaying 
									? (darkMode ? 'rgba(74, 95, 127, 0.4)' : 'rgba(74, 95, 127, 0.2)')
									: (darkMode ? 'rgba(74, 95, 127, 0.2)' : 'rgba(74, 95, 127, 0.08)'),
								color: darkMode ? '#A8B5C4' : COLORS.primary,
								border: `1px solid ${darkMode ? 'rgba(74, 95, 127, 0.3)' : 'rgba(74, 95, 127, 0.15)'}`,
								borderRadius: '50%',
								width: '28px',
								height: '28px',
								padding: 0,
								cursor: isLoading ? 'not-allowed' : 'pointer',
								transition: 'all 0.2s ease'
							}}
							onMouseEnter={(e) => {
								if (!isLoading) {
									e.currentTarget.style.background = darkMode ? 'rgba(74, 95, 127, 0.35)' : 'rgba(74, 95, 127, 0.15)';
								}
							}}
							onMouseLeave={(e) => {
								if (!isPlaying) {
									e.currentTarget.style.background = darkMode ? 'rgba(74, 95, 127, 0.2)' : 'rgba(74, 95, 127, 0.08)';
								}
							}}
							aria-label={isPlaying ? "Playing audio" : "Play Aira's voice"}
								title={isPlaying ? "Playing..." : "Play voice"}
							>
							{isLoading ? (
								<span 
									className="spinner-border spinner-border-sm" 
									role="status"
									style={{ 
										width: '12px', 
										height: '12px',
										color: COLORS.primary 
									}}
								>
									<span className="visually-hidden">Playing...</span>
								</span>
							) : isPlaying ? (
								<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
									<rect x="6" y="6" width="4" height="12" rx="1"></rect>
									<rect x="14" y="6" width="4" height="12" rx="1"></rect>
								</svg>
							) : (
								<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
									<polygon points="5 3 19 12 5 21 5 3"></polygon>
								</svg>
							)}
						</button>
					)}
				</div>
			)}
		</div>
	</div>
));

MessageBubble.displayName = 'MessageBubble';

// Memoized suggestion buttons component
const SuggestionButtons = React.memo<{
	darkMode: boolean;
	onSuggestionClick: (text: string) => void;
}>(({ darkMode, onSuggestionClick }) => {
	const suggestions = [
		'Help me brainstorm ideas',
		'Explain a concept',
		'Write some code'
	];

	return (
		<div className="d-flex gap-3 mt-5 flex-wrap justify-content-center">
			{suggestions.map((text) => (
				<button
					key={text}
					className="btn px-4 py-2"
					onClick={() => onSuggestionClick(text)}
					style={{
						background: darkMode ? 'rgba(74, 95, 127, 0.2)' : 'rgba(74, 95, 127, 0.08)',
						color: darkMode ? '#A8B5C4' : COLORS.primary,
						border: `1px solid ${darkMode ? 'rgba(74, 95, 127, 0.3)' : 'rgba(74, 95, 127, 0.15)'}`,
						borderRadius: '24px',
						fontSize: '0.95rem',
						fontWeight: 500,
						transition: 'all 0.2s ease'
					}}
					onMouseEnter={(e) => {
						e.currentTarget.style.background = darkMode ? 'rgba(74, 95, 127, 0.35)' : 'rgba(74, 95, 127, 0.15)';
						e.currentTarget.style.transform = 'translateY(-2px)';
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.background = darkMode ? 'rgba(74, 95, 127, 0.2)' : 'rgba(74, 95, 127, 0.08)';
						e.currentTarget.style.transform = 'translateY(0)';
					}}
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
	audioLoading,
	isRecording,
	emotion,
	handleSendMessage,
	setInputMessage,
	startRecording,
	stopRecording,
	messagesEndRef,
	onPlayAudio,
	darkMode,
	playingMessageIndex
}) => {
	// Memoize class names to avoid recalculation
	const classes = useMemo(() => ({
		bgClass: darkMode ? 'bg-dark' : '',
		bgColor: darkMode ? '#1a1d23' : '#F8F9FA',
		inputBg: darkMode ? '#2A2D35' : '#FFFFFF',
		inputBorder: darkMode ? '#3A3D45' : '#E0E2E6',
		cardUserBg: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryLight} 100%)`,
		cardAiraBg: darkMode ? '#2A2D35' : '#FFFFFF',
		textMuted: darkMode ? '#7A8BA3' : '#6B7B94',
		textColor: darkMode ? '#F5F3F0' : COLORS.textDark,
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
		<div 
			className={`d-flex flex-column h-100 ${classes.bgClass}`}
			style={{ background: classes.bgColor }}
		>
			<div className="flex-grow-1 p-4 overflow-auto">
				{messages.length === 0 ? (
					<div className="d-flex flex-column align-items-center justify-content-center h-100">
						<div 
							className="rounded-circle d-flex align-items-center justify-content-center mb-4 shadow-sm"
							style={{
								width: '72px',
								height: '72px',
								background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryLight} 100%)`,
								border: `3px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.9)'}`,
							}}
						>
							<span className="fs-2">✨</span>
						</div>
						<h1 
							className="fw-bold mb-3"
							style={{ 
								color: classes.textColor,
								fontSize: '2rem'
							}}
						>
							Howdy! What's on your mind?
						</h1>
						<p 
							className="mb-1"
							style={{ color: classes.textMuted, fontSize: '1.1rem' }}
						>
							Ask me anything or choose a suggestion below
						</p>
						<SuggestionButtons
							darkMode={darkMode}
							onSuggestionClick={handleSuggestionClick}
						/>
					</div>
				) : (
					messages.map((msg, index) => (
						<MessageBubble
							key={`${msg.sender}-${index}`}
							msg={msg}
							cardUserBg={classes.cardUserBg}
							cardAiraBg={classes.cardAiraBg}
							darkMode={darkMode}
							messageIndex={index}
							onPlayAudio={onPlayAudio}
							isPlaying={playingMessageIndex === index}
							isLoading={audioLoading && playingMessageIndex === index}
						/>
					))
				)}

				{loading && (
					<div className="d-flex mb-4 justify-content-start">
						<div className="me-3">
							<div 
								className="rounded-circle d-flex align-items-center justify-content-center"
								style={{ 
									width: '36px', 
									height: '36px',
									background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryLight} 100%)`,
								}}
							>
								<span className="text-white fw-bold" style={{ fontSize: '14px' }}>A</span>
							</div>
						</div>
						<div 
							className="border-0 shadow-sm d-flex align-items-center gap-2"
							style={{ 
								maxWidth: '70%',
								borderRadius: '18px 18px 18px 4px',
								background: classes.cardAiraBg,
								padding: '12px 16px',
								color: classes.textMuted
							}}
						>
							<div 
								className="spinner-border spinner-border-sm" 
								role="status"
								style={{ color: COLORS.primary }}
							>
								<span className="visually-hidden">Loading...</span>
							</div>
							<span style={{ fontSize: '0.9rem' }}>Aira is thinking...</span>
						</div>
					</div>
				)}

				<div ref={messagesEndRef} />
			</div>

			<div 
				className="p-4"
				style={{ 
					background: darkMode ? '#1a1d23' : '#FFFFFF',
					borderTop: `1px solid ${darkMode ? '#2A2D35' : '#E8EAED'}`
				}}
			>
				<div 
					className="d-flex gap-2 align-items-center"
					style={{
						background: classes.inputBg,
						borderRadius: '28px',
						padding: '6px',
						border: `1px solid ${classes.inputBorder}`
					}}
				>
					<input
						type="text"
						className="form-control border-0 shadow-none"
						placeholder="Message Aira..."
						value={inputMessage}
						onChange={(e) => setInputMessage(e.target.value)}
						onKeyPress={handleKeyPress}
						disabled={loading}
						aria-label="Message input"
						style={{
							background: 'transparent',
							color: classes.textColor,
							padding: '10px 16px'
						}}
					/>
					<button
						className="btn d-flex align-items-center justify-content-center"
						onClick={handleSendMessage}
						disabled={loading || !inputMessage.trim()}
						aria-label="Send message"
						title="Send message"
						style={{
							background: !loading && inputMessage.trim() ? COLORS.primary : 'transparent',
							color: !loading && inputMessage.trim() ? 'white' : classes.textMuted,
							borderRadius: '50%',
							width: '44px',
							height: '44px',
							border: !loading && inputMessage.trim() ? 'none' : `1px solid ${classes.inputBorder}`,
							transition: 'all 0.2s ease'
						}}
					>
						<svg 
							width="20" 
							height="20" 
							viewBox="0 0 24 24" 
							fill="none" 
							stroke="currentColor" 
							strokeWidth="2" 
							strokeLinecap="round" 
							strokeLinejoin="round"
						>
							<line x1="22" y1="2" x2="11" y2="13"></line>
							<polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
						</svg>
					</button>
					<button
						className="btn d-flex align-items-center justify-content-center"
						onClick={isRecording ? stopRecording : startRecording}
						disabled={loading || audioLoading}
						aria-label={isRecording ? 'Stop recording' : 'Start recording'}
						title={isRecording ? 'Stop recording' : 'Start voice recording'}
						style={{
							background: isRecording ? '#DC3545' : 'transparent',
							color: isRecording ? 'white' : classes.textMuted,
							borderRadius: '50%',
							width: '44px',
							height: '44px',
							border: isRecording ? 'none' : `1px solid ${classes.inputBorder}`,
							transition: 'all 0.2s ease'
						}}
					>
						{isRecording ? (
							<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
								<rect x="6" y="6" width="12" height="12" rx="2"></rect>
							</svg>
						) : (
							<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
								<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
								<path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
								<line x1="12" y1="19" x2="12" y2="22"></line>
							</svg>
						)}
					</button>
				</div>

				{emotion && (
					<p className="text-center mt-3 mb-0">
						<span 
							className="badge"
							style={{
								background: darkMode ? 'rgba(74, 95, 127, 0.25)' : 'rgba(74, 95, 127, 0.12)',
								color: darkMode ? '#A8B5C4' : COLORS.primary,
								borderRadius: '12px',
								padding: '6px 12px',
								fontWeight: 500
							}}
						>
							Emotion: {emotion}
						</span>
					</p>
				)}

				<p 
					className="text-center mt-3 mb-0 small"
					style={{ color: classes.textMuted }}
				>
					Mistakes happen. Humans make them, and Aira does too.
				</p>
			</div>
		</div>
	);
};

// Wrap the entire Chat component with React.memo
export default React.memo(Chat);
