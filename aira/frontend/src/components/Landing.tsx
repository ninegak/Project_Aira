import React, { useState } from 'react';

interface LandingProps {
	darkMode: boolean;
	onStartChat: () => void;
}

// Color palette matching Chat.tsx theme
const COLORS = {
	primary: '#4A5F7F',
	primaryLight: '#6B7B94',
	primaryDark: '#3A4A5F',
	accent: '#E8D5C4',
	accentLight: '#F5EDE6',
	textLight: '#F5F3F0',
	textDark: '#2C3A4F',
};

const Landing: React.FC<LandingProps> = ({ darkMode, onStartChat }) => {
	const [mousePosition, setMousePosition] = useState({ x: 50, y: 50 });

	const handleMouseMove = (e: React.MouseEvent) => {
		const rect = e.currentTarget.getBoundingClientRect();
		setMousePosition({
			x: ((e.clientX - rect.left) / rect.width) * 100,
			y: ((e.clientY - rect.top) / rect.height) * 100,
		});
	};

	const features = [
		{
			icon: '🎤',
			title: 'Voice Enabled',
			description: 'Speak naturally, Aira listens and responds',
		},
		{
			icon: '⚡',
			title: 'Lightning Fast',
			description: 'Local LLM inference for instant responses',
		},
		{
			icon: '🔒',
			title: 'Privacy First',
			description: 'All processing happens on your device',
		},
	];

	return (
		<div
			className="min-vh-100 d-flex flex-column justify-content-center align-items-center position-relative overflow-hidden"
			style={{
				background: darkMode
					? `radial-gradient(circle at ${mousePosition.x}% ${mousePosition.y}%, rgba(74, 95, 127, 0.15) 0%, transparent 50%), #1a1d23`
					: `radial-gradient(circle at ${mousePosition.x}% ${mousePosition.y}%, rgba(74, 95, 127, 0.08) 0%, transparent 50%), #F8F9FA`,
			}}
			onMouseMove={handleMouseMove}
		>
			{/* Animated background elements */}
			<div className="position-absolute w-100 h-100 overflow-hidden" style={{ zIndex: 0 }}>
				{[...Array(3)].map((_, i) => (
					<div
						key={i}
						className="position-absolute rounded-circle"
						style={{
							width: `${300 + i * 100}px`,
							height: `${300 + i * 100}px`,
							background: darkMode
								? `rgba(74, 95, 127, ${0.04 - i * 0.01})`
								: `rgba(74, 95, 127, ${0.06 - i * 0.015})`,
							left: `${20 + i * 25}%`,
							top: `${30 + i * 10}%`,
							animation: `float ${6 + i * 2}s ease-in-out infinite`,
							animationDelay: `${i * 0.5}s`,
						}}
					/>
				))}
			</div>

			{/* Main content */}
			<div
				className="container text-center position-relative"
				style={{ zIndex: 1, maxWidth: '800px' }}
			>
				{/* Logo / Icon */}
				<div
					className="mb-4 animate-fade-in"
					style={{ animationDelay: '0ms' }}
				>
					<div
						className="d-inline-flex align-items-center justify-content-center rounded-4 mb-3"
						style={{
							width: '80px',
							height: '80px',
							background: darkMode ? 'rgba(74, 95, 127, 0.2)' : 'rgba(74, 95, 127, 0.1)',
							backdropFilter: 'blur(10px)',
							border: `1px solid ${darkMode ? 'rgba(74, 95, 127, 0.3)' : 'rgba(74, 95, 127, 0.15)'}`,
						}}
					>
						<span className="fs-1">✨</span>
					</div>
				</div>

				{/* Headline */}
				<h1
					className="display-3 fw-bold mb-3 animate-fade-in"
					style={{
						letterSpacing: '-0.02em',
						animationDelay: '100ms',
						color: darkMode ? COLORS.textLight : COLORS.textDark,
					}}
				>
					Meet{' '}
					<span
						style={{
							background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryLight} 100%)`,
							WebkitBackgroundClip: 'text',
							WebkitTextFillColor: 'transparent',
							backgroundClip: 'text',
						}}
					>
						Aira
					</span>
				</h1>

				{/* Tagline */}
				<p
					className="lead mb-5 animate-fade-in"
					style={{ 
						fontSize: '1.25rem', 
						lineHeight: '1.6', 
						animationDelay: '200ms',
						color: darkMode ? '#7A8BA3' : '#6B7B94'
					}}
				>
					Your voice-enabled AI assistant.
					<br />
					Speak naturally. Get instant answers. All local.
				</p>

				{/* CTA Button */}
				<div
					className="mb-5 animate-fade-in"
					style={{ animationDelay: '300ms' }}
				>
					<button
						onClick={onStartChat}
						className="btn btn-lg px-5 py-3 rounded-pill fw-semibold shadow-lg transition-all duration-300 position-relative overflow-hidden"
						style={{
							background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryLight} 100%)`,
							border: 'none',
							fontSize: '1.1rem',
							color: 'white',
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
							e.currentTarget.style.boxShadow = '0 10px 30px rgba(74, 95, 127, 0.3)';
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.transform = 'translateY(0) scale(1)';
							e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.1)';
						}}
					>
						<span className="d-flex align-items-center gap-2">
							Start Chatting
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
								<line x1="5" y1="12" x2="19" y2="12" />
								<polyline points="12 5 19 12 12 19" />
							</svg>
						</span>
					</button>
				</div>

				{/* Features */}
				<div
					className="row g-4 justify-content-center animate-fade-in"
					style={{ animationDelay: '500ms' }}
				>
					{features.map((feature, index) => (
						<div key={index} className="col-md-4">
							<div
								className="p-4 rounded-4 h-100"
								style={{
									backdropFilter: 'blur(10px)',
									background: darkMode ? 'rgba(42, 45, 53, 0.5)' : 'rgba(255, 255, 255, 0.8)',
									border: `1px solid ${darkMode ? 'rgba(74, 95, 127, 0.2)' : 'rgba(74, 95, 127, 0.1)'}`,
									boxShadow: darkMode ? 'none' : '0 2px 10px rgba(0, 0, 0, 0.05)',
								}}
							>
								<div className="fs-2 mb-2">{feature.icon}</div>
								<h5
									className="fw-semibold mb-2"
									style={{ color: darkMode ? COLORS.textLight : COLORS.textDark }}
								>
									{feature.title}
								</h5>
								<p
									className="small mb-0"
									style={{ color: darkMode ? '#7A8BA3' : '#6B7B94' }}
								>
									{feature.description}
								</p>
							</div>
						</div>
					))}
				</div>

				{/* Footer hint */}
				<div
					className="mt-5 animate-fade-in"
					style={{ animationDelay: '700ms' }}
				>
					<p className="small" style={{ color: darkMode ? '#5A6B7F' : '#8B9AAF' }}>
						Press{' '}
						<kbd
							className="px-2 py-1 rounded"
							style={{
								background: darkMode ? 'rgba(74, 95, 127, 0.2)' : 'rgba(74, 95, 127, 0.1)',
								color: darkMode ? '#7A8BA3' : '#6B7B94',
								border: `1px solid ${darkMode ? 'rgba(74, 95, 127, 0.3)' : 'rgba(74, 95, 127, 0.2)'}`,
							}}
						>
							Space
						</kbd>{' '}
						to start recording voice
					</p>
				</div>
			</div>

			{/* CSS for animations */}
			<style>{`
				@keyframes float {
					0%, 100% {
						transform: translateY(0) scale(1);
					}
					50% {
						transform: translateY(-20px) scale(1.05);
					}
				}
				@keyframes fadeInUp {
					from {
						opacity: 0;
						transform: translateY(20px);
					}
					to {
						opacity: 1;
						transform: translateY(0);
					}
				}
				.animate-fade-in {
					animation: fadeInUp 0.6s ease-out forwards;
					opacity: 0;
				}
			`}</style>
		</div>
	);
};

export default React.memo(Landing);
