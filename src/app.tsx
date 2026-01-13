import { APP_CONFIG } from './config'
import { settings, SETTINGS_SCHEMA } from './settings'
import { fetchAudioData, getPlaybackRate, getDynamicAnalysis, getAudioData } from './audio'
import { createWebMVideo, syncTiming, getVideoElement, syncVideoToMusicBeat } from './video'

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
					let currentRate = 1
					let currentBeatIndex = -1

					self.onmessage = (e: MessageEvent) => {
						const { type, data } = e.data

						if (type === 'process' && data.audioData) {
							const result = processAudioData(data.progressMs, data.audioData)
							self.postMessage({ type: 'result', data: result })
						}

						if (type === 'resetRate') {
							currentRate = 1
							currentBeatIndex = -1
						}
					}

					function processAudioData(progressMs: number, audioData: any) {
						const progressSec = progressMs / 1000

						const playbackRate = calculateSmoothPlaybackRate(progressSec, audioData)

						const loudness = getLoudnessAt(audioData.segments, progressSec)
						const normalizedLoudness = Math.max(0, Math.min(1, (loudness + 60) / 60))
						const scale = 1 + normalizedLoudness * (APP_CONFIG.VISUAL.MAX_SCALE - 1)

						return { playbackRate, scale }
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

					function calculateSmoothPlaybackRate(
						progressSec: number,
						audioData: any
					): number {
						if (!audioData?.beats?.length) return 1

						let beatIndex = -1
						for (let i = 0; i < audioData.beats.length; i++) {
							if (audioData.beats[i].start <= progressSec) {
								beatIndex = i
							} else {
								break
							}
						}

						if (beatIndex !== currentBeatIndex) {
							currentBeatIndex = beatIndex
						}

						const nextBeat = getNextBeat(progressSec, audioData.beats)
						if (!nextBeat) return 1

						const dropIndex = nextBeat.index % CAT_HEAD_DROPS.length
						const currentDrop = CAT_HEAD_DROPS[dropIndex]
						const nextDrop = CAT_HEAD_DROPS[(dropIndex + 1) % CAT_HEAD_DROPS.length]

						let dropDuration: number
						if (nextDrop > currentDrop) {
							dropDuration = nextDrop - currentDrop
						} else {
							dropDuration = VIDEO_DURATION - currentDrop + nextDrop
						}

						const timeUntilBeat = nextBeat.time - progressSec
						if (timeUntilBeat <= 0.05) return currentRate

						const timeUntilDrop =
							dropDuration *
							(timeUntilBeat /
								(audioData.beats[nextBeat.index].start -
									audioData.beats[beatIndex].start))

						const targetRate = timeUntilDrop / timeUntilBeat
						const clampedTarget = Math.max(0.85, Math.min(1.3, targetRate))

						currentRate = lerp(currentRate, clampedTarget, 0.08)

						const maxDelta = 0.02
						if (Math.abs(currentRate - clampedTarget) > maxDelta) {
							return currentRate
						}

						return currentRate
					}

					function getNextHeadDrop(currentVideoTime: number): {
						index: number
						time: number
					} {
						for (let i = 0; i < CAT_HEAD_DROPS.length; i++) {
							if (CAT_HEAD_DROPS[i] > currentVideoTime) {
								return { index: i, time: CAT_HEAD_DROPS[i] }
							}
						}
						return { index: 0, time: CAT_HEAD_DROPS[0] + VIDEO_DURATION }
					}

					function getNextBeat(
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

					function lerp(current: number, target: number, factor: number): number {
						return current + (target - current) * factor
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
				videoElement.playbackRate = data.playbackRate
				videoElement.style.transform = `scale(${data.scale})`
			}
		}
	} catch (error) {
		console.warn('[CAT-JAM] Worker setup failed, falling back to main thread:', error)
		worker = null
	}

	const updateLoop = async () => {
		if (!Spicetify.Player.isPlaying()) {
			animationId = null
			getVideoElement()?.pause()
			return
		}

		const progress = Spicetify.Player.getProgress()

		if (worker && workerReady) {
			const audioData = getAudioData()
			if (audioData) {
				worker.postMessage({
					type: 'process',
					data: { progressMs: progress, audioData },
				})
			}
		} else {
			syncVideoToMusicBeat(progress)

			const { loudness } = getDynamicAnalysis(progress)
			const videoElement = getVideoElement()

			if (videoElement) {
				const scale = 1 + loudness * (APP_CONFIG.VISUAL.MAX_SCALE - 1)
				videoElement.style.transform = `scale(${scale})`
			}
		}

		animationId = requestAnimationFrame(updateLoop)
	}

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
		}
	})

	let lastProgress = 0
	Spicetify.Player.addEventListener('onprogress', () => {
		const progress = Spicetify.Player.getProgress()
		if (Math.abs(progress - lastProgress) >= APP_CONFIG.DEFAULTS.PROGRESS_THRESHOLD) {
			syncTiming(performance.now(), progress)
		}
		lastProgress = progress
	})

	Spicetify.Player.addEventListener('songchange', async () => {
		const videoElement = getVideoElement()
		if (!videoElement) return

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
