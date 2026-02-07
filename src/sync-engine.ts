import { APP_CONFIG } from './config'

export interface SyncState {
	playbackRate: number
	currentBeatIndex: number
}

const LERP_FACTORS: Record<string, number> = {
	high: 0.25,
	medium: 0.18,
	low: 0.1,
}

export class PredictiveSyncEngine {
	private state: SyncState = {
		playbackRate: 1,
		currentBeatIndex: -1,
	}

	reset() {
		this.state = {
			playbackRate: 1,
			currentBeatIndex: -1,
		}
	}

	update(
		progressSec: number,
		currentVideoTime: number,
		audioData: any,
		perfLevel: 'low' | 'medium' | 'high' = 'high'
	): { playbackRate: number } {
		if (!audioData?.beats?.length) {
			return { playbackRate: 1 }
		}

		const beats = audioData.beats
		const lerpFactor = LERP_FACTORS[perfLevel] ?? LERP_FACTORS.high
		const duration = APP_CONFIG.VIDEO_DURATION
		const drops = APP_CONFIG.CAT_HEAD_DROPS

		let videoTime = currentVideoTime % duration
		if (videoTime < 0) videoTime = 0

		let beatIndex = -1
		for (let i = beats.length - 1; i >= 0; i--) {
			if (beats[i].start <= progressSec) {
				beatIndex = i
				break
			}
		}

		const nextBeat = this.findNextBeat(progressSec, beats)
		if (!nextBeat) {
			this.state.playbackRate = this.lerp(this.state.playbackRate, 1, lerpFactor)
			return { playbackRate: this.state.playbackRate }
		}

		const timeUntilBeat = nextBeat.time - progressSec
		if (timeUntilBeat < 0.005) {
			return { playbackRate: this.state.playbackRate }
		}

		const timeUntilDrop = this.getTimeUntilNextDrop(videoTime, drops, duration)

		const targetRate = timeUntilDrop / timeUntilBeat
		const clampedTarget = Math.max(0.75, Math.min(1.35, targetRate))

		this.state.playbackRate = this.lerp(this.state.playbackRate, clampedTarget, lerpFactor)

		if (beatIndex !== this.state.currentBeatIndex) {
			this.state.currentBeatIndex = beatIndex
		}

		return { playbackRate: this.state.playbackRate }
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

	private getTimeUntilNextDrop(videoTime: number, drops: number[], duration: number): number {
		for (const drop of drops) {
			if (drop > videoTime) {
				return drop - videoTime
			}
		}
		return duration - videoTime + drops[0]
	}

	private lerp(current: number, target: number, factor: number): number {
		return current + (target - current) * factor
	}

	getState(): SyncState {
		return { ...this.state }
	}
}

export const syncEngine = new PredictiveSyncEngine()
