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
        VIDEO_URL: "https://github.com/BlafKing/spicetify-cat-jam-synced/raw/main/src/resources/catjam.webm",
        BPM: 135.48,
        SIZE: 100,
        RETRY_DELAY: 200,
        MAX_RETRIES: 10,
        SYNC_INTERVAL: 100,
        PROGRESS_THRESHOLD: 500,
    },
    ALGORITHM: {
        DANCEABILITY_WEIGHT: 0.9,
        ENERGY_WEIGHT: 0.6,
        BPM_WEIGHT: 0.6,
        BPM_THRESHOLD: 0.8,
        LOW_BPM_LIMIT: 70,
        DANCE_ENERGY_SCALE: 100,
    },
    API: {
        AUDIO_FEATURES: "https://api.spotify.com/v1/audio-features/",
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
    }
};

