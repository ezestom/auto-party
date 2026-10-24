export interface MixBoundaries {
    audioStart: number;
    audioEnd: number;
}
/** Only trim sustained edge silence. No beat, phrase or vocal detection is implied. */
export function detectMixBoundaries(buffer: {
    duration: number;
    sampleRate: number;
    length: number;
    numberOfChannels: number;
    getChannelData: (channel: number) => Float32Array;
}): MixBoundaries {
    const { duration, sampleRate, length } = buffer;
    if (!Number.isFinite(duration) || duration <= 0 || !length || !buffer.numberOfChannels)
        return { audioStart: 0, audioEnd: duration };
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
    const window = Math.max(1, Math.round(sampleRate * 0.05));
    const audible = (start: number) => {
        for (const samples of channels)
            for (let i = start; i < Math.min(start + window, length); i++)
                if (Math.abs(samples[i]) > 0.003)
                    return true;
        return false;
    };
    let first = 0, last = Math.max(0, Math.floor((length - 1) / window) * window);
    while (first < length && !audible(first))
        first += window;
    if (first >= length)
        return { audioStart: 0, audioEnd: duration };
    while (last > first && !audible(last))
        last -= window;
    const start = Math.max(0, first / sampleRate - 0.1), end = Math.min(duration, (last + window) / sampleRate + 0.1);
    return { audioStart: start >= 1 ? start : 0, audioEnd: duration - end >= 1 ? end : duration };
}
export function naturalTransition(outgoing: {
    duration: number;
    bpm: number;
    audioEnd?: number;
}, incoming: {
    bpm: number;
}, preferredDuration: number) {
    const end = Number.isFinite(outgoing.audioEnd) && outgoing.audioEnd! > 0 && outgoing.audioEnd! <= outgoing.duration ? outgoing.audioEnd! : outgoing.duration;
    const compatible = outgoing.bpm > 0 && incoming.bpm > 0 && Math.abs(outgoing.bpm - incoming.bpm) / outgoing.bpm <= 0.06;
    const duration = Math.max(0.5, Math.min(compatible ? preferredDuration : 2, end / 4, 8));
    return { end, duration, startsAt: Math.max(0, end - duration) };
}
