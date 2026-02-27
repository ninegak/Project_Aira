import 'bootstrap/dist/css/bootstrap.min.css';
import React, { useEffect, useRef, useState, useCallback } from 'react';

interface VoiceControllerProps {
	darkMode?: boolean;
	isVoiceMode?: boolean;
	isProcessing?: boolean;
	isSpeaking?: boolean;
	onVoiceStart?: () => void;
	onVoiceStop?: () => void;
	children?: React.ReactNode;
}

const VoiceController: React.FC<VoiceControllerProps> = ({
	darkMode = false,
	isVoiceMode = false,
	isProcessing = false,
	isSpeaking = false,
	onVoiceStart,
	onVoiceStop,
	children,
}) => {
	const [isRecording, setIsRecording] = useState(false);

	const handleVoiceToggle = useCallback(() => {
		if (isRecording) {
			setIsRecording(false);
			onVoiceStop?.();
		} else {
			setIsRecording(true);
			onVoiceStart?.();
		}
	}, [isRecording, onVoiceStart, onVoiceStop]);

	useEffect(() => {
		setIsRecording(false);
	}, [isVoiceMode]);

	if (!isVoiceMode) {
		return <>{children}</>;
	}

	return (
		<>
			{children}
			<div
				className="position-fixed d-flex flex-column align-items-center gap-3"
				style={{
					bottom: '40px',
					left: '50%',
					transform: 'translateX(-50%)',
					zIndex: 1003,
				}}
			>
				<button
					onClick={handleVoiceToggle}
					className="btn rounded-circle d-flex align-items-center justify-content-center"
					style={{
						width: '80px',
						height: '80px',
						background: isRecording
							? 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)'
							: 'linear-gradient(135deg, #4A5F7F 0%, #6B7B94 100%)',
						border: 'none',
						boxShadow: isRecording
							? '0 0 50px rgba(220, 53, 69, 0.8)'
							: '0 8px 30px rgba(74, 95, 127, 0.4)',
						transition: 'all 0.3s ease',
						animation: isRecording ? 'pulse 1.5s infinite' : 'none',
					}}
					title={isRecording ? 'Stop Recording' : 'Start Recording'}
				>
					<svg
						width="36"
						height="36"
						viewBox="0 0 24 24"
						fill="none"
						stroke="white"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						{isRecording ? (
							<rect x="6" y="6" width="12" height="12" rx="2"></rect>
						) : (
							<>
								<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
								<path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
								<line x1="12" y1="19" x2="12" y2="22"></line>
							</>
						)}
					</svg>
				</button>

				<p style={{ color: darkMode ? '#A8B5C4' : '#6B7B94', fontSize: '0.85rem' }}>
					{isRecording ? '🔴 Recording...' : isSpeaking ? '🎙️ Aira speaking...' : 'Tap to record'}
				</p>

				<style>{`
					@keyframes pulse {
						0%, 100% { transform: scale(1); box-shadow: 0 0 40px rgba(220, 53, 69, 0.6); }
						50% { transform: scale(1.05); box-shadow: 0 0 60px rgba(220, 53, 69, 0.8); }
					}
				`}</style>
			</div>
		</>
	);
};

export default VoiceController;
