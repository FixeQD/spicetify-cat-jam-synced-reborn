import { fetchAudioData } from './audio'
import { syncTiming, getVideoElement } from './video'
import { getRateBuffer } from './rate-buffer'
import { resetBeatAccuracy } from './debug-overlay'
import { destroyPartyOverlay } from './party-mode'

type WorkerRef = { worker: Worker | null; ready: boolean }

export function registerPlayerEvents(
	workerRef: WorkerRef,
	startLoop: () => void
) {
	function clearBuffers() {
		getRateBuffer('high').clear()
		getRateBuffer('medium').clear()
		getRateBuffer('low').clear()
	}

	Spicetify.Player.addEventListener('onplaypause', () => {
		const progress = Spicetify.Player.getProgress()
		syncTiming(performance.now(), progress)
		if (Spicetify.Player.isPlaying()) {
			startLoop()
		} else {
			workerRef.worker?.postMessage({ type: 'resetRate' })
			clearBuffers()
		}
	})

	let lastProgress = 0
	Spicetify.Player.addEventListener('onprogress', () => {
		const progress = Spicetify.Player.getProgress()
		if (Math.abs(progress - lastProgress) >= 3000) {
			syncTiming(performance.now(), progress)
			workerRef.worker?.postMessage({ type: 'resetRate' })
			clearBuffers()
		}
		lastProgress = progress
	})

	Spicetify.Player.addEventListener('songchange', async () => {
		const videoElement = getVideoElement()
		if (!videoElement) return

		clearBuffers()
		resetBeatAccuracy()
		destroyPartyOverlay()

		const startTime = performance.now()
		const audioData = await fetchAudioData()
		videoElement.playbackRate = 1

		if (audioData?.beats?.length) {
			const delay = Math.max(0, audioData.beats[0].start * 1000 - (performance.now() - startTime))
			setTimeout(() => { getVideoElement()?.play(); startLoop() }, delay)
		} else {
			videoElement.play()
			startLoop()
		}
	})
}
