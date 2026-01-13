import { APP_CONFIG } from './config'
import { getLocalBPM, getLoudnessAt, normalizeLoudness } from './analyzer'

let audioData: any = null
let currentRate = 1
const CAT_HEAD_DROPS = APP_CONFIG.CAT_HEAD_DROPS
const VIDEO_DURATION = APP_CONFIG.VIDEO_DURATION

self.addEventListener('message', (event: MessageEvent) => {
	const { type, data } = event.data

	switch (type) {
		case 'setAudioData':
			audioData = data
			break

		case 'process': {
			if (!audioData) {
				self.postMessage({ type: 'result', data: { playbackRate: 1, scale: 1 } })
				return
			}
			const result = processAudioData(data.progressMs)
			self.postMessage({ type: 'result', data: result })
			break
		}

		case 'resetRate':
			currentRate = 1
			break
	}
})

function processAudioData(progressMs: number) {
	const progressSec = progressMs / 1000

	const playbackRate = calculateSmoothPlaybackRate(progressMs)
	const loudness = normalizeLoudness(getLoudnessAt(audioData.segments, progressSec))
	const scale = 1 + loudness * (APP_CONFIG.VISUAL.MAX_SCALE - 1)

	return { playbackRate, scale }
}

function getNextHeadDrop(currentVideoTime: number): { index: number; time: number } {
	for (let i = 0; i < CAT_HEAD_DROPS.length; i++) {
		if (CAT_HEAD_DROPS[i] > currentVideoTime) {
			return { index: i, time: CAT_HEAD_DROPS[i] }
		}
	}
	return { index: 0, time: CAT_HEAD_DROPS[0] + VIDEO_DURATION }
}

function getNextBeat(progressSec: number, beats: any[]): { index: number; time: number } | null {
	for (let i = 0; i < beats.length; i++) {
		if (beats[i].start > progressSec) {
			return { index: i, time: beats[i].start }
		}
	}
	return null
}

function lerp(current: number, target: number, factor: number): number {
	return current + (target - current) * factor
}

function calculateSmoothPlaybackRate(progressMs: number): number {
	if (!audioData?.beats?.length) return 1

	const progressSec = progressMs / 1000

	const nextBeat = getNextBeat(progressSec, audioData.beats)
	if (!nextBeat) return 1

	const timeUntilBeat = nextBeat.time - progressSec
	if (timeUntilBeat <= 0.05) return currentRate

	const nextDrop = getNextHeadDrop(0)
	let timeUntilDrop = nextDrop.time
	if (timeUntilDrop <= 0) {
		timeUntilDrop += VIDEO_DURATION
	}

	const targetRate = timeUntilDrop / timeUntilBeat
	const clampedTarget = Math.max(0.85, Math.min(1.3, targetRate))

	currentRate = lerp(currentRate, clampedTarget, 0.08)

	const maxDelta = 0.02
	if (Math.abs(currentRate - clampedTarget) > maxDelta) {
		return currentRate
	}

	return currentRate
}
