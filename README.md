# 🎧 MIXR DJ Console

MIXR is a premium, high-performance, browser-based 2-deck DJ console. Built with Next.js 15, native Web Audio API, and Tailwind CSS, MIXR delivers a professional, low-latency, and visually stunning mixing environment entirely client-side.

---

## 🚀 Key Features

*   **Symmetrical 2-Deck Mixer**: Responsive dual-deck interface styling with separate channel strips, volume faders, and tactile controls.
*   **Low-Latency Web Audio Engine**: Direct Web Audio API node graph with 3-band EQs (Low, Mid, High), channel gains, master brickwall limiter, and PFL headphone cue routing.
*   **Interactive SVG Jog Wheels**: Symmetrical platters featuring concentric grooves, rotating album art, and pointer-capture physics for vinyl scratching and pitch bends.
*   **Dual 60FPS Waveform Renderers**: Dual-canvas scrolling waveform visualizations displaying a 4-bar zoomed timeline alongside static track overview playheads and hot cue/loop highlights.
*   **Intelligent Background Analysis**: Pre-computes peak analysis vectors and detects grid beat BPMs on track import via background web workers.
*   **IndexedDB Library & Safety Loaders**: Seamless Dexie.js integration to persist tracks and cue states. Features one-click `[ A ]` / `[ B ]` load controls with double-tap replacement warnings for active decks.
*   **Real-time dB VU Meters**: 12-segment L/R vertical dB LED channels per deck employing instant attack, steady analog decay, and 500ms clip indicators.
*   **Lossless Mix Recording**: Capture master output through a direct audio pipeline and trigger downloads of 16-bit PCM WAV mixes.

---

## 🛠️ Tech Stack

*   **Framework**: Next.js 15 (App Router, React 19)
*   **Audio DSP**: Web Audio API & AudioWorklet processors
*   **State Management**: Zustand
*   **Local Database**: Dexie.js (IndexedDB wrapper)
*   **Audio Analysis**: Essentia.js (offline BPM & beat grid detection)
*   **Styling**: Tailwind CSS, CSS Variables
*   **Testing**: Vitest (Unit/Integration) & Playwright (E2E)

---

## 📁 Directory Structure

```
mixrdjconsole/
├── app/
│   ├── layout.tsx              # Root HTML template, CSS imports, Google Fonts (Syne, DM Mono, Space Grotesk)
│   ├── page.tsx                # Landing redirect to /console
│   └── console/
│       └── page.tsx            # Console Route - renders dynamic <DJConsole /> (ssr: false)
├── components/
│   ├── console/
│   │   ├── DJConsole.tsx       # Root container, connects UI to Zustand & AudioEngine
│   │   ├── DeckPanel.tsx       # Symmetrical deck shell (Deck A & B colors)
│   │   ├── JogWheel.tsx        # SVG Vinyl grooves + slow-rotating album art + drag-to-scratch
│   │   ├── Waveform.tsx        # Dual canvas: scrolling zoomed view + static full-track overview
│   │   ├── MixerCenter.tsx     # Master Vol, Headphone PFL, Beat FX placeholders, Crossfader
│   │   ├── EQStrip.tsx         # HI, MID, LOW, GAIN rotary knobs + vertical volume fader
│   │   ├── TransportBar.tsx    # Tactile CUE, PLAY/PAUSE, SYNC, and KEY LOCK buttons
│   │   └── VUMeter.tsx         # 12-segment L/R vertical dB LED channels
│   └── library/
│       ├── LibraryPanel.tsx    # Dexie search query input, drag-and-drop well
│       └── LibraryRow.tsx      # Track row containing REQ-015a Load-to-Deck A/B buttons
├── lib/
│   ├── audio/
│   │   └── AudioEngine.ts      # Web Audio singleton graph manager
│   ├── db/
│   │   └── dexie.ts            # Local IndexedDB schemas and hooks
│   └── workers/
│       ├── waveform.worker.ts  # Pre-computes peak analysis array on track import
│       └── bpm.worker.ts       # Runs essentia.js analysis in background thread
├── e2e/
│   └── console.spec.ts         # Playwright End-to-End browser tests
├── public/
│   └── worklets/
│       ├── scratch.worklet.js  # AudioWorklet processor for scratch-pitch interpolation
│       └── vocoder.worklet.js  # AudioWorklet processor for time-stretching/key-locking
```

---

## ⚙️ Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org) (v18 or higher) installed.

### Installation

1. Clone the repository and navigate to the project directory:
   ```bash
   cd mixrdjconsole
   ```
2. Install the dependencies:
   ```bash
   npm install
   ```

### Development Server

Run the local development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) with your browser to experience the console.

### Running Tests

*   **Unit Tests (Vitest)**:
    ```bash
    npm run test
    ```
*   **End-to-End Tests (Playwright)**:
    ```bash
    npx playwright test
    ```

---

## 🔮 Future Upgrades

The following features are planned for future development to expand MIXR's capabilities:

*   **AI Stem Separation**: Direct client-side separation (Vocal, Drums, Bass, Melody) using ONNX Runtime.
*   **Key Detection & Harmonic Display**: Automated key extraction on track import with Camelot Wheel compatibility guides.
*   **Beat-Synchronized Effects**: 10 performance FX modules (Echo, Reverb, Phaser, Flanger, etc.) synced to active grid tempo.
*   **Multi-Mode Performance Pads**: Support for Auto Loop, Manual Loops, Roll, Slicer, and Sampler triggers.
*   **WebMIDI Controller Mapping**: Custom UI to map external USB/Bluetooth DJ hardware directly to console parameters.
*   **Beat Grid Editor**: Interactive timeline adjustments on the canvas layout to customize grid alignments.
*   **Auto-DJ Transitions**: Algorithmic mixing queue support for hands-off sets.
*   **Cloud Streaming Integration**: Live stream output broadcasts utilizing WHIP protocols.
*   **WASM MP3 Encoding**: Master output compilation to MP3 format via FFmpeg WASM.
# DJ-Console-UI
