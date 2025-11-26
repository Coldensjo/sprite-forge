/**
 * Animation utilities for Tibia sprites
 * Based on Object Builder's animation system (ThingDataView.as lines 238-244)
 */

import type { ThingType, FrameDuration, ThingCategory } from './types';

// Animation modes (from Object Builder's AnimationMode.as)
export const AnimationMode = {
	SYNCHRONOUS: 1, // All instances play in sync
	ASYNCHRONOUS: 0 // Each instance plays independently
} as const;

// Animation direction constants (for ping-pong animations)
export const AnimationDirection = {
	FORWARD: 0,
	BACKWARD: 1
} as const;

// Frame control constants (from Animator.as lines 262-264)
export const FrameControl = {
	RANDOM: 0xfe, // Random starting frame
	AUTOMATIC: -1, // Use start frame or random
	ASYNCHRONOUS: 0xff // Asynchronous mode
} as const;

/**
 * Get the duration for a single frame with randomization
 * Based on FrameDuration.as lines 42-50
 */
export function getFrameDuration(frameDuration: FrameDuration): number {
	if (frameDuration.minimum === frameDuration.maximum) {
		return frameDuration.minimum;
	}

	return frameDuration.minimum + Math.round(Math.random() * (frameDuration.maximum - frameDuration.minimum));
}

/**
 * Generate default frame durations for animations without explicit timing data
 * Based on ThingDataView.as lines 238-244
 *
 * @param thing - The ThingType to generate durations for
 * @param category - The thing category (determines default duration)
 * @returns Array of FrameDuration objects
 */
export function generateDefaultDurations(thing: ThingType, category: ThingCategory): FrameDuration[] {
	// Generate default durations based on category
	const durations: FrameDuration[] = [];

	if (category === 'outfit') {
		// Outfits: Walking animations ALWAYS use 1000ms / frames
		// This matches Object Builder's behavior (ThingDataView.as lines 238-244)
		// CRITICAL: Override DAT durations for outfits to ensure correct walking speed
		let duration = thing.frames > 0 ? Math.floor(1000 / thing.frames) : 333;

		// Apply OTClient's animation speed clamping (creature.cpp lines 594-606)
		// This prevents animations from being too slow
		// For 3+ frame outfits: max 80ms per frame (12.5 FPS)
		// For 1-2 frame outfits: max 205ms per frame (4.9 FPS)
		const maxDelay = thing.frames > 2 ? 80 : 205;
		duration = Math.min(duration, maxDelay);

		for (let i = 0; i < thing.frames; i++) {
			durations.push({ minimum: duration, maximum: duration });
		}
	} else if (category === 'effect') {
		// Effects: Use DAT durations if available, otherwise default 200ms per frame
		if (thing.frameDurations && thing.frameDurations.length === thing.frames) {
			return thing.frameDurations;
		}
		for (let i = 0; i < thing.frames; i++) {
			durations.push({ minimum: 200, maximum: 200 });
		}
	} else if (category === 'missile') {
		// Missiles: Use DAT durations if available, otherwise default 300ms per frame
		if (thing.frameDurations && thing.frameDurations.length === thing.frames) {
			return thing.frameDurations;
		}
		for (let i = 0; i < thing.frames; i++) {
			durations.push({ minimum: 300, maximum: 300 });
		}
	} else {
		// Items and other: Use DAT durations if available, otherwise default 500ms per frame
		if (thing.frameDurations && thing.frameDurations.length === thing.frames) {
			return thing.frameDurations;
		}
		for (let i = 0; i < thing.frames; i++) {
			durations.push({ minimum: 500, maximum: 500 });
		}
	}

	return durations;
}

/**
 * Check if a thing should skip the first frame when idle
 * Based on ThingDataView.as line 248
 */
export function shouldSkipFirstFrame(thing: ThingType, category: ThingCategory): boolean {
	// Outfits skip first frame when idle (not animateAlways) and not walking
	return category === 'outfit' && !thing.animateAlways;
}

/**
 * Get the starting frame for an animation
 * Based on Animator.as lines 162-170
 */
export function getStartFrame(thing: ThingType): number {
	if (thing.startFrame > -1) {
		return thing.startFrame;
	}

	// Random starting frame
	return Math.floor(Math.random() * thing.frames);
}

/**
 * Calculate the next frame in a looping animation
 * Based on Animator.as lines 223-243
 */
export function getLoopFrame(currentFrame: number, frames: number, loopCount: number, currentLoop: number): number {
	const nextFrame = currentFrame + 1;

	if (nextFrame < frames) {
		return nextFrame;
	}

	// End of animation reached
	if (loopCount === 0) {
		// Infinite loop (loopCount = 0 means continuous)
		return 0;
	}

	// Check if we have more loops to go
	if (currentLoop < loopCount - 1) {
		return 0; // Start next loop
	}

	// Animation complete
	return currentFrame; // Stay on last frame
}

/**
 * Calculate the next frame in a ping-pong animation
 * Based on Animator.as lines 245-256
 */
export function getPingPongFrame(
	currentFrame: number,
	frames: number,
	direction: number
): { frame: number; newDirection: number } {
	const count = direction === AnimationDirection.FORWARD ? 1 : -1;
	let nextFrame = currentFrame + count;

	let newDirection = direction;

	// Check if we need to reverse direction
	if (nextFrame < 0 || nextFrame >= frames) {
		newDirection = direction === AnimationDirection.FORWARD ? AnimationDirection.BACKWARD : AnimationDirection.FORWARD;
		nextFrame = currentFrame - count; // Reverse
	}

	return { newDirection, frame: nextFrame };
}
