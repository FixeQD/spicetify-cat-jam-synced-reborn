import { getAudioData } from './audio'
import { getLoudnessAt, normalizeLoudness, getInstantBPM } from './analyzer'

export const PARTY_BPM_THRESHOLD = 130
export const PARTY_LOUDNESS_THRESHOLD_DB = -10
const OPACITY_SMOOTHING = 0.04
const FLASH_DECAY = 0.82

let canvas: HTMLCanvasElement | null = null
let ctx: CanvasRenderingContext2D | null = null
let currentOpacity = 0
let flashIntensity = 0
let lastBeatIndex = -1
let hueOffset = 0
let _lastBpm = 0
let _lastLoudness = 0
let partyActiveUntil = 0
let cooldownUntil = 0

function createCanvas(): HTMLCanvasElement {
	const el = document.createElement('canvas')
	el.id = 'catjam-party-canvas'
	el.style.cssText = `
		position: fixed;
		pointer-events: none;
		z-index: 9999;
		mix-blend-mode: screen;
	`
	document.body.appendChild(el)
	return el
}

export function updatePartyMode(videoElement: HTMLVideoElement, progressMs: number) {
	const audioData = getAudioData()
	if (!audioData) return

	const progressSec = progressMs / 1000
	const loudnessDb = getLoudnessAt(audioData.segments, progressSec)
	const loudness = normalizeLoudness(loudnessDb)
	const bpm = (getInstantBPM(audioData.beats, progressSec) || audioData.track?.tempo) ?? 0

	const now = performance.now()
	if (bpm >= PARTY_BPM_THRESHOLD && loudnessDb >= PARTY_LOUDNESS_THRESHOLD_DB) {
		partyActiveUntil = now + 1000
	}
	const shouldBeActive = now < partyActiveUntil
	_lastBpm = bpm
	_lastLoudness = loudnessDb

	// beat flash
	let beatIndex = -1
	if (audioData.beats?.length) {
		for (let i = audioData.beats.length - 1; i >= 0; i--) {
			if (audioData.beats[i].start <= progressSec) {
				beatIndex = i
				break
			}
		}
	}

	if (beatIndex !== lastBeatIndex && beatIndex >= 0 && shouldBeActive) {
		lastBeatIndex = beatIndex
		flashIntensity = 1.0
	}

	const baseTarget = shouldBeActive
		? 0.25 + Math.min((bpm - PARTY_BPM_THRESHOLD) / 75, 1) * 0.5
		: 0
	currentOpacity += (baseTarget - currentOpacity) * OPACITY_SMOOTHING
	flashIntensity *= FLASH_DECAY

	const totalOpacity = Math.min(0.9, currentOpacity + flashIntensity * 0.45)

	if (totalOpacity <= 0.01) {
		if (canvas) canvas.style.opacity = '0'
		return
	}

	hueOffset = (hueOffset + (bpm / 60) * 1.5) % 360

	// lazy init
	if (!canvas || !canvas.parentElement) {
		canvas = createCanvas()
		ctx = canvas.getContext('2d')
	}

	// sync canvas size and position to video each frame
	const rect = videoElement.getBoundingClientRect()
	const w = Math.round(rect.width)
	const h = Math.round(rect.height)
	const dpr = window.devicePixelRatio || 1

	canvas.style.left = `${rect.left}px`
	canvas.style.top = `${rect.top}px`
	canvas.style.width = `${w}px`
	canvas.style.height = `${h}px`
	canvas.style.opacity = String(totalOpacity.toFixed(3))

	const pw = Math.round(w * dpr)
	const ph = Math.round(h * dpr)

	if (canvas.width !== pw || canvas.height !== ph) {
		canvas.width = pw
		canvas.height = ph
	}

	if (!ctx) return

	ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

	ctx.clearRect(0, 0, w, h)

	// draw spinning conic gradient
	const cx = w / 2
	const cy = h / 2
	const gradient = ctx.createConicGradient((hueOffset * Math.PI) / 180, cx, cy)
	for (let i = 0; i <= 8; i++) {
		const hue = (hueOffset + i * 45) % 360
		gradient.addColorStop(i / 8, `hsl(${hue}, 100%, 65%)`)
	}

	ctx.fillStyle = gradient
	ctx.fillRect(0, 0, w, h)

	ctx.globalCompositeOperation = 'destination-in'
	ctx.drawImage(videoElement, 0, 0, w, h)
	ctx.globalCompositeOperation = 'source-over'
}

export function getPartyModeState() {
	return {
		active: currentOpacity > 0.01 || flashIntensity > 0.01,
		bpm: _lastBpm,
		loudnessDb: _lastLoudness,
		opacity: currentOpacity,
		flash: flashIntensity,
	}
}

export function destroyPartyOverlay() {
	canvas?.remove()
	canvas = null
	ctx = null
	currentOpacity = 0
	flashIntensity = 0
	lastBeatIndex = -1
	hueOffset = 0
}
