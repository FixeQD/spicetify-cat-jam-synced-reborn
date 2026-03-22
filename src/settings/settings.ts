import { APP_CONFIG } from '../config'

export const SETTINGS_SCHEMA = {
	link: { id: 'catjam-webm-link', label: 'Custom webM video URL', type: 'input', default: '' },
	bpm: {
		id: 'catjam-webm-bpm',
		label: 'Custom default BPM',
		type: 'number',
		default: APP_CONFIG.DEFAULTS.BPM,
	},
	position: {
		id: 'catjam-webm-position',
		label: 'Position',
		type: 'dropdown',
		default: 0,
		options: [APP_CONFIG.LABELS.POSITION.BOTTOM, APP_CONFIG.LABELS.POSITION.LEFT] as const,
	},
	bpmMethod: {
		id: 'catjam-webm-bpm-method',
		label: 'Lowering Method',
		type: 'dropdown',
		default: 0,
		options: [APP_CONFIG.LABELS.METHOD.TRACK, APP_CONFIG.LABELS.METHOD.ADVANCED] as const,
	},
	bpmMethodFaster: {
		id: 'catjam-webm-bpm-method-faster-songs',
		label: 'Faster Method',
		type: 'dropdown',
		default: 0,
		options: [APP_CONFIG.LABELS.METHOD.TRACK, APP_CONFIG.LABELS.METHOD.ADVANCED] as const,
	},
	size: {
		id: 'catjam-webm-position-left-size',
		label: 'Left Size (%)',
		type: 'number',
		default: APP_CONFIG.DEFAULTS.SIZE,
	},
	catSize: { id: 'catjam-cat-size', label: 'Cat size (px)', type: 'number', default: 65 },
	pulseIntensity: {
		id: 'catjam-pulse-intensity',
		label: 'Pulse intensity',
		type: 'number',
		default: 1.15,
	},
	syncClampMax: {
		id: 'catjam-sync-clamp-max',
		label: 'Sync aggressiveness',
		type: 'number',
		default: 1.35,
	},
	partyCooldownMs: {
		id: 'catjam-party-cooldown-ms',
		label: 'Party mode cooldown (ms)',
		type: 'number',
		default: 1000,
	},
	partyBpmThreshold: {
		id: 'catjam-party-bpm-threshold',
		label: 'Party Mode BPM threshold',
		type: 'number',
		default: 130,
	},
	partyLoudnessDb: {
		id: 'catjam-party-loudness-db',
		label: 'Party Mode loudness threshold',
		type: 'number',
		default: -10,
	},
} as const

type SchemaKey = keyof typeof SETTINGS_SCHEMA

function getRaw(key: SchemaKey): string {
	const schema = SETTINGS_SCHEMA[key]
	return localStorage.getItem(`catjam-setting:${schema.id}`) ?? String(schema.default)
}

export const cachedSettings = new Proxy({} as any, {
	get: (_: any, prop: string) => {
		if (!(prop in SETTINGS_SCHEMA)) return undefined
		const schema = SETTINGS_SCHEMA[prop as SchemaKey]
		const raw = getRaw(prop as SchemaKey)

		if (schema.type === 'number') {
			const n = Number(raw)
			return isNaN(n) ? schema.default : n
		}
		if (schema.type === 'dropdown') {
			const idx = Number(raw)
			const opts = (schema as any).options as string[]
			return isNaN(idx) ? opts[0] : (opts[idx] ?? opts[0])
		}
		return raw || schema.default
	},
})
