import { APP_CONFIG } from "./config";
import { cachedSettings } from "./settings";

let audioData: any = null;
const audioFeaturesCache = new Map<string, any>();

export function getAudioData() {
    return audioData;
}

export function setAudioData(data: any) {
    audioData = data;
}

export async function getDynamicAnalysis(progressMs: number) {
    if (!audioData) return { playbackRate: 1, loudness: 0.5 };

    const { getLocalBPM, getLoudnessAt, normalizeLoudness } = await import("./analyzer");
    const progressSec = progressMs / 1000;
    const videoDefaultBPM = cachedSettings.bpm;

    const localBPM = getLocalBPM(audioData.beats, progressSec) || audioData.track?.tempo || videoDefaultBPM;
    const loudness = normalizeLoudness(getLoudnessAt(audioData.segments, progressSec));

    const playbackRate = localBPM / videoDefaultBPM;

    return { playbackRate, loudness, bpm: localBPM };
}

export async function fetchAudioData(retryDelay: number = APP_CONFIG.DEFAULTS.RETRY_DELAY, maxRetries: number = APP_CONFIG.DEFAULTS.MAX_RETRIES): Promise<any> {
    const uri = Spicetify.Player.data?.item?.uri;
    if (!uri) return null;

    try {
        const id = uri.split(":")[2];
        const url = `https://spclient.wg.spotify.com/audio-attributes/v1/audio-analysis/${id}?format=json`;
        const data = await Spicetify.CosmosAsync.get(url);
        
        setAudioData(data);
        return data;
    } catch (error) {
        console.warn(`[CAT-JAM] Error fetching detailed analysis: ${error}`);
        // Fallback to basic audio data if detailed fails
        try {
            const data = await Spicetify.getAudioData();
            setAudioData(data);
            return data;
        } catch (innerError) {
            if (maxRetries > 0) {
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                return fetchAudioData(retryDelay, maxRetries - 1);
            }
            return null;
        }
    }
}

export async function getPlaybackRate(data: any): Promise<number> {
    const videoDefaultBPM = cachedSettings.bpm;

    if (data?.track) {
        const trackBPM = data.track.tempo;
        let bpmToUse = trackBPM;

        if (cachedSettings.bpmMethod !== APP_CONFIG.LABELS.METHOD.TRACK) {
            bpmToUse = await getBetterBPM(trackBPM);
        }

        const playbackRate = bpmToUse ? bpmToUse / videoDefaultBPM : 1;
        console.debug(`[CAT-JAM] Track BPM: ${trackBPM}, Effective BPM: ${bpmToUse}, Playback Rate: ${playbackRate}`);

        return playbackRate;
    }

    console.warn("[CAT-JAM] BPM data not available, using default rate.");
    return 1;
}

async function getBetterBPM(currentBPM: number): Promise<number> {
    const uri = Spicetify.Player.data?.item?.uri;
    if (!uri) return currentBPM;

    if (audioFeaturesCache.has(uri)) {
        const cached = audioFeaturesCache.get(uri);
        return calculateBetterBPM(cached.danceability, cached.energy, currentBPM);
    }

    try {
        const id = uri.split(":")[2];
        const res = await Spicetify.CosmosAsync.get(`${APP_CONFIG.API.AUDIO_FEATURES}${id}`);
        
        const danceability = Math.round(APP_CONFIG.ALGORITHM.DANCE_ENERGY_SCALE * (res.danceability ?? 0.5));
        const energy = Math.round(APP_CONFIG.ALGORITHM.DANCE_ENERGY_SCALE * (res.energy ?? 0.5));
        
        audioFeaturesCache.set(uri, { danceability, energy });
        return calculateBetterBPM(danceability, energy, currentBPM);
    } catch (error) {
        console.error("[CAT-JAM] Audio features error: ", error);
        return currentBPM;
    }
}

function calculateBetterBPM(danceability: number, energy: number, currentBPM: number): number {
    let dw = APP_CONFIG.ALGORITHM.DANCEABILITY_WEIGHT;
    let ew = APP_CONFIG.ALGORITHM.ENERGY_WEIGHT;
    let bw = APP_CONFIG.ALGORITHM.BPM_WEIGHT;
    
    const scale = APP_CONFIG.ALGORITHM.DANCE_ENERGY_SCALE;
    const nd = danceability / scale, ne = energy / scale, nb = currentBPM / scale;

    if (nd < 0.5) dw *= nd;
    if (ne < 0.5) ew *= ne;
    if (nb < APP_CONFIG.ALGORITHM.BPM_THRESHOLD) bw = 0.9;

    const divisor = (1 - dw + 1 - ew + bw);
    const weightedAverage = divisor !== 0 ? (nd * dw + ne * ew + nb * bw) / divisor : nb;
    let betterBPM = weightedAverage * scale;

    if (isNaN(betterBPM)) return currentBPM;

    if (betterBPM > currentBPM) {
        betterBPM = cachedSettings.bpmMethodFaster !== APP_CONFIG.LABELS.METHOD.TRACK ? (betterBPM + currentBPM) / 2 : currentBPM;
    } else {
        betterBPM = Math.max(betterBPM, APP_CONFIG.ALGORITHM.LOW_BPM_LIMIT);
    }

    return isNaN(betterBPM) ? currentBPM : betterBPM;
}
