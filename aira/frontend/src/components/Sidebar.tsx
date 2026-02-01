import 'bootstrap/dist/css/bootstrap.min.css';

const Sidebar = () => {
	return (
		<div className="d-flex flex-column vh-100 bg-light border-end sidebar">
			<div className="d-flex align-items-center justify-content-between p-3 border-bottom">
				<a href="/" className="d-flex align-items-center gap-2 text-decoration-none text-dark">
					<div className="d-flex align-items-center justify-content-center">
					</div>
					<span className="fw-medium fs-6">Aira</span>
				</a>
				<button
					className="btn btn-primary btn-sm d-flex align-items-center justify-content-center"
				>
					+
				</button>
			</div>

			{/* Conversations */}
			<div className="flex-grow-1 overflow-auto p-3">
				<div className="d-flex flex-column align-items-center justify-content-center h-100 text-center">
					<p className="fs-6 text-dark">No conversations yet</p>
					<p className="fs-6 text-muted mt-1">Start a new chat to begin</p>
				</div>
			</div>

			{/* Footer */}
			<div className="p-3 border-top">
				<div className="d-flex align-items-center gap-3">
					<div className="d-flex align-items-center justify-content-center rounded-circle bg-secondary" style={{ width: '32px', height: '32px' }}>
						<span className="fs-6 fw-medium text-white">U</span>
					</div>
					<div className="flex-grow-1 min-w-0">
						<p className="fs-6 fw-medium text-dark text-truncate">User</p>
						<p className="fs-6 text-muted">Free plan</p>
					</div>
				</div>
			</div>
		</div>
	);
};

export default Sidebar;
