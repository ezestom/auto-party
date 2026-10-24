# Party Auto-DJ

The user wants musical blocks, shared control between DJ and automation, and full songs with natural endings. Product UI stays English.

1. Shared queue: Play next and Add to queue move a library track without restarting playback or duplicating upcoming entries. Played history stays intact. Edits during a committed transition are disabled. Manual deck or fader intervention suspends automation; Resume Auto-DJ adopts the audible song and preserves pending requests.
2. Musical blocks: named, explicitly curated track collections saved locally. No inferred genre or energy claims. Choose a block before starting or apply one during playback; manual requests can override membership. Groq receives only the eligible tracks and a validated block name. Named themes repeat when exhausted; an enabled programme controls natural changes between themes. All music remains finite without a programme.
3. Natural-end policy: prefer the audible ending; detect only leading/trailing silence, not vocal/phrase structure. Skip detected opening silence. Use short conservative transitions for incompatible/unknown tempos, and configured fades for compatible tempos. Prepare the next file before its transition, without playing it. Never claim beatmatching or phrase detection.

Verify queue edits/history, preparation races, manual takeover, current playback preservation, block persistence/filtering, bounded context, silence bounds, browser flows, responsive layout, lint and production build. No extra provider calls per playback tick. Existing authentication, quotas and local fallback remain.

## Theme tabs and timed party programme — 24 October 2026

Build order: (1) curated theme tabs/import membership, (2) saved programme and playback policy, (3) programme editor and manual jumps, (4) truthful Play animation.

- Reuse existing named blocks as DJ-created themes; no predefined styles or genre inference. Browsing a tab is independent of the audible theme. One song may belong to multiple themes. Imports capture the destination theme before asynchronous processing.
- Programme: ordered, locally saved theme + minutes entries; same theme may occur more than once. Positive approximate durations, 1–720 minutes. Explicit Enable programme opt-in; no programme means existing manual theme selection. Invalid/empty entries block programme startup with a useful message.
- Count actual running audio-context seconds once across blends, excluding stopped/suspended/manual sessions. At a natural song ending, enter the next stage if that ending reaches/passes the target. Never cut because a timer expired. Last stage continues its theme.
- Refill exhausted active themes; prefer unplayed songs in the cycle, avoid immediate repeats when alternatives exist. A one-song theme can repeat on the other deck. All music retains existing finite behaviour without a programme.
- Manual theme selection prepares the upcoming queue without changing the current deck/fader. Selecting a theme in the programme jumps to its first matching stage and restarts that stage's clock when its first song actually starts. Outside-programme themes pause the programme until a programme theme is chosen. Pending DJ requests survive theme changes. A committed blend finishes before further theme changes.
- A deleted or now-empty target must never stop valid playback or silently fall back to all music. Reject manual empty targets; skip unavailable future programme stages with a visible notice. Stop programme scheduling if the current theme is removed, keeping current playback.
- UI: horizontally scrollable user-created tabs in Media library; theme editor can start empty, rename, assign existing songs and delete. Explicit Play this theme next action. Party programme editor supports append/reorder/remove/duration, progress and manual jump. English product copy, touch/keyboard controls, mobile landscape and portrait checks.
- Cursor: approach the real Play control before scheduled playback and show a brief press when the engine starts that deck. Never dispatch a second click or delay audio. Existing human priority, reduced motion and settings remain.

Acceptance: unit coverage of scheduling, cycles, pause accounting, manual jump, stale loads and single-song repeat; browser tests for scoped imports/persistence, arbitrary tabs, programme editing/manual jump, responsive layout, and Play press with uninterrupted playback. Existing Auto-DJ/library/hand flows, lint, types and production build must remain green.
