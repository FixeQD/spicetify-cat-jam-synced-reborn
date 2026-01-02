import { APP_CONFIG } from "./config";
import { settings, SETTINGS_SCHEMA } from "./settings";
import { fetchAudioData, getPlaybackRate, getDynamicAnalysis } from "./audio";
import { createWebMVideo, syncTiming, getVideoElement } from "./video";

async function main() {
    console.log("[CAT-JAM] Extension initializing...");
    while (!Spicetify?.Player?.addEventListener || !Spicetify?.getAudioData) {
        await new Promise(resolve => setTimeout(resolve, APP_CONFIG.DEFAULTS.SYNC_INTERVAL));
    }
    
    Object.values(SETTINGS_SCHEMA).forEach(field => {
        if (field.type === "input" || field.type === "number") {
            settings.addInput(field.id, field.label, String(field.default));
        } else if (field.type === "dropdown") {
            settings.addDropDown(field.id, field.label, field.options as any, 0);
        }
    });

    settings.addButton("catjam-reload", "Reload", "Save and reload", () => { 
        createWebMVideo(); 
    });
    
    settings.pushSettings();

    await createWebMVideo();

    Spicetify.Player.addEventListener("onplaypause", () => {
        syncTiming(performance.now(), Spicetify.Player.getProgress());
    });
    
    let lastProgress = 0;
    Spicetify.Player.addEventListener("onprogress", async () => {
        const progress = Spicetify.Player.getProgress();
        if (Math.abs(progress - lastProgress) >= APP_CONFIG.DEFAULTS.PROGRESS_THRESHOLD) {
            syncTiming(performance.now(), progress);

            // Dynamic analysis update
            const videoElement = getVideoElement();
            if (videoElement) {
                const { playbackRate } = await getDynamicAnalysis(progress);
                videoElement.playbackRate = playbackRate;
            }
        }
        lastProgress = progress;
    });

    Spicetify.Player.addEventListener("songchange", async () => {
        const videoElement = getVideoElement();
        if (!videoElement) return;

        const startTime = performance.now();
        const audioData = await fetchAudioData();
        
        videoElement.playbackRate = await getPlaybackRate(audioData);
        
        if (audioData?.beats?.length) {
            const firstBeatStart = audioData.beats[0].start;
            const delay = Math.max(0, firstBeatStart * 1000 - (performance.now() - startTime));
            setTimeout(() => getVideoElement()?.play(), delay);
        } else {
            videoElement.play();
        }
    });
}

export default main;
main();