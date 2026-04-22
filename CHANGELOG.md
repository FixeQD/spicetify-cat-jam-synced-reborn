# Changelog 📋

All notable changes to this project will be documented in this file.

### v3.3.1 (Worker Inlining Fix) 🐛🔧

- **Fixed Unexpected `export` SyntaxError**: Resolved a build-time issue where a leftover top-level `export` could remain in the final bundle (producing "Uncaught SyntaxError: Unexpected token 'export'"). The post-processing step now reliably strips inlined exports and string-literal exports produced when bundling workers.
- **Improved Worker Inlining Robustness**: Updated build cleanup logic to handle multi-line export blocks and string/backtick literals used when inlining worker code. This prevents the worker-inlining pattern from leaking ESM syntax into the final IIFE.
- **No functional changes**: This is a build-system fix only — runtime behavior of the extension remains unchanged. The extension will now load without the error.

### v3.3.0 (Bun Speedrun Update) ⚡🐱

- **Migrated to Bun Build**: Switched from `esbuild` to Bun's native bundler. Build time dropped from ~2 seconds to... **15 milliseconds**. Yes, you read that right.
- **Native Minification**: Ditched Terser in favor of Bun's built-in minifier. It's faster, lighter, and does the job perfectly.
- **Build Timer**: The build script now proudly reports exactly how many milliseconds it took to prepare your code.
- **Improved Watch Mode**: Refactored the development workflow to be more reliable and react instantly to every code change.


### v3.2.0 (Local Import Update) 📁🐱

- **Local File Import**: Added a new "📁" button next to the URL setting. You can now select a `.webm` file directly from your computer - no external hosting required!

### v3.1.4 🖼️✨

- **Marketplace Details**: Restored `preview.gif` and `README.md` to the `build` branch so the extension icon and description display correctly in the Spicetify Marketplace.

### v3.1.3 🧹🐱

- **Repo Cleanup**: Moved the build artifact to a separate `build` branch to avoid cluttering the main repository history.

### v3.1.2 🚀

- **Dependency updates**: Bumped all dependencies and devDependencies to their latest versions.
- **Cleanup**: Removed unused `spcr-settings` dependency.

### v3.1.1 🐱✨

- **Seamless Transitions**: Removed the forced video reset to 0 on track changes and seeking. The cat now continues jamming smoothly, with the sync engine aligning its rhythm to the new track without visible jumps.

### v3.1.0 (Settings & Sync Update) 🐱⚙️

- **Fixed missing settings**: Added all missing configuration options to the settings popup, including custom video URLs, and position controls.
- **New Drop Timestamps Editor**: Added a dedicated editor to fine-tune exactly when the cat's head drops. This makes it easy to perfectly sync any custom video with the music.
- **Restored Settings Shortcut**: Fixed a bug where the Shift + Click shortcut would stop working after you saved your settings. Now it works every time without needing a reload.

### v3.0.0 (Worker Refactor) 🔧

- **Eliminated worker blob duplication**: Sync logic was previously copy-pasted as a raw string inside `worker-factory.ts`. Extracted into `src/sync/algorithm.ts` — pure functions (`computeNextRate`, `findNextBeat`, `getTimeUntilNextDrop`) shared by both the main thread engine and the worker.
- **`processor.worker.ts` is now real TypeScript**: Imports directly from `../analyzer` and `../sync/algorithm`. Full type checking, no separate implementation to keep in sync.
- **`workerBundlePlugin` in `build.ts`**: esbuild plugin that intercepts `?worker` imports, bundles the worker file as a self-contained IIFE, and inlines it as a string. Zero runtime overhead, no blob template literals.
- **Worker receives config on init**: `createSyncWorker()` sends `maxScale` and `clampMax` from `cachedSettings` via a `setConfig` message instead of baking them into the blob at factory time.

### v2.7.1

