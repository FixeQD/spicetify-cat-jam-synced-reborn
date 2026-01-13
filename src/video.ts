import { APP_CONFIG } from './config'
import { cachedSettings } from './settings'
import { getAudioData, fetchAudioData } from './audio'

let videoElement: HTMLVideoElement | null = null
let lastSyncBeatIndex = -1
let currentRate = 1

export function getVideoElement() {
	return videoElement
}

function getNextHeadDrop(currentVideoTime: number): { index: number; time: number } {
	const drops = APP_CONFIG.CAT_HEAD_DROPS
	const videoDuration = APP_CONFIG.VIDEO_DURATION

	for (let i = 0; i < drops.length; i++) {
		if (drops[i] > currentVideoTime) {
			return { index: i, time: drops[i] }
		}
	}
	// wrapped around - next drop is first one
	return { index: 0, time: drops[0] + videoDuration }
}

function getNextBeat(progressSec: number, beats: any[]): { index: number; time: number } | null {
	for (let i = 0; i < beats.length; i++) {
		if (beats[i].start > progressSec) {
			return { index: i, time: beats[i].start }
		}
	}
	return null
}

// lerp towards target rate - smooths out sudden changes
function lerp(current: number, target: number, factor: number): number {
	return current + (target - current) * factor
}

function calculateSmoothPlaybackRate(progressMs: number): number {
	if (!videoElement) return 1

	const audioData = getAudioData()
	if (!audioData?.beats?.length) return 1

	const progressSec = progressMs / 1000
	const currentVideoTime = videoElement.currentTime
	const videoDuration = APP_CONFIG.VIDEO_DURATION

	const nextBeat = getNextBeat(progressSec, audioData.beats)
	if (!nextBeat) return 1

	const nextDrop = getNextHeadDrop(currentVideoTime)

	const timeUntilBeat = nextBeat.time - progressSec
	// if beat is too close, just coast at current rate
	if (timeUntilBeat <= 0.05) return currentRate

	let timeUntilDrop = nextDrop.time - currentVideoTime
	if (timeUntilDrop <= 0) {
		timeUntilDrop += videoDuration
	}

	// playback rate = video_distance / music_distance
	const targetRate = timeUntilDrop / timeUntilBeat
	const clampedTarget = Math.max(0.85, Math.min(1.3, targetRate))

	// smooth transition - don't jump rates instantly
	currentRate = lerp(currentRate, clampedTarget, 0.08)

	// limit max change per frame to prevent jumps
	const maxDelta = 0.02
	if (Math.abs(currentRate - clampedTarget) > maxDelta) {
		return currentRate
	}

	return currentRate
}

// only jumps currentTime on big desync (pause/seek/song change)
function correctBigDrift(progressMs: number) {
	if (!videoElement) return

	const audioData = getAudioData()
	if (!audioData?.beats?.length) return

	const progressSec = progressMs / 1000
	const drops = APP_CONFIG.CAT_HEAD_DROPS
	const videoDuration = APP_CONFIG.VIDEO_DURATION

	let currentBeatIndex = 0
	for (let i = 0; i < audioData.beats.length; i++) {
		if (audioData.beats[i].start <= progressSec) {
			currentBeatIndex = i
		} else {
			break
		}
	}

	// only correct once per beat transition
	if (currentBeatIndex === lastSyncBeatIndex) return
	lastSyncBeatIndex = currentBeatIndex

	const currentBeat = audioData.beats[currentBeatIndex]
	const nextBeat = audioData.beats[currentBeatIndex + 1]
	if (!currentBeat || !nextBeat) return

	const beatDuration = nextBeat.start - currentBeat.start
	const timeSinceBeat = progressSec - currentBeat.start
	const beatProgress = Math.min(1, timeSinceBeat / beatDuration)

	// where should video be?
	const dropIndex = currentBeatIndex % drops.length
	const currentDrop = drops[dropIndex]
	const nextDrop = drops[(dropIndex + 1) % drops.length]

	let dropDuration: number
	if (nextDrop > currentDrop) {
		dropDuration = nextDrop - currentDrop
	} else {
		dropDuration = videoDuration - currentDrop + nextDrop
	}

	let expectedTime = currentDrop + beatProgress * dropDuration
	if (expectedTime >= videoDuration) {
		expectedTime -= videoDuration
	}

	const drift = videoElement.currentTime - expectedTime
	const wrappedDrift =
		Math.abs(drift) > videoDuration / 2
			? drift > 0
				? drift - videoDuration
				: drift + videoDuration
			: drift

	if (Math.abs(wrappedDrift) > 1.5) {
		videoElement.currentTime = expectedTime
		currentRate = 1
	} else if (Math.abs(wrappedDrift) > 0.5) {
		currentRate = 1 + (wrappedDrift > 0 ? 0.1 : -0.1)
	}
}

