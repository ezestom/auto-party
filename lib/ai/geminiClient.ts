"use client";

/**
 * Gemini API Client for EZE MIX PRO AI Auto-DJ
 * Uses Google AI Studio REST API (Gemini 2.0 Flash)
 */

const CANDIDATE_MODELS = [
  "gemini-3.6-flash",
  "gemini-2.5-flash",
  "gemini-1.5-flash",
  "gemini-pro",
];

export interface TrackInfo {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  key: string;
  duration: number;
}

export interface SetlistItem {
  trackId: string;
  mixPoint: number; // seconds before end to start transition
  transitionStyle: "smooth" | "cut" | "echo";
}

export interface GeminiSetlistResponse {
  setlist: SetlistItem[];
  djComment: string;
}

/**
 * Generates an optimized DJ setlist using Gemini API.
 * Analyzes BPM, key compatibility (Camelot wheel), and energy flow.
 */
export async function generateSetlist(
  apiKey: string,
  tracks: TrackInfo[]
): Promise<GeminiSetlistResponse> {
  if (!apiKey) throw new Error("API Key is required");
  if (tracks.length < 2)
    throw new Error("Need at least 2 tracks for a setlist");

  const trackList = tracks
    .map(
      (t, i) =>
        `${i + 1}. "${t.title}" by ${t.artist} — BPM: ${t.bpm}, Key: ${t.key}, Duration: ${Math.floor(t.duration)}s`
    )
    .join("\n");

  const prompt = `You are an expert DJ assistant. Analyze these tracks and create the optimal mixing order for a party.

TRACKS:
${trackList}

RULES:
1. Order tracks for smooth harmonic mixing using the Camelot Wheel (compatible keys: same number, ±1, or same number opposite letter)
2. Create an energy curve: start mellow, build up to peak energy, then bring it down
3. Match BPMs where possible (±5% is mixable, larger jumps need a "cut" transition)
4. For each transition, suggest a mixPoint (how many seconds before the track ends to start the transition, typically 16-32 seconds)
5. Choose transition style: "smooth" (gradual crossfade), "cut" (quick swap for big BPM jumps), or "echo" (echo out effect)

Respond ONLY with valid JSON in this exact format, no markdown, no backticks:
{
  "setlist": [
    { "trackId": "TRACK_ID_HERE", "mixPoint": 24, "transitionStyle": "smooth" }
  ],
  "djComment": "Brief 1-sentence explanation of the mixing strategy"
}

Use the exact track IDs from the list. Include ALL tracks.`;

  let lastError = "";

  // Try candidate models in order (gemini-3.6-flash first)
  for (const model of CANDIDATE_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
            responseMimeType: "application/json",
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg =
          (errorData as Record<string, Record<string, string>>)?.error?.message ||
          `HTTP ${response.status}`;
        lastError = errorMsg;
        console.warn(`[Gemini API] Model ${model} returned error: ${errorMsg}, trying next...`);
        continue;
      }

      const data = await response.json();
      const textContent = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!textContent) continue;

      // Parse JSON response (Gemini may wrap in markdown code blocks)
      let cleanJson = textContent.trim();
      if (cleanJson.startsWith("```")) {
        cleanJson = cleanJson
          .replace(/^```(?:json)?\n?/, "")
          .replace(/\n?```$/, "");
      }

      const parsed = JSON.parse(cleanJson) as GeminiSetlistResponse;

      if (parsed.setlist && Array.isArray(parsed.setlist)) {
        // Map track IDs and validate they exist
        const trackIds = new Set(tracks.map((t) => t.id));
        parsed.setlist = parsed.setlist.filter((item) => trackIds.has(item.trackId));

        // Add any missing tracks at the end
        const usedIds = new Set(parsed.setlist.map((item) => item.trackId));
        tracks.forEach((t) => {
          if (!usedIds.has(t.id)) {
            parsed.setlist.push({
              trackId: t.id,
              mixPoint: 24,
              transitionStyle: "smooth",
            });
          }
        });

        return parsed;
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      console.warn(`[Gemini API] Error with ${model}:`, e);
    }
  }

  // If all models failed, fall back to local intelligent BPM setlist without interrupting the party
  console.warn(`[Gemini API] All models failed (${lastError}), using local BPM setlist fallback.`);
  return generateFallbackSetlist(tracks);
}

/**
 * Simple fallback setlist generator (no API needed).
 * Sorts by BPM for basic harmonic flow.
 */
export function generateFallbackSetlist(
  tracks: TrackInfo[]
): GeminiSetlistResponse {
  const sorted = [...tracks].sort((a, b) => a.bpm - b.bpm);

  return {
    setlist: sorted.map((t) => ({
      trackId: t.id,
      mixPoint: Math.min(24, Math.floor(t.duration * 0.1)),
      transitionStyle: "smooth" as const,
    })),
    djComment:
      "Fallback mode: tracks sorted by BPM for natural energy progression.",
  };
}
