import 'bootstrap/dist/css/bootstrap.min.css';
import React from 'react';

interface Message {
	sender: 'user' | 'aira';
	text: string;
}

interface Conversation {
	id: string;
	title: string;
	messages: Message[];
	createdAt: Date;
	updatedAt: Date;
}

interface SidebarProps {
	darkMode?: boolean;
	conversations?: Conversation[];
	currentConversationId?: string | null;
	onNewConversation?: () => void;
	onSwitchConversation?: (id: string) => void;
	onDeleteConversation?: (id: string) => void;
}

// Color palette matching the theme
const COLORS = {
	primary: '#4A5F7F',
	primaryLight: '#6B7B94',
	primaryDark: '#3A4A5F',
	textLight: '#F5F3F0',
	textDark: '#2C3A4F',
};

const Sidebar: React.FC<SidebarProps> = ({ 
	darkMode = false, 
	conversations = [],
	currentConversationId,
	onNewConversation,
	onSwitchConversation,
	onDeleteConversation
}) => {
	// Format date for display
	const formatDate = (date: Date) => {
		const now = new Date();
		const convDate = new Date(date);
		const diffTime = Math.abs(now.getTime() - convDate.getTime());
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
		
		if (diffDays === 1) return 'Today';
		if (diffDays === 2) return 'Yesterday';
		if (diffDays <= 7) return `${diffDays} days ago`;
		return convDate.toLocaleDateString();
	};

	return (
		<div 
			className="d-flex flex-column sidebar"
			style={{
				width: '280px',
				height: '100vh',
				position: 'fixed',
				left: 0,
				top: 0,
				background: darkMode ? '#1a1d23' : '#F8F9FA',
				borderRight: `1px solid ${darkMode ? '#2A2D35' : '#E8EAED'}`,
				zIndex: 1000,
			}}
		>
			{/* Header */}
			<div 
				className="d-flex align-items-center justify-content-between p-3"
				style={{
					borderBottom: `1px solid ${darkMode ? '#2A2D35' : '#E8EAED'}`,
				}}
			>
				<a 
					href="/" 
					className="d-flex align-items-center gap-2 text-decoration-none"
					style={{ color: darkMode ? COLORS.textLight : COLORS.textDark }}
				>
					<div 
						className="rounded-circle d-flex align-items-center justify-content-center"
						style={{
							width: '28px',
							height: '28px',
							background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryLight} 100%)`,
						}}
					>
						<span style={{ fontSize: '14px' }}>🌸</span>
					</div>
					<span className="fw-semibold">Aira</span>
				</a>
				<button
					className="btn btn-sm d-flex align-items-center justify-content-center"
					onClick={onNewConversation}
					style={{
						width: '32px',
						height: '32px',
						borderRadius: '8px',
						background: darkMode ? 'rgba(74, 95, 127, 0.2)' : 'rgba(74, 95, 127, 0.1)',
						color: darkMode ? '#A8B5C4' : COLORS.primary,
						border: `1px solid ${darkMode ? 'rgba(74, 95, 127, 0.3)' : 'rgba(74, 95, 127, 0.15)'}`,
						transition: 'all 0.2s ease',
					}}
					onMouseEnter={(e) => {
						e.currentTarget.style.background = darkMode ? 'rgba(74, 95, 127, 0.35)' : 'rgba(74, 95, 127, 0.2)';
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.background = darkMode ? 'rgba(74, 95, 127, 0.2)' : 'rgba(74, 95, 127, 0.1)';
					}}
					title="New conversation"
				>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
						<line x1="12" y1="5" x2="12" y2="19"></line>
						<line x1="5" y1="12" x2="19" y2="12"></line>
					</svg>
				</button>
			</div>

			{/* Conversations List */}
			<div className="flex-grow-1 overflow-auto py-2">
				{conversations.length === 0 ? (
					<div className="d-flex flex-column align-items-center justify-content-center h-100 text-center px-3">
						<div 
							className="rounded-circle d-flex align-items-center justify-content-center mb-3"
							style={{
								width: '48px',
								height: '48px',
								background: darkMode ? 'rgba(74, 95, 127, 0.15)' : 'rgba(74, 95, 127, 0.08)',
							}}
						>
							<svg 
								width="24" 
								height="24" 
								viewBox="0 0 24 24" 
								fill="none" 
								stroke={darkMode ? '#5A6B7F' : '#8B9AAF'} 
								strokeWidth="2" 
								strokeLinecap="round" 
								strokeLinejoin="round"
							>
								<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
							</svg>
						</div>
						<p style={{ color: darkMode ? '#7A8BA3' : '#6B7B94', fontSize: '0.95rem' }}>
							No conversations yet
						</p>
						<p style={{ color: darkMode ? '#5A6B7F' : '#8B9AAF', fontSize: '0.85rem', marginTop: '4px' }}>
							Start a new chat to begin
						</p>
					</div>
				) : (
					<div className="d-flex flex-column gap-1 px-2">
						{conversations.map((conv) => (
							<div
								key={conv.id}
								data-conversation="true"
								onClick={() => onSwitchConversation?.(conv.id)}
								className="d-flex align-items-center gap-2 p-2 rounded-3 cursor-pointer conversation-item"
								style={{
									background: currentConversationId === conv.id
										? (darkMode ? 'rgba(74, 95, 127, 0.25)' : 'rgba(74, 95, 127, 0.12)')
										: 'transparent',
									border: `1px solid ${currentConversationId === conv.id
										? (darkMode ? 'rgba(74, 95, 127, 0.4)' : 'rgba(74, 95, 127, 0.2)')
										: 'transparent'}`,
									cursor: 'pointer',
									transition: 'all 0.2s ease',
								}}
								onMouseEnter={(e) => {
									if (currentConversationId !== conv.id) {
										e.currentTarget.style.background = darkMode ? 'rgba(74, 95, 127, 0.15)' : 'rgba(74, 95, 127, 0.08)';
									}
								}}
								onMouseLeave={(e) => {
									if (currentConversationId !== conv.id) {
										e.currentTarget.style.background = 'transparent';
									}
								}}
							>
								<div className="flex-grow-1 min-w-0">
									<p 
										className="fw-medium text-truncate mb-0"
										style={{ 
											color: darkMode ? COLORS.textLight : COLORS.textDark,
											fontSize: '0.9rem'
										}}
									>
										{conv.title}
									</p>
									<p 
										className="mb-0"
										style={{ 
											color: darkMode ? '#5A6B7F' : '#8B9AAF',
											fontSize: '0.75rem'
										}}
									>
										{formatDate(conv.updatedAt)} • {conv.messages.length} messages
									</p>
								</div>
								<button
									onClick={(e) => {
										e.stopPropagation();
										onDeleteConversation?.(conv.id);
									}}
									className="btn btn-sm d-flex align-items-center justify-content-center opacity-0"
									style={{
										width: '24px',
										height: '24px',
										borderRadius: '4px',
										background: 'transparent',
										color: darkMode ? '#5A6B7F' : '#8B9AAF',
										border: 'none',
										padding: 0,
										transition: 'all 0.2s ease'
									}}
									onMouseEnter={(e) => {
										e.currentTarget.style.color = '#DC3545';
										e.currentTarget.style.background = darkMode ? 'rgba(220, 53, 69, 0.1)' : 'rgba(220, 53, 69, 0.05)';
									}}
									onMouseLeave={(e) => {
										e.currentTarget.style.color = darkMode ? '#5A6B7F' : '#8B9AAF';
										e.currentTarget.style.background = 'transparent';
									}}
									title="Delete conversation"
								>
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
										<line x1="18" y1="6" x2="6" y2="18"></line>
										<line x1="6" y1="6" x2="18" y2="18"></line>
									</svg>
								</button>
							</div>
						))}
					</div>
				)}
			</div>

			<style>{`
				/* Show delete button on hover */
				.conversation-item:hover button {
					opacity: 1 !important;
				}
			`}</style>

			{/* Footer */}
			<div 
				className="p-3"
				style={{
					borderTop: `1px solid ${darkMode ? '#2A2D35' : '#E8EAED'}`,
				}}
			>
				<div className="d-flex align-items-center gap-3">
					<div 
						className="d-flex align-items-center justify-content-center rounded-circle"
						style={{ 
							width: '36px', 
							height: '36px',
							background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryLight} 100%)`,
						}}
					>
						<svg 
							width="20" 
							height="20" 
							viewBox="0 0 24 24" 
							fill="none" 
							stroke="white" 
							strokeWidth="2" 
							strokeLinecap="round" 
							strokeLinejoin="round"
						>
							<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
							<circle cx="12" cy="7" r="4"></circle>
						</svg>
					</div>
					<div className="flex-grow-1 min-w-0">
						<p 
							className="fw-medium text-truncate mb-0"
							style={{ color: darkMode ? COLORS.textLight : COLORS.textDark, fontSize: '0.95rem' }}
						>
							User
						</p>
						<p 
							className="mb-0"
							style={{ color: darkMode ? '#5A6B7F' : '#8B9AAF', fontSize: '0.8rem' }}
						>
							Free plan
						</p>
					</div>
				</div>
			</div>
		</div>
	);
};

export default Sidebar;
