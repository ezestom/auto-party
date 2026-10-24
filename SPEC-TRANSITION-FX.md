# Controlled transition effects

Groq proposes only none, filter_sweep or echo_out for the outgoing track. It never controls browser input or raw AudioParams. The app validates proposals, musical context and manual overrides; Web Audio schedules execution against AudioContext time. Playwright is verification only.

Filter sweep: dedicated high-pass stage, low resonance, 20–900 Hz bounded envelope during the existing transition, then neutral restoration. It does not overwrite manual filters or EQ.
Echo out: post-channel-volume send into a capped half-beat delay (estimated tempo only, no beat-grid quantization). Filtered feedback <=0.25, wet <=0.18. Send stops early; the tail has a fixed fade and bounded lifetime. Missing tempo falls back to simple fade.

Automatic effects are sparse (at least 3 transitions and 45 seconds apart); default is none unless useful. The DJ can arm a one-shot preset for the next transition or cancel an active effect. Manual transport/fader/EQ/filter/gain/volume changes, track replacement and deactivation cancel effect automation. VU updates do not. Existing music, blocks, queue, quotas and access are preserved. No scratching, reverse, braking, arbitrary commands or chorus/beat-grid claims.

Verify rejected commands, delay feedback/wet limits, deterministic scheduling, cancellation and disposal, no stacking, actual rendered audio with OfflineAudioContext, and browser UI/manual takeover.
