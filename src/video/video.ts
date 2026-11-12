import { APP_CONFIG } from '../config'
import { cachedSettings } from '../settings/settings'
import { getAudioData, fetchAudioData } from '../audio/audio'
import { syncEngine } from '../sync/engine'
import type { PerformanceLevel } from '../performance'
import { findLibrarySidebar, mountVideoOverSidebar } from './left-mount'

let videoElement: HTMLVideoElement | null = null
let lastSyncBeatIndex = -1
let stopTrackingSidebar: (() => void) | null = null

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
		videoElement.play()
	} else {
		videoElement.pause()
	}
}

function findBottomPlayerTarget(): Element | null {
	const direct = document.querySelector(APP_CONFIG.SELECTORS.BOTTOM_PLAYER)
	if (direct) return direct

	const bar = document.querySelector(APP_CONFIG.SELECTORS.NOW_PLAYING_BAR)
	if (!bar) return null

	const inner = bar.querySelector('.main-nowPlayingBar-nowPlayingBar') ?? bar
	return inner.lastElementChild ?? inner
}

async function waitForElement(
	find: string | (() => Element | null),
	maxAttempts = 50,
	interval = APP_CONFIG.DEFAULTS.SYNC_INTERVAL
): Promise<Element> {
	const lookup = typeof find === 'string' ? () => document.querySelector(find) : find
	for (let attempts = 0; attempts < maxAttempts; attempts++) {
		const element = lookup()
		if (element) return element
		await new Promise((resolve) => setTimeout(resolve, interval))
	}
	throw new Error(`Element ${typeof find === 'string' ? find : 'bottom player'} not found.`)
}

export async function createWebMVideo() {
	try {
		const isBottom = cachedSettings.position === APP_CONFIG.LABELS.POSITION.BOTTOM
		const videoDuration = APP_CONFIG.VIDEO_DURATION

		const sz = `${cachedSettings.catSize ?? 65}px`
		const bottomStyle = `width: ${sz}; height: ${sz};`

		const elementStyles = isBottom ? bottomStyle : ''

		const targetElement = await waitForElement(
			isBottom ? findBottomPlayerTarget : APP_CONFIG.SELECTORS.LEFT_LIBRARY
		)

		stopTrackingSidebar?.()
		stopTrackingSidebar = null

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

		videoElement.addEventListener('loadedmetadata', () => {
			if (videoElement && isFinite(videoElement.duration) && videoElement.duration > 0) {
				localStorage.setItem(
					'catjam-setting:custom-duration',
					String(videoElement.duration)
				)
			}
		})

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

		if (isBottom) {
			targetElement.insertBefore(videoElement, targetElement.firstChild)
		} else {
			const sidebar = findLibrarySidebar(targetElement)
			if (!sidebar) throw new Error('Left sidebar column not found.')
			stopTrackingSidebar = mountVideoOverSidebar(videoElement, sidebar, cachedSettings.size)
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
