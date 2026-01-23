export const APP_CONFIG = {
	SELECTORS: {
		BOTTOM_PLAYER: '.main-nowPlayingBar-right',
		LEFT_LIBRARY: '.main-yourLibraryX-libraryItemContainer',
		CAT_JAM_ID: 'catjam-webm',
	},
	STYLES: {
		BOTTOM_PLAYER: 'width: 65px; height: 65px;',
		MAX_LIBRARY_WIDTH: '300px',
	},
	DEFAULTS: {
		VIDEO_URL:
			'https://github.com/FixeQD/spicetify-cat-jam-synced-reborn/raw/main/src/resources/catjam.webm',
		BPM: 135.48,
		SIZE: 100,
		RETRY_DELAY: 200,
		MAX_RETRIES: 10,
		SYNC_INTERVAL: 100,
		PROGRESS_THRESHOLD: 500,
	},
	VISUAL: {
		MAX_SCALE: 1.15,
		LOUDNESS_THRESHOLD: -40,
	},
	ALGORITHM: {
		DANCEABILITY_WEIGHT: 0.9,
		ENERGY_WEIGHT: 0.6,
		BPM_WEIGHT: 0.6,
		BPM_THRESHOLD: 0.8,
		LOW_BPM_LIMIT: 70,
		DANCE_ENERGY_SCALE: 100,
	},
	PERFORMANCE: {
		LOW_FPS_THRESHOLD: 30,
		MEDIUM_FPS_THRESHOLD: 50,
		THROTTLE_INTERVAL_LOW: 33.33,
		THROTTLE_INTERVAL_MEDIUM: 16.67,
		THROTTLE_INTERVAL_HIGH: 0,
		MEASUREMENT_WINDOW_MS: 1000,
		SAMPLE_COUNT: 30,
	},
	SYNC: {
		LERP_FACTOR_HIGH: 0.08,
		LERP_FACTOR_MEDIUM: 0.05,
		LERP_FACTOR_LOW: 0.03,
		MAX_RATE_DELTA_HIGH: 0.02,
		MAX_RATE_DELTA_MEDIUM: 0.015,
		MAX_RATE_DELTA_LOW: 0.01,
	},
	API: {
		AUDIO_FEATURES: 'https://api.spotify.com/v1/audio-features/',
	},
	LABELS: {
		POSITION: {
			BOTTOM: 'Bottom (Player)',
			LEFT: 'Left (Library)',
		},
		METHOD: {
			TRACK: 'Track BPM',
			ADVANCED: 'Advanced',
		},
	},
	CAT_HEAD_DROPS: [
		0.425, 0.883, 1.403, 1.841, 2.206, 2.664, 3.075, 3.58, 3.945, 4.433, 4.885, 5.292, 5.826,
		6.152, 7.06, 7.51, 8.01, 8.435, 8.86, 9.27,
	],
	VIDEO_DURATION: 9.75,
}
