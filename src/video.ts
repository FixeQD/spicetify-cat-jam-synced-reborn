import { APP_CONFIG } from "./config";
import { cachedSettings } from "./settings";
import { getAudioData, fetchAudioData, getPlaybackRate } from "./audio";

let videoElement: HTMLVideoElement | null = null;

export function getVideoElement() {
    return videoElement;
}

export function syncTiming(startTime: number, progress: number) {
    if (!videoElement) return;

    if (Spicetify.Player.isPlaying()) {
        const progressInSeconds = progress / 1000;
        const audioData = getAudioData();

        if (audioData?.beats?.length) {
            const upcomingBeat = audioData.beats.find((beat: any) => beat.start > progressInSeconds);
            if (upcomingBeat) {
                const operationTime = performance.now() - startTime;
                const delayUntilNextBeat = Math.max(0, (upcomingBeat.start - progressInSeconds) * 1000 - operationTime);
                
                setTimeout(() => {
                    videoElement?.play();
                }, delayUntilNextBeat);
            } else {
                videoElement.play();
            }
        } else {
            videoElement.play();
        }
    } else {
        videoElement.pause();
    }
}

async function waitForElement(selector: string, maxAttempts = 50, interval = APP_CONFIG.DEFAULTS.SYNC_INTERVAL): Promise<Element> {
    for (let attempts = 0; attempts < maxAttempts; attempts++) {
        const element = document.querySelector(selector);
        if (element) return element;
        await new Promise(resolve => setTimeout(resolve, interval));
    }
    throw new Error(`Element ${selector} not found.`);
}

export async function createWebMVideo() {
    try {
        const isBottom = cachedSettings.position === APP_CONFIG.LABELS.POSITION.BOTTOM;
        
        const leftLibraryStyle = `width: ${cachedSettings.size}%; max-width: ${APP_CONFIG.STYLES.MAX_LIBRARY_WIDTH}; height: auto; max-height: 100%; position: absolute; bottom: 0; pointer-events: none; z-index: 1;`;

        const targetElementSelector = isBottom ? APP_CONFIG.SELECTORS.BOTTOM_PLAYER : APP_CONFIG.SELECTORS.LEFT_LIBRARY;
        const elementStyles = isBottom ? APP_CONFIG.STYLES.BOTTOM_PLAYER : leftLibraryStyle;

        const targetElement = await waitForElement(targetElementSelector);

        if (videoElement) {
            videoElement.remove();
        }
        
        const videoURL = cachedSettings.link || APP_CONFIG.DEFAULTS.VIDEO_URL;

        videoElement = document.createElement('video');
        videoElement.loop = true;
        videoElement.autoplay = true;
        videoElement.muted = true;
        videoElement.style.cssText = elementStyles;
        videoElement.src = videoURL;
        videoElement.id = APP_CONFIG.SELECTORS.CAT_JAM_ID;

        const audioData = await fetchAudioData();
        videoElement.playbackRate = await getPlaybackRate(audioData);

        if (targetElement.firstChild) {
            targetElement.insertBefore(videoElement, targetElement.firstChild);
        } else {
            targetElement.appendChild(videoElement);
        }

        if (Spicetify.Player.isPlaying()) {
            videoElement.play();
        } else {
            videoElement.pause();
        }
    } catch (error) {
        console.error("[CAT-JAM] Initialization error: ", error);
    }
}
