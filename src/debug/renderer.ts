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

// ─── formatters ──────────────────────────────────────────────────────────────

function row(label: string, value: string, color?: string): string {
	const valStyle = color ? `color: ${color}; font-weight: 600;` : 'color: #fff;'
	return `
		<div style="display: flex; justify-content: space-between; padding: 1px 0;">
			<span style="color: rgba(255,255,255,0.5);">${label}</span>
			<span style="${valStyle}">${value}</span>
		</div>
	`
}

function separator(title?: string): string {
	if (title) {
		return `
			<div style="
				margin: 6px 0 4px;
				padding: 3px 0;
				border-top: 1px solid rgba(255,255,255,0.06);
				font-size: 9px;
				color: rgba(255,255,255,0.3);
				letter-spacing: 1px;
				text-transform: uppercase;
			">${title}</div>
		`
	}
	return '<div style="margin: 4px 0; border-top: 1px solid rgba(255,255,255,0.06);"></div>'
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

// ─── main render ─────────────────────────────────────────────────────────────

export function renderDebugContent(lastMetrics: DebugMetrics): string {
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
		for (let i = audioData.beats.length - 1; i >= 0; i--) {
			if (audioData.beats[i].start <= progressSec) {
				beatIndex = i
				break
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

	let html = separator('PERFORMANCE')
	html += row('FPS', perf.fps.toFixed(1), perfLevelColor(perf.level))
	html += row('Profile', perf.level.toUpperCase(), perfLevelColor(perf.level))
	html += row('Frame Time', perf.avgFrameTime.toFixed(1) + 'ms')
	html += row(
		'Dropped Frames',
		String(perf.droppedFrames),
		perf.droppedFrames > 10 ? '#f87171' : undefined
	)
	html += row(
		'Worker',
		workerActive ? 'ACTIVE' : 'MAIN THREAD',
		workerActive ? '#4ade80' : '#facc15'
	)

	html += separator('SYNC ENGINE')
	html += row('Actual Rate', actualRate.toFixed(3) + 'x')
	if (lastMetrics.targetRate !== undefined)
		html += row('Target Rate', lastMetrics.targetRate.toFixed(3) + 'x', '#60a5fa')
	html += row('Beat Index', String(beatIndex))
	html += row('Beat Drift', `${liveDriftMs.toFixed(1)}ms`, driftColor(liveDriftMs))
	if (driftHistory.length > 0) {
		const accuracy =
			(driftHistory.reduce((s, d) => s + Math.max(0, 1 - d / MAX_DRIFT_MS), 0) /
				driftHistory.length) *
			100
		html += row(
			'Beat Accuracy',
			`${accuracy.toFixed(1)}% (last ${driftHistory.length})`,
			accuracy >= 85
				? '#4ade80'
				: accuracy >= 35
					? '#ffffff'
					: accuracy >= 10
						? '#facc15'
						: '#f87171'
		)
	}

	html += separator('AUDIO ANALYSIS')
	if (audioData) {
		const globalBPM = audioData.track?.tempo ?? 0
		const localBPM = getLocalBPM(audioData.beats, progressSec) || globalBPM
		html += row('Global BPM', globalBPM.toFixed(1))
		html += row(
			'Local BPM',
			localBPM.toFixed(1),
			localBPM !== globalBPM ? '#60a5fa' : undefined
		)
		const loudnessDb = getLoudnessAt(audioData.segments, progressSec)
		const scale = 1 + normalizeLoudness(loudnessDb) * (APP_CONFIG.VISUAL.MAX_SCALE - 1)
		html += row('Loudness', loudnessDb.toFixed(1) + 'dB')
		html += row('Scale', scale.toFixed(3) + 'x')
		html += row('Segments', String(audioData.segments?.length ?? 0))
		html += row('Beats', String(audioData.beats?.length ?? 0))
	} else {
		html += row('Status', 'No audio data', '#f87171')
	}

	html += separator('VIDEO')
	if (video) {
		html += row('Video Time', video.currentTime.toFixed(3) + 's')
		html += row('Paused', video.paused ? 'YES' : 'NO', video.paused ? '#f87171' : '#4ade80')
		const vt = video.currentTime % APP_CONFIG.VIDEO_DURATION
		const nextDrop = APP_CONFIG.CAT_HEAD_DROPS.find((d) => d > vt)
		const timeUntilDrop = nextDrop
			? nextDrop - vt
			: APP_CONFIG.VIDEO_DURATION - vt + APP_CONFIG.CAT_HEAD_DROPS[0]
		html += row('Next Head Drop', `in ${(timeUntilDrop * 1000).toFixed(0)}ms`)
	}

	html += separator('RATE BUFFER')
	html += row('Buffer Size', String(buffer.getBufferSize()))
	html += row('Stale', buffer.isStale() ? 'YES' : 'NO', buffer.isStale() ? '#f87171' : '#4ade80')

	html += separator('PLAYBACK')
	const totalMs = Spicetify?.Player?.getDuration?.() ?? 0
	const pMin = Math.floor(progressMs / 60000)
	const pSec = Math.floor((progressMs % 60000) / 1000)
	const tMin = Math.floor(totalMs / 60000)
	const tSec = Math.floor((totalMs % 60000) / 1000)
	html += row(
		'Progress',
		`${pMin}:${String(pSec).padStart(2, '0')} / ${tMin}:${String(tSec).padStart(2, '0')}`
	)

	html += separator('PARTY MODE')
	const party = getPartyModeState()
	html += row('Active', party.active ? 'YES' : 'NO', party.active ? '#e879f9' : '#4ade80')
	html += row(
		'BPM',
		`${party.bpm.toFixed(1)} / ${PARTY_BPM_THRESHOLD}`,
		party.bpm >= PARTY_BPM_THRESHOLD ? '#e879f9' : 'rgba(255,255,255,0.4)'
	)
	html += row(
		'Loudness',
		`${party.loudnessDb.toFixed(1)}dB / ${PARTY_LOUDNESS_THRESHOLD_DB}dB`,
		party.loudnessDb >= PARTY_LOUDNESS_THRESHOLD_DB ? '#e879f9' : 'rgba(255,255,255,0.4)'
	)
	html += row('Opacity', party.opacity.toFixed(3), party.active ? '#e879f9' : undefined)
	html += row('Flash', party.flash.toFixed(3))

	return html
}
