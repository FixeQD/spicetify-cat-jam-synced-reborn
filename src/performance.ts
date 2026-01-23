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
	private droppedFrames: number = 0
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
			droppedFrames: this.droppedFrames,
			avgFrameTime: this.getAverageFrameTime(),
		}
	}

	measureFrame() {
		const now = performance.now()
		if (this.lastFrameTime > 0) {
			const frameTime = now - this.lastFrameTime
			this.frameTimes.push(frameTime)

			if (frameTime > 33.33) {
				this.droppedFrames++
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

	getThrottleInterval(): number {
		const level = this.getPerformanceLevel()
		if (level === 'low') return 33.33
		if (level === 'medium') return 16.67
		return 0
	}

	shouldSkipFrame(): boolean {
		const throttle = this.getThrottleInterval()
		if (throttle === 0) return false
		return this.lastFrameTime > 0 && this.lastFrameTime < throttle
	}

	reset() {
		this.frameTimes = []
		this.lastFrameTime = 0
		this.frameCount = 0
		this.fpsUpdateTime = 0
		this.currentFPS = 60
		this.droppedFrames = 0
	}
}

export const performanceMonitor = new PerformanceMonitor()

export function createTimedRAF(callback: (timestamp: number) => void): (timestamp: number) => void {
	return (timestamp: number) => {
		performanceMonitor.measureFrame()
		if (!performanceMonitor.shouldSkipFrame()) {
			callback(timestamp)
		}
	}
}
