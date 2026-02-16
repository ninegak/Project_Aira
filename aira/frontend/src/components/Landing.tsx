import React, { useState, useEffect, useRef } from 'react';

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
	const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set());

	// Intersection Observer for scroll animations
	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						setVisibleSections((prev) => new Set([...prev, entry.target.id]));
					}
				});
			},
			{ threshold: 0.2, rootMargin: '0px 0px -50px 0px' }
		);

		document.querySelectorAll('[data-animate]').forEach((el) => {
			observer.observe(el);
		});

		return () => observer.disconnect();
	}, []);

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

	const techStack = [
		{ icon: '🦀', name: 'Rust', desc: 'Blazing fast backend' },
		{ icon: '⚛️', name: 'React', desc: 'Modern UI' },
		{ icon: '🎤', name: 'Whisper', desc: 'Speech recognition' },
		{ icon: '🧠', name: 'LLM', desc: 'Local AI inference' },
	];

	const examples = [
		{
			q: "What's the weather like?",
			a: "I don't have access to real-time weather data, but I can help you understand weather patterns or prepare for different conditions!",
		},
		{
			q: 'Explain quantum computing',
			a: "Quantum computing uses quantum bits (qubits) that can exist in multiple states simultaneously, unlike classical bits that are either 0 or 1...",
		},
		{
			q: 'Help me brainstorm ideas',
			a: "I'd love to help! What topic are you brainstorming about? I can suggest creative approaches, different angles, or help you organize your thoughts.",
		},
	];

	return (
		<div
			className="position-relative overflow-hidden"
			style={{
				background: darkMode ? '#1a1d23' : '#F8F9FA',
			}}
			onMouseMove={handleMouseMove}
		>
			{/* Hero Section - Full viewport */}
			<section
				className="min-vh-100 d-flex flex-column justify-content-center align-items-center position-relative"
				style={{
					background: darkMode
						? `radial-gradient(circle at ${mousePosition.x}% ${mousePosition.y}%, rgba(74, 95, 127, 0.15) 0%, transparent 50%), #1a1d23`
						: `radial-gradient(circle at ${mousePosition.x}% ${mousePosition.y}%, rgba(74, 95, 127, 0.08) 0%, transparent 50%), #F8F9FA`,
				}}
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
							color: darkMode ? '#7A8BA3' : '#6B7B94',
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
										background: darkMode
											? 'rgba(42, 45, 53, 0.5)'
											: 'rgba(255, 255, 255, 0.8)',
										border: `1px solid ${darkMode ? 'rgba(74, 95, 127, 0.2)' : 'rgba(74, 95, 127, 0.1)'}`,
										boxShadow: darkMode
											? 'none'
											: '0 2px 10px rgba(0, 0, 0, 0.05)',
									}}
								>
									<div className="fs-2 mb-2">{feature.icon}</div>
									<h5
										className="fw-semibold mb-2"
										style={{
											color: darkMode ? COLORS.textLight : COLORS.textDark,
										}}
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
				</div>

				{/* Scroll indicator */}
				<div
					className="position-absolute bottom-0 start-50 translate-middle-x mb-4 animate-bounce"
					style={{ animation: 'bounce 2s infinite' }}
				>
					<svg
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						stroke={darkMode ? '#7A8BA3' : '#6B7B94'}
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<polyline points="6 9 12 15 18 9" />
					</svg>
				</div>
			</section>

			{/* Live Demo Section */}
			<section
				id="live-demo"
				data-animate
				className="py-5"
				style={{
					background: darkMode ? '#1a1d23' : '#F8F9FA',
					minHeight: '80vh',
					opacity: visibleSections.has('live-demo') ? 1 : 0,
					transform: visibleSections.has('live-demo')
						? 'translateY(0)'
						: 'translateY(30px)',
					transition: 'all 0.8s ease-out',
				}}
			>
				<div className="container" style={{ maxWidth: '900px' }}>
					<h2
						className="fw-bold mb-4 text-center"
						style={{ color: darkMode ? COLORS.textLight : COLORS.textDark }}
					>
						See Aira in Action
					</h2>
					<div
						className="rounded-4 overflow-hidden shadow-lg"
						style={{
							background: darkMode ? '#2A2D35' : '#FFFFFF',
							border: `1px solid ${darkMode ? 'rgba(74, 95, 127, 0.2)' : 'rgba(74, 95, 127, 0.1)'}`,
						}}
					>
						{/* Mock chat interface */}
						<div
							className="p-3 border-bottom"
							style={{
								background: darkMode ? '#1a1d23' : '#F8F9FA',
								borderColor: darkMode ? '#2A2D35' : '#E8EAED',
							}}
						>
							<div className="d-flex align-items-center gap-2">
								<div
									className="rounded-circle d-flex align-items-center justify-content-center"
									style={{
										width: '32px',
										height: '32px',
										background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryLight} 100%)`,
									}}
								>
									<span style={{ fontSize: '14px' }}>🌸</span>
								</div>
								<span
									className="fw-semibold"
									style={{ color: darkMode ? COLORS.textLight : COLORS.textDark }}
								>
									Aira
								</span>
							</div>
						</div>
						<div className="p-4" style={{ minHeight: '300px' }}>
							{/* User message */}
							<div className="d-flex justify-content-end mb-3">
								<div
									className="px-3 py-2"
									style={{
										background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryLight} 100%)`,
										borderRadius: '18px 18px 4px 18px',
										color: 'white',
										maxWidth: '70%',
									}}
								>
									"What can you help me with?"
								</div>
							</div>
							{/* Aira message */}
							<div className="d-flex mb-3">
								<div
									className="rounded-circle d-flex align-items-center justify-content-center me-2 flex-shrink-0"
									style={{
										width: '32px',
										height: '32px',
										background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryLight} 100%)`,
									}}
								>
									<span style={{ fontSize: '14px' }}>🌸</span>
								</div>
								<div
									className="px-3 py-2"
									style={{
										background: darkMode ? '#3A3D45' : '#F0F2F5',
										borderRadius: '18px 18px 18px 4px',
										color: darkMode ? COLORS.textLight : COLORS.textDark,
										maxWidth: '75%',
									}}
								>
									I can help with coding, writing, analysis, brainstorming, explanations, and much
									more. Just speak naturally and I'll assist you!
									<div className="mt-2 d-flex gap-2">
										<span
											className="badge"
											style={{
												background: darkMode
													? 'rgba(74, 95, 127, 0.25)'
													: 'rgba(74, 95, 127, 0.12)',
												fontSize: '0.7rem',
											}}
										>
											⚡ 14.2 tokens/sec
										</span>
									</div>
								</div>
							</div>
							{/* Input area mock */}
							<div
								className="mt-4 p-2 rounded-pill d-flex align-items-center gap-2"
								style={{
									background: darkMode ? '#2A2D35' : '#FFFFFF',
									border: `1px solid ${darkMode ? '#3A3D45' : '#E0E2E6'}`,
								}}
							>
								<div
									className="flex-grow-1 px-3 py-2"
									style={{ color: darkMode ? '#5A6B7F' : '#8B9AAF' }}
								>
									Message Aira...
								</div>
								<div
									className="rounded-circle d-flex align-items-center justify-content-center"
									style={{
										width: '36px',
										height: '36px',
										background: COLORS.primary,
									}}
								>
									<svg
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="white"
										strokeWidth="2"
									>
										<line x1="22" y1="2" x2="11" y2="13" />
										<polygon points="22 2 15 22 11 13 2 9 22 2" />
									</svg>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Privacy Section */}
			<section
				id="privacy"
				data-animate
				className="py-5"
				style={{
					background: darkMode
						? 'rgba(74, 95, 127, 0.05)'
						: 'rgba(74, 95, 127, 0.03)',
					minHeight: '60vh',
					opacity: visibleSections.has('privacy') ? 1 : 0,
					transform: visibleSections.has('privacy')
						? 'translateY(0)'
						: 'translateY(30px)',
					transition: 'all 0.8s ease-out',
				}}
			>
				<div className="container" style={{ maxWidth: '800px' }}>
					<h2
						className="fw-bold mb-4 text-center"
						style={{ color: darkMode ? COLORS.textLight : COLORS.textDark }}
					>
						🔒 Your Privacy Matters
					</h2>
					<div className="row g-4">
						<div className="col-md-6">
							<div
								className="p-4 rounded-4 h-100"
								style={{
									background: darkMode
										? 'rgba(42, 45, 53, 0.8)'
										: 'rgba(255, 255, 255, 0.9)',
									border: `1px solid ${darkMode ? 'rgba(74, 95, 127, 0.2)' : 'rgba(74, 95, 127, 0.1)'}`,
								}}
							>
								<h5
									className="fw-semibold mb-3"
									style={{ color: darkMode ? COLORS.textLight : COLORS.textDark }}
								>
									100% Local Processing
								</h5>
								<p style={{ color: darkMode ? '#7A8BA3' : '#6B7B94' }}>
									All AI models run directly on your machine. No data ever leaves your device or
									gets sent to external servers.
								</p>
							</div>
						</div>
						<div className="col-md-6">
							<div
								className="p-4 rounded-4 h-100"
								style={{
									background: darkMode
										? 'rgba(42, 45, 53, 0.8)'
										: 'rgba(255, 255, 255, 0.9)',
									border: `1px solid ${darkMode ? 'rgba(74, 95, 127, 0.2)' : 'rgba(74, 95, 127, 0.1)'}`,
								}}
							>
								<h5
									className="fw-semibold mb-3"
									style={{ color: darkMode ? COLORS.textLight : COLORS.textDark }}
								>
									Optional Camera
								</h5>
								<p style={{ color: darkMode ? '#7A8BA3' : '#6B7B94' }}>
									The camera is completely optional and processes video locally. Only numerical
									emotion data is sent to enhance responses.
								</p>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Tech Stack Section */}
			<section
				id="tech-stack"
				data-animate
				className="py-5"
				style={{
					background: darkMode ? '#1a1d23' : '#F8F9FA',
					minHeight: '60vh',
					opacity: visibleSections.has('tech-stack') ? 1 : 0,
					transform: visibleSections.has('tech-stack')
						? 'translateY(0)'
						: 'translateY(30px)',
					transition: 'all 0.8s ease-out',
				}}
			>
				<div className="container" style={{ maxWidth: '800px' }}>
					<h2
						className="fw-bold mb-5 text-center"
						style={{ color: darkMode ? COLORS.textLight : COLORS.textDark }}
					>
						Built With
					</h2>
					<div className="row g-4 justify-content-center">
						{techStack.map((tech, index) => (
							<div key={index} className="col-6 col-md-3">
								<div
									className="text-center p-4 rounded-4 h-100"
									style={{
										background: darkMode
											? 'rgba(42, 45, 53, 0.8)'
											: 'rgba(255, 255, 255, 0.9)',
										border: `1px solid ${darkMode ? 'rgba(74, 95, 127, 0.2)' : 'rgba(74, 95, 127, 0.1)'}`,
									}}
								>
									<div className="fs-1 mb-2">{tech.icon}</div>
									<h6
										className="fw-semibold mb-1"
										style={{
											color: darkMode ? COLORS.textLight : COLORS.textDark,
										}}
									>
										{tech.name}
									</h6>
									<p
										className="small mb-0"
										style={{ color: darkMode ? '#7A8BA3' : '#6B7B94' }}
									>
										{tech.desc}
									</p>
								</div>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* Conversation Examples Section */}
			<section
				id="examples"
				data-animate
				className="py-5"
				style={{
					background: darkMode
						? 'rgba(74, 95, 127, 0.05)'
						: 'rgba(74, 95, 127, 0.03)',
					minHeight: '80vh',
					opacity: visibleSections.has('examples') ? 1 : 0,
					transform: visibleSections.has('examples')
						? 'translateY(0)'
						: 'translateY(30px)',
					transition: 'all 0.8s ease-out',
				}}
			>
				<div className="container" style={{ maxWidth: '800px' }}>
					<h2
						className="fw-bold mb-5 text-center"
						style={{ color: darkMode ? COLORS.textLight : COLORS.textDark }}
					>
						💬 Conversation Examples
					</h2>
					<div className="vstack gap-4">
						{examples.map((example, index) => (
							<div
								key={index}
								className="p-4 rounded-4"
								style={{
									background: darkMode
										? 'rgba(42, 45, 53, 0.8)'
										: 'rgba(255, 255, 255, 0.9)',
									border: `1px solid ${darkMode ? 'rgba(74, 95, 127, 0.2)' : 'rgba(74, 95, 127, 0.1)'}`,
								}}
							>
								<div className="d-flex gap-3 mb-3">
									<div
										className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
										style={{
											width: '32px',
											height: '32px',
											background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryLight} 100%)`,
										}}
									>
										<svg
											width="16"
											height="16"
											viewBox="0 0 24 24"
											fill="none"
											stroke="white"
											strokeWidth="2"
										>
											<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
											<circle cx="12" cy="7" r="4" />
										</svg>
									</div>
									<div>
										<p
											className="fw-semibold mb-1"
											style={{
												color: darkMode ? COLORS.textLight : COLORS.textDark,
											}}
										>
											You
										</p>
										<p
											className="mb-0"
											style={{
												color: darkMode ? '#A8B5C4' : '#4A5F7F',
											}}
										>
											{example.q}
										</p>
									</div>
								</div>
								<div className="d-flex gap-3">
									<div
										className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
										style={{
											width: '32px',
											height: '32px',
											background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryLight} 100%)`,
										}}
									>
										<span style={{ fontSize: '14px' }}>🌸</span>
									</div>
									<div>
										<p
											className="fw-semibold mb-1"
											style={{
												color: darkMode ? COLORS.textLight : COLORS.textDark,
											}}
										>
											Aira
										</p>
										<p
											className="mb-0"
											style={{
												color: darkMode ? '#A8B5C4' : '#4A5F7F',
											}}
										>
											{example.a}
										</p>
									</div>
								</div>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* How It Works Section */}
			<section
				id="how-it-works"
				data-animate
				className="py-5"
				style={{
					background: darkMode ? '#1a1d23' : '#F8F9FA',
					minHeight: '70vh',
					opacity: visibleSections.has('how-it-works') ? 1 : 0,
					transform: visibleSections.has('how-it-works')
						? 'translateY(0)'
						: 'translateY(30px)',
					transition: 'all 0.8s ease-out',
				}}
			>
				<div className="container" style={{ maxWidth: '800px' }}>
					<h2
						className="fw-bold mb-5 text-center"
						style={{ color: darkMode ? COLORS.textLight : COLORS.textDark }}
					>
						How It Works
					</h2>
					<div className="row g-4 justify-content-center">
						{[
							{ icon: '🎙️', title: 'Speak', desc: 'Just talk naturally to Aira' },
							{ icon: '🧠', title: 'Understand', desc: 'Aira processes your voice locally' },
							{ icon: '💬', title: 'Respond', desc: 'Get instant answers with voice' },
						].map((item, index) => (
							<div key={index} className="col-md-4">
								<div className="text-center position-relative">
									<div
										className="mx-auto mb-3 d-flex align-items-center justify-content-center rounded-circle"
										style={{
											width: '80px',
											height: '80px',
											background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryLight} 100%)`,
											fontSize: '2rem',
										}}
									>
										{item.icon}
									</div>
									<h5
										className="fw-semibold mb-2"
										style={{
											color: darkMode ? COLORS.textLight : COLORS.textDark,
										}}
									>
										{item.title}
									</h5>
									<p
										className="mb-0"
										style={{ color: darkMode ? '#7A8BA3' : '#6B7B94' }}
									>
										{item.desc}
									</p>
									{index < 2 && (
										<div
											className="position-absolute d-none d-md-block"
											style={{
												top: '40px',
												right: '-20%',
												width: '40%',
												height: '2px',
												background: darkMode
													? 'rgba(74, 95, 127, 0.3)'
													: 'rgba(74, 95, 127, 0.2)',
											}}
										/>
									)}
								</div>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* Footer CTA */}
			<section
				id="footer-cta"
				data-animate
				className="py-5"
				style={{
					background: darkMode
						? 'rgba(74, 95, 127, 0.1)'
						: 'rgba(74, 95, 127, 0.05)',
					opacity: visibleSections.has('footer-cta') ? 1 : 0,
					transform: visibleSections.has('footer-cta')
						? 'translateY(0)'
						: 'translateY(30px)',
					transition: 'all 0.8s ease-out',
				}}
			>
				<div className="container text-center" style={{ maxWidth: '600px' }}>
					<h3
						className="fw-bold mb-3"
						style={{ color: darkMode ? COLORS.textLight : COLORS.textDark }}
					>
						Ready to try Aira?
					</h3>
					<p
						className="mb-4"
						style={{ color: darkMode ? '#7A8BA3' : '#6B7B94' }}
					>
						Start chatting with your voice-enabled AI assistant now.
					</p>
					<button
						onClick={onStartChat}
						className="btn btn-lg px-5 py-3 rounded-pill fw-semibold shadow-lg"
						style={{
							background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryLight} 100%)`,
							border: 'none',
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
						Start Chatting
					</button>
				</div>
			</section>

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
				@keyframes bounce {
					0%, 20%, 50%, 80%, 100% {
						transform: translateY(0) translateX(-50%);
					}
					40% {
						transform: translateY(-10px) translateX(-50%);
					}
					60% {
						transform: translateY(-5px) translateX(-50%);
					}
				}
				.animate-fade-in {
					animation: fadeInUp 0.6s ease-out forwards;
					opacity: 0;
				}
				.animate-bounce {
					animation: bounce 2s infinite;
				}
			`}</style>
		</div>
	);
};

export default React.memo(Landing);
