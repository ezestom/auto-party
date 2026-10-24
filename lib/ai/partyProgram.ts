export interface ProgramStep { id: string; blockId: string; minutes: number }

export function parseProgram(value: unknown): ProgramStep[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.slice(0, 64).flatMap(item => {
    if (!item || typeof item.id !== 'string' || !item.id || item.id.length > 100 || seen.has(item.id) ||
      typeof item.blockId !== 'string' || !item.blockId || item.blockId.length > 100 ||
      !Number.isFinite(item.minutes) || item.minutes < 1 || item.minutes > 720) return [];
    seen.add(item.id);
    return [{id:item.id,blockId:item.blockId,minutes:item.minutes}];
  });
}

export function nextProgramStep(steps: ProgramStep[], currentId: string, projectedSeconds: number, available: (id: string) => boolean) {
  const index = steps.findIndex(step => step.id === currentId);
  if (index < 0 || projectedSeconds < steps[index].minutes * 60) return null;
  return steps.slice(index + 1).find(step => available(step.blockId)) || null;
}

export function cycleTracks<T extends {id:string}>(tracks: T[], history: string[], lastId: string): T[] {
  const heard = new Set(history);
  const unheard = tracks.filter(track => !heard.has(track.id));
  const cycle = unheard.length ? unheard : tracks;
  return cycle.length > 1 ? cycle.filter(track => track.id !== lastId) : cycle;
}
