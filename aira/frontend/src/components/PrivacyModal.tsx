import React from 'react';

interface PrivacyModalProps {
	isOpen: boolean;
	onConfirm: () => void;
	onCancel: () => void;
	darkMode: boolean;
}

const PrivacyModal: React.FC<PrivacyModalProps> = ({ isOpen, onConfirm, onCancel, darkMode }) => {
	if (!isOpen) return null;

	return (
		<div
			className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
			style={{
				background: 'rgba(0, 0, 0, 0.6)',
				zIndex: 9999,
				backdropFilter: 'blur(4px)',
			}}
			onClick={onCancel}
		>
			<div
				className="rounded-4 p-4 mx-3"
				style={{
					maxWidth: '450px',
					width: '100%',
					background: darkMode ? '#2A2D35' : '#FFFFFF',
					border: `1px solid ${darkMode ? '#3A3D45' : '#E8EAED'}`,
					boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
				}}
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<div className="d-flex align-items-center gap-3 mb-4">
					<div
						className="rounded-circle d-flex align-items-center justify-content-center"
						style={{
							width: '48px',
							height: '48px',
							background: 'rgba(74, 95, 127, 0.15)',
						}}
					>
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4A5F7F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
							<circle cx="12" cy="13" r="4"></circle>
						</svg>
					</div>
					<h5
						className="fw-bold mb-0"
						style={{ color: darkMode ? '#F5F3F0' : '#2C3A4F' }}
					>
						Camera Privacy Notice
					</h5>
				</div>

				{/* Content */}
				<div className="mb-4" style={{ color: darkMode ? '#A8B5C4' : '#6B7B94' }}>
					<p className="mb-3">
						<strong style={{ color: darkMode ? '#F5F3F0' : '#2C3A4F' }}>
							This feature will access your camera for AI awareness.
						</strong>
					</p>
					
					<div className="d-flex flex-column gap-2 mb-3">
						<div className="d-flex align-items-start gap-2">
							<span style={{ color: '#28a745' }}>✓</span>
							<span>Extract numerical features only (eye openness, blink rate, etc.)</span>
						</div>
						<div className="d-flex align-items-start gap-2">
							<span style={{ color: '#28a745' }}>✓</span>
							<span>No images or video frames are stored or transmitted</span>
						</div>
						<div className="d-flex align-items-start gap-2">
							<span style={{ color: '#28a745' }}>✓</span>
							<span>Only anonymized data (fatigue, engagement) is sent</span>
						</div>
						<div className="d-flex align-items-start gap-2">
							<span style={{ color: '#28a745' }}>✓</span>
							<span>Camera feed is processed locally in your browser</span>
						</div>
					</div>

					<p className="mb-0 small" style={{ color: darkMode ? '#7A8BA3' : '#8B9AAF' }}>
						Your privacy is important. This system does not perform surveillance, facial recognition, or identity tracking.
					</p>
				</div>

				{/* Buttons */}
				<div className="d-flex gap-2">
					<button
						onClick={onCancel}
						className="btn flex-grow-1 py-2"
						style={{
							background: darkMode ? 'rgba(74, 95, 127, 0.1)' : '#F8F9FA',
							color: darkMode ? '#A8B5C4' : '#6B7B94',
							border: `1px solid ${darkMode ? 'rgba(74, 95, 127, 0.2)' : '#E0E2E6'}`,
							borderRadius: '12px',
							fontWeight: 500,
						}}
					>
						Not Now
					</button>
					<button
						onClick={onConfirm}
						className="btn flex-grow-1 py-2"
						style={{
							background: '#4A5F7F',
							color: 'white',
							border: 'none',
							borderRadius: '12px',
							fontWeight: 600,
						}}
					>
						Enable Camera
					</button>
				</div>
			</div>
		</div>
	);
};

export default PrivacyModal;
