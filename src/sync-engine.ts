import { APP_CONFIG } from './config'

export interface SyncState {
	playbackRate: number
	currentBeatIndex: number
	lastBeatTime: number
	expectedVideoTime: number
	drift: number
}

export interface SyncConfig {
	lerpFactor: number
	maxDelta: number
	snapThreshold: number
	velocityWeight: number
	maxDriftCorrection: number
}

export const SYNC_CONFIGS = {
	high: {
		lerpFactor: 0.08,
		maxDelta: 0.02,
		snapThreshold: 0.05,
		velocityWeight: 0.3,
		maxDriftCorrection: 0.15,
	} as SyncConfig,
	medium: {
		lerpFactor: 0.05,
		maxDelta: 0.015,
		snapThreshold: 0.07,
		velocityWeight: 0.25,
		maxDriftCorrection: 0.12,
	} as SyncConfig,
	low: {
		lerpFactor: 0.03,
		maxDelta: 0.01,
		snapThreshold: 0.1,
		velocityWeight: 0.2,
		maxDriftCorrection: 0.1,
	} as SyncConfig,
}

export class PredictiveSyncEngine {
	private state: SyncState = {
		playbackRate: 1,
		currentBeatIndex: -1,
		lastBeatTime: 0,
		expectedVideoTime: 0,
		drift: 0,
	}

	private velocityHistory: number[] = []
	private readonly velocityHistorySize = 5

	reset() {
		this.state = {
			playbackRate: 1,
			currentBeatIndex: -1,
			lastBeatTime: 0,
			expectedVideoTime: 0,
			drift: 0,
		}
		this.velocityHistory = []
	}

	update(
		progressSec: number,
		currentVideoTime: number,
		audioData: any,
		perfLevel: 'low' | 'medium' | 'high' = 'high'
	): { playbackRate: number; shouldSnap: boolean; snapTime?: number } {
		if (!audioData?.beats?.length) {
			return { playbackRate: 1, shouldSnap: false }
		}

		const config = SYNC_CONFIGS[perfLevel] ?? SYNC_CONFIGS.high
		const beats = audioData.beats

		let beatIndex = this.findCurrentBeat(progressSec, beats)
		if (beatIndex < 0) beatIndex = 0

		const nextBeat = this.findNextBeat(progressSec, beats)
		if (!nextBeat) {
			return { playbackRate: this.state.playbackRate, shouldSnap: false }
		}

		if (beatIndex !== this.state.currentBeatIndex && this.state.currentBeatIndex >= 0) {
			this.onBeatTransition(beatIndex, progressSec, config)
		}
		this.state.currentBeatIndex = beatIndex

		const { targetRate, timeUntilBeat, timeUntilDrop } = this.calculateTargetRate(
			progressSec,
			currentVideoTime,
			nextBeat,
			beats
		)

		if (timeUntilBeat <= config.snapThreshold) {
			return this.handleBeatSnap(
				progressSec,
				currentVideoTime,
				nextBeat,
				beats,
				beatIndex,
				config
			)
		}

		const predictedVelocity = this.calculateVelocityPrediction(targetRate, perfLevel)

		const clampedTarget = this.clampTargetRate(targetRate, config)
		this.state.playbackRate = this.smoothTransition(
			this.state.playbackRate,
			clampedTarget,
			config,
			predictedVelocity
		)

		this.state.drift = this.calculateDrift(
			currentVideoTime,
			progressSec,
			nextBeat,
			beats,
			beatIndex
		)

		return { playbackRate: this.state.playbackRate, shouldSnap: false }
	}

	private findCurrentBeat(progressSec: number, beats: any[]): number {
		for (let i = beats.length - 1; i >= 0; i--) {
			if (beats[i].start <= progressSec) {
				return i
			}
		}
		return -1
	}

	private findNextBeat(
		progressSec: number,
		beats: any[]
	): { index: number; time: number } | null {
		for (let i = 0; i < beats.length; i++) {
			if (beats[i].start > progressSec) {
				return { index: i, time: beats[i].start }
			}
		}
		return null
	}

	private getNextHeadDrop(videoTime: number): { index: number; time: number } {
		const drops = APP_CONFIG.CAT_HEAD_DROPS
		const duration = APP_CONFIG.VIDEO_DURATION

		for (let i = 0; i < drops.length; i++) {
			if (drops[i] > videoTime) {
				return { index: i, time: drops[i] }
			}
		}
		return { index: 0, time: drops[0] + duration }
	}

	private calculateTargetRate(
		progressSec: number,
		currentVideoTime: number,
		nextBeat: { index: number; time: number },
		beats: any[]
	): { targetRate: number; timeUntilBeat: number; timeUntilDrop: number } {
		const drops = APP_CONFIG.CAT_HEAD_DROPS
		const duration = APP_CONFIG.VIDEO_DURATION
		const currentDrop = this.getNextHeadDrop(currentVideoTime)

		let dropDuration: number
		if (currentDrop.time < duration) {
			dropDuration = currentDrop.time - currentVideoTime
		} else {
			dropDuration = duration - currentVideoTime + drops[0]
		}

		const beatIndex = this.findCurrentBeat(progressSec, beats)
		const beatDuration =
			beatIndex >= 0 && beatIndex < beats.length - 1
				? beats[beatIndex + 1].start - beats[beatIndex].start
				: 1

		const timeUntilBeat = nextBeat.time - progressSec
		const timeUntilDrop = dropDuration * (timeUntilBeat / beatDuration)
		const targetRate = timeUntilDrop > 0 ? timeUntilDrop / timeUntilBeat : 1

		return { targetRate, timeUntilBeat, timeUntilDrop }
	}

