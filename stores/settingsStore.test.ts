import { afterEach, describe, expect, it } from "vitest";
import { useSettingsStore } from "./settingsStore";

afterEach(() => { useSettingsStore.setState({ isOpen: false, activeTab: "controls" }); useSettingsStore.getState().resetDefaults(); });

describe("settings defaults", () => {
  it("restores safe preferences without closing the dialog or changing its section", () => {
    const settings = useSettingsStore.getState();
    settings.setIsOpen(true); settings.setActiveTab("audio");
    settings.setLockPlayingDeck(false); settings.setAutoPlayOnLoad(true); settings.setAutoGainEnabled(false);
    settings.setCrossfaderCurve("CUT"); settings.setAiDefaultDuration(16); settings.setAiEffectsEnabled(false); settings.setAiPointerEnabled(false);
    settings.resetDefaults();
    expect(useSettingsStore.getState()).toMatchObject({ isOpen: true, activeTab: "audio", lockPlayingDeck: true,
      autoPlayOnLoad: false, autoGainEnabled: true, crossfaderCurve: "LIN", aiDefaultDuration: 8, aiEffectsEnabled: true, aiPointerEnabled: true });
  });
});
