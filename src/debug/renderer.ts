import { performanceMonitor } from '../performance'
import { getRateBuffer } from '../sync/rate-buffer'
import { getAudioData } from '../audio/audio'
import { getLocalBPM, getLoudnessAt, normalizeLoudness } from '../audio/analyzer'
import { APP_CONFIG } from '../config'
import { getVideoElement } from '../video/video'
import {
	getPartyModeState,
	PARTY_BPM_THRESHOLD,
	PARTY_LOUDNESS_THRESHOLD_DB,
} from '../video/party-mode'
import type { DebugMetrics } from '../debug/overlay'

const MAX_DRIFT_MS = ((APP_CONFIG.VIDEO_DURATION / APP_CONFIG.CAT_HEAD_DROPS.length) * 1000) / 2
let driftHistory: number[] = []
let lastMeasuredBeatIndex = -1

export function resetBeatAccuracy() {
	driftHistory = []
	lastMeasuredBeatIndex = -1
}

function perfLevelColor(level: string): string {
	if (level === 'high') return '#4ade80'
	if (level === 'medium') return '#facc15'
	return '#f87171'
}

function driftColor(driftMs: number): string {
	const abs = Math.abs(driftMs)
	if (abs < 20) return '#4ade80'
	if (abs < 50) return '#facc15'
	return '#f87171'
}

function measureDrift(videoTime: number): number {
	const duration = APP_CONFIG.VIDEO_DURATION
	let vt = videoTime % duration
	if (vt < 0) vt += duration
	let minDist = Infinity
	for (const drop of APP_CONFIG.CAT_HEAD_DROPS) {
		const d1 = Math.abs(vt - drop)
		const d2 = duration - d1
		if (Math.min(d1, d2) < minDist) minDist = Math.min(d1, d2)
	}
	return minDist
}

// ─── dom updates ─────────────────────────────────────────────────────────────

const domNodes = new Map<string, { valueEl: HTMLElement; lastValue?: string; lastColor?: string }>()

function renderSeparator(container: HTMLElement, id: string, title?: string) {
	if (domNodes.has(id)) return

	const el = document.createElement('div')
	if (title) {
		el.style.cssText = `
			margin: 6px 0 4px;
			padding: 3px 0;
			border-top: 1px solid rgba(255,255,255,0.06);
			font-size: 9px;
			color: rgba(255,255,255,0.3);
			letter-spacing: 1px;
			text-transform: uppercase;
		`
		el.textContent = title
	} else {
		el.style.cssText = 'margin: 4px 0; border-top: 1px solid rgba(255,255,255,0.06);'
	}

	container.appendChild(el)
	domNodes.set(id, { valueEl: el }) // store to mark as created
}

function renderRow(
	container: HTMLElement,
	id: string,
	label: string,
	value: string,
	color?: string
) {
	let node = domNodes.get(id)

	if (!node) {
		const el = document.createElement('div')
		el.style.cssText = 'display: flex; justify-content: space-between; padding: 1px 0;'

		const labelEl = document.createElement('span')
		labelEl.style.color = 'rgba(255,255,255,0.5)'
		labelEl.textContent = label

		const valueEl = document.createElement('span')
		el.appendChild(labelEl)
		el.appendChild(valueEl)
		container.appendChild(el)

		node = { valueEl }
		domNodes.set(id, node)
	}

	if (node.lastValue !== value) {
		node.valueEl.textContent = value
		node.lastValue = value
	}

	const targetColor = color || '#fff'
	if (node.lastColor !== targetColor) {
		node.valueEl.style.color = targetColor
		node.valueEl.style.fontWeight = color ? '600' : 'normal'
		node.lastColor = targetColor
	}
}

// ─── main render ─────────────────────────────────────────────────────────────

