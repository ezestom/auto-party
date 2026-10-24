import type { SetlistItem } from './contract';
export function requestTrack(queue: SetlistItem[], currentIndex: number, item: SetlistItem, next: boolean) {
    if (queue[currentIndex]?.trackId === item.trackId)
        return queue;
    const history = queue.slice(0, currentIndex + 1);
    const upcoming = queue.slice(currentIndex + 1).filter(entry => entry.trackId !== item.trackId);
    return [...history, ...(next ? [item, ...upcoming] : [...upcoming, item])];
}
