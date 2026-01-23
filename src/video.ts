import { APP_CONFIG } from './config'
import { cachedSettings } from './settings'
import { getAudioData, fetchAudioData } from './audio'
import { syncEngine, SYNC_CONFIGS } from './sync-engine'
import type { PerformanceLevel } from './performance'

let videoElement: HTMLVideoElement | null = null
let lastSyncBeatIndex = -1

export function getVideoElement() {
	return videoElement
}

function calculateSmoothPlaybackRate(
	progressMs: number,
	perfLevel: PerformanceLevel = 'high'
): number {
	if (!videoElement) return 1

	const audioData = getAudioData()
	if (!audioData?.beats?.length) return 1

	const progressSec = progressMs / 1000
	const currentVideoTime = videoElement.currentTime

	const result = syncEngine.update(progressSec, currentVideoTime, audioData, perfLevel)

	if (result.needsReset) {
		const videoDuration = APP_CONFIG.VIDEO_DURATION
		if (result.snapTime !== undefined) {
			let wrappedCurrent = currentVideoTime
			if (wrappedCurrent >= videoDuration) wrappedCurrent -= videoDuration
			const drift = wrappedCurrent - result.snapTime
			if (Math.abs(drift) > 1.5) {
				videoElement.currentTime = result.snapTime
			}
		}
		syncEngine.reset()
		return 1
	}

	if (result.shouldSnap && result.snapTime !== undefined) {
		const videoDuration = APP_CONFIG.VIDEO_DURATION
		let wrappedCurrent = currentVideoTime
		if (wrappedCurrent >= videoDuration) wrappedCurrent -= videoDuration

		const drift = wrappedCurrent - result.snapTime
		if (Math.abs(drift) > 1.5) {
			videoElement.currentTime = result.snapTime
			syncEngine.reset()
			return 1
		}
	}

	return result.playbackRate
}

export function syncVideoToMusicBeat(progressMs: number, perfLevel: PerformanceLevel = 'high') {
	if (!videoElement) return

	const rate = calculateSmoothPlaybackRate(progressMs, perfLevel)
	videoElement.playbackRate = rate
}

export function syncTiming(startTime: number, progress: number) {
	if (!videoElement) return

	if (Spicetify.Player.isPlaying()) {
		syncEngine.reset()
		lastSyncBeatIndex = -1

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
		syncEngine.reset()

		if (targetElement.firstChild) {
			targetElement.insertBefore(videoElement, targetElement.firstChild)
		} else {
			targetElement.appendChild(videoElement)
		}

		// reset sync state
		lastSyncBeatIndex = -1
		syncEngine.reset()

		if (Spicetify.Player.isPlaying()) {
			videoElement.play()
		} else {
			videoElement.pause()
		}
	} catch (error) {
		console.error('[CAT-JAM] Initialization error: ', error)
	}
}
