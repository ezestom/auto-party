"use client";
import { create } from 'zustand';
import { generateSetlist, generateFallbackSetlist, type SetlistItem } from '../lib/ai/aiClient';
import type { AIReason, PlanResult } from '../lib/ai/contract';
import { requestTrack } from '../lib/ai/partyQueue';
import { selectTransitionEffect, isTransitionEffect, type TransitionEffect, type NextTransitionEffect } from '../lib/ai/transitionEffects';
import { naturalTransition } from '../lib/audio/mixBoundaries';
import { useSettingsStore } from './settingsStore';
import { useLibraryStore } from './libraryStore';
import { useDeckStore, type TrackMetadata } from './deckStore';
import { useMixerStore } from './mixerStore';
import { usePartyBlockStore } from './partyBlockStore';
import { usePartyProgramStore } from './partyProgramStore';
import { cycleTracks, nextProgramStep } from '../lib/ai/partyProgram';
import { useAIConnectionStore } from './aiConnectionStore';
import { useVJStore } from './vjStore';
import { loadTrackById } from '../lib/audio/trackLoader';
import { getAudioEngine } from '../lib/audio/AudioEngine';
import { samplerEngine } from '../lib/audio/SamplerEngine';
type Deck = 'A' | 'B';
type PendingTheme = { blockId: string; stepId: string | null; origin: 'manual' | 'program' };
export type AIDJStatus = 'idle' | 'analyzing' | 'mixing' | 'transitioning' | 'manual' | 'error';
interface AIDJStore {
    isActive: boolean;
    status: AIDJStatus;
    planSource: 'groq' | 'local' | null;
    planReason: AIReason | null;
    setlist: SetlistItem[];
    currentIndex: number;
    requestedIds: string[];
    djComment: string;
    errorMessage: string;
    autoFXDrops: boolean;
    isReplanning: boolean;
    preparation: { trackId: string; deck: Deck } | null;
    pendingTheme: PendingTheme | null;
    programStepId: string | null;
    programElapsed: number;
    playAt: number | null;
    lastPlay: {deck: Deck; trackId: string; at: number} | null;
    nextEffect: NextTransitionEffect; activeEffect: TransitionEffect;
    setNextEffect: (effect: NextTransitionEffect) => void; cancelEffect: () => void;
    toggleAutoFXDrops: () => void;
    activate: () => Promise<void>;
    deactivate: () => void;
    skipToNext: () => void;
    queueTrack: (id: string, next?: boolean) => boolean;
    removeQueued: (id: string) => void;
    suspend: () => void;
    resume: () => void;
    applyBlock: (id: string) => Promise<void>;
    jumpToStep: (id: string) => Promise<void>;
}
let monitor: ReturnType<typeof setInterval> | null = null;
let session: AbortController | null = null;
let replanning: AbortController | null = null;
let loadingTransition = false, revision = 0;
let lastEffectIndex = -3, lastEffectAt = -Infinity;
let lastProgramClock: number | null = null;
interface Prepared {
    id: string;
    deck: Deck;
    controller: AbortController;
    promise: Promise<TrackMetadata | null>;
}
let prepared: Prepared | null = null;
const catalog = () => useLibraryStore.getState().allTracks || useLibraryStore.getState().tracks;
const itemFor = (trackId: string): SetlistItem => ({ trackId, mixPoint: 4, transitionStyle: 'smooth' });
function cancelPreparation() {
    prepared?.controller.abort(); prepared = null;
    useAIDJStore.setState({ preparation: null, playAt: null });
}
function currentDeck(): Deck {
    const ai = useAIDJStore.getState(), decks = useDeckStore.getState().decks, id = ai.setlist[ai.currentIndex]?.trackId;
    if (id && (decks.A.track?.id === id) !== (decks.B.track?.id === id))
        return decks.A.track?.id === id ? 'A' : 'B';
    return useMixerStore.getState().crossfader <= 0.5 ? 'A' : 'B';
}
function eligibleTracks(id = usePartyBlockStore.getState().activeId) {
    const { blocks } = usePartyBlockStore.getState(), block = blocks.find(b => b.id === id);
    const tracks = catalog();
    return { tracks: block ? tracks.filter(track => block.trackIds.includes(track.id)) : id ? [] : tracks, name: block?.name || '' };
}
async function installThemeQueue(id: string, destination: PendingTheme | null) {
    const ai = useAIDJStore.getState();
    if (['analyzing', 'transitioning'].includes(ai.status)) return;
    const eligible = eligibleTracks(id);
    if (!eligible.tracks.length) {
        useAIDJStore.setState({errorMessage:'This theme has no available songs. Add music before playing it.'}); return;
    }
    if (!ai.isActive) { usePartyBlockStore.getState().setActive(id); return; }
    const history = ai.setlist.slice(0, ai.currentIndex + 1);
    const pinned = ai.setlist.slice(ai.currentIndex + 1).filter(item => ai.requestedIds.includes(item.trackId));
    const candidates = cycleTracks(eligible.tracks, history.map(item=>item.trackId), history.at(-1)?.trackId || '')
        .filter(track=>!pinned.some(item=>item.trackId===track.id));
    const allowed = new Set(candidates.map(track=>track.id));
    const local = generateFallbackSetlist(candidates);
    cancelPreparation(); replanning?.abort();
    const controller = new AbortController(); replanning = controller;
    const version = ++revision;
    useAIDJStore.setState({setlist:[...history,...pinned,...local.setlist.filter(item=>allowed.has(item.trackId))],
        pendingTheme:destination, planSource:'local',planReason:'LOCAL_SELECTED',
        isReplanning:candidates.length>=2 && useAIConnectionStore.getState().useRemoteAI,errorMessage:''});
    try {
        if (candidates.length<2 || !useAIConnectionStore.getState().useRemoteAI) return;
        const result = await plan(candidates,controller.signal,eligible.name);
        if (controller.signal.aborted || revision!==version || useAIDJStore.getState().status==='transitioning') return;
        cancelPreparation();
        useAIDJStore.setState({setlist:[...history,...pinned,...result.setlist.filter(item=>allowed.has(item.trackId))],planSource:result.source,planReason:result.reason||null,djComment:result.djComment});
        useAIConnectionStore.getState().recordPlan(result);
    } catch(error) {
        if (!controller.signal.aborted && revision===version) useAIDJStore.setState({errorMessage:error instanceof Error?error.message:'Local ordering is active.'});
    } finally {
        if (replanning===controller) useAIDJStore.setState({isReplanning:false});
    }
}
async function plan(tracks: TrackMetadata[], signal: AbortSignal, blockName: string): Promise<PlanResult> {
    const metadata = tracks.map(({ id, title, artist, bpm, key, duration }) => ({ id, title, artist, bpm, key, duration }));
    return tracks.length >= 2 && useAIConnectionStore.getState().useRemoteAI
        ? generateSetlist(metadata, signal, blockName) : generateFallbackSetlist(metadata);
}
function prepareNext(deck: Deck): Prepared | null {
    const ai = useAIDJStore.getState(), next = ai.setlist[ai.currentIndex + 1];
    if (!session || !next)
        return null;
    if (prepared?.id === next.trackId && prepared.deck === deck)
        return prepared;
    cancelPreparation();
    const controller = new AbortController(), activeSession = session;
    // Deferring the loader ensures the reservation exists before any synchronous store update.
    const entry: Prepared = { id: next.trackId, deck, controller, promise: Promise.resolve(null) };
    prepared = entry;
    useAIDJStore.setState({ preparation: { trackId: next.trackId, deck } });
    entry.promise = Promise.resolve().then(() => loadTrackById(next.trackId, deck, false, { signal: AbortSignal.any([activeSession.signal, controller.signal]), autoPlay: false, restoreLoop: false })).catch(error => {
        if (!controller.signal.aborted && session === activeSession)
            useAIDJStore.setState({ status: 'error', errorMessage: error instanceof Error ? error.message : 'Unable to prepare the next song.' });
        return null;
    });
    return entry;
}
function transitionPolicy(outgoing: TrackMetadata, incoming: TrackMetadata) {
    const ai = useAIDJStore.getState();
    const base = naturalTransition(outgoing, incoming, useSettingsStore.getState().aiDefaultDuration);
    const automatic = ai.nextEffect === 'auto';
    const requested = automatic ? (ai.planSource === 'groq' ? ai.setlist[ai.currentIndex]?.effect || 'none' : 'none') : ai.nextEffect;
    const effect = selectTransitionEffect(requested, { duration: base.duration, bpm: outgoing.bpm, incomingBpm: incoming.bpm, automatic, index: ai.currentIndex, lastIndex: lastEffectIndex, now: getAudioEngine().ctx?.currentTime || 0, lastAt: lastEffectAt });
    const duration = effect === 'echo_out' ? Math.min(2, base.duration) : base.duration;
    return { ...base, duration, startsAt: Math.max(0, base.end - duration), effect };
}
async function transition(deck: Deck) {
    const ai = useAIDJStore.getState(), activeSession = session;
    if (!ai.isActive || !activeSession || activeSession.signal.aborted || loadingTransition || !['mixing'].includes(ai.status) || useMixerStore.getState().isAutoCrossfading)
        return;
    const next = ai.setlist[ai.currentIndex + 1];
    if (!next)
        return;
    const fader = useMixerStore.getState().crossfader;
    if ((deck === 'B' && fader > .001) || (deck === 'A' && fader < .999)) {
        ai.suspend();
        useAIDJStore.setState({ errorMessage: 'Finish the manual blend by moving the crossfader fully to the current song, then resume Auto-DJ.' });
        return;
    }
    loadingTransition = true;
    useAIDJStore.setState({ status: 'transitioning' });
    const entry = prepareNext(deck);
    try {
        const loaded = await entry?.promise;
        if (session !== activeSession || activeSession.signal.aborted || prepared !== entry || entry?.controller.signal.aborted)
            return;
        if (!loaded)
            throw new Error('The next song could not be prepared. Current playback was preserved.');
        if (ai.pendingTheme?.blockId && !eligibleTracks(ai.pendingTheme.blockId).tracks.length)
            throw new Error('The next theme is no longer available. Choose another theme; current playback continues.');
        const outgoingDeck = currentDeck();
        const outgoing = useDeckStore.getState().decks[outgoingDeck].track;
        const policy = transitionPolicy(outgoing || loaded, loaded);
        if (loaded.audioStart)
            useDeckStore.getState().setCurrentTime(deck, loaded.audioStart);
        useDeckStore.getState().setPlaying(deck, true);
        if (ai.pendingTheme) {
            usePartyBlockStore.getState().setActive(ai.pendingTheme.blockId);
            lastProgramClock = getAudioEngine().ctx?.currentTime ?? null;
            const program=usePartyProgramStore.getState();
            const step=program.enabled?program.steps.find(step=>step.id===ai.pendingTheme?.stepId):null;
            useAIDJStore.setState({programStepId:step?.id||null,programElapsed:0,pendingTheme:null});
        }
        useAIDJStore.setState({lastPlay:{deck,trackId:loaded.id,at:performance.now()}});
        useMixerStore.getState().setAutoDuration(policy.duration);
        useMixerStore.getState().triggerAutoCrossfade(deck);
        const effect = getAudioEngine().startTransitionEffect?.(outgoingDeck, policy.effect, policy.duration, outgoing?.bpm || 0) || "none";
        if (effect !== "none") { lastEffectIndex = ai.currentIndex; lastEffectAt = getAudioEngine().ctx?.currentTime || 0; }
        useAIDJStore.setState({ activeEffect: effect, nextEffect: useSettingsStore.getState().aiEffectsEnabled ? "auto" : "none" });
        revision++;
        useAIDJStore.setState({ currentIndex: ai.currentIndex + 1, requestedIds: ai.requestedIds.filter(id => id !== next.trackId) });
        try {
            const vj = useVJStore.getState();
            vj.rotateToNextVideo();
            vj.triggerDropFlash('NOW PLAYING', deck === 'A' ? '#ff6b00' : '#00d4ff');
            if (ai.autoFXDrops) samplerEngine.trigger(policy.duration <= 2 ? 'laser' : 'subdrop', .5);
        } catch { /* Optional visuals and effects must not interrupt the audio transition. */ }
        prepared = null;
        useAIDJStore.setState({ preparation: null, playAt: null });
    }
    catch (error) {
        if (session === activeSession && !activeSession.signal.aborted)
            useAIDJStore.setState({ status: 'error', errorMessage: error instanceof Error ? error.message : 'Transition failed.' });
    }
    finally {
        if (session === activeSession)
            loadingTransition = false;
    }
}
function stopMonitor() { if (monitor)
    clearInterval(monitor); monitor = null; }
