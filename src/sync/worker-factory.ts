import { APP_CONFIG } from '../config'
import { cachedSettings } from '../settings/settings'

export function createSyncWorker(): Worker | null {
	try {
		const MAX_SCALE = cachedSettings.pulseIntensity ?? APP_CONFIG.VISUAL.MAX_SCALE
		const SYNC_CLAMP_MAX = cachedSettings.syncClampMax ?? 1.35
		const SYNC_CLAMP_MIN = 2 - SYNC_CLAMP_MAX
		const CAT_HEAD_DROPS = APP_CONFIG.CAT_HEAD_DROPS
		const VIDEO_DURATION = APP_CONFIG.VIDEO_DURATION

		const code = `
const CAT_HEAD_DROPS = ${JSON.stringify(CAT_HEAD_DROPS)};
const VIDEO_DURATION = ${VIDEO_DURATION};
const MAX_SCALE = ${MAX_SCALE};
const SYNC_CLAMP_MAX = ${SYNC_CLAMP_MAX};
const SYNC_CLAMP_MIN = ${SYNC_CLAMP_MIN};

const LERP_FACTORS = { high: 0.25, medium: 0.18, low: 0.1 };
let currentRate = 1;
let currentBeatIndex = -1;

self.onmessage = function(e) {
	const { type, data } = e.data;
	if (type === 'process' && data.audioData) {
		self.postMessage({ type: 'result', data: process(data.progressMs, data.videoTime, data.audioData, data.perfLevel) });
	}
	if (type === 'resetRate') { currentRate = 1; currentBeatIndex = -1; }
};

function process(progressMs, videoTime, audioData, perfLevel) {
	const progressSec = progressMs / 1000;
	const playbackRate = calculateSync(progressSec, videoTime, audioData, perfLevel || 'high');
	const loudness = getLoudnessAt(audioData.segments, progressSec);
	const normalizedLoudness = Math.max(0, Math.min(1, (loudness + 60) / 60));
	return { playbackRate, scale: 1 + normalizedLoudness * (MAX_SCALE - 1) };
}

function calculateSync(progressSec, rawVideoTime, audioData, perfLevel) {
	if (!audioData?.beats?.length) return 1;
	const beats = audioData.beats;
	const lerpFactor = LERP_FACTORS[perfLevel] ?? 0.25;
	let vt = rawVideoTime % VIDEO_DURATION;
	if (vt < 0) vt = 0;
	let beatIndex = -1;
	for (let i = beats.length - 1; i >= 0; i--) {
		if (beats[i].start <= progressSec) { beatIndex = i; break; }
	}
	const nextBeat = findNextBeat(progressSec, beats);
	if (!nextBeat) { currentRate = currentRate + (1 - currentRate) * lerpFactor; return currentRate; }
	const timeUntilBeat = nextBeat.time - progressSec;
	if (timeUntilBeat < 0.005) return currentRate;
	const timeUntilDrop = getTimeUntilNextDrop(vt);
	const target = Math.max(SYNC_CLAMP_MIN, Math.min(SYNC_CLAMP_MAX, timeUntilDrop / timeUntilBeat));
	currentRate = currentRate + (target - currentRate) * lerpFactor;
	if (beatIndex !== currentBeatIndex) currentBeatIndex = beatIndex;
	return currentRate;
}

function getTimeUntilNextDrop(vt) {
	for (const d of CAT_HEAD_DROPS) { if (d > vt) return d - vt; }
	return VIDEO_DURATION - vt + CAT_HEAD_DROPS[0];
}

function findNextBeat(progressSec, beats) {
	for (let i = 0; i < beats.length; i++) {
		if (beats[i].start > progressSec) return { index: i, time: beats[i].start };
	}
	return null;
}

function getLoudnessAt(segments, timeSec) {
	if (!segments || segments.length === 0) return -60;
	let low = 0, high = segments.length - 1, mid = 0;
	while (low <= high) {
		mid = (low + high) >> 1;
		const s = segments[mid];
		if (s.start <= timeSec && s.start + s.duration > timeSec) break;
		else if (s.start > timeSec) high = mid - 1;
		else low = mid + 1;
	}
	const seg = segments[mid];
	if (!seg) return -60;
	const timeInSeg = timeSec - seg.start;
	const maxTime = seg.loudness_max_time;
	if (timeInSeg < maxTime) {
		return seg.loudness_start + (timeInSeg / maxTime) * (seg.loudness_max - seg.loudness_start);
	}
	const t = (timeInSeg - maxTime) / (seg.duration - maxTime);
	return seg.loudness_max + t * ((segments[mid + 1]?.loudness_start ?? seg.loudness_max) - seg.loudness_max);
}
`
		const blob = new Blob([code], { type: 'application/javascript' })
		return new Worker(URL.createObjectURL(blob))
	} catch {
		return null
	}
}
