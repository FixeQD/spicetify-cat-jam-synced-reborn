import { performanceMonitor } from './performance'
import { getRateBuffer } from './rate-buffer'
import { getAudioData } from './audio'
import { getLocalBPM, getLoudnessAt, normalizeLoudness } from './analyzer'
import { APP_CONFIG } from './config'
import { getVideoElement } from './video'

export interface DebugMetrics {
	progressMs: number
	perfLevel: 'low' | 'medium' | 'high'
	workerActive: boolean
}

let overlay: HTMLDivElement | null = null
let visible = false
let animFrameId: number | null = null
let lastMetrics: DebugMetrics = { progressMs: 0, perfLevel: 'high', workerActive: false }

// beat accuracy tracking
let beatHits = 0
let beatTotal = 0
let lastTrackedBeatIndex = -1

const ACCURACY_WINDOW = 50

function createStyles(): string {
	return `
		position: fixed;
		top: 80px;
		left: 20px;
		z-index: 99999;
		background: rgba(0, 0, 0, 0.88);
		color: #e0e0e0;
		font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'SF Mono', monospace;
		font-size: 11px;
		line-height: 1.55;
		padding: 0;
		border-radius: 8px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		backdrop-filter: blur(12px);
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
		min-width: 310px;
		user-select: none;
		cursor: default;
		pointer-events: auto;
	`
}

function createOverlayElement(): HTMLDivElement {
	const el = document.createElement('div')
	el.id = 'catjam-debug-overlay'
	el.style.cssText = createStyles()

	el.innerHTML = `
		<div id="catjam-debug-header" style="
			padding: 8px 12px;
			background: rgba(255, 255, 255, 0.04);
			border-bottom: 1px solid rgba(255, 255, 255, 0.06);
			border-radius: 8px 8px 0 0;
			cursor: grab;
			display: flex;
			align-items: center;
			justify-content: space-between;
		">
			<span style="font-weight: 600; color: #fff; letter-spacing: 0.5px;">
				Cat Jam Debug
			</span>
			<span style="
				font-size: 9px;
				color: rgba(255, 255, 255, 0.35);
				letter-spacing: 0.3px;
			">v${APP_CONFIG.DEFAULTS.BPM ? '2.3.0' : '?'} - drag to move</span>
		</div>
		<div id="catjam-debug-content" style="padding: 10px 12px;"></div>
	`

	setupDrag(el)
	document.body.appendChild(el)
	return el
}

function setupDrag(el: HTMLDivElement) {
	const header = el.querySelector('#catjam-debug-header') as HTMLElement
	if (!header) return

	let dragging = false
	let offsetX = 0
	let offsetY = 0

	header.addEventListener('mousedown', (e: MouseEvent) => {
		if (e.button !== 0) return
		dragging = true
		offsetX = e.clientX - el.getBoundingClientRect().left
		offsetY = e.clientY - el.getBoundingClientRect().top
		header.style.cursor = 'grabbing'
		e.preventDefault()
	})

	document.addEventListener('mousemove', (e: MouseEvent) => {
		if (!dragging) return
		const x = Math.max(0, Math.min(window.innerWidth - el.offsetWidth, e.clientX - offsetX))
		const y = Math.max(0, Math.min(window.innerHeight - el.offsetHeight, e.clientY - offsetY))
		el.style.left = `${x}px`
		el.style.top = `${y}px`
	})

	document.addEventListener('mouseup', () => {
		if (!dragging) return
		dragging = false
		header.style.cursor = 'grab'
	})
}

function formatRate(rate: number): string {
	return rate.toFixed(3) + 'x'
}

function formatMs(ms: number): string {
	return ms.toFixed(1) + 'ms'
}

