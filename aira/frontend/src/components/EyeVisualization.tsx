import 'bootstrap/dist/css/bootstrap.min.css';
import React, { useEffect, useRef, useState, useCallback } from 'react';

type EmotionType = 'happy' | 'focused' | 'neutral' | 'stressed' | 'fatigued' | 'disengaged' | 'sleep';

interface EyeVisualizationProps {
	emotion: string | null;
	darkMode?: boolean;
	onClose?: () => void;
	onToggleDisplayMode?: () => void;
	isSpeaking?: boolean;
	isRecording?: boolean;
	isProcessing?: boolean;
	onVoiceStart?: () => void;
	onVoiceStop?: () => void;
}

const EYE_BITMAPS: Record<string, number[][]> = {
	neutral: [
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0],
		[0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0],
		[0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0],
		[0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0],
		[0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0],
		[0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0],
		[0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0],
		[0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0],
		[0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0],
		[0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0],
		[0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0],
		[0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0],
		[0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0],
		[0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0],
		[0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0],
		[0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0],
		[0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0],
		[0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0],
		[0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0],
		[0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0],
		[0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0],
		[0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
	],
	sleep: Array(32).fill(null).map(() => Array(32).fill(0)),
	happy: [
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0],
		[0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0],
		[0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0],
		[0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0],
		[0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0],
		[0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0],
		[0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
	],
	focused: Array(32).fill(null).map((_, i) => {
		if (i < 4 || i > 26) return Array(32).fill(0);
		if (i === 4) return [0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0];
		if (i === 5) return [0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0];
		if (i >= 6 && i <= 24) return [0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0];
		if (i === 25) return [0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0];
		if (i === 26) return [0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0];
		return Array(32).fill(0);
	}),
	stressed: Array(32).fill(null).map(() => Array(32).fill(0)),
	disengaged: Array(32).fill(null).map(() => Array(32).fill(0)),
	blink: [
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0],
		[0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0],
		[0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
	],
};

const EYE_COLORS: Record<string, string> = {
	neutral: '#4A5F7F',
	focused: '#4A5F7F',
	happy: '#4CAF50',
	stressed: '#E53935',
	fatigued: '#5C6BC0',
	disengaged: '#78909C',
	sleep: '#5C6BC0',
	blink: '#4A5F7F',
};

