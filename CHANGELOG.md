# Changelog 📋

All notable changes to this project will be documented in this file.

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
