import { APP_CONFIG } from './config'
import { settings, SETTINGS_SCHEMA } from './settings'
import { fetchAudioData, getPlaybackRate, getDynamicAnalysis } from './audio'
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

	const updateLoop = async () => {
		if (!Spicetify.Player.isPlaying()) {
			animationId = null
			return
		}

		const progress = Spicetify.Player.getProgress()

		syncVideoToMusicBeat(progress)

		const { loudness } = getDynamicAnalysis(progress)
		const videoElement = getVideoElement()

		if (videoElement) {
			const scale = 1 + loudness * (APP_CONFIG.VISUAL.MAX_SCALE - 1)
			videoElement.style.transform = `scale(${scale})`
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
