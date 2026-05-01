export interface AnalysisPoint {
	loudness: number
	tempo: number
}

export function getLoudnessAt(segments: any[], timeSec: number): number {
	if (!segments || segments.length === 0) return -60

	let low = 0
	let high = segments.length - 1
	let mid = 0

	while (low <= high) {
		mid = (low + high) >> 1
		const s = segments[mid]
		if (s.start <= timeSec && s.start + s.duration > timeSec) {
			break
		} else if (s.start > timeSec) {
			high = mid - 1
		} else {
			low = mid + 1
		}
	}

	const segment = segments[mid]
	if (!segment) return -60

	const timeInSegment = timeSec - segment.start
	const maxTime = segment.loudness_max_time

	if (timeInSegment < maxTime) {
		const t = timeInSegment / maxTime
		return segment.loudness_start + t * (segment.loudness_max - segment.loudness_start)
	} else {
		const remainingTime = segment.duration - maxTime
		const t = (timeInSegment - maxTime) / remainingTime
		const nextStart = segments[mid + 1]?.loudness_start ?? segment.loudness_max
		return segment.loudness_max + t * (nextStart - segment.loudness_max)
	}
}

export function normalizeLoudness(db: number): number {
	const min = -60
	const max = 0
	return Math.max(0, Math.min(1, (db - min) / (max - min)))
}

export function getLocalBPM(beats: any[], timeSec: number, windowSeconds: number = 8): number {
	if (!beats || beats.length < 2) return 0

	const windowStart = timeSec - windowSeconds
	
	let startIdx = 0
	let low = 0
	let high = beats.length - 1
	while (low <= high) {
		const mid = (low + high) >> 1
		if (beats[mid].start >= windowStart) {
			startIdx = mid
			high = mid - 1
		} else {
			low = mid + 1
		}
	}

	let endIdx = beats.length - 1
	low = startIdx
	high = beats.length - 1
	while (low <= high) {
		const mid = (low + high) >> 1
		if (beats[mid].start <= timeSec) {
			endIdx = mid
			low = mid + 1
		} else {
			high = mid - 1
		}
	}

	if (startIdx >= endIdx) {
		const nearby = beats.slice(0, Math.min(8, beats.length))
		if (nearby.length < 2) return 0
		const totalInterval = nearby[nearby.length - 1].start - nearby[0].start
		return 60 / (totalInterval / (nearby.length - 1))
	}

	const intervals: { bpm: number; weight: number }[] = []
	for (let i = startIdx + 1; i <= endIdx; i++) {
		const interval = beats[i].start - beats[i - 1].start
		if (interval <= 0) continue
		const bpm = 60 / interval
		if (bpm < 50 || bpm > 300) continue
		const weight = (beats[i].confidence ?? 1) + (beats[i - 1].confidence ?? 1)
		intervals.push({ bpm, weight })
	}

	if (intervals.length === 0) return 0

	const sorted = [...intervals].sort((a, b) => a.bpm - b.bpm)
	const medianBpm = sorted[Math.floor(sorted.length / 2)].bpm
	const filtered = intervals.filter(
		(iv) => iv.bpm >= medianBpm * 0.75 && iv.bpm <= medianBpm * 1.25
	)

	const pool = filtered.length > 0 ? filtered : intervals

	let sumW = 0
	let sumBpm = 0
	for (const iv of pool) {
		sumBpm += iv.bpm * iv.weight
		sumW += iv.weight
	}

	return sumW > 0 ? sumBpm / sumW : medianBpm
}

// BPM from the last N beat intervals — reacts in under a second
export function getInstantBPM(beats: any[], timeSec: number, beatCount: number = 6): number {
	if (!beats || beats.length < 2) return 0

	let idx = -1
	for (let i = beats.length - 1; i >= 0; i--) {
		if (beats[i].start <= timeSec) {
			idx = i
			break
		}
	}
	if (idx < 1) return 0

	const from = Math.max(1, idx - beatCount + 1)
	const intervals: number[] = []
	for (let i = from; i <= idx; i++) {
		const interval = beats[i].start - beats[i - 1].start
		if (interval > 0) intervals.push(interval)
	}
	if (intervals.length === 0) return 0

	intervals.sort((a, b) => a - b)
	const median = intervals[Math.floor(intervals.length / 2)]
	return 60 / median
}
