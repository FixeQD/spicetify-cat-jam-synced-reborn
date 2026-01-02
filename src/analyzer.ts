export interface AnalysisPoint {
    loudness: number;
    tempo: number;
}

export function getLoudnessAt(segments: any[], timeSec: number): number {
    if (!segments || segments.length === 0) return -60;

    const segment = segments.find(s => s.start <= timeSec && s.start + s.duration > timeSec);
    if (!segment) return -60;

    return segment.loudness_max;
}

export function getLocalBPM(beats: any[], timeSec: number, windowSeconds: number = 6): number {
    if (!beats || beats.length < 2) return 0;

    const start = timeSec - windowSeconds / 2;
    const end = timeSec + windowSeconds / 2;

    const localBeats = beats.filter(b => b.start >= start && b.start <= end);

    if (localBeats.length < 2) return 0;

    const totalInterval = localBeats[localBeats.length - 1].start - localBeats[0].start;
    const avgInterval = totalInterval / (localBeats.length - 1);
    
    return 60 / avgInterval;
}

export function normalizeLoudness(db: number): number {
    const min = -60;
    const max = 0;
    return Math.max(0, Math.min(1, (db - min) / (max - min)));
}