	private handleBeatSnap(
		progressSec: number,
		currentVideoTime: number,
		nextBeat: { index: number; time: number },
		beats: any[],
		beatIndex: number,
		config: SyncConfig
	): { playbackRate: number; shouldSnap: boolean; snapTime: number } {
		const drops = APP_CONFIG.CAT_HEAD_DROPS
		const duration = APP_CONFIG.VIDEO_DURATION

		const dropIndex = nextBeat.index % drops.length
		const currentDrop = drops[dropIndex]
		const nextDrop = drops[(dropIndex + 1) % drops.length]

		let dropDuration: number
		if (nextDrop > currentDrop) {
			dropDuration = nextDrop - currentDrop
		} else {
			dropDuration = duration - currentDrop + nextDrop
		}

		const beatProgress = (progressSec - beats[beatIndex].start) / dropDuration
		const expectedTime = currentDrop + beatProgress * dropDuration

		const wrappedExpected = expectedTime >= duration ? expectedTime - duration : expectedTime
		const wrappedVideo =
			currentVideoTime >= duration ? currentVideoTime - duration : currentVideoTime

		const drift = wrappedVideo - wrappedExpected
		const maxCorrection = config.maxDriftCorrection

		let snapRate = 1
		if (Math.abs(drift) > maxCorrection) {
			snapRate = drift > 0 ? 1 - Math.abs(drift) * 0.1 : 1 + Math.abs(drift) * 0.1
		}

		this.state.playbackRate = this.lerp(this.state.playbackRate, snapRate, 0.2)

		return {
			playbackRate: this.clamp(this.state.playbackRate, 0.85, 1.3),
			shouldSnap: true,
			snapTime: wrappedExpected,
		}
	}

	private onBeatTransition(newBeatIndex: number, progressSec: number, config: SyncConfig): void {
		if (this.state.lastBeatTime > 0) {
			const dt = progressSec - this.state.lastBeatTime
			if (dt > 0) {
				const velocity = (this.state.playbackRate - 1) / dt
				this.velocityHistory.push(velocity)
				if (this.velocityHistory.length > this.velocityHistorySize) {
					this.velocityHistory.shift()
				}
			}
		}
		this.state.lastBeatTime = progressSec
	}

	private calculateVelocityPrediction(targetRate: number, perfLevel: string): number {
		if (this.velocityHistory.length < 2) return 0

		const avgVelocity =
			this.velocityHistory.reduce((a, b) => a + b, 0) / this.velocityHistory.length
		const config = SYNC_CONFIGS[perfLevel] ?? SYNC_CONFIGS.high

		return avgVelocity * config.velocityWeight
	}

	private calculateDrift(
		currentVideoTime: number,
		progressSec: number,
		nextBeat: { index: number; time: number },
		beats: any[],
		beatIndex: number
	): number {
		const drops = APP_CONFIG.CAT_HEAD_DROPS
		const duration = APP_CONFIG.VIDEO_DURATION

		if (beatIndex < 0 || beatIndex >= beats.length) return 0

		const dropIndex = nextBeat.index % drops.length
		const currentDrop = drops[dropIndex]
		const nextDrop = drops[(dropIndex + 1) % drops.length]

		let dropDuration: number
		if (nextDrop > currentDrop) {
			dropDuration = nextDrop - currentDrop
		} else {
			dropDuration = duration - currentDrop + nextDrop
		}

		const beatDuration =
			beatIndex < beats.length - 1 ? beats[beatIndex + 1].start - beats[beatIndex].start : 1

		const timeSinceLastBeat = progressSec - beats[beatIndex].start
		const beatProgress = Math.min(1, timeSinceLastBeat / beatDuration)

		let expectedTime = currentDrop + beatProgress * dropDuration
		if (expectedTime >= duration) {
			expectedTime -= duration
		}

		return currentVideoTime - expectedTime
	}

	private smoothTransition(
		current: number,
		target: number,
		config: SyncConfig,
		velocityPrediction: number
	): number {
		const velocityAdjustedTarget = target + velocityPrediction
		const adjustedTarget = this.clamp(velocityAdjustedTarget, 0.85, 1.3)
		return this.lerp(current, adjustedTarget, config.lerpFactor)
	}

	private clampTargetRate(rate: number, config: SyncConfig): number {
		return this.clamp(rate, 0.85, 1.3)
	}

	private clamp(value: number, min: number, max: number): number {
		return Math.max(min, Math.min(max, value))
	}

	private lerp(current: number, target: number, factor: number): number {
		return current + (target - current) * factor
	}

	getState(): SyncState {
		return { ...this.state }
	}
}

export const syncEngine = new PredictiveSyncEngine()
