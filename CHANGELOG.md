# Changelog 📋

All notable changes to this project will be documented in this file.

### v2.4.0 (Stats for Nerds) 🐱📊

- **Debug Overlay**: Shift+click the cat to open a real-time debug panel showing everything happening under the hood.
- **Live Metrics**: FPS, performance profile, playback rate, beat drift, loudness, local/global BPM, video sync state, rate buffer status
- **Beat Accuracy Tracking**: Rolling accuracy percentage over the last 50 beats - see how well the cat is actually hitting them.
- **Zero Overhead**: Overlay only runs its own RAF loop when visible. No performance cost when closed.

### v2.3.0 (Performance Boost) 🚀🎯

- **Adaptive Performance System**: Added FPS-based throttling that adjusts update frequency based on system performance (low/medium/high modes).
- **Predictive Sync Engine**: Enhanced beat-aligned prediction with velocity history tracking for smoother rate transitions.
- **Rate Buffer System**: Frame-dropping buffer prevents jarring jumps during rapid playback rate changes.
- **Dynamic Tuning**: Each performance level now has optimized lerp factors, drift thresholds, and snap behaviors.

### v2.2.4 (Smooth Loop) 🔄✨

- **Fixed Video Loop Jank**: Replaced native HTML5 loop with custom threshold-based reset to eliminate stuttering at loop boundaries.
- **Seamless Playback**: Video now resets 0.15s before end, avoiding harsh seek operations that caused visible glitches.

### v2.2.3 (Always Upright) 🐱📐

- **Fixed Head Flip Bug**: Worker now correctly calculates head drops based on actual beat progress instead of hardcoded offset.
- **Gradual Sync Fixes**: Moderate drift corrections now use gentle playback rate adjustments instead of abrupt time jumps.
- **Stable Synchronization**: Added beat index tracking in worker to prevent erratic head movements and timing inconsistencies.

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