function startMonitor() {
    stopMonitor();
    monitor = setInterval(() => {
        let ai = useAIDJStore.getState();
        const clock = getAudioEngine().ctx?.currentTime ?? null;
        const delta = clock !== null && lastProgramClock !== null ? Math.max(0,clock-lastProgramClock) : 0;
        lastProgramClock = clock;
        if (ai.isActive && ai.programStepId && ['mixing','transitioning'].includes(ai.status) &&
            Object.values(useDeckStore.getState().decks).some(deck=>deck.isPlaying) && delta) {
            useAIDJStore.setState({programElapsed:ai.programElapsed+delta}); ai=useAIDJStore.getState();
        }
        if (ai.activeEffect !== "none" && getAudioEngine().hasTransitionEffects?.() === false) useAIDJStore.setState({ activeEffect: "none" });
        if (!ai.isActive || loadingTransition || ['manual', 'analyzing', 'error'].includes(ai.status))
            return;
        const mixer = useMixerStore.getState(), deck = currentDeck(), state = useDeckStore.getState().decks[deck];
        if (ai.status === 'transitioning') {
            if (!mixer.isAutoCrossfading) {
                if (deck === 'A' && mixer.crossfader <= .001)
                    useDeckStore.getState().setPlaying('B', false);
                if (deck === 'B' && mixer.crossfader >= .999)
                    useDeckStore.getState().setPlaying('A', false);
                useAIDJStore.setState({ status: 'mixing' });
            }
            return;
        }
        if (!state.track) {
            ai.suspend();
            return;
        }
        const time = getAudioEngine().getPlaybackTime(deck);
        const end = state.track.audioEnd || state.track.duration;
        const program = usePartyProgramStore.getState(), activeId = usePartyBlockStore.getState().activeId;
        if (ai.pendingTheme?.origin !== 'manual') {
            const nextStep = program.enabled && ai.programStepId ? nextProgramStep(program.steps,ai.programStepId,
                ai.programElapsed+Math.max(0,end-time),id=>eligibleTracks(id).tracks.length>0) : null;
            if (nextStep && ai.pendingTheme?.stepId!==nextStep.id) {
                void installThemeQueue(nextStep.blockId,{blockId:nextStep.blockId,stepId:nextStep.id,origin:'program'});
                if(program.steps.findIndex(step=>step.id===nextStep.id)>program.steps.findIndex(step=>step.id===ai.programStepId)+1)
                    useAIDJStore.setState({errorMessage:'Skipped unavailable programme themes. Current playback continues.'});
            } else if (!nextStep && ai.pendingTheme?.origin==='program') {
                void installThemeQueue(activeId,null);
            }
        }
        ai=useAIDJStore.getState();
        if (!ai.setlist[ai.currentIndex+1] && activeId && !ai.pendingTheme && eligibleTracks(activeId).tracks.length) {
            void installThemeQueue(activeId,null); ai=useAIDJStore.getState();
        }
        const next = ai.setlist[ai.currentIndex + 1];
        if (!next) {
            if (!state.isPlaying && time >= state.track.duration - .1)
                ai.deactivate();
            return;
        }
        if (!state.isPlaying || state.loopActive)
            return;
        const incoming = catalog().find(t => t.id === next.trackId);
        if (!incoming) {
            useAIDJStore.setState({ status: 'error', errorMessage: 'The next song is no longer in the library. Choose another song.' });
            return;
        }
        const policy = transitionPolicy(state.track, incoming), target = deck === 'A' ? 'B' : 'A';
        if (policy.end - time <= Math.max(20, policy.duration + 10)) {
            prepareNext(target);
            useAIDJStore.setState({playAt:(clock||0)+Math.max(0,policy.startsAt-time)});
        }
        if (time >= policy.startsAt)
            void transition(target);
    }, 500);
}
export const useAIDJStore = create<AIDJStore>((set, get) => ({
    isActive: false, status: 'idle', planSource: null, planReason: null, setlist: [], currentIndex: 0, requestedIds: [], djComment: '', errorMessage: '', autoFXDrops: false, isReplanning: false, preparation: null,
    pendingTheme:null,programStepId:null,programElapsed:0,playAt:null,lastPlay:null,
    toggleAutoFXDrops: () => set(s => ({ autoFXDrops: !s.autoFXDrops })),
    nextEffect: useSettingsStore.getState().aiEffectsEnabled ? 'auto' : 'none', activeEffect: 'none',
    setNextEffect: effect => { if (effect === 'auto' || isTransitionEffect(effect)) { if (effect === 'none' || effect === 'auto') useSettingsStore.getState().setAiEffectsEnabled(effect === 'auto'); if (effect === 'none') get().cancelEffect(); set({ nextEffect: effect }); } },
    cancelEffect: () => { getAudioEngine().cancelTransitionEffects?.(); set({ activeEffect: 'none', nextEffect: useSettingsStore.getState().aiEffectsEnabled ? "auto" : "none" }); },
    activate: async () => {
        if (get().isActive)
            return;
        const program = usePartyProgramStore.getState();
        const first = program.enabled ? program.steps[0] : null;
        const previousTheme=usePartyBlockStore.getState().activeId;
        if (program.enabled && (!first || program.steps.some(step=>!eligibleTracks(step.blockId).tracks.length))) {
            set({status:'error',errorMessage:'Add songs to every programme theme, or disable the programme before starting.'});return;
        }
        if (first) usePartyBlockStore.getState().setActive(first.blockId);
        const eligible = eligibleTracks();
        if (!eligible.tracks.length) {
            set({ status: 'error', errorMessage: 'Add songs to the selected block before starting.' });
            return;
        }
        session?.abort();
        lastEffectIndex = -3; lastEffectAt = -Infinity;
        const activeSession = new AbortController();
        session = activeSession;
        loadingTransition = false;
        lastProgramClock = null;
        revision++;
        set({ isActive: true, status: 'analyzing', errorMessage: '', planSource: null, planReason: null, requestedIds: [],pendingTheme:null,programStepId:first?.id||null,programElapsed:0,lastPlay:null });
        try {
            const result = await plan(eligible.tracks, activeSession.signal, eligible.name);
            if (session !== activeSession || activeSession.signal.aborted)
                return;
            useAIConnectionStore.getState().recordPlan(result);
            const valid = new Set(eligible.tracks.map(t => t.id)), seen = new Set<string>();
            let queue = result.setlist.filter(item => valid.has(item.trackId) && !seen.has(item.trackId) && !!seen.add(item.trackId));
            if (!queue.length)
                throw new Error('No eligible songs are available.');
            const decks = useDeckStore.getState().decks, focus = useMixerStore.getState().crossfader <= .5 ? 'A' : 'B', other = focus === 'A' ? 'B' : 'A';
            const playing = decks[focus].isPlaying && decks[focus].track ? focus : decks[other].isPlaying && decks[other].track ? other : null;
            let initialTheme: PendingTheme | null = null;
            if (playing) {
                const id = decks[playing].track!.id;
                queue = [queue.find(item => item.trackId === id) || itemFor(id), ...queue.filter(item => item.trackId !== id)];
                if(first&&!eligible.tracks.some(track=>track.id===id)) {
                    usePartyBlockStore.getState().setActive(previousTheme);
                    initialTheme={blockId:first.blockId,stepId:first.id,origin:'manual'};
                }
            }
            else {
                const loaded = await loadTrackById(queue[0].trackId, 'A', false, { signal: activeSession.signal, autoPlay: false, restoreLoop: false });
                if (session !== activeSession || activeSession.signal.aborted)
                    return;
                if (!loaded)
                    throw new Error('Deck A is busy.');
                if (loaded.audioStart)
                    useDeckStore.getState().setCurrentTime('A', loaded.audioStart);
                useMixerStore.getState().setCrossfader(0);
                useDeckStore.getState().setPlaying('A', true);
                set({lastPlay:{deck:'A',trackId:loaded.id,at:performance.now()}});
            }
            set({ setlist: queue, currentIndex: 0, status: 'mixing', djComment: result.djComment, planSource: result.source, planReason: result.reason || null,
                pendingTheme:initialTheme,programStepId:initialTheme?null:first?.id||null });
            startMonitor();
        }
        catch (error) {
            if (session === activeSession && !activeSession.signal.aborted)
                set({ isActive: false, status: 'error', errorMessage: error instanceof Error ? error.message : 'Unable to start Auto-DJ.' });
        }
    },
    deactivate: () => {
        get().cancelEffect();
        session?.abort();
        session = null;
        replanning?.abort();
        cancelPreparation();
        loadingTransition = false;
        revision++;
        stopMonitor();
        lastProgramClock = null;
        set({ isActive: false, status: 'idle', setlist: [], currentIndex: 0, requestedIds: [], planSource: null, planReason: null, djComment: '', errorMessage: '', isReplanning: false,pendingTheme:null,programStepId:null,programElapsed:0,lastPlay:null });
        useMixerStore.getState().stopAutoCrossfade();
    },
    skipToNext: () => { const deck = currentDeck(); void transition(deck === 'A' ? 'B' : 'A'); },
    queueTrack: (id, next = true) => {
        const ai = get();
        if (!ai.isActive || ['analyzing', 'transitioning'].includes(ai.status) || !catalog().some(t => t.id === id))
            return false;
        const queue = requestTrack(ai.setlist, ai.currentIndex, itemFor(id), next);
        if (queue === ai.setlist)
            return false;
        revision++;
        replanning?.abort();
        cancelPreparation();
        set({ setlist: queue, requestedIds: [...new Set([...ai.requestedIds, id])], errorMessage: '', isReplanning: false });
        return true;
    },
    removeQueued: id => {
        const ai = get();
        if (['analyzing', 'transitioning'].includes(ai.status))
            return;
        revision++;
        replanning?.abort();
        cancelPreparation();
        set({ setlist: [...ai.setlist.slice(0, ai.currentIndex + 1), ...ai.setlist.slice(ai.currentIndex + 1).filter(item => item.trackId !== id)], requestedIds: ai.requestedIds.filter(value => value !== id), isReplanning: false });
    },
    suspend: () => {
        get().cancelEffect();
        if (!get().isActive || get().status === 'analyzing')
            return;
        revision++;
        replanning?.abort();
        cancelPreparation();
        set({ status: 'manual', isReplanning: false });
        useMixerStore.getState().stopAutoCrossfade();
    },
    resume: () => {
        if (!get().isActive || !['manual', 'error'].includes(get().status))
            return;
        const decks = useDeckStore.getState().decks, focus = useMixerStore.getState().crossfader <= .5 ? 'A' : 'B', other = focus === 'A' ? 'B' : 'A';
        const active = decks[focus].isPlaying && decks[focus].track ? decks[focus] : decks[other].isPlaying && decks[other].track ? decks[other] : decks[focus].track ? decks[focus] : null;
        if (!active?.track) {
            set({ errorMessage: 'Start a deck before resuming Auto-DJ.' });
            return;
        }
        const selected = active === decks.A ? 'A' : 'B', fader = useMixerStore.getState().crossfader;
        if ((selected === 'A' && fader > .001) || (selected === 'B' && fader < .999)) {
            set({ errorMessage: 'Move the crossfader fully to the song you want to keep, then resume Auto-DJ.' });
            return;
        }
        useDeckStore.getState().setPlaying(selected === 'A' ? 'B' : 'A', false);
        if (!active.isPlaying) useDeckStore.getState().setPlaying(selected, true);
        const ai = get(), id = active.track.id;
        set({ setlist: [...ai.setlist.slice(0, ai.currentIndex), itemFor(id), ...ai.setlist.slice(ai.currentIndex).filter(item => item.trackId !== id)], requestedIds: ai.requestedIds.filter(value => value !== id), status: 'mixing', errorMessage: '' });
    },
    applyBlock: async id => {
        const program=usePartyProgramStore.getState();
        const step=program.enabled?program.steps.find(step=>step.blockId===id):null;
        await installThemeQueue(id,{blockId:id,stepId:step?.id||null,origin:'manual'});
    },
    jumpToStep: async id => {
        const step=usePartyProgramStore.getState().steps.find(step=>step.id===id);
        if(step) await installThemeQueue(step.blockId,{blockId:step.blockId,stepId:step.id,origin:'manual'});
    },
}));
// Manual controls have priority over the automation's scheduled moves.
useMixerStore.subscribe((state, previous) => {
    const ai = useAIDJStore.getState();
    if (!ai.isActive || ['analyzing', 'manual', 'error'].includes(ai.status))
        return;
    const movedManually = state.crossfader !== previous.crossfader && !state.isAutoCrossfading && !previous.isAutoCrossfading;
    const interrupted = previous.isAutoCrossfading && !state.isAutoCrossfading && state.crossfader > .001 && state.crossfader < .999;
    if (movedManually || interrupted)
        ai.suspend();
});
useDeckStore.subscribe((state, previous) => {
    const ai = useAIDJStore.getState();
    if (!ai.isActive || ['analyzing', 'manual', 'error'].includes(ai.status))
        return;
    for (const id of ['A', 'B'] as const) {
        const now = state.decks[id], before = previous.decks[id];
        if (now.track !== before.track && prepared?.deck === id && prepared.id === now.track?.id)
            continue;
        if (now.track?.id !== before.track?.id && !(prepared?.deck === id && prepared.id === now.track?.id)) {
            ai.suspend();
            return;
        }
        const ownPreparation = loadingTransition && prepared?.deck === id;
        if ((now.seekRevision !== before.seekRevision || now.tempoOffset !== before.tempoOffset || now.loopActive !== before.loopActive || now.loopLength !== before.loopLength || now.loopStart !== before.loopStart) && !ownPreparation) {
            ai.suspend();
            return;
        }
        const mixer = useMixerStore.getState();
        const ownStart = ownPreparation && now.isPlaying;
        const ownRelease = ai.status === 'transitioning' && !mixer.isAutoCrossfading && id !== currentDeck() && (id === 'A' ? mixer.crossfader >= .999 : mixer.crossfader <= .001);
        if (now.isPlaying !== before.isPlaying && !ownStart && !ownRelease && !(now.currentTime >= (now.track?.duration || Infinity) - .1)) {
            ai.suspend();
            return;
        }
    }
});

