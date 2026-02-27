import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { CameraFeatures } from '../types/camera';

interface CameraSensorProps {
	darkMode?: boolean;
	onClose?: () => void;
	onToggleDisplayMode?: () => void;
	isSpeaking?: boolean;
	isRecording?: boolean;
	isProcessing?: boolean;
	onVoiceStart?: () => void;
	onVoiceStop?: () => void;
	onFeaturesUpdate?: (features: CameraFeatures) => void;
}

const CameraSensor: React.FC<CameraSensorProps> = ({
	darkMode = false,
	onClose,
	onToggleDisplayMode,
	isSpeaking = false,
	isRecording = false,
	isProcessing = false,
	onVoiceStart,
	onVoiceStop,
	onFeaturesUpdate,
}) => {
	const [localIsRecording, setLocalIsRecording] = useState(false);
	const videoRef = useRef<HTMLVideoElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const animationFrameRef = useRef<number>(0);
	const lastVideoTimeRef = useRef<number>(-1);
	const [cameraReady, setCameraReady] = useState(false);
	const [faceDetected, setFaceDetected] = useState(false);
	const [debugInfo, setDebugInfo] = useState<string>('Initializing...');

	const handleVoiceToggle = () => {
		if (localIsRecording) {
			setLocalIsRecording(false);
			onVoiceStop?.();
		} else {
			setLocalIsRecording(true);
			onVoiceStart?.();
		}
	};

	const effectiveIsRecording = isRecording || localIsRecording;

	const calculateFeatures = useCallback((result: any): CameraFeatures | null => {
		if (!result.faceLandmarks || result.faceLandmarks.length === 0) {
			return null;
		}

		const landmarks = result.faceLandmarks[0];
		const blendshapes = result.faceBlendshapes?.[0]?.categories || [];

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

	const faceDetectedRef = useRef(faceDetected);
	faceDetectedRef.current = faceDetected;
	const calculateFeaturesRef = useRef(calculateFeatures);
	calculateFeaturesRef.current = calculateFeatures;
	const onFeaturesUpdateRef = useRef(onFeaturesUpdate);
	onFeaturesUpdateRef.current = onFeaturesUpdate;

	const predictWebcamRef = useRef<() => void>(() => {});

	const predictWebcam = useCallback(() => {
		if (!videoRef.current || !canvasRef.current) {
			animationFrameRef.current = requestAnimationFrame(predictWebcam);
			return;
		}

		const video = videoRef.current;
		const faceLandmarker = faceLandmarkerRef.current;

		if (video.currentTime !== lastVideoTimeRef.current) {
			lastVideoTimeRef.current = video.currentTime;

			if (faceLandmarker && video.videoWidth > 0) {
				try {
					const startTimeMs = performance.now();
					const result = faceLandmarker.detectForVideo(video, startTimeMs);

					const hasFace = result.faceLandmarks && result.faceLandmarks.length > 0;
					if (hasFace !== faceDetectedRef.current) {
						setFaceDetected(hasFace);
					}

					if (hasFace) {
						const features = calculateFeaturesRef.current(result);
						if (features) {
							onFeaturesUpdateRef.current?.(features);
							console.log('Camera features:', features);
						}
					}
				} catch (err) {
					console.error('Face detection error:', err);
				}
			}
		}

		animationFrameRef.current = requestAnimationFrame(predictWebcam);
	}, []);

	predictWebcamRef.current = predictWebcam;

	useEffect(() => {
		let stream: MediaStream | null = null;

		const initCamera = async () => {
			try {
				setDebugInfo('Accessing camera...');
				stream = await navigator.mediaDevices.getUserMedia({
					video: {
						width: { ideal: 640, min: 320 },
						height: { ideal: 480, min: 240 },
						facingMode: 'user',
					},
					audio: false,
				});

				streamRef.current = stream;

				if (videoRef.current) {
					videoRef.current.srcObject = stream;
					videoRef.current.onloadedmetadata = async () => {
						await videoRef.current?.play();
						setCameraReady(true);
						setDebugInfo('Loading face model...');

						try {
							const filesetResolver = await FilesetResolver.forVisionTasks(
								'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm'
							);

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

							faceLandmarkerRef.current = faceLandmarker;
							setDebugInfo('Face detection active');
							predictWebcamRef.current?.();
						} catch (err) {
							console.error('Failed to load face landmarker:', err);
							setDebugInfo('Camera active (no face detection)');
						}
					};
				}
			} catch (err) {
				console.error('Camera error:', err);
				setDebugInfo('Camera error');
			}
		};

		initCamera();

		return () => {
			stream?.getTracks().forEach(track => track.stop());
			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current);
			}
		};
	}, []);

	return (
		<div
			className="position-fixed top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center"
			style={{
				background: darkMode ? '#000' : '#1a1a2e',
				zIndex: 1001,
			}}
		>
			<div className="position-absolute d-flex gap-2" style={{ top: '20px', right: '20px', zIndex: 1002 }}>
				{onToggleDisplayMode && (
					<button onClick={onToggleDisplayMode} className="btn btn-sm d-flex align-items-center justify-content-center" style={{ background: darkMode ? 'rgba(74, 95, 127, 0.3)' : 'rgba(74, 95, 127, 0.2)', color: darkMode ? '#A8B5C4' : '#4A5F7F', border: `1px solid ${darkMode ? 'rgba(74, 95, 127, 0.4)' : 'rgba(74, 95, 127, 0.3)'}`, borderRadius: '8px', padding: '8px 12px', minWidth: '90px', height: '36px' }}>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
							<path d="M2.062 12.348a1 1 0 0 1 0-.696"></path>
							<path d="M10.5 17.5a1 1 0 0 1 0-.696"></path>
							<circle cx="12" cy="12" r="3"></circle>
							<path d="M12 2v2"></path>
							<path d="M12 20v2"></path>
							<path d="m4.93 4.93 1.41 1.41"></path>
							<path d="m17.66 17.66 1.41 1.41"></path>
						</svg>
						<span style={{ marginLeft: '6px' }}>Vision</span>
					</button>
				)}
				{onClose && (
					<button onClick={onClose} className="btn btn-sm d-flex align-items-center justify-content-center" style={{ background: darkMode ? 'rgba(220, 53, 69, 0.3)' : 'rgba(220, 53, 69, 0.2)', color: '#DC3545', border: `1px solid ${darkMode ? 'rgba(220, 53, 69, 0.4)' : 'rgba(220, 53, 69, 0.3)'}`, borderRadius: '8px', padding: '8px 12px', minWidth: '90px', height: '36px' }}>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
						<span style={{ marginLeft: '6px' }}>Back</span>
					</button>
				)}
			</div>

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
					}}
				/>

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
					{faceDetected ? '● Face detected' : cameraReady ? '○ No face' : '⟳ Loading...'}
				</div>
			</div>

			<p style={{ color: darkMode ? '#A8B5C4' : '#6B7B94', fontSize: '0.8rem', marginTop: '10px' }}>
				{debugInfo}
			</p>

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
						background: effectiveIsRecording
							? 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)'
							: 'linear-gradient(135deg, #4A5F7F 0%, #6B7B94 100%)',
						border: 'none',
						boxShadow: effectiveIsRecording
							? '0 0 50px rgba(220, 53, 69, 0.8)'
							: '0 8px 30px rgba(74, 95, 127, 0.4)',
						transition: 'all 0.3s ease',
						animation: effectiveIsRecording ? 'pulse 1.5s infinite' : 'none',
					}}
					title={effectiveIsRecording ? 'Stop Recording' : 'Start Recording'}
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
						{effectiveIsRecording ? (
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
					{effectiveIsRecording ? '🔴 Recording...' : isSpeaking ? '🎙️ Aira speaking...' : 'Tap to record'}
				</p>

				<style>{`
					@keyframes pulse {
						0%, 100% { transform: scale(1); box-shadow: 0 0 40px rgba(220, 53, 69, 0.6); }
						50% { transform: scale(1.05); box-shadow: 0 0 60px rgba(220, 53, 69, 0.8); }
					}
				`}</style>
			</div>
		</div>
	);
};

export default CameraSensor;
