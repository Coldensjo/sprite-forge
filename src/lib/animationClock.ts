type Subscriber = (timestamp: number) => void;

class AnimationClock {
	private subscribers = new Set<Subscriber>();
	private rafId: null | number = null;

	subscribe(fn: Subscriber): () => void {
		this.subscribers.add(fn);
		if (this.rafId === null) this.start();
		return () => {
			this.subscribers.delete(fn);
			if (this.subscribers.size === 0) this.stop();
		};
	}

	private start(): void {
		const tick = (timestamp: number) => {
			for (const fn of this.subscribers) fn(timestamp);
			if (this.subscribers.size > 0) {
				this.rafId = requestAnimationFrame(tick);
			} else {
				this.rafId = null;
			}
		};
		this.rafId = requestAnimationFrame(tick);
	}

	private stop(): void {
		if (this.rafId !== null) {
			cancelAnimationFrame(this.rafId);
			this.rafId = null;
		}
	}
}

export const animationClock = new AnimationClock();