useSettingsStore.subscribe((state,previous)=>{if(state.aiEffectsEnabled!==previous.aiEffectsEnabled){if(!state.aiEffectsEnabled)useAIDJStore.getState().cancelEffect();useAIDJStore.setState({nextEffect:state.aiEffectsEnabled?"auto":"none"});}});

usePartyBlockStore.subscribe((state,previous)=>{
    const ai=useAIDJStore.getState();
    if (!ai.isActive) return;
    const removed=previous.activeId && !state.blocks.some(block=>block.id===previous.activeId);
    const pendingRemoved=ai.pendingTheme?.blockId && !state.blocks.some(block=>block.id===ai.pendingTheme?.blockId);
    if (removed || pendingRemoved) {
        ai.suspend();
        useAIDJStore.setState({pendingTheme:null,programStepId:null,errorMessage:'A selected theme was removed. Current playback continues; choose another theme to resume.'});
    }
});
usePartyProgramStore.subscribe((state,previous)=>{
    if (state.enabled===previous.enabled && state.steps===previous.steps) return;
    const ai=useAIDJStore.getState();
    if (ai.programStepId && (!state.enabled || !state.steps.some(step=>step.id===ai.programStepId)))
        useAIDJStore.setState({programStepId:null});
    if(ai.pendingTheme?.stepId&&!state.steps.some(step=>step.id===ai.pendingTheme?.stepId))
        useAIDJStore.setState({pendingTheme:{...ai.pendingTheme,stepId:null}});
});