const EyeVisualization: React.FC<EyeVisualizationProps> = ({
	emotion,
	darkMode = false,
	onClose,
	onToggleDisplayMode,
	isSpeaking = false,
	isRecording = false,
	isProcessing = false,
	onVoiceStart,
	onVoiceStop,
}) => {
	const [localIsRecording, setLocalIsRecording] = useState(false);

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
	const effectiveIsSpeaking = isSpeaking;
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [currentEmotion, setCurrentEmotion] = useState<EmotionType>('neutral');
	const [isBlinking, setIsBlinking] = useState(false);
	const animationRef = useRef<number | null>(null);
	const lastBlinkTimeRef = useRef<number>(0);
	const lastMoveTimeRef = useRef<number>(0);
	const eyeOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

	const mapEmotionToType = useCallback((emotionStr: string | null): EmotionType => {
		if (!emotionStr) return 'neutral';
		const e = emotionStr.toLowerCase();
		if (e.includes('happy') || e.includes('😊')) return 'happy';
		if (e.includes('focused') || e.includes('🎯')) return 'focused';
		if (e.includes('stressed') || e.includes('😰')) return 'stressed';
		if (e.includes('fatigued') || e.includes('😴') || e.includes('tired')) return 'sleep';
		if (e.includes('disengaged') || e.includes('😶') || e.includes('away')) return 'disengaged';
		return 'neutral';
	}, []);

	useEffect(() => {
		if (effectiveIsSpeaking || isProcessing) {
			setCurrentEmotion('happy');
		} else {
			setCurrentEmotion('neutral');
		}
	}, [effectiveIsSpeaking, isProcessing]);

	const drawEye = useCallback((ctx: CanvasRenderingContext2D, bitmap: number[][], x: number, y: number, scale: number, color: string) => {
		const pixelSize = scale;
		for (let row = 0; row < bitmap.length; row++) {
			for (let col = 0; col < bitmap[row].length; col++) {
				if (bitmap[row][col] === 1) {
					ctx.fillStyle = color;
					ctx.fillRect(x + col * pixelSize, y + row * pixelSize, pixelSize, pixelSize);
				}
			}
		}
	}, []);

	const render = useCallback(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const width = canvas.width;
		const height = canvas.height;

		ctx.fillStyle = darkMode ? '#1a1d23' : '#F8F9FA';
		ctx.fillRect(0, 0, width, height);

		const eyeScale = Math.min(width, height) / 64;
		const eyeWidth = 32 * eyeScale;
		const eyeHeight = 32 * eyeScale;
		const eyeY = height / 2 - eyeHeight / 2 + eyeOffsetRef.current.y * eyeScale;
		const centerX = width / 2;
		const leftEyeX = centerX - eyeWidth - 15 * eyeScale + eyeOffsetRef.current.x * eyeScale;
		const rightEyeX = centerX + 15 * eyeScale + eyeOffsetRef.current.x * eyeScale;

		let leftBitmap: number[][];
		let rightBitmap: number[][];
		let eyeColor = EYE_COLORS[currentEmotion] || EYE_COLORS.neutral;

		if (isBlinking) {
			leftBitmap = EYE_BITMAPS.blink;
			rightBitmap = EYE_BITMAPS.blink;
			eyeColor = EYE_COLORS.blink;
		} else {
			switch (currentEmotion) {
				case 'happy':
					leftBitmap = EYE_BITMAPS.happy;
					rightBitmap = EYE_BITMAPS.happy;
					break;
				case 'sleep':
					leftBitmap = EYE_BITMAPS.sleep;
					rightBitmap = EYE_BITMAPS.sleep;
					break;
				case 'focused':
					leftBitmap = EYE_BITMAPS.focused;
					rightBitmap = EYE_BITMAPS.focused;
					break;
				case 'stressed':
					leftBitmap = EYE_BITMAPS.stressed;
					rightBitmap = EYE_BITMAPS.stressed;
					break;
				case 'disengaged':
					leftBitmap = EYE_BITMAPS.disengaged;
					rightBitmap = EYE_BITMAPS.disengaged;
					break;
				default:
					leftBitmap = EYE_BITMAPS.neutral;
					rightBitmap = EYE_BITMAPS.neutral;
			}
		}

		drawEye(ctx, leftBitmap, leftEyeX, eyeY, eyeScale, eyeColor);
		drawEye(ctx, rightBitmap, rightEyeX, eyeY, eyeScale, eyeColor);

		const now = Date.now();

		if (now - lastBlinkTimeRef.current > 2000 + Math.random() * 4000) {
			setIsBlinking(true);
			lastBlinkTimeRef.current = now;
			setTimeout(() => {
				setIsBlinking(false);
			}, 100 + Math.random() * 100);
		}

		if (now - lastMoveTimeRef.current > 1500 + Math.random() * 3000) {
			const moves = [
				{ x: 0, y: 0 },
				{ x: -1, y: -0.5 },
				{ x: 1, y: -0.5 },
				{ x: -0.5, y: 0.5 },
				{ x: 0.5, y: 0.5 },
				{ x: -1, y: 0 },
				{ x: 1, y: 0 },
			];
			const randomMove = moves[Math.floor(Math.random() * moves.length)];
			eyeOffsetRef.current = randomMove;
			lastMoveTimeRef.current = now;
		}

		animationRef.current = requestAnimationFrame(render);
	}, [currentEmotion, isBlinking, darkMode, drawEye]);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const resizeCanvas = () => {
			canvas.width = window.innerWidth;
			canvas.height = window.innerHeight;
		};

		resizeCanvas();
		window.addEventListener('resize', resizeCanvas);

		animationRef.current = requestAnimationFrame(render);

		return () => {
			window.removeEventListener('resize', resizeCanvas);
			if (animationRef.current) {
				cancelAnimationFrame(animationRef.current);
			}
		};
	}, [render]);

	const getEmotionLabel = () => {
		switch (currentEmotion) {
			case 'happy': return '😊 Happy';
			case 'focused': return '🎯 Focused';
			case 'stressed': return '😰 Stressed';
			case 'sleep': return '😴 Sleepy';
			case 'disengaged': return '😶 Away';
			default: return '😐 Neutral';
		}
	};

	return (
		<div className="position-fixed" style={{ top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 1001 }}>
			<canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
			
			<div className="position-absolute d-flex gap-2" style={{ top: '20px', right: '20px', zIndex: 1002 }}>
				{onToggleDisplayMode && (
					<button onClick={onToggleDisplayMode} className="btn btn-sm d-flex align-items-center justify-content-center" style={{ background: darkMode ? 'rgba(74, 95, 127, 0.3)' : 'rgba(74, 95, 127, 0.2)', color: darkMode ? '#A8B5C4' : '#4A5F7F', border: `1px solid ${darkMode ? 'rgba(74, 95, 127, 0.4)' : 'rgba(74, 95, 127, 0.3)'}`, borderRadius: '8px', padding: '8px 12px', minWidth: '90px', height: '36px' }}>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
							<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
							<circle cx="12" cy="13" r="4"></circle>
						</svg>
						<span style={{ marginLeft: '6px' }}>Yourself</span>
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
					{effectiveIsRecording ? '🔴 Recording...' : effectiveIsSpeaking ? '🎙️ Aira speaking...' : 'Tap to record'}
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

export default EyeVisualization;
