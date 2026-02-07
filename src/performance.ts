export type PerformanceLevel = 'low' | 'medium' | 'high'

export interface PerformanceMetrics {
	level: PerformanceLevel
	fps: number
	frameTime: number
	droppedFrames: number
	avgFrameTime: number
}

export class PerformanceMonitor {
	private frameTimes: number[] = []
	private lastFrameTime: number = 0
	private frameCount: number = 0
	private fpsUpdateTime: number = 0
	private currentFPS: number = 60
	private droppedTimestamps: number[] = []
	private measurementWindowMs: number = 1000
	private samplesCount: number = 30

	getPerformanceLevel(): PerformanceLevel {
		if (this.currentFPS < 30) return 'low'
		if (this.currentFPS < 50) return 'medium'
		return 'high'
	}

	getMetrics(): PerformanceMetrics {
		return {
			level: this.getPerformanceLevel(),
			fps: this.currentFPS,
			frameTime: this.lastFrameTime,
			droppedFrames: this.getDroppedFrames(),
			avgFrameTime: this.getAverageFrameTime(),
		}
	}

	measureFrame() {
		const now = performance.now()
		if (this.lastFrameTime > 0) {
			const delta = now - this.lastFrameTime
			this.frameTimes.push(delta)

			const missedFrames = Math.floor(delta / 16.67) - 1
			if (missedFrames > 0 && delta > 50) {
				for (let i = 0; i < missedFrames; i++) {
					this.droppedTimestamps.push(now)
				}
			}

			if (this.frameTimes.length > this.samplesCount) {
				this.frameTimes.shift()
			}
		}
		this.lastFrameTime = now

		this.frameCount++
		if (now - this.fpsUpdateTime >= this.measurementWindowMs) {
			this.currentFPS = (this.frameCount * 1000) / (now - this.fpsUpdateTime)
			this.frameCount = 0
			this.fpsUpdateTime = now
		}
	}

	getAverageFrameTime(): number {
		if (this.frameTimes.length === 0) return 16.67
		const sum = this.frameTimes.reduce((a, b) => a + b, 0)
		return sum / this.frameTimes.length
	}

	getDroppedFrames(): number {
		const now = performance.now()
		this.droppedTimestamps = this.droppedTimestamps.filter(
			(t) => now - t < this.measurementWindowMs
		)
		return this.droppedTimestamps.length
	}

	getThrottleInterval(): number {
		const level = this.getPerformanceLevel()
		if (level === 'low') return 33.33
		if (level === 'medium') return 16.67
		return 0
	}

	shouldSkipFrame(): boolean {
		const throttle = this.getThrottleInterval()
		if (throttle === 0) return false
		if (this.frameTimes.length === 0) return false
		const lastDelta = this.frameTimes[this.frameTimes.length - 1]
		return lastDelta < throttle
	}

	reset() {
		this.frameTimes = []
		this.lastFrameTime = 0
		this.frameCount = 0
		this.fpsUpdateTime = 0
		this.currentFPS = 60
		this.droppedTimestamps = []
	}
}

export const performanceMonitor = new PerformanceMonitor()

export function createTimedRAF(callback: (timestamp: number) => void): (timestamp: number) => void {
	return (timestamp: number) => {
		performanceMonitor.measureFrame()
		callback(timestamp)
	}
}
