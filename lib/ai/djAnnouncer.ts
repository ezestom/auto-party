"use client";

import { voiceboxClient } from "./voiceboxClient";
import { useDeckStore } from "../../stores/deckStore";

export interface DJPhraseCategory {
  id: string;
  name: string;
  icon: string;
  phrases: string[];
}

export const DJ_PHRASE_CATEGORIES: DJPhraseCategory[] = [
  {
    id: "greetings",
    name: "Saludos / Intro",
    icon: "🎉",
    phrases: [
      "¡Buenas noches a todos! Bienvenidos a la fiesta con AutoParty en la mezcla.",
      "¡Arrancamos la noche con toda la energía! Suban el volumen.",
      "¡Gente hermosa de Bella Vista y de todos lados, que empiece la locura!",
      "¡Bienvenidos a la cabina! Hoy no duerme nadie.",
    ],
  },
  {
    id: "hype",
    name: "Arenga / Drops",
    icon: "🔥",
    phrases: [
      "¡Arriba las manos todo el mundo, arriba, arriba!",
      "¡Se viene el drop, quiero ver a todos saltando!",
      "¡Que no pare la fiesta, dale con todo!",
      "¡Subiendo los decibeles, a romper la pista!",
      "¡Todos con las palmas arriba, 1, 2, 3, va!",
    ],
  },
  {
    id: "signature",
    name: "Firma / Tags",
    icon: "🎧",
    phrases: [
      "¡AutoParty en los controles, en vivo para todos ustedes!",
      "¡Estás escuchando la mejor música, directo desde la consola!",
      "¡AutoParty mezclando en vivo, que suene fuerte!",
      "¡Sonando en exclusiva para esta fiesta!",
    ],
  },
  {
    id: "closing",
    name: "Cierre / Épico",
    icon: "✨",
    phrases: [
      "¡Qué noche increíble estamos viviendo, gracias a todos por estar!",
      "¡Una más y no jodemos más, arriba las copas!",
      "¡Aplauso gigante para toda la gente que no paró de bailar!",
    ],
  },
];

class DJAnnouncer {
  private djName = "AutoParty";
  private profile = "eze";
  private autoAnnounceTracks = true;

  public setDJName(name: string) {
    this.djName = name;
  }

  public setVoiceProfile(profile: string) {
    this.profile = profile;
  }

  public setAutoAnnounce(enabled: boolean) {
    this.autoAnnounceTracks = enabled;
  }

  public getAutoAnnounce(): boolean {
    return this.autoAnnounceTracks;
  }

  /**
   * Shouts a random phrase from a given category
   */
  public async shoutCategory(categoryId: string): Promise<void> {
    const category = DJ_PHRASE_CATEGORIES.find((c) => c.id === categoryId);
    if (!category || category.phrases.length === 0) return;

    const phrase = category.phrases[Math.floor(Math.random() * category.phrases.length)];
    await this.speak(phrase);
  }

  /**
   * Custom announcement or free speech
   */
  public async speak(text: string): Promise<void> {
    await voiceboxClient.speak(text, {
      profile: this.profile,
      duckMusic: true,
      volume: 1.0,
    });
  }

  /**
   * Intelligently announces the current or next track being mixed
   */
  public async announceTrack(deckId: "A" | "B"): Promise<void> {
    const deck = useDeckStore.getState().decks[deckId];
    if (!deck.track) return;

    const title = deck.track.title.replace(/\.[a-zA-Z0-9]+$/, "").trim();
    const artist = deck.track.artist && deck.track.artist !== "Unknown Artist" ? `de ${deck.track.artist}` : "";

    const intros = [
      `Seguimos en la mezcla con ${title} ${artist}. ¡A bailar!`,
      `¡Subiendo la energía con ${title} ${artist}!`,
      `Esto que suena es ${title} ${artist}, ¡arriba las manos!`,
      `Tremendo tema que se viene ahora: ${title} ${artist}.`,
    ];

    const phrase = intros[Math.floor(Math.random() * intros.length)];
    await this.speak(phrase);
  }
}

export const djAnnouncer = new DJAnnouncer();
