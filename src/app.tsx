import { APP_CONFIG } from './config'
import { settings, SETTINGS_SCHEMA } from './settings'
import { fetchAudioData, getPlaybackRate, getDynamicAnalysis, getAudioData } from './audio'
import { createWebMVideo, syncTiming, getVideoElement, syncVideoToMusicBeat } from './video'
import { performanceMonitor, createTimedRAF } from './performance'
import { getRateBuffer } from './rate-buffer'
import { updateDebugMetrics, resetBeatAccuracy } from './debug-overlay'

async function main() {
	console.log('[CAT-JAM] Extension initializing...')
	while (!Spicetify?.Player?.addEventListener || !Spicetify?.getAudioData) {
		await new Promise((resolve) => setTimeout(resolve, APP_CONFIG.DEFAULTS.SYNC_INTERVAL))
	}

	Object.values(SETTINGS_SCHEMA).forEach((field) => {
		if (field.type === 'input' || field.type === 'number') {
			settings.addInput(field.id, field.label, String(field.default))
		} else if (field.type === 'dropdown') {
			settings.addDropDown(field.id, field.label, field.options as any, 0)
		}
	})

	settings.addButton('catjam-reload', 'Reload', 'Save and reload', () => {
		createWebMVideo()
	})

	settings.pushSettings()

	await createWebMVideo()

	let animationId: number | null = null

	let worker: Worker | null = null
	let workerReady = false
	let pendingProgress: number | null = null
	let lastWorkerMessage = 0
	const WORKER_THROTTLE = 16

	try {
		const workerBlob = new Blob(
			[
				`(${(() => {
					const CAT_HEAD_DROPS = APP_CONFIG.CAT_HEAD_DROPS
					const VIDEO_DURATION = APP_CONFIG.VIDEO_DURATION
					const MAX_SCALE = APP_CONFIG.VISUAL.MAX_SCALE

					const LERP_FACTORS: Record<string, number> = {
						high: 0.25,
						medium: 0.18,
						low: 0.1,
					}

					let currentRate = 1
					let currentBeatIndex = -1

					self.onmessage = (e: MessageEvent) => {
						const { type, data } = e.data

						if (type === 'process' && data.audioData) {
							const result = processAudioData(
								data.progressMs,
								data.videoTime,
								data.audioData,
								data.perfLevel
							)
							self.postMessage({ type: 'result', data: result })
						}

						if (type === 'resetRate') {
							currentRate = 1
							currentBeatIndex = -1
						}
					}

					function processAudioData(
						progressMs: number,
						videoTime: number,
						audioData: any,
						perfLevel: string = 'high'
					) {
						const progressSec = progressMs / 1000
						const playbackRate = calculateSync(
							progressSec,
							videoTime,
							audioData,
							perfLevel
						)

						const loudness = getLoudnessAt(audioData.segments, progressSec)
						const normalizedLoudness = Math.max(0, Math.min(1, (loudness + 60) / 60))
						const scale = 1 + normalizedLoudness * (MAX_SCALE - 1)

						return { playbackRate, scale }
					}

					function calculateSync(
						progressSec: number,
						rawVideoTime: number,
						audioData: any,
						perfLevel: string
					): number {
						if (!audioData?.beats?.length) return 1

						const beats = audioData.beats
						const lerpFactor = LERP_FACTORS[perfLevel] ?? LERP_FACTORS.high

						// wrap video time to valid range
						let videoTime = rawVideoTime % VIDEO_DURATION
						if (videoTime < 0) videoTime = 0

						let beatIndex = -1
						for (let i = beats.length - 1; i >= 0; i--) {
							if (beats[i].start <= progressSec) {
								beatIndex = i
								break
							}
						}

						const nextBeat = findNextBeat(progressSec, beats)
						if (!nextBeat) {
							// past all beats - drift back to 1x
							currentRate = lerp(currentRate, 1, lerpFactor)
							return currentRate
						}

						const timeUntilBeat = nextBeat.time - progressSec
						if (timeUntilBeat < 0.005) return currentRate

						const timeUntilDrop = getTimeUntilNextDrop(videoTime)

						const targetRate = timeUntilDrop / timeUntilBeat
						const clampedTarget = clamp(targetRate, 0.75, 1.35)

						currentRate = lerp(currentRate, clampedTarget, lerpFactor)

						if (beatIndex !== currentBeatIndex) {
							currentBeatIndex = beatIndex
						}

						return currentRate
					}

					function getTimeUntilNextDrop(videoTime: number): number {
						for (const drop of CAT_HEAD_DROPS) {
							if (drop > videoTime) {
								return drop - videoTime
							}
						}
						return VIDEO_DURATION - videoTime + CAT_HEAD_DROPS[0]
					}

					function findNextBeat(
						progressSec: number,
						beats: any[]
					): { index: number; time: number } | null {
						for (let i = 0; i < beats.length; i++) {
							if (beats[i].start > progressSec) {
								return { index: i, time: beats[i].start }
							}
						}
						return null
					}

					function getLoudnessAt(segments: any[], timeSec: number): number {
						if (!segments || segments.length === 0) return -60

						let low = 0
						let high = segments.length - 1
						let mid = 0

						while (low <= high) {
							mid = (low + high) >> 1
							const s = segments[mid]
							if (s.start <= timeSec && s.start + s.duration > timeSec) {
								break
							} else if (s.start > timeSec) {
								high = mid - 1
							} else {
								low = mid + 1
							}
						}

						const segment = segments[mid]
						if (!segment) return -60

						const timeInSegment = timeSec - segment.start
						const maxTime = segment.loudness_max_time

						if (timeInSegment < maxTime) {
							const t = timeInSegment / maxTime
							return (
								segment.loudness_start +
								t * (segment.loudness_max - segment.loudness_start)
							)
						} else {
							const remainingTime = segment.duration - maxTime
							const t = (timeInSegment - maxTime) / remainingTime
							const nextStart =
								segments[mid + 1]?.loudness_start ?? segment.loudness_max
							return segment.loudness_max + t * (nextStart - segment.loudness_max)
						}
					}

					function lerp(current: number, target: number, factor: number): number {
						return current + (target - current) * factor
					}

					function clamp(value: number, min: number, max: number): number {
						return Math.max(min, Math.min(max, value))
					}
				}).toString()})()`,
			],
			{ type: 'application/javascript' }
		)
		worker = new Worker(URL.createObjectURL(workerBlob))
		workerReady = true

		worker.onmessage = (e) => {
			const { type, data } = e.data
			if (type === 'result' && getVideoElement()) {
				const videoElement = getVideoElement()!
				const perfLevel = performanceMonitor.getPerformanceLevel()
				const buffer = getRateBuffer(perfLevel)

				buffer.push(data.playbackRate, performance.now())
				const output = buffer.getOutput()

				if (!output.shouldSkip) {
					videoElement.playbackRate = output.rate
				}
				videoElement.style.transform = `scale(${data.scale})`

				updateDebugMetrics({ targetRate: data.playbackRate })
			}
		}
	} catch (error) {
		console.warn('[CAT-JAM] Worker setup failed, falling back to main thread:', error)
		worker = null
	}

	const updateLoop = createTimedRAF(async (timestamp: number) => {
		if (!Spicetify.Player.isPlaying()) {
			animationId = null
			getVideoElement()?.pause()
			return
		}

		const progress = Spicetify.Player.getProgress()
		const perfLevel = performanceMonitor.getPerformanceLevel()

		updateDebugMetrics({
			progressMs: progress,
			perfLevel,
			workerActive: !!(worker && workerReady),
		})

		if (worker && workerReady) {
			const audioData = getAudioData()
			if (audioData) {
				const videoTime = getVideoElement()?.currentTime ?? 0
				worker.postMessage({
					type: 'process',
					data: { progressMs: progress, audioData, perfLevel, videoTime },
				})
			}
		} else {
			syncVideoToMusicBeat(progress, perfLevel)

			const { loudness } = getDynamicAnalysis(progress)
			const videoElement = getVideoElement()

			if (videoElement) {
				const scale = 1 + loudness * (APP_CONFIG.VISUAL.MAX_SCALE - 1)
				videoElement.style.transform = `scale(${scale})`
				updateDebugMetrics({ targetRate: videoElement.playbackRate })
			}
		}

		animationId = requestAnimationFrame(updateLoop)
	})

	const startLoop = () => {
		if (!animationId) animationId = requestAnimationFrame(updateLoop)
	}

	Spicetify.Player.addEventListener('onplaypause', () => {
		const progress = Spicetify.Player.getProgress()
		syncTiming(performance.now(), progress)
		if (Spicetify.Player.isPlaying()) {
			startLoop()
		} else {
			worker?.postMessage({ type: 'resetRate' })
			getRateBuffer('high').clear()
			getRateBuffer('medium').clear()
			getRateBuffer('low').clear()
		}
	})

	let lastProgress = 0
	Spicetify.Player.addEventListener('onprogress', () => {
		const progress = Spicetify.Player.getProgress()
		const diff = Math.abs(progress - lastProgress)
		if (diff >= 3000) {
			syncTiming(performance.now(), progress)
			worker?.postMessage({ type: 'resetRate' })
			getRateBuffer('high').clear()
			getRateBuffer('medium').clear()
			getRateBuffer('low').clear()
		}
		lastProgress = progress
	})

	Spicetify.Player.addEventListener('songchange', async () => {
		const videoElement = getVideoElement()
		if (!videoElement) return

		getRateBuffer('high').clear()
		getRateBuffer('medium').clear()
		getRateBuffer('low').clear()
		resetBeatAccuracy()

		const startTime = performance.now()
		const audioData = await fetchAudioData()

		videoElement.playbackRate = 1

		if (audioData?.beats?.length) {
			const firstBeatStart = audioData.beats[0].start
			const delay = Math.max(0, firstBeatStart * 1000 - (performance.now() - startTime))
			setTimeout(() => {
				getVideoElement()?.play()
				startLoop()
			}, delay)
		} else {
			videoElement.play()
			startLoop()
		}
	})

	// Initial start if already playing
	if (Spicetify.Player.isPlaying()) startLoop()
}

export default main
main()