export function syncVideoToMusicBeat(progressMs: number) {
	if (!videoElement) return

	correctBigDrift(progressMs)

	const rate = calculateSmoothPlaybackRate(progressMs)
	videoElement.playbackRate = rate
}

export function syncTiming(startTime: number, progress: number) {
	if (!videoElement) return

	if (Spicetify.Player.isPlaying()) {
		// reset sync tracking on manual sync
		lastSyncBeatIndex = -1
		correctBigDrift(progress)

		const progressInSeconds = progress / 1000
		const audioData = getAudioData()

		if (audioData?.beats?.length) {
			const upcomingBeat = audioData.beats.find((beat: any) => beat.start > progressInSeconds)
			if (upcomingBeat) {
				const operationTime = performance.now() - startTime
				const delayUntilNextBeat = Math.max(
					0,
					(upcomingBeat.start - progressInSeconds) * 1000 - operationTime
				)

				setTimeout(() => {
					videoElement?.play()
				}, delayUntilNextBeat)
			} else {
				videoElement.play()
			}
		} else {
			videoElement.play()
		}
	} else {
		videoElement.pause()
	}
}

async function waitForElement(
	selector: string,
	maxAttempts = 50,
	interval = APP_CONFIG.DEFAULTS.SYNC_INTERVAL
): Promise<Element> {
	for (let attempts = 0; attempts < maxAttempts; attempts++) {
		const element = document.querySelector(selector)
		if (element) return element
		await new Promise((resolve) => setTimeout(resolve, interval))
	}
	throw new Error(`Element ${selector} not found.`)
}

export async function createWebMVideo() {
	try {
		const isBottom = cachedSettings.position === APP_CONFIG.LABELS.POSITION.BOTTOM
		const videoDuration = APP_CONFIG.VIDEO_DURATION

		const leftLibraryStyle = `width: ${cachedSettings.size}%; max-width: ${APP_CONFIG.STYLES.MAX_LIBRARY_WIDTH}; height: auto; max-height: 100%; position: absolute; bottom: 0; pointer-events: none; z-index: 1;`

		const targetElementSelector = isBottom
			? APP_CONFIG.SELECTORS.BOTTOM_PLAYER
			: APP_CONFIG.SELECTORS.LEFT_LIBRARY
		const elementStyles = isBottom ? APP_CONFIG.STYLES.BOTTOM_PLAYER : leftLibraryStyle

		const targetElement = await waitForElement(targetElementSelector)

		if (videoElement) {
			videoElement.remove()
			const oldVideo = document.getElementById(APP_CONFIG.SELECTORS.CAT_JAM_ID)
			if (oldVideo) {
				oldVideo.remove()
			}
		}

		const videoURL = cachedSettings.link || APP_CONFIG.DEFAULTS.VIDEO_URL

		videoElement = document.createElement('video')
		videoElement.loop = false
		videoElement.autoplay = false
		videoElement.muted = true
		videoElement.style.cssText = elementStyles
		videoElement.src = videoURL
		videoElement.id = APP_CONFIG.SELECTORS.CAT_JAM_ID

		const loopThreshold = videoDuration - 0.15

		const handleTimeUpdate = () => {
			if (!videoElement) return
			if (videoElement.currentTime >= loopThreshold) {
				videoElement.currentTime = 0
			}
		}

		const handleEnded = () => {
			if (videoElement) {
				videoElement.currentTime = 0
				videoElement.play()
			}
		}

		videoElement.addEventListener('timeupdate', handleTimeUpdate)
		videoElement.addEventListener('ended', handleEnded)

		await fetchAudioData()
		videoElement.playbackRate = 1
		currentRate = 1

		if (targetElement.firstChild) {
			targetElement.insertBefore(videoElement, targetElement.firstChild)
		} else {
			targetElement.appendChild(videoElement)
		}

		// reset sync state
		lastSyncBeatIndex = -1
		currentRate = 1

		if (Spicetify.Player.isPlaying()) {
			videoElement.play()
		} else {
			videoElement.pause()
		}
	} catch (error) {
		console.error('[CAT-JAM] Initialization error: ', error)
	}
}
