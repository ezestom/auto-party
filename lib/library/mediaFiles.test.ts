import { describe, expect, it } from "vitest";
import { mediaKind } from "./mediaFiles";

describe("media file classification", () => {
  it("recognizes Windows M4A and WEBM files even without a MIME type", () => {
    expect(mediaKind({ name: "Ke Personajes.M4A", type: "" })).toBe("audio");
    expect(mediaKind({ name: "4k_visual_dj.WEBM", type: "application/octet-stream" })).toBe("video");
  });
  it("uses media MIME types and ignores unrelated folder contents", () => {
    expect(mediaKind({ name: "recording", type: "audio/mp4" })).toBe("audio");
    expect(mediaKind({ name: "loop", type: "video/webm" })).toBe("video");
    expect(mediaKind({ name: "cover.jpg", type: "image/jpeg" })).toBe(null);
    expect(mediaKind({ name: "desktop.ini", type: "" })).toBe(null);
  });
});
