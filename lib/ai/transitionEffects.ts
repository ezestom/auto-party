export const TRANSITION_EFFECTS = ['none', 'filter_sweep', 'echo_out'] as const;
export type TransitionEffect = typeof TRANSITION_EFFECTS[number];
export type NextTransitionEffect = TransitionEffect | 'auto';
export const EFFECT_LABELS: Record<NextTransitionEffect, string> = { auto: 'Auto · occasional effects', none: 'Off · simple fades', filter_sweep: 'Next · Filter sweep', echo_out: 'Next · Echo out' };
export const isTransitionEffect = (value: unknown): value is TransitionEffect => typeof value === 'string' && (TRANSITION_EFFECTS as readonly string[]).includes(value);
export function selectTransitionEffect(requested: unknown, context: {
    duration: number;
    bpm: number;
    incomingBpm: number;
    automatic: boolean;
    index: number;
    lastIndex: number;
    now: number;
    lastAt: number;
}): TransitionEffect {
    if (!isTransitionEffect(requested) || requested === 'none' || !Number.isFinite(context.duration) || context.duration < 1 || context.duration > 8)
        return 'none';
    if (context.automatic && (context.index - context.lastIndex < 3 || context.now - context.lastAt < 45))
        return 'none';
    if (context.automatic && requested === 'filter_sweep' && (!(context.bpm > 0) || !(context.incomingBpm > 0) || Math.abs(context.bpm - context.incomingBpm) / context.bpm > .06)) return 'none';
    if (requested === 'echo_out' && (!Number.isFinite(context.bpm) || context.bpm < 60 || context.bpm > 200))
        return 'none';
    return requested;
}
