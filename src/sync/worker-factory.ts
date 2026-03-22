import { APP_CONFIG } from '../config'
import { cachedSettings } from '../settings/settings'
import processorWorkerCode from '../audio/processor.worker?worker'

export function createSyncWorker(): Worker | null {
	try {
		const blob = new Blob([processorWorkerCode as unknown as string], {
			type: 'application/javascript',
		})
		const worker = new Worker(URL.createObjectURL(blob))

		worker.postMessage({
			type: 'setConfig',
			data: {
				maxScale: cachedSettings.pulseIntensity ?? APP_CONFIG.VISUAL.MAX_SCALE,
				clampMax: cachedSettings.syncClampMax ?? 1.35,
			},
		})

		return worker
	} catch {
		return null
	}
}
