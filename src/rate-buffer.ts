export interface RateEntry {
	rate: number
	timestamp: number
}

export interface BufferConfig {
	maxBufferSize: number
	maxAgeMs: number
	interpolationThreshold: number
	maxJumpRate: number
	smoothFactor: number
}

export const BUFFER_CONFIGS = {
	high: {
		maxBufferSize: 8,
		maxAgeMs: 100,
		interpolationThreshold: 0.02,
		maxJumpRate: 0.5,
		smoothFactor: 0.6,
	} as BufferConfig,
	medium: {
		maxBufferSize: 6,
		maxAgeMs: 80,
		interpolationThreshold: 0.03,
		maxJumpRate: 0.4,
		smoothFactor: 0.5,
	} as BufferConfig,
	low: {
		maxBufferSize: 4,
		maxAgeMs: 60,
		interpolationThreshold: 0.05,
		maxJumpRate: 0.35,
		smoothFactor: 0.4,
	} as BufferConfig,
}

export class RateBuffer {
	private buffer: RateEntry[] = []
	private lastOutputRate: number = 1
	private lastOutputTime: number = 0

	constructor(private config: BufferConfig = BUFFER_CONFIGS.high) {}

	setConfig(config: BufferConfig) {
		this.config = config
	}

	push(rate: number, timestamp: number = performance.now()) {
		this.buffer.push({ rate, timestamp })

		const now = performance.now()
		this.buffer = this.buffer.filter((entry) => now - entry.timestamp < this.config.maxAgeMs)

		while (this.buffer.length > this.config.maxBufferSize) {
			this.buffer.shift()
		}
	}

	getOutput(timestamp: number = performance.now()): {
		rate: number
		isBuffered: boolean
		shouldSkip: boolean
	} {
		if (this.buffer.length === 0) {
			return { rate: this.lastOutputRate, isBuffered: false, shouldSkip: false }
		}

		const newest = this.buffer[this.buffer.length - 1]

		if (this.buffer.length === 1) {
			return this.applyBufferLogic(newest.rate, newest.timestamp, timestamp)
		}

		const oldest = this.buffer[0]
		const age = timestamp - oldest.timestamp

		if (age > this.config.maxAgeMs) {
			this.buffer.shift()
			return this.getOutput(timestamp)
		}

		const interpolated = this.interpolate(oldest, newest, timestamp)
		return this.applyBufferLogic(interpolated, oldest.timestamp, timestamp)
	}

	private interpolate(oldest: RateEntry, newest: RateEntry, timestamp: number): number {
		const totalDuration = newest.timestamp - oldest.timestamp
		if (totalDuration <= 0) return newest.rate

		const elapsed = timestamp - oldest.timestamp
		const t = Math.min(1, Math.max(0, elapsed / totalDuration))

		return oldest.rate + (newest.rate - oldest.rate) * this.easeInOut(t)
	}

	private easeInOut(t: number): number {
		return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
	}

	private applyBufferLogic(
		rate: number,
		entryTimestamp: number,
		currentTime: number
	): { rate: number; isBuffered: boolean; shouldSkip: boolean } {
		const delta = Math.abs(rate - this.lastOutputRate)

		const isRecent = currentTime - entryTimestamp < 50
		const isBuffered = this.buffer.length > 1

		if (isRecent && isBuffered && delta > this.config.interpolationThreshold) {
			const adjustedRate = this.lerp(this.lastOutputRate, rate, this.config.smoothFactor)

			if (delta > this.config.maxJumpRate) {
				return {
					rate: this.lastOutputRate,
					isBuffered: true,
					shouldSkip: true,
				}
			}

			this.lastOutputRate = adjustedRate
			this.lastOutputTime = currentTime
			return { rate: adjustedRate, isBuffered: true, shouldSkip: false }
		}

		this.lastOutputRate = rate
		this.lastOutputTime = currentTime
		return { rate, isBuffered: isBuffered, shouldSkip: false }
	}

	private lerp(current: number, target: number, factor: number): number {
		return current + (target - current) * factor
	}

	clear() {
		this.buffer = []
		this.lastOutputRate = 1
	}

	getBufferSize(): number {
		return this.buffer.length
	}

	isStale(timestamp: number = performance.now()): boolean {
		if (this.buffer.length === 0) return true
		const newest = this.buffer[this.buffer.length - 1]
		return timestamp - newest.timestamp > 500
	}
}

export const rateBufferHigh = new RateBuffer(BUFFER_CONFIGS.high)
export const rateBufferMedium = new RateBuffer(BUFFER_CONFIGS.medium)
export const rateBufferLow = new RateBuffer(BUFFER_CONFIGS.low)

export function getRateBuffer(level: 'low' | 'medium' | 'high'): RateBuffer {
	if (level === 'low') return rateBufferLow
	if (level === 'medium') return rateBufferMedium
	return rateBufferHigh
}