export function renderDebugContent(container: HTMLElement, lastMetrics: DebugMetrics) {
	const { progressMs, perfLevel, workerActive } = lastMetrics
	const progressSec = progressMs / 1000
	const audioData = getAudioData()
	const video = getVideoElement()
	const perf = performanceMonitor.getMetrics()
	const buffer = getRateBuffer(perfLevel)
	const actualRate = video?.playbackRate ?? 1
	const videoTime = video?.currentTime ?? 0

	let beatIndex = -1
	if (audioData?.beats?.length) {
		let low = 0
		let high = audioData.beats.length - 1

		while (low <= high) {
			const mid = Math.floor((low + high) / 2)
			if (audioData.beats[mid].start <= progressSec) {
				beatIndex = mid
				low = mid + 1
			} else {
				high = mid - 1
			}
		}
	}

	const liveDriftMs = measureDrift(videoTime) * 1000
	const totalBeats = audioData?.beats?.length ?? 0

	if (totalBeats > 0 && beatIndex >= 0 && beatIndex !== lastMeasuredBeatIndex) {
		lastMeasuredBeatIndex = beatIndex
		const beatStart = audioData.beats[beatIndex].start
		const timeSinceBeat = progressSec - beatStart
		const correctedDrift = measureDrift(videoTime - timeSinceBeat * actualRate) * 1000
		driftHistory.push(correctedDrift)
		if (driftHistory.length > totalBeats) driftHistory.shift()
	}

	renderSeparator(container, 'sep-perf', 'PERFORMANCE')
	renderRow(container, 'perf-fps', 'FPS', perf.fps.toFixed(1), perfLevelColor(perf.level))
	renderRow(container, 'perf-profile', 'Profile', perf.level.toUpperCase(), perfLevelColor(perf.level))
	renderRow(container, 'perf-frametime', 'Frame Time', perf.avgFrameTime.toFixed(1) + 'ms')
	renderRow(container, 'perf-dropped', 'Dropped Frames', String(perf.droppedFrames), perf.droppedFrames > 10 ? '#f87171' : undefined)
	renderRow(container, 'perf-worker', 'Worker', workerActive ? 'ACTIVE' : 'MAIN THREAD', workerActive ? '#4ade80' : '#facc15')

	renderSeparator(container, 'sep-sync', 'SYNC ENGINE')
	renderRow(container, 'sync-actualrate', 'Actual Rate', actualRate.toFixed(3) + 'x')
	if (lastMetrics.targetRate !== undefined) {
		renderRow(container, 'sync-targetrate', 'Target Rate', lastMetrics.targetRate.toFixed(3) + 'x', '#60a5fa')
	}
	renderRow(container, 'sync-beatidx', 'Beat Index', String(beatIndex))
	renderRow(container, 'sync-drift', 'Beat Drift', `${liveDriftMs.toFixed(1)}ms`, driftColor(liveDriftMs))
	
	if (driftHistory.length > 0) {
		const accuracy =
			(driftHistory.reduce((s, d) => s + Math.max(0, 1 - d / MAX_DRIFT_MS), 0) /
				driftHistory.length) *
			100
		const accColor = accuracy >= 85 ? '#4ade80' : accuracy >= 35 ? '#ffffff' : accuracy >= 10 ? '#facc15' : '#f87171'
		renderRow(container, 'sync-accuracy', 'Beat Accuracy', `${accuracy.toFixed(1)}% (last ${driftHistory.length})`, accColor)
	} else {
		renderRow(container, 'sync-accuracy', 'Beat Accuracy', '---')
	}

	renderSeparator(container, 'sep-audio', 'AUDIO ANALYSIS')
	if (audioData) {
		const globalBPM = audioData.track?.tempo ?? 0
		const localBPM = getLocalBPM(audioData.beats, progressSec) || globalBPM
		renderRow(container, 'audio-globalbpm', 'Global BPM', globalBPM.toFixed(1))
		renderRow(container, 'audio-localbpm', 'Local BPM', localBPM.toFixed(1), localBPM !== globalBPM ? '#60a5fa' : undefined)
		
		const loudnessDb = getLoudnessAt(audioData.segments, progressSec)
		const scale = 1 + normalizeLoudness(loudnessDb) * (APP_CONFIG.VISUAL.MAX_SCALE - 1)
		renderRow(container, 'audio-loudness', 'Loudness', loudnessDb.toFixed(1) + 'dB')
		renderRow(container, 'audio-scale', 'Scale', scale.toFixed(3) + 'x')
		renderRow(container, 'audio-segments', 'Segments', String(audioData.segments?.length ?? 0))
		renderRow(container, 'audio-beats', 'Beats', String(audioData.beats?.length ?? 0))
	} else {
		renderRow(container, 'audio-status', 'Status', 'No audio data', '#f87171')
	}

	renderSeparator(container, 'sep-video', 'VIDEO')
	if (video) {
		renderRow(container, 'video-time', 'Video Time', video.currentTime.toFixed(3) + 's')
		renderRow(container, 'video-paused', 'Paused', video.paused ? 'YES' : 'NO', video.paused ? '#f87171' : '#4ade80')
		const vt = video.currentTime % APP_CONFIG.VIDEO_DURATION
		const nextDrop = APP_CONFIG.CAT_HEAD_DROPS.find((d) => d > vt)
		const timeUntilDrop = nextDrop
			? nextDrop - vt
			: APP_CONFIG.VIDEO_DURATION - vt + APP_CONFIG.CAT_HEAD_DROPS[0]
		renderRow(container, 'video-head', 'Next Head Drop', `in ${(timeUntilDrop * 1000).toFixed(0)}ms`)
	} else {
		renderRow(container, 'video-status', 'Status', 'No video data', '#f87171')
	}

	renderSeparator(container, 'sep-rate', 'RATE BUFFER')
	renderRow(container, 'rate-size', 'Buffer Size', String(buffer.getBufferSize()))
	renderRow(container, 'rate-stale', 'Stale', buffer.isStale() ? 'YES' : 'NO', buffer.isStale() ? '#f87171' : '#4ade80')

	renderSeparator(container, 'sep-playback', 'PLAYBACK')
	const totalMs = Spicetify?.Player?.getDuration?.() ?? 0
	const pMin = Math.floor(progressMs / 60000)
	const pSec = Math.floor((progressMs % 60000) / 1000)
	const tMin = Math.floor(totalMs / 60000)
	const tSec = Math.floor((totalMs % 60000) / 1000)
	renderRow(container, 'play-progress', 'Progress', `${pMin}:${String(pSec).padStart(2, '0')} / ${tMin}:${String(tSec).padStart(2, '0')}`)

	renderSeparator(container, 'sep-party', 'PARTY MODE')
	const party = getPartyModeState()
	renderRow(container, 'party-active', 'Active', party.active ? 'YES' : 'NO', party.active ? '#e879f9' : '#4ade80')
	renderRow(container, 'party-bpm', 'BPM', `${party.bpm.toFixed(1)} / ${PARTY_BPM_THRESHOLD}`, party.bpm >= PARTY_BPM_THRESHOLD ? '#e879f9' : 'rgba(255,255,255,0.4)')
	renderRow(container, 'party-loudness', 'Loudness', `${party.loudnessDb.toFixed(1)}dB / ${PARTY_LOUDNESS_THRESHOLD_DB}dB`, party.loudnessDb >= PARTY_LOUDNESS_THRESHOLD_DB ? '#e879f9' : 'rgba(255,255,255,0.4)')
	renderRow(container, 'party-opacity', 'Opacity', party.opacity.toFixed(3), party.active ? '#e879f9' : undefined)
	renderRow(container, 'party-flash', 'Flash', party.flash.toFixed(3))
}
