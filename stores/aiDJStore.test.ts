import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { useDeckStore } from "./deckStore";
import { useMixerStore } from "./mixerStore";
import { useAIDJStore } from "./aiDJStore";
import { useSettingsStore } from "./settingsStore";
import { usePartyBlockStore } from "./partyBlockStore";
import { usePartyProgramStore } from "./partyProgramStore";
import { useAIConnectionStore } from "./aiConnectionStore";
const mocks = vi.hoisted(() => ({ load: vi.fn(), generate: vi.fn(), fallback: vi.fn(), effect: vi.fn(), cancelFX: vi.fn(), clock:100, time:170 }));
const tracks = [{ id: "one", title: "One", artist: "User", bpm: 120, key: "—", duration: 180, color: "#fff" }, { id: "two", title: "Two", artist: "User", bpm: 124, key: "—", duration: 180, color: "#fff" }, { id: "three", title: "Three", artist: "User", bpm: 94, key: "—", duration: 180, color: "#fff" }];
vi.mock("./libraryStore", () => ({ useLibraryStore: { getState: () => ({ tracks }) } }));
vi.mock("../lib/audio/trackLoader", () => ({ loadTrackById: mocks.load }));
vi.mock("../lib/ai/aiClient", () => ({ generateSetlist: mocks.generate, generateFallbackSetlist: mocks.fallback }));
vi.mock("../lib/audio/AudioEngine", () => ({ getAudioEngine: () => ({ getPlaybackTime: () => mocks.time, startTransitionEffect: mocks.effect, cancelTransitionEffects: mocks.cancelFX, ctx: { currentTime: mocks.clock } }) }));
vi.mock("../lib/audio/SamplerEngine", () => ({ samplerEngine: { trigger: vi.fn() } }));
vi.mock("./vjStore", () => ({ useVJStore: { getState: () => ({ rotateToNextVideo: vi.fn(), triggerDropFlash: vi.fn() }) } }));
const response = { source: "local" as const, reason: "LOCAL_SELECTED" as const, setlist: [{ trackId: "one", mixPoint: 24, transitionStyle: "smooth" as const }, { trackId: "two", mixPoint: 24, transitionStyle: "smooth" as const }], djComment: "Local session" };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
}
describe("Auto-DJ session safety", () => {
  test("presentation follows real preparation and clears when a DJ request replaces it", async () => {
    await useAIDJStore.getState().activate();
    await vi.advanceTimersByTimeAsync(500);
    expect(useAIDJStore.getState().preparation).toEqual({ trackId: "two", deck: "B" });
    expect(useDeckStore.getState().decks.B.track?.id).toBe("two");
    useAIDJStore.getState().queueTrack("three");
    expect(useAIDJStore.getState().preparation).toBeNull();
    await vi.advanceTimersByTimeAsync(500);
    expect(useAIDJStore.getState().preparation).toEqual({ trackId: "three", deck: "B" });
    useAIDJStore.getState().suspend();
    expect(useAIDJStore.getState().preparation).toBeNull();
    expect(useDeckStore.getState().decks.A.isPlaying).toBe(true);
  });
  beforeEach(() => {
    vi.useFakeTimers(); vi.resetAllMocks();
    mocks.clock=100; mocks.time=170;
    useAIDJStore.getState().deactivate();
    usePartyProgramStore.setState({steps:[],enabled:false});
    useSettingsStore.setState({aiEffectsEnabled:true});
    useAIDJStore.setState({ autoFXDrops: false, nextEffect: "auto", activeEffect: "none" });
    mocks.effect.mockImplementation((_deck, effect) => effect);
    usePartyBlockStore.setState({blocks:[],activeId:""});
    useAIConnectionStore.setState({ useRemoteAI: false });
    useDeckStore.getState().resetDeck("A"); useDeckStore.getState().resetDeck("B");
    useMixerStore.getState().resetMixer();
    mocks.fallback.mockReturnValue(response); mocks.generate.mockResolvedValue(response);
    mocks.load.mockImplementation(async (id: string, deck: "A" | "B") => {
      const track = tracks.find(t => t.id === id)!;
      useDeckStore.getState().setTrack(deck, track);
      return track;
    });
  });
  afterEach(() => { useAIDJStore.getState().deactivate(); vi.useRealTimers(); });
  test('programme queues a new theme at the natural ending and commits its clock only on Play',async()=>{
    usePartyBlockStore.setState({blocks:[{id:'c',name:'Cumbia',trackIds:['one']},{id:'r',name:'Rock',trackIds:['two']}],activeId:''});
    usePartyProgramStore.setState({enabled:true,steps:[{id:'s1',blockId:'c',minutes:1},{id:'s2',blockId:'r',minutes:1}]});
    await useAIDJStore.getState().activate();
    useAIDJStore.setState({programElapsed:55});
    await vi.advanceTimersByTimeAsync(500);
    expect(usePartyBlockStore.getState().activeId).toBe('c');
    expect(useAIDJStore.getState().pendingTheme?.blockId).toBe('r');
    expect(useDeckStore.getState().decks.A.isPlaying).toBe(true);
    expect(useDeckStore.getState().decks.B.isPlaying).toBe(false);
    useAIDJStore.getState().skipToNext(); await vi.advanceTimersByTimeAsync(0);
    expect(usePartyBlockStore.getState().activeId).toBe('r');
    expect(useAIDJStore.getState()).toMatchObject({programStepId:'s2',programElapsed:0,lastPlay:{deck:'B',trackId:'two'}});
  });
  test('a one-song theme repeats on the free deck without exhausting the party',async()=>{
    usePartyBlockStore.setState({blocks:[{id:'c',name:'Cumbia',trackIds:['one']}],activeId:'c'});
    mocks.fallback.mockReturnValue({...response,setlist:[response.setlist[0]]});
    await useAIDJStore.getState().activate(); await vi.advanceTimersByTimeAsync(500);
    expect(useAIDJStore.getState().setlist.map(item=>item.trackId)).toEqual(['one','one']);
    useAIDJStore.getState().skipToNext();await vi.advanceTimersByTimeAsync(0);
    expect(useDeckStore.getState().decks.B.isPlaying).toBe(true);
    expect(useAIDJStore.getState().status).toBe('transitioning');
  });
  test('manual theme changes preserve playback, reject empty themes and can revisit a played theme',async()=>{
    await useAIDJStore.getState().activate();
    usePartyBlockStore.setState({blocks:[{id:'c',name:'Cumbia',trackIds:['one']},{id:'empty',name:'Empty',trackIds:[]}]});
    await useAIDJStore.getState().applyBlock('empty');
    expect(useAIDJStore.getState().pendingTheme).toBeNull();
    const playing=useDeckStore.getState().decks.A;
    await useAIDJStore.getState().applyBlock('c');
    expect(useDeckStore.getState().decks.A).toBe(playing);
    expect(useAIDJStore.getState().setlist.at(-1)?.trackId).toBe('one');
  });
  test('programme time excludes manual pauses and counts a running blend only once',async()=>{
    await useAIDJStore.getState().activate();useAIDJStore.setState({programStepId:'s1'});
    usePartyProgramStore.setState({enabled:true,steps:[{id:'s1',blockId:'c',minutes:60}]});
    await vi.advanceTimersByTimeAsync(500); mocks.clock+=2; await vi.advanceTimersByTimeAsync(500);
    expect(useAIDJStore.getState().programElapsed).toBe(2);
    useAIDJStore.getState().skipToNext();await vi.advanceTimersByTimeAsync(0);
    expect(useDeckStore.getState().decks.A.isPlaying && useDeckStore.getState().decks.B.isPlaying).toBe(true);
    mocks.clock+=3;await vi.advanceTimersByTimeAsync(500);
    expect(useAIDJStore.getState().programElapsed).toBe(5);
    useAIDJStore.getState().suspend(); mocks.clock+=30; await vi.advanceTimersByTimeAsync(500);
    expect(useAIDJStore.getState().programElapsed).toBe(5);
  });
  test('extending a stage cancels an automatic theme change while a manual jump wins over the clock',async()=>{
    usePartyBlockStore.setState({blocks:[{id:'c',name:'Cumbia',trackIds:['one']},{id:'r',name:'Rock',trackIds:['two']}],activeId:''});
    const steps=[{id:'s1',blockId:'c',minutes:1},{id:'s2',blockId:'r',minutes:60}];
    usePartyProgramStore.setState({enabled:true,steps});await useAIDJStore.getState().activate();
    useAIDJStore.setState({programElapsed:55});await vi.advanceTimersByTimeAsync(500);
    expect(useAIDJStore.getState().pendingTheme?.blockId).toBe('r');
    usePartyProgramStore.getState().setSteps([{...steps[0],minutes:120},steps[1]]);await vi.advanceTimersByTimeAsync(500);
    expect(useAIDJStore.getState().pendingTheme).toBeNull();
    expect(useDeckStore.getState().decks.A.isPlaying).toBe(true);
    usePartyProgramStore.getState().setSteps(steps);await useAIDJStore.getState().applyBlock('c');await vi.advanceTimersByTimeAsync(500);
    expect(useAIDJStore.getState().pendingTheme).toMatchObject({blockId:'c',origin:'manual'});
  });
  test('programme startup rejects empty themes and deleting an active theme preserves its audio',async()=>{
    usePartyBlockStore.setState({blocks:[{id:'c',name:'Cumbia',trackIds:[]}],activeId:''});
    usePartyProgramStore.setState({enabled:true,steps:[{id:'s1',blockId:'c',minutes:60}]});
    await useAIDJStore.getState().activate();expect(useAIDJStore.getState().isActive).toBe(false);
    usePartyBlockStore.getState().addTracks('c',['one']);await useAIDJStore.getState().activate();
    usePartyBlockStore.getState().removeBlock('c');
    expect(useAIDJStore.getState().status).toBe('manual');
    expect(useDeckStore.getState().decks.A.isPlaying).toBe(true);
  });
  test('starting a programme during an unrelated song waits before starting its first stage clock',async()=>{
    usePartyBlockStore.setState({blocks:[{id:'c',name:'Cumbia',trackIds:['two']}],activeId:''});
    usePartyProgramStore.setState({enabled:true,steps:[{id:'s1',blockId:'c',minutes:60}]});
    useDeckStore.getState().setTrack('A',tracks[0]);useDeckStore.getState().setPlaying('A',true);
    useMixerStore.getState().setCrossfader(0);
    await useAIDJStore.getState().activate();
    expect(useAIDJStore.getState()).toMatchObject({programStepId:null,programElapsed:0,pendingTheme:{blockId:'c',stepId:'s1'}});
    mocks.clock+=10;await vi.advanceTimersByTimeAsync(500);
    expect(useAIDJStore.getState().programElapsed).toBe(0);
    expect(useDeckStore.getState().decks.A.track?.id).toBe('one');
    usePartyProgramStore.getState().setEnabled(false);
    useAIDJStore.getState().skipToNext();await vi.advanceTimersByTimeAsync(0);
    expect(useAIDJStore.getState().programStepId).toBeNull();
    expect(useDeckStore.getState().decks.B.isPlaying).toBe(true);
  });
  test.each(["A", "B"] as const)("activation preserves the currently playing song on deck %s", async deck => {
    useDeckStore.getState().setTrack(deck, tracks[1]);
    useDeckStore.getState().setPlaying(deck, true);
    useMixerStore.getState().setCrossfader(deck === "A" ? 0 : 1);
    useDeckStore.getState().setCurrentTime(deck, 65);
    await useAIDJStore.getState().activate();
    expect(mocks.load).not.toHaveBeenCalled();
    expect(useDeckStore.getState().decks[deck].currentTime).toBe(65);
    expect(useAIDJStore.getState().setlist[0].trackId).toBe("two");
  });
  test("follows the preserved song when only B is playing and the fader is centered", async () => {
    useDeckStore.getState().setTrack("B", tracks[0]);
    useDeckStore.getState().setPlaying("B", true);
    await useAIDJStore.getState().activate();
    await vi.advanceTimersByTimeAsync(500);
    expect(mocks.load).toHaveBeenCalledWith("two", "A", false, expect.any(Object));
  });
  test("completed transitions release only the fully inaudible deck", async () => {
    await useAIDJStore.getState().activate();
    useAIDJStore.getState().skipToNext();
    await vi.advanceTimersByTimeAsync(0);
    expect(useMixerStore.getState().isAutoCrossfading).toBe(true);
    useMixerStore.getState().setCrossfader(1);
    useMixerStore.getState().stopAutoCrossfade();
    await vi.advanceTimersByTimeAsync(500);
    expect(useDeckStore.getState().decks.A.isPlaying).toBe(false);
    expect(useDeckStore.getState().decks.B.isPlaying).toBe(true);
  });
  test("manual cancellation halfway through a blend preserves both playing decks", async () => {
    await useAIDJStore.getState().activate();
    useAIDJStore.getState().skipToNext();
    await vi.advanceTimersByTimeAsync(0);
    useMixerStore.getState().setCrossfader(0.4);
    useMixerStore.getState().stopAutoCrossfade();
    await vi.advanceTimersByTimeAsync(500);
    expect(useDeckStore.getState().decks.A.isPlaying).toBe(true);
    expect(useDeckStore.getState().decks.B.isPlaying).toBe(true);
  });
  test("deactivation during remote analysis cannot later start playback", async () => {
    const slow = deferred<typeof response>(); mocks.generate.mockReturnValue(slow.promise);
    useAIConnectionStore.setState({ useRemoteAI: true });
    const activating = useAIDJStore.getState().activate();
    useAIDJStore.getState().deactivate(); slow.resolve(response); await activating;
    expect(mocks.load).not.toHaveBeenCalled();
    expect(useAIDJStore.getState().isActive).toBe(false);
    expect(useAIDJStore.getState().status).toBe("idle");
  });
  test("deactivation during initial load aborts it and never starts playback", async () => {
    const slow = deferred<typeof tracks[number]>(); mocks.load.mockReturnValue(slow.promise);
    const activating = useAIDJStore.getState().activate();
    await Promise.resolve();
    const options = mocks.load.mock.calls[0][3];
    useAIDJStore.getState().deactivate();
    expect(options.signal.aborted).toBe(true);
    slow.resolve(tracks[0]); await activating;
    expect(useDeckStore.getState().decks.A.isPlaying).toBe(false);
  });
  test("skip and monitor cannot start duplicate transitions during a slow load", async () => {
    await useAIDJStore.getState().activate(); mocks.load.mockClear();
    const slow = deferred<typeof tracks[number]>(); mocks.load.mockReturnValue(slow.promise);
    useAIDJStore.getState().skipToNext();
    useAIDJStore.getState().skipToNext();
    await vi.advanceTimersByTimeAsync(2000);
    expect(mocks.load).toHaveBeenCalledTimes(1);
    expect(useAIDJStore.getState().status).toBe("transitioning");
    useAIDJStore.getState().deactivate(); slow.resolve(tracks[1]); await Promise.resolve();
    expect(useMixerStore.getState().isAutoCrossfading).toBe(false);
    expect(useDeckStore.getState().decks.B.isPlaying).toBe(false);
    expect(useAIDJStore.getState().status).toBe("idle");
  });
  test("transition failure keeps current music and does not repeatedly retry", async () => {
    await useAIDJStore.getState().activate(); mocks.load.mockClear();
    mocks.load.mockRejectedValue(new Error("bad file"));
    useAIDJStore.getState().skipToNext(); await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(2000);
    expect(mocks.load).toHaveBeenCalledTimes(1);
    expect(useDeckStore.getState().decks.A.isPlaying).toBe(true);
    expect(useAIDJStore.getState().status).toBe("error");
  });
  test("manual requests preserve current playback, deduplicate and continue with the planned queue", async () => {
    await useAIDJStore.getState().activate(); mocks.load.mockClear();
    const deck=useDeckStore.getState().decks.A;
    expect(useAIDJStore.getState().queueTrack('three')).toBe(true);
    expect(useAIDJStore.getState().queueTrack('three')).toBe(true);
    expect(useAIDJStore.getState().setlist.map(item=>item.trackId)).toEqual(['one','three','two']);
    expect(useDeckStore.getState().decks.A).toBe(deck);
    expect(mocks.load).not.toHaveBeenCalled();
    useAIDJStore.getState().skipToNext(); await vi.advanceTimersByTimeAsync(0);
    expect(useDeckStore.getState().decks.B.track?.id).toBe('three');
    expect(useMixerStore.getState().autoDuration).toBe(2);
    expect(useAIDJStore.getState().requestedIds).toEqual([]);
    expect(useAIDJStore.getState().setlist[2].trackId).toBe('two');
  });
  test("manual fader movement suspends automation and resume adopts the audible deck", async () => {
    await useAIDJStore.getState().activate();
    useMixerStore.getState().setCrossfader(.3);
    expect(useAIDJStore.getState().status).toBe('manual');
    useDeckStore.getState().setTrack('B',tracks[2]); useDeckStore.getState().setPlaying('B',true);useMixerStore.getState().setCrossfader(1);
    useAIDJStore.getState().resume();
    expect(useAIDJStore.getState().status).toBe('mixing');
    expect(useAIDJStore.getState().setlist[0].trackId).toBe('three');
    expect(useDeckStore.getState().decks.B.isPlaying).toBe(true);
  });
  test("queue edits during a committed transition are rejected", async () => {
    await useAIDJStore.getState().activate();
    useAIDJStore.getState().skipToNext();
    expect(useAIDJStore.getState().queueTrack('three')).toBe(false);
  });
  test("preparing the next song never starts it early", async () => {
    await useAIDJStore.getState().activate();await vi.advanceTimersByTimeAsync(500);
    expect(useDeckStore.getState().decks.B.track?.id).toBe('two');
    expect(useDeckStore.getState().decks.B.isPlaying).toBe(false);
    expect(useAIDJStore.getState().status).toBe('mixing');
  });

  test("a musical block restricts planning to curated songs and passes its name as context",async()=>{
    usePartyBlockStore.getState().saveBlock({id:'dance',name:'Dance block',trackIds:['one','three']});
    usePartyBlockStore.getState().setActive('dance');useAIConnectionStore.setState({useRemoteAI:true});
    await useAIDJStore.getState().activate();
    expect(mocks.generate.mock.calls[0][0].map((t:{id:string})=>t.id)).toEqual(['one','three']);
    expect(mocks.generate.mock.calls[0][2]).toBe('Dance block');
  });
  test("switching blocks preserves the current song and the DJ's pinned request",async()=>{
    await useAIDJStore.getState().activate();useAIDJStore.getState().queueTrack('three');
    const current=useDeckStore.getState().decks.A;
    usePartyBlockStore.getState().saveBlock({id:'dance',name:'Dance block',trackIds:['two']});
    mocks.fallback.mockReturnValue({...response,setlist:[response.setlist[1]]});
    await useAIDJStore.getState().applyBlock('dance');
    expect(useAIDJStore.getState().setlist.map(t=>t.trackId)).toEqual(['one','three','two']);
    expect(useDeckStore.getState().decks.A).toBe(current);
  });
  test("manual replacement cancels a pending preparation before it can start playback",async()=>{
    await useAIDJStore.getState().activate();const slow=deferred<typeof tracks[number]>();mocks.load.mockReturnValue(slow.promise);
    await vi.advanceTimersByTimeAsync(500);
    const options=mocks.load.mock.calls.at(-1)![3];
    useDeckStore.getState().setTrack('B',tracks[2]);
    expect(useAIDJStore.getState().status).toBe('manual');expect(options.signal.aborted).toBe(true);
    slow.resolve(tracks[1]);await vi.advanceTimersByTimeAsync(0);
    expect(useDeckStore.getState().decks.B.isPlaying).toBe(false);
  });

  test("pausing a deck during an automatic blend yields to manual control",async()=>{
    await useAIDJStore.getState().activate();useAIDJStore.getState().skipToNext();await vi.advanceTimersByTimeAsync(0);
    useDeckStore.getState().setPlaying('B',false);
    expect(useAIDJStore.getState().status).toBe('manual');
    expect(useMixerStore.getState().isAutoCrossfading).toBe(false);
    expect(useDeckStore.getState().decks.A.isPlaying).toBe(true);
  });

  test('a one-shot DJ echo is executed locally on the outgoing deck with a short transition',async()=>{
    await useAIDJStore.getState().activate();useAIDJStore.getState().setNextEffect('echo_out');
    useAIDJStore.getState().skipToNext();await vi.advanceTimersByTimeAsync(0);
    expect(mocks.effect).toHaveBeenCalledWith('A','echo_out',2,120);
    expect(useAIDJStore.getState().nextEffect).toBe('auto');
    useAIDJStore.getState().suspend();expect(mocks.cancelFX).toHaveBeenCalled();
    expect(useAIDJStore.getState().activeEffect).toBe('none');
  });
  test('off mode overrides a Groq effect proposal and remains off after the transition',async()=>{
    useAIConnectionStore.setState({useRemoteAI:true});mocks.generate.mockResolvedValue({...response,source:'groq',setlist:[{...response.setlist[0],effect:'filter_sweep'},response.setlist[1]]});
    await useAIDJStore.getState().activate();useAIDJStore.getState().setNextEffect('none');
    useAIDJStore.getState().skipToNext();await vi.advanceTimersByTimeAsync(0);
    expect(mocks.effect).toHaveBeenCalledWith('A','none',8,120);
    expect(useAIDJStore.getState().nextEffect).toBe('none');
  });

  test('manual pitch changes cancel an armed effect and return automation to the DJ',async()=>{
    await useAIDJStore.getState().activate();useAIDJStore.getState().setNextEffect('filter_sweep');
    useDeckStore.getState().setTempoOffset('A',.05);
    expect(useAIDJStore.getState().status).toBe('manual');
    expect(useAIDJStore.getState().nextEffect).toBe('auto');expect(mocks.cancelFX).toHaveBeenCalled();
  });

});
