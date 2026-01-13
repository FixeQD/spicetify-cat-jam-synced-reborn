# Changelog 📋

All notable changes to this project will be documented in this file.

### v2.2.2 (No More UI Lag) ⚡🧵

- **Web Worker Audio Processing**: Moved all heavy audio calculations to a separate thread to prevent UI freezing.
- **Smoothed Playback Rate Limits**: Adjusted rate clamping to 0.85-1.3 and max change delta of 0.02 per frame for buttery smooth transitions.
- **Drift Correction Fix**: Reset playback rate to 1 on big drift corrections to prevent jarring jumps.

### v2.2.1 🐱

- **Smooth Rate Changes**: Lerp-based rate transitions prevent stuttering on rapid beat sequences.
- **Startup Fix**: Cat no longer vibes to silence when Spotify starts - waits for music to actually play.

### v2.2.0 (Cat Has More IQ) 🧠🐱

- **Head Drop Timestamps**: Mapped 20 precise timestamps of when the cat drops its head in the animation.
- **Smart Sync**: Dynamic `playbackRate` adjusts so the next head drop lands exactly on the next music beat.
- **Better Rhythm Feel**: Cat actually vibes with the beat now instead of approximating with constant BPM.
- **Pause Sync**: Cat pauses when music pauses. No more jamming to silence.

### v2.1.0 (Real-time Analysis Update) 🐾⚡

- **High-Precision Sync**: Switched to detailed sub-millisecond audio analysis (jk, just getting it from Spotify's internal endpoints) for better rhythm accuracy.
- **Dynamic Pulsing**: Added intensity-based scaling, making the cat react to the current loudness of the track.
- **Rhythm Interpolation**: Seamlessly handles tempo changes and complex segments for consistent jamming.

### v2.0.0 (Reborn)

- **Modularization**: Completely refactored the monolithic codebase into focused modules.
- **Build System**: Migrated from the deprecated [spicetify-creator](https://github.com/Spicetify/spicetify-creator) to a custom `esbuild` + `terser` setup powered by `bun`.
- **Optimization**: Significant bundle size reduction by mapping React/ReactDOM to Spicetify's internal globals.
- **Improved Stability**: Added robust error handling and NaN guards for BPM calculations.

### v1.2.5

- Added better BPM calculation for songs based on danceability and energy.
- Can be toggled from settings.
- Fixed minor bugs.

### v1.2.0

- Added ability to position and resize webM video to the left library.
- Changed "Reload" button label to "Save and reload".
- Switched from npm to yarn (now deprecated in favor of bun).

### v1.1.0

- Added custom webM link and default BPM settings.

### v1.0.0

- Initial release.
