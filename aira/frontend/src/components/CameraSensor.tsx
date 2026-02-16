import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { CameraFeatures } from '../types/camera';

interface CameraSensorProps {
	onFeaturesUpdate?: (features: CameraFeatures) => void;
	onVoiceStart?: () => void;
	onVoiceStop?: () => void;
	darkMode?: boolean;
	enabled?: boolean;
	isFullscreen?: boolean;
	onClose?: () => void;
	isProcessing?: boolean; // Add loading state for Aira processing
}

const CameraSensor: React.FC<CameraSensorProps> = ({
	onFeaturesUpdate,
	onVoiceStart,
	onVoiceStop,
	darkMode = false,
	enabled = true,
	isFullscreen = false,
	onClose,
	isProcessing = false,
}) => {
	const videoRef = useRef<HTMLVideoElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const animationFrameRef = useRef<number>(0);
	const lastVideoTimeRef = useRef<number>(-1);

	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [faceDetected, setFaceDetected] = useState(false);
	const [debugInfo, setDebugInfo] = useState<string>('Initializing...');
	const [isRecording, setIsRecording] = useState(false);
	const [cameraReady, setCameraReady] = useState(false);

	// Calculate facial features from landmarks
	const calculateFeatures = useCallback((result: any): CameraFeatures | null => {
		if (!result.faceLandmarks || result.faceLandmarks.length === 0) {
			return null;
		}

		const landmarks = result.faceLandmarks[0];
		const blendshapes = result.faceBlendshapes?.[0]?.categories || [];

		// Eye openness calculation
		const leftEyeTop = landmarks[159];
		const leftEyeBottom = landmarks[145];
		const leftEyeLeft = landmarks[33];
		const leftEyeRight = landmarks[133];

		const rightEyeTop = landmarks[386];
		const rightEyeBottom = landmarks[374];
		const rightEyeLeft = landmarks[362];
		const rightEyeRight = landmarks[263];

		const leftEyeHeight = Math.abs(leftEyeTop?.y - leftEyeBottom?.y) || 0;
		const leftEyeWidth = Math.abs(leftEyeLeft?.x - leftEyeRight?.x) || 1;
		const rightEyeHeight = Math.abs(rightEyeTop?.y - rightEyeBottom?.y) || 0;
		const rightEyeWidth = Math.abs(rightEyeLeft?.x - rightEyeRight?.x) || 1;

		const leftEyeOpenness = Math.min(leftEyeHeight / (leftEyeWidth * 0.4), 1);
		const rightEyeOpenness = Math.min(rightEyeHeight / (rightEyeWidth * 0.4), 1);
		const avgEyeOpenness = (leftEyeOpenness + rightEyeOpenness) / 2;

		const eyeBlinkLeft = blendshapes.find((c: any) => c.categoryName === 'eyeBlinkLeft')?.score || 0;
		const eyeBlinkRight = blendshapes.find((c: any) => c.categoryName === 'eyeBlinkRight')?.score || 0;
		const mouthSmileLeft = blendshapes.find((c: any) => c.categoryName === 'mouthSmileLeft')?.score || 0;
		const mouthSmileRight = blendshapes.find((c: any) => c.categoryName === 'mouthSmileRight')?.score || 0;

		const matrix = result.facialTransformationMatrixes?.[0];
		let headPitch = 0;
		let headYaw = 0;

		if (matrix?.data) {
			const data = matrix.data;
			headPitch = Math.atan2(data[6], data[10]) * (180 / Math.PI);
			headYaw = Math.atan2(-data[2], Math.sqrt(data[6] * data[6] + data[10] * data[10])) * (180 / Math.PI);
		}

		const smileScore = (mouthSmileLeft + mouthSmileRight) / 2;

		return {
			face_present: true,
			face_confidence: 1 - (eyeBlinkLeft + eyeBlinkRight) / 2,
			left_eye_openness: leftEyeOpenness,
			right_eye_openness: rightEyeOpenness,
			avg_eye_openness: avgEyeOpenness,
			blink_rate: Math.round((eyeBlinkLeft + eyeBlinkRight) * 50),
			head_pitch: Math.round(headPitch),
			head_yaw: Math.round(headYaw),
			smile_score: Math.round(smileScore * 100) / 100,
			timestamp: Date.now(),
		};
	}, []);

	// Use refs to avoid dependency issues
	const faceDetectedRef = useRef(faceDetected);
	faceDetectedRef.current = faceDetected;
	const calculateFeaturesRef = useRef(calculateFeatures);
	calculateFeaturesRef.current = calculateFeatures;
	const onFeaturesUpdateRef = useRef(onFeaturesUpdate);
	onFeaturesUpdateRef.current = onFeaturesUpdate;

	// Store predictWebcam in ref so init can access it without being dependency
	const predictWebcamRef = useRef<() => void>(() => { });

	// Process video frames
	const predictWebcam = useCallback(() => {
		if (!videoRef.current || !canvasRef.current) {
			animationFrameRef.current = requestAnimationFrame(predictWebcam);
			return;
		}

		const video = videoRef.current;
		const faceLandmarker = faceLandmarkerRef.current;

		// Check if video has new frame
		if (video.currentTime !== lastVideoTimeRef.current) {
			lastVideoTimeRef.current = video.currentTime;

			if (faceLandmarker && video.videoWidth > 0) {
				try {
					const startTimeMs = performance.now();
					const result = faceLandmarker.detectForVideo(video, startTimeMs);

					// Update face detection state using ref to check current value
					const hasFace = result.faceLandmarks && result.faceLandmarks.length > 0;
					if (hasFace !== faceDetectedRef.current) {
						setFaceDetected(hasFace);
					}

					// Calculate and send features using refs
					if (hasFace) {
						const features = calculateFeaturesRef.current(result);
						if (features) {
							onFeaturesUpdateRef.current?.(features);
						}
					}
				} catch (err) {
					console.error('Face detection error:', err);
				}
			}
		}

		animationFrameRef.current = requestAnimationFrame(predictWebcam);
	}, []);

	// Store the function in ref so init can access it
	predictWebcamRef.current = predictWebcam;

	// Initialize camera
	useEffect(() => {
		if (!enabled) return;

		setDebugInfo('Requesting camera');
		setIsLoading(true);
		setError(null);
		setCameraReady(false);

		let isActive = true;
		let stream: MediaStream | null = null;
		let timeoutId: ReturnType<typeof setTimeout>;

		const init = async () => {
			try {
				// First get camera access
				console.log('CameraSensor: Getting user media');
				setDebugInfo('Accessing camera...');

				stream = await navigator.mediaDevices.getUserMedia({
					video: {
						width: { ideal: 640, min: 320 },
						height: { ideal: 480, min: 240 },
						facingMode: 'user',
					},
					audio: false,
				}).catch((err) => {
					// Specific error messages
					if (err.name === 'NotAllowedError') {
						throw new Error('Camera permission denied. Please allow camera access.');
					} else if (err.name === 'NotFoundError') {
						throw new Error('No camera found on this device.');
					} else if (err.name === 'NotReadableError') {
						throw new Error('Camera is already in use by another application.');
					} else if (err.name === 'SecurityError') {
						throw new Error('Camera access requires HTTPS or localhost.');
					}
					throw err;
				});
				if (!isActive) {
					stream.getTracks().forEach((track) => track.stop());
					return;
				}

				console.log('CameraSensor: Got stream with', stream.getVideoTracks().length, 'video tracks');
				streamRef.current = stream;

				const videoTrack = stream.getVideoTracks()[0];
				if (videoTrack) {
					console.log('CameraSensor: Video track settings:', videoTrack.getSettings());
				}

				// Set stream to video element
				const video = videoRef.current;
				if (video) {
					console.log('CameraSensor: Setting srcObject to video element');
					video.srcObject = stream;

					// Wait for video to be ready with timeout
					let metadataLoaded = false;

					const checkVideoReady = () => {
						if (!isActive) return;

						console.log('CameraSensor: Checking video ready - readyState:', video.readyState);

						// readyState >= 2 means HAVE_CURRENT_DATA or better
						if (video.readyState >= 2 && !metadataLoaded) {
							metadataLoaded = true;
							console.log('CameraSensor: Video has data, attempting play...');
							setDebugInfo('Starting video...');

							video.play().then(() => {
								if (!isActive) return;
								console.log('CameraSensor: Video playing successfully');
								setDebugInfo('Camera active');
								setCameraReady(true);
								setIsLoading(false);

								// Start face detection loop
								predictWebcamRef.current?.();
							}).catch((err) => {
								if (!isActive) return;
								console.error('CameraSensor: Play error:', err);
								setError('Failed to play video: ' + err.message);
								setDebugInfo('Play error: ' + err.message);
								setIsLoading(false);
							});
						} else if (!metadataLoaded) {
							// Poll again in 100ms
							timeoutId = setTimeout(checkVideoReady, 100);
						}
					};

					// Also listen to events as backup
					video.onloadedmetadata = () => {
						console.log('CameraSensor: onloadedmetadata fired');
						if (!metadataLoaded) {
							checkVideoReady();
						}
					};

					video.onloadeddata = () => {
						console.log('CameraSensor: onloadeddata fired');
						if (!metadataLoaded) {
							checkVideoReady();
						}
					};

					video.onerror = (err) => {
						console.error('CameraSensor: Video error:', err);
						setError('Video element error');
						setDebugInfo('Video error occurred');
						setIsLoading(false);
					};

					// Start checking
					checkVideoReady();

					// Timeout fallback after 10 seconds
					setTimeout(() => {
						if (isActive && !metadataLoaded) {
							console.error('CameraSensor: Timeout waiting for video');
							setError('Camera timeout - video not starting');
							setDebugInfo('Timeout: readyState=' + video.readyState);
							setIsLoading(false);
						}
					}, 10000);
				} else {
					console.error('CameraSensor: Video ref is null');
					setError('Video element not found');
					setDebugInfo('Video ref null');
					setIsLoading(false);
				}
			} catch (err: any) {
				console.error('CameraSensor: Error:', err);
				setError(err.message || 'Camera access failed');
				setDebugInfo('Error: ' + (err.message || 'Unknown error'));
				setIsLoading(false);
			}
		};

		// Delay to ensure DOM is ready, then check if video ref exists
		const initTimeout = setTimeout(() => {
			if (videoRef.current) {
				init();
			} else {
				console.log('CameraSensor: Video ref not ready, retrying...');
				setDebugInfo('Waiting for video element...');
				// Retry after a short delay
				setTimeout(() => {
					if (videoRef.current && isActive) {
						init();
					} else if (isActive) {
						console.error('CameraSensor: Video ref still null after retry');
						setError('Video element not found');
						setDebugInfo('Video ref null - DOM issue');
						setIsLoading(false);
					}
				}, 500);
			}
		}, 100);

		return () => {
			isActive = false;
			clearTimeout(initTimeout);
			clearTimeout(timeoutId);
			console.log('CameraSensor: Cleaning up...');

			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current);
			}

			stream?.getTracks().forEach((track) => track.stop());

			const video = videoRef.current;
			if (video) {
				video.srcObject = null;
				video.onloadedmetadata = null;
				video.onloadeddata = null;
				video.onerror = null;
			}
		};
	}, [enabled]); // Removed predictWebcam from deps to prevent re-renders

	// Load face landmarker after camera is ready
	useEffect(() => {
		if (!cameraReady) return;

		let isActive = true;

		const loadModel = async () => {
			try {
				setDebugInfo('Loading face model...');

				const filesetResolver = await FilesetResolver.forVisionTasks(
					'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm'
				);

				if (!isActive) return;

				const faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
					baseOptions: {
						modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
						delegate: 'GPU',
					},
					outputFaceBlendshapes: true,
					outputFacialTransformationMatrixes: true,
					runningMode: 'VIDEO',
					numFaces: 1,
				});

				if (!isActive) return;

				faceLandmarkerRef.current = faceLandmarker;
				console.log('Face Landmarker loaded successfully');
				setDebugInfo('Face detection active');
			} catch (err: any) {
				console.error('Failed to load face landmarker:', err);
				setDebugInfo('Camera active (no face detection)');
			}
		};

		loadModel();

		return () => {
			isActive = false;
		};
	}, [cameraReady]);

	// Handle voice toggle
	const handleVoiceToggle = () => {
		if (isRecording) {
			setIsRecording(false);
			onVoiceStop?.();
		} else {
			setIsRecording(true);
			onVoiceStart?.();
		}
	};

	if (!enabled) {
		return null;
	}

	if (error) {
		return (
			<div
				className="position-fixed top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center"
				style={{
					background: darkMode ? '#000' : '#1a1a2e',
					zIndex: 1000,
				}}
			>
				<div className="text-center p-4">
					<div className="mb-3" style={{ color: '#dc3545', fontSize: '3rem' }}>📷</div>
					<h4 style={{ color: darkMode ? '#F5F3F0' : '#2C3A4F' }}>Camera Error</h4>
					<p style={{ color: darkMode ? '#A8B5C4' : '#6B7B94' }}>{error}</p>
					<p className="small" style={{ color: darkMode ? '#7A8BA3' : '#8B9AAF' }}>
						{debugInfo}
					</p>
					<button
						onClick={onClose}
						className="btn mt-3"
						style={{
							background: '#4A5F7F',
							color: 'white',
							borderRadius: '20px',
							padding: '8px 24px',
						}}
					>
						Back to Chat
					</button>
				</div>
			</div>
		);
	}

	// Render fullscreen camera view when enabled
	if (!isFullscreen) {
		// When not in fullscreen, render hidden video element to keep refs working
		return (
			<>
				<video
					ref={videoRef}
					style={{ display: 'none' }}
					playsInline
					muted
					autoPlay
				/>
				<canvas
					ref={canvasRef}
					width={640}
					height={480}
					style={{ display: 'none' }}
				/>
			</>
		);
	}

	// Fullscreen camera view
	return (
		<div
			className="position-fixed top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center"
			style={{
				background: darkMode ? '#000' : '#1a1a2e',
				zIndex: 1000,
			}}
		>
			{/* Loading State */}
			{isLoading && (
				<div className="position-absolute d-flex flex-column align-items-center gap-3" style={{ zIndex: 10 }}>
					<div
						className="spinner-border"
						role="status"
						style={{ width: '3rem', height: '3rem', color: '#4A5F7F' }}
					>
						<span className="visually-hidden">Loading...</span>
					</div>
					<p style={{ color: darkMode ? '#A8B5C4' : '#6B7B94' }}>{debugInfo}</p>
				</div>
			)}

			{/* Video Container */}
			<div
				className="position-relative"
				style={{
					width: 'min(80vw, 600px)',
					height: 'min(80vw, 600px)',
					maxWidth: '600px',
					maxHeight: '600px',
					borderRadius: '50%',
					overflow: 'hidden',
					border: `4px solid ${faceDetected ? '#28a745' : cameraReady ? '#4A5F7F' : '#6c757d'}`,
					boxShadow: faceDetected
						? '0 0 60px rgba(40, 167, 69, 0.4)'
						: '0 0 60px rgba(74, 95, 127, 0.3)',
					background: '#000',
				}}
			>
				<video
					ref={videoRef}
					width={640}
					height={480}
					style={{
						width: '100%',
						height: '100%',
						objectFit: 'cover',
						transform: 'scaleX(-1)',
						opacity: cameraReady ? 1 : 0.3,
						transition: 'opacity 0.3s ease',
						background: '#000',
					}}
					playsInline
					muted
					autoPlay
				/>

				{/* Canvas overlay for face landmarks */}
				<canvas
					ref={canvasRef}
					width={640}
					height={480}
					style={{
						position: 'absolute',
						top: 0,
						left: 0,
						width: '100%',
						height: '100%',
						transform: 'scaleX(-1)',
						pointerEvents: 'none',
						opacity: cameraReady ? 1 : 0,
						transition: 'opacity 0.3s ease',
					}}
				/>

				{/* Status Badge */}
				<div
					className="position-absolute px-3 py-1 rounded-pill"
					style={{
						top: '20px',
						left: '50%',
						transform: 'translateX(-50%)',
						background: faceDetected ? 'rgba(40, 167, 69, 0.9)' : cameraReady ? 'rgba(74, 95, 127, 0.9)' : 'rgba(108, 117, 125, 0.9)',
						color: 'white',
						fontSize: '0.85rem',
						fontWeight: 600,
						backdropFilter: 'blur(10px)',
						zIndex: 5,
					}}
				>
					{faceDetected ? '● Live' : cameraReady ? '○ Waiting...' : '⟳ Loading...'}
				</div>

				{/* Status indicator - shows processing/recording/ready states */}
				{cameraReady && (
					<div
						className="position-absolute px-3 py-1 rounded-pill"
						style={{
							bottom: '20px',
							left: '50%',
							transform: 'translateX(-50%)',
							background: isProcessing
								? 'rgba(40, 167, 69, 0.9)'
								: isRecording
									? 'rgba(220, 53, 69, 0.9)'
									: 'rgba(255, 193, 7, 0.9)',
							color: 'white',
							fontSize: '0.85rem',
							fontWeight: 600,
							backdropFilter: 'blur(10px)',
							zIndex: 5,
						}}
					>
						{isProcessing
							? '⟳ Aira thinking...'
							: isRecording
								? '🔴 Recording'
								: '⏸️ Tap to speak'}
					</div>
				)}
			</div>

			{/* Controls - Record Button Only */}
			<div className="mt-4 d-flex flex-column align-items-center gap-3">
				{cameraReady && (
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
				)}

				<p style={{ color: darkMode ? '#A8B5C4' : '#6B7B94', fontSize: '0.85rem' }}>
					{isRecording ? '🔴 Recording...' : 'Tap to record'}
				</p>

				{/* Back/Close Button */}
				<button
					onClick={onClose}
					className="btn rounded-circle d-flex align-items-center justify-content-center mt-2"
					style={{
						width: '44px',
						height: '44px',
						background: 'rgba(255,255,255,0.1)',
						border: '2px solid rgba(255,255,255,0.3)',
						color: 'white',
						backdropFilter: 'blur(10px)',
					}}
					title="Close camera"
				>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
						<line x1="18" y1="6" x2="6" y2="18"></line>
						<line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				</button>
			</div>

			<style>{`
				@keyframes pulse {
					0%, 100% { transform: scale(1); box-shadow: 0 0 40px rgba(220, 53, 69, 0.6); }
					50% { transform: scale(1.05); box-shadow: 0 0 60px rgba(220, 53, 69, 0.8); }
				}
			`}</style>
		</div>
	);
};

export default React.memo(CameraSensor);