- Fixed all broken imports after folder restructuring. Renamed `debug-overlay.ts` → `overlay.ts` and `debug-renderer.ts` → `renderer.ts`.

### v2.7.0 (Refactor) 🏗️

- **Settings rewrite**: Dropped `spcr-settings` entirely. All settings now stored in `localStorage` and read via a `Proxy`-based `cachedSettings`. Custom settings popup replaces the Spotify settings panel.
- **Project modularization**: Source reorganized into `audio/`, `sync/`, `video/`, `debug/`, and `settings/` folders. Worker blob extracted to `sync/worker-factory.ts`, player events to `sync/player-events.ts`, debug rendering to `debug/debug-renderer.ts`, and UI primitives to `settings/popup-ui.ts`.

### v2.6.0 (Party Mode) 🎉🌈

- **Party Mode**: Rainbow disco overlay on the cat, activates at ≥130 BPM and ≥-10 dB. Follows the cat's exact WebM shape via canvas `destination-in` masking. Flashes on every beat, 1-second cooldown before deactivating.
- **Instant BPM**: New `getInstantBPM()` based on last 6 beat intervals with median filtering — reacts in under a second.
- **BPM overhaul**: `getLocalBPM()` now uses a trailing window, confidence weighting, and outlier rejection.
- **Debug overlay**: New PARTY MODE section with live BPM/loudness gate indicators. Fixed Next Head Drop countdown after first video loop.
- **Watch mode**: `bun watch` now auto-registers the extension and copies to Spicetify's Extensions folder before starting `spicetify watch -e`.

### v2.5.1 (Drift & Accuracy Overhaul) 🎨🛠

- Drift measurement fixed: video time is backtracked to the exact beat start before measuring drift, removing mid-beat bias.
- Accuracy scoring overhauled: uses normalized drift against `MAX_DRIFT_MS` instead of a fixed 80ms hit threshold.
- Accuracy window updated: ring buffer size now matches total track beats instead of a hardcoded 200.

### v2.5.0 (Sync Engine Rework) 🐱🔧

- **Fixed sync loop dying**: `createTimedRAF` throttling was killing the RAF loop - skipped frames never scheduled the next `requestAnimationFrame`, freezing everything. Removed broken throttling, loop now runs every frame.
- **Fixed onprogress resetting sync**: `onprogress` was calling `syncTiming()` every ~1s during normal playback, resetting the engine to 1x constantly. Now only resets on actual seeks (>3s jumps).
- **Rewrote sync algorithm**: Both worker and fallback engine use the same simple formula - `timeUntilNextHeadDrop / timeUntilNextBeat`. Video time is wrapped with modulo for loop boundaries.
- **Beat accuracy rewritten from scratch**: Old sliding window math was fundamentally broken - subtracting excess from hits caused accuracy to always decay to 0%. Now uses a proper ring buffer of 200 boolean results.
- **Beat accuracy resets on song change**: No more stale accuracy data carrying over between tracks.
- **Fixed dropped frames counter**: Was a monotonically increasing counter that never reset. Now counts drops in a 1-second sliding window. Only counts real drops (50ms+ gaps, not jitter). Properly calculates missed vsync slots.
- **Fixed `shouldSkipFrame` bug**: Was comparing `performance.now()` timestamp (huge number) against a 33ms threshold. Never worked. Fixed to use actual frame delta.
- **Fixed rate buffer stale detection**: `isStale()` was checking `lastOutputTime` which was only set by `getOutput()`. Debug overlay never called `getOutput()`, so stale was always true. Now checks newest buffer entry timestamp with a 500ms threshold.
- **Tuned sync responsiveness**: Tighter playback rate clamp (0.75-1.35 instead of 0.7-1.5), higher lerp factors (0.25 instead of 0.15), wider rate buffer jump tolerance (0.5 instead of 0.3).
- **Debug overlay improvements**: Live drift measurement (updated every frame, not just on beat transitions), target rate display, version number from package.json.

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
