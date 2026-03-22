import { APP_CONFIG } from '../config'
import { getLoudnessAt, normalizeLoudness } from './analyzer'
import { computeNextRate } from '../sync/algorithm'

interface WorkerConfig {
	maxScale: number
	clampMax: number
}

interface ProcessPayload {
	progressMs: number
	videoTime: number
	audioData: any
	perfLevel: 'low' | 'medium' | 'high'
}

let audioData: any = null
let currentRate = 1
let currentBeatIndex = -1

let config: WorkerConfig = {
	maxScale: APP_CONFIG.VISUAL.MAX_SCALE,
	clampMax: 1.35,
}

self.onmessage = (e: MessageEvent) => {
	const { type, data } = e.data

	switch (type) {
		case 'setAudioData':
			audioData = data
			break

		case 'setConfig':
			config = { ...config, ...data }
			break

		case 'process': {
			const payload = data as ProcessPayload
			// Keep audio data in sync with every frame
			if (payload.audioData) audioData = payload.audioData
			if (!audioData) {
				self.postMessage({ type: 'result', data: { playbackRate: 1, scale: 1 } })
				return
			}
			self.postMessage({ type: 'result', data: process(payload) })
			break
		}

		case 'resetRate':
			currentRate = 1
			currentBeatIndex = -1
			break
	}
}

function process(payload: ProcessPayload): { playbackRate: number; scale: number } {
	const { progressMs, videoTime, perfLevel } = payload
	const progressSec = progressMs / 1000

	currentRate = computeNextRate(
		currentRate,
		progressSec,
		videoTime,
		audioData.beats,
		APP_CONFIG.CAT_HEAD_DROPS,
		APP_CONFIG.VIDEO_DURATION,
		perfLevel ?? 'high',
		config.clampMax
	)

	// track beat index for resetRate accuracy
	if (audioData.beats?.length) {
		for (let i = audioData.beats.length - 1; i >= 0; i--) {
			if (audioData.beats[i].start <= progressSec) {
				currentBeatIndex = i
				break
			}
		}
	}

	const loudnessDb = getLoudnessAt(audioData.segments, progressSec)
	const loudness = normalizeLoudness(loudnessDb)
	const scale = 1 + loudness * (config.maxScale - 1)

	return { playbackRate: currentRate, scale }
}
