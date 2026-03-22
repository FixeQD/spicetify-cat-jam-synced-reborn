import { APP_CONFIG } from '../config'
import { cachedSettings } from '../settings/settings'
import { computeNextRate } from './algorithm'

export interface SyncState {
	playbackRate: number
	currentBeatIndex: number
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
		if (!audioData?.beats?.length) return { playbackRate: 1 }

		const clampMax = cachedSettings.syncClampMax ?? 1.35

		const beats = audioData.beats
		let beatIndex = -1
		for (let i = beats.length - 1; i >= 0; i--) {
			if (beats[i].start <= progressSec) {
				beatIndex = i
				break
			}
		}

		this.state.playbackRate = computeNextRate(
			this.state.playbackRate,
			progressSec,
			currentVideoTime,
			beats,
			APP_CONFIG.CAT_HEAD_DROPS,
			APP_CONFIG.VIDEO_DURATION,
			perfLevel,
			clampMax
		)

		if (beatIndex !== this.state.currentBeatIndex) {
			this.state.currentBeatIndex = beatIndex
		}

		return { playbackRate: this.state.playbackRate }
	}

	getState(): SyncState {
		return { ...this.state }
	}
}

export const syncEngine = new PredictiveSyncEngine()
