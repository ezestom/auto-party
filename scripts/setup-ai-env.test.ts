import { expect, test } from "vitest";
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("environment setup is idempotent, removes the public key and never prints secrets", () => {
  const directory = mkdtempSync(join(tmpdir(), "eze-ai-env-test-"));
  try {
    mkdirSync(join(directory, "scripts"));
    copyFileSync(new URL("./setup-ai-env.mjs", import.meta.url), join(directory, "scripts/setup-ai-env.mjs"));
    copyFileSync(new URL("../.env.example", import.meta.url), join(directory, ".env.example"));
    writeFileSync(join(directory, ".env.local"), "NEXT_PUBLIC_GEMINI_API_KEY=old-test-key\nGEMINI_API_KEY=retired-key\nNEXT_PUBLIC_GROQ_API_KEY=public-groq-key\nGROQ_API_KEY=private-test-key\nGROQ_TTS_MODEL=retired-voice-model\nKEEP_THIS=value\n");
    const output = execFileSync(process.execPath, [join(directory, "scripts/setup-ai-env.mjs")], { encoding: "utf8" });
    const first = readFileSync(join(directory, ".env.local"), "utf8");
    expect(first).not.toContain("old-test-key");
    expect(first).not.toContain("retired-key");
    expect(first).not.toContain("GROQ_TTS_MODEL");
    expect(first).not.toContain("public-groq-key");
    expect(first).toContain("GROQ_API_KEY=private-test-key");
    expect(first).toContain("KEEP_THIS=value");
    expect(first).toMatch(/AI_SESSION_SECRET=[a-zA-Z0-9_-]{64}/);
    expect(first).toMatch(/AI_ACCESS_CODE=[a-zA-Z0-9_-]{24}/);
    expect(output).not.toContain("private-test-key");
    execFileSync(process.execPath, [join(directory, "scripts/setup-ai-env.mjs")]);
    expect(readFileSync(join(directory, ".env.local"), "utf8")).toBe(first);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
