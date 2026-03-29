import { APP_CONFIG } from './config'
import { cachedSettings } from './settings/settings'
import { getDynamicAnalysis, getAudioData } from './audio/audio'
import { createWebMVideo, syncTiming, getVideoElement, syncVideoToMusicBeat } from './video/video'
import { performanceMonitor, createTimedRAF } from './performance'
import { getRateBuffer } from './sync/rate-buffer'
import { updateDebugMetrics } from './debug/overlay'
import { updatePartyMode } from './video/party-mode'
import { setupSettingsTrigger } from './settings/popup'
import { createSyncWorker } from './sync/worker-factory'
import { registerPlayerEvents } from './sync/player-events'

async function main() {
	console.log('[CAT-JAM] Extension initializing...')
	while (!Spicetify?.Player?.addEventListener || !Spicetify?.getAudioData) {
		await new Promise((resolve) => setTimeout(resolve, APP_CONFIG.DEFAULTS.SYNC_INTERVAL))
	}

	await createWebMVideo()

	const initSettings = () => {
		const videoEl = getVideoElement()
		if (videoEl) {
			setupSettingsTrigger(videoEl, async () => {
				await createWebMVideo()
				initSettings()
			})
		}
	}
	initSettings()

	let animationId: number | null = null
	const workerRef = { worker: createSyncWorker(), ready: false }

	if (workerRef.worker) {
		workerRef.ready = true
		workerRef.worker.onmessage = (e) => {
			const { type, data } = e.data
			if (type !== 'result') return
			const videoElement = getVideoElement()
			if (!videoElement) return

			const buffer = getRateBuffer(performanceMonitor.getPerformanceLevel())
			buffer.push(data.playbackRate, performance.now())
			const output = buffer.getOutput()

			if (!output.shouldSkip) videoElement.playbackRate = output.rate
			videoElement.style.transform = `scale(${data.scale})`
			updateDebugMetrics({ targetRate: data.playbackRate })
		}
		workerRef.worker.onerror = (e) => {
			console.warn('[CAT-JAM] Worker error, falling back to main thread:', e)
			workerRef.worker = null
			workerRef.ready = false
		}
	}

	const updateLoop = createTimedRAF(() => {
		if (!Spicetify.Player.isPlaying()) {
			animationId = null
			getVideoElement()?.pause()
			return
		}

		const progress = Spicetify.Player.getProgress()
		const perfLevel = performanceMonitor.getPerformanceLevel()

		updateDebugMetrics({ progressMs: progress, perfLevel, workerActive: workerRef.ready })

		if (workerRef.worker && workerRef.ready) {
			const audioData = getAudioData()
			if (audioData) {
				workerRef.worker.postMessage({
					type: 'process',
					data: {
						progressMs: progress,
						audioData,
						perfLevel,
						videoTime: getVideoElement()?.currentTime ?? 0,
					},
				})
			}
		} else {
			syncVideoToMusicBeat(progress, perfLevel)
			const { loudness } = getDynamicAnalysis(progress)
			const videoElement = getVideoElement()
			if (videoElement) {
				const scale =
					1 +
					loudness * ((cachedSettings.pulseIntensity ?? APP_CONFIG.VISUAL.MAX_SCALE) - 1)
				videoElement.style.transform = `scale(${scale})`
				updateDebugMetrics({ targetRate: videoElement.playbackRate })
			}
		}

		const vid = getVideoElement()
		if (vid) updatePartyMode(vid, progress)

		animationId = requestAnimationFrame(updateLoop)
	})

	const startLoop = () => {
		if (!animationId) animationId = requestAnimationFrame(updateLoop)
	}

	registerPlayerEvents(workerRef, startLoop)

	if (Spicetify.Player.isPlaying()) startLoop()
}

export default main
main()
