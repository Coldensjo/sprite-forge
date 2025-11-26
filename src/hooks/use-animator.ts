/**
 * useAnimator - React hook for frame-accurate animation control
 * Based on Object Builder's Animator.as (lines 27-268)
 */

import type { ThingType, FrameDuration, ThingCategory } from '@/lib/tibia/types';

import { useRef, useState, useEffect, useCallback } from 'react';
import {
	getLoopFrame,
	getStartFrame,
	getFrameDuration,
	getPingPongFrame,
	AnimationDirection,
	shouldSkipFirstFrame,
	generateDefaultDurations
} from '@/lib/tibia/animation';

export interface AnimatorState {
	isPlaying: boolean;
	isComplete: boolean;
	currentFrame: number;
}

export interface AnimatorControls {
	play: () => void;
	stop: () => void;
	pause: () => void;
	reset: () => void;
	setFrame: (frame: number) => void;
}

export interface UseAnimatorOptions {
	thing: ThingType;
	autoPlay?: boolean;
	category: ThingCategory;
	onComplete?: () => void;
}

/**
 * Hook for managing animation timing and frame advancement
 * Matches Object Builder's Animator behavior exactly
 */
export function useAnimator({
	thing,
	category,
	onComplete,
	autoPlay = false
}: UseAnimatorOptions): AnimatorState & AnimatorControls {
	// Animation state (from Animator.as lines 33-45)
	const [currentFrame, setCurrentFrame] = useState<number>(0);
	const [isPlaying, setIsPlaying] = useState(autoPlay && thing.isAnimation);
	const [isComplete, setIsComplete] = useState(false);

	// Internal state refs (persisted across renders)
	const lastTimeRef = useRef<number>(0);
	const currentFrameDurationRef = useRef<number>(0);
	const currentLoopRef = useRef<number>(0);
	const currentDirectionRef = useRef<number>(AnimationDirection.FORWARD);
	const animationFrameIdRef = useRef<number>(0);
	const skipFirstFrameRef = useRef<boolean>(false);

	// Get or generate frame durations
	const durationsRef = useRef<FrameDuration[]>(generateDefaultDurations(thing, category));

	// Update durations when thing changes
	useEffect(() => {
		durationsRef.current = generateDefaultDurations(thing, category);
		skipFirstFrameRef.current = shouldSkipFirstFrame(thing, category);
	}, [thing, category]);

	/**
	 * Animation update loop (based on Animator.as lines 127-160)
	 * Called on every requestAnimationFrame when playing
	 */
	const updateAnimation = useCallback(
		(timestamp: number) => {
			if (!isPlaying) return;

			// Initialize lastTime on first frame
			if (lastTimeRef.current === 0) {
				lastTimeRef.current = timestamp;
				currentFrameDurationRef.current = getFrameDuration(durationsRef.current[currentFrame]);
				animationFrameIdRef.current = requestAnimationFrame(updateAnimation);
				return;
			}

			const elapsed = timestamp - lastTimeRef.current;

			if (elapsed >= currentFrameDurationRef.current) {
				// Time to advance to next frame
				let nextFrame: number;
				let complete = false;

				if (thing.loopCount < 0) {
					// Ping-pong animation (loopCount = -1)
					const result = getPingPongFrame(currentFrame, thing.frames, currentDirectionRef.current);
					nextFrame = result.frame;
					currentDirectionRef.current = result.newDirection;
				} else {
					// Normal looping animation
					nextFrame = getLoopFrame(currentFrame, thing.frames, thing.loopCount, currentLoopRef.current);

					// Check if we completed a loop
					if (nextFrame === 0 && currentFrame === thing.frames - 1) {
						currentLoopRef.current++;
					}

					// Check if animation is complete
					if (nextFrame === currentFrame && currentFrame === thing.frames - 1) {
						complete = true;
					}
				}

				// Handle skipFirstFrame for outfits
				if (skipFirstFrameRef.current && nextFrame === 0) {
					nextFrame = 1 % thing.frames;
				}

				if (complete) {
					setIsComplete(true);
					setIsPlaying(false);

					if (thing.animateAlways) {
						// Auto-restart for animateAlways
						setCurrentFrame(0);
						setIsComplete(false);
						setIsPlaying(true);
						currentLoopRef.current = 0;
						currentDirectionRef.current = AnimationDirection.FORWARD;
					} else {
						// Stop animation
						if (onComplete) {
							onComplete();
						}
						return; // Don't schedule next frame
					}
				} else {
					setCurrentFrame(nextFrame);
				}

				// Calculate remaining time for next frame
				const duration = getFrameDuration(durationsRef.current[nextFrame]);
				const remainingTime = duration - (elapsed - currentFrameDurationRef.current);
				currentFrameDurationRef.current = remainingTime < 0 ? 0 : remainingTime;
			} else {
				// Still waiting for current frame duration
				currentFrameDurationRef.current -= elapsed;
			}

			lastTimeRef.current = timestamp;

			// Schedule next update
			if (isPlaying) {
				animationFrameIdRef.current = requestAnimationFrame(updateAnimation);
			}
		},
		[isPlaying, currentFrame, thing, onComplete]
	);

	// Start/stop animation loop
	useEffect(() => {
		if (isPlaying && thing.isAnimation) {
			lastTimeRef.current = 0; // Reset timing
			animationFrameIdRef.current = requestAnimationFrame(updateAnimation);
		} else {
			if (animationFrameIdRef.current) {
				cancelAnimationFrame(animationFrameIdRef.current);
				animationFrameIdRef.current = 0;
			}
		}

		return () => {
			if (animationFrameIdRef.current) {
				cancelAnimationFrame(animationFrameIdRef.current);
			}
		};
	}, [isPlaying, thing.isAnimation, updateAnimation]);

	// Control functions (based on ThingDataView.as lines 178-194)
	const play = useCallback(() => {
		if (thing.isAnimation) {
			setIsPlaying(true);
			setIsComplete(false);
		}
	}, [thing.isAnimation]);

	const pause = useCallback(() => {
		setIsPlaying(false);
	}, []);

	const stop = useCallback(() => {
		setIsPlaying(false);
		setCurrentFrame(0);
		setIsComplete(false);
		currentLoopRef.current = 0;
		currentDirectionRef.current = AnimationDirection.FORWARD;
		lastTimeRef.current = 0;
	}, []);

	const reset = useCallback(() => {
		setCurrentFrame(thing.startFrame >= 0 ? thing.startFrame : getStartFrame(thing));
		setIsComplete(false);
		currentLoopRef.current = 0;
		currentDirectionRef.current = AnimationDirection.FORWARD;
		lastTimeRef.current = 0;
	}, [thing]);

	const setFrame = useCallback(
		(frame: number) => {
			if (frame >= 0 && frame < thing.frames) {
				setCurrentFrame(frame);
				setIsComplete(false);
				lastTimeRef.current = 0;
			}
		},
		[thing.frames]
	);

	return {
		play,
		stop,
		pause,
		reset,
		setFrame,
		isPlaying,
		isComplete,
		currentFrame
	};
}