function formatDb(db: number): string {
	return db.toFixed(1) + 'dB'
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

// tracks actual beat-to-head-drop timing for real drift measurement
let lastBeatTime = 0
let lastHeadDropTime = 0
let currentDrift = 0
let prevBeatIndex = -1
let prevDropIndex = -1

function trackDrift(videoTime: number, progressSec: number, audioData: any) {
	if (!audioData?.beats?.length) return

	const drops = APP_CONFIG.CAT_HEAD_DROPS
	const beats = audioData.beats

	// find current beat
	let beatIndex = -1
	for (let i = beats.length - 1; i >= 0; i--) {
		if (beats[i].start <= progressSec) {
			beatIndex = i
			break
		}
	}

	// detect beat transition
	if (beatIndex >= 0 && beatIndex !== prevBeatIndex) {
		lastBeatTime = beats[beatIndex].start
		prevBeatIndex = beatIndex
	}

	// detect head drop transition
	let dropIndex = -1
	for (let i = drops.length - 1; i >= 0; i--) {
		if (drops[i] <= videoTime) {
			dropIndex = i
			break
		}
	}

	if (dropIndex >= 0 && dropIndex !== prevDropIndex) {
		lastHeadDropTime = drops[dropIndex]
		prevDropIndex = dropIndex

		if (lastBeatTime > 0) {
			const video = getVideoElement()
			const rate = video?.playbackRate ?? 1
			const timeSinceDropInVideo = videoTime - lastHeadDropTime
			const timeSinceDropReal = rate > 0 ? timeSinceDropInVideo / rate : 0
			const dropMusicTime = progressSec - timeSinceDropReal

			currentDrift = dropMusicTime - lastBeatTime
		}
	}
}

function renderContent(): string {
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

	// update drift tracking
	trackDrift(videoTime, progressSec, audioData)
	const driftMs = currentDrift * 1000

	// performance section
	let html = separator('PERFORMANCE')
	html += row('FPS', perf.fps.toFixed(1), perfLevelColor(perf.level))
	html += row('Profile', perf.level.toUpperCase(), perfLevelColor(perf.level))
	html += row('Frame Time', formatMs(perf.avgFrameTime))
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

	// sync section
	html += separator('SYNC ENGINE')
	html += row('Playback Rate', formatRate(actualRate))
	html += row('Beat Index', String(beatIndex))

	const driftSign = driftMs >= 0 ? '+' : ''
	html += row('Drift', `${driftSign}${driftMs.toFixed(1)}ms`, driftColor(driftMs))

	// beat accuracy
	if (audioData?.beats?.length && beatIndex >= 0) {
		if (beatIndex !== lastTrackedBeatIndex) {
			lastTrackedBeatIndex = beatIndex
			beatTotal++
			if (Math.abs(driftMs) < 50) beatHits++
			if (beatTotal > ACCURACY_WINDOW) {
				const excess = beatTotal - ACCURACY_WINDOW
				beatTotal = ACCURACY_WINDOW
				beatHits = Math.max(0, beatHits - excess)
			}
		}
		const accuracy = beatTotal > 0 ? (beatHits / beatTotal) * 100 : 0
		html += row(
			'Beat Accuracy',
			`${accuracy.toFixed(1)}% (last ${beatTotal})`,
			accuracy > 85 ? '#4ade80' : accuracy > 60 ? '#facc15' : '#f87171'
		)
	}

	// audio analysis section
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
		const loudnessNorm = normalizeLoudness(loudnessDb)
		const scale = 1 + loudnessNorm * (APP_CONFIG.VISUAL.MAX_SCALE - 1)
		html += row('Loudness', formatDb(loudnessDb))
		html += row('Scale', scale.toFixed(3) + 'x')
		html += row('Segments', String(audioData.segments?.length ?? 0))
		html += row('Beats', String(audioData.beats?.length ?? 0))
	} else {
		html += row('Status', 'No audio data', '#f87171')
	}

	// video section
	html += separator('VIDEO')
	if (video) {
		html += row('Video Time', video.currentTime.toFixed(3) + 's')
		html += row('Video Rate', formatRate(video.playbackRate))
		html += row('Paused', video.paused ? 'YES' : 'NO', video.paused ? '#f87171' : '#4ade80')

		// next head drop
		const drops = APP_CONFIG.CAT_HEAD_DROPS
		const nextDrop = drops.find((d) => d > video.currentTime)
		const nextDropTime = nextDrop ?? drops[0] + APP_CONFIG.VIDEO_DURATION
		const timeUntilDrop = nextDrop
			? nextDrop - video.currentTime
			: APP_CONFIG.VIDEO_DURATION - video.currentTime + drops[0]
		html += row('Next Head Drop', `in ${(timeUntilDrop * 1000).toFixed(0)}ms`)
	}

	// rate buffer section
	html += separator('RATE BUFFER')
	html += row('Buffer Size', `${buffer.getBufferSize()}`)
	html += row('Stale', buffer.isStale() ? 'YES' : 'NO', buffer.isStale() ? '#f87171' : '#4ade80')

	// music progress
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

	return html
}

function updateOverlay() {
	if (!visible || !overlay) return

	const content = overlay.querySelector('#catjam-debug-content') as HTMLElement
	if (content) {
		content.innerHTML = renderContent()
	}

	animFrameId = requestAnimationFrame(updateOverlay)
}

export function updateDebugMetrics(metrics: Partial<DebugMetrics>) {
	lastMetrics = { ...lastMetrics, ...metrics }
}

export function toggleDebugOverlay() {
	visible = !visible

	if (visible) {
		if (!overlay) {
			overlay = createOverlayElement()
		}
		overlay.style.display = 'block'
		animFrameId = requestAnimationFrame(updateOverlay)
		console.log('[CAT-JAM] Debug overlay enabled')
	} else {
		if (overlay) {
			overlay.style.display = 'none'
		}
		if (animFrameId) {
			cancelAnimationFrame(animFrameId)
			animFrameId = null
		}
		console.log('[CAT-JAM] Debug overlay disabled')
	}
}

export function isDebugVisible(): boolean {
	return visible
}

export function setupDebugTrigger(videoElement: HTMLVideoElement) {
	videoElement.style.pointerEvents = 'auto'

	videoElement.addEventListener('click', (e: MouseEvent) => {
		if (!e.shiftKey) return
		e.preventDefault()
		toggleDebugOverlay()
	})
}
