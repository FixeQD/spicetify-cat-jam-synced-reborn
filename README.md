# Cat-Jam Synced (Reborn)

![preview](assets/preview.gif)

A reborn and optimized Cat-Jam experience, perfectly in sync with your beat. Make a cat appear next to your progress bar, jamming along with your music synchronized to the beat!

Beat data (BPM, beat timestamps, segments, loudness) comes from Spotify's internal audio analysis API endpoint - it sometimes isn't perfect...

**Shift+click the cat** to open the debug overlay with live sync stats, beat accuracy, drift, FPS, etc.

## Build & Installation

### Prerequisites

- [Bun](https://bun.sh) installed on your system.

### Setup

1. Clone the repository.
2. Install dependencies:
    ```bash
    bun install
    ```
3. Build the project:
    ```bash
    bun run build
    ```
4. Copy the output to your Spicetify Extensions folder:
    ```bash
    cp dist/cat-jam.js ~/.config/spicetify/Extensions/
    ```
5. Apply the extension:
    ```bash
    spicetify config extensions cat-jam.js
    spicetify apply
    ```

## Development

To watch for changes and rebuild automatically:

```bash
bun run watch
```

---

That's it! Now go forth and jam - just try not to let the cat out-vibe you. 🐾🎵
