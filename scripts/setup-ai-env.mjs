import { readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const read = path => readFile(path, "utf8").catch(error => { if (error.code === "ENOENT") return ""; throw error; });
// Remove the deprecated public credential without displaying or copying it.
for (const name of [".env", ".env.local"]) {
  const path = new URL(name, root), original = await read(path);
  const cleaned = original.split(/\r?\n/).filter(line => !/^\s*(?:export\s+)?(?:NEXT_PUBLIC_(?:GEMINI|GROQ)_API_KEY|GEMINI_(?:API_KEY|MODEL|TTS_MODEL)|GROQ_TTS_MODEL)\s*=/.test(line)).join("\n");
  if (original && original !== cleaned) await writeFile(path, cleaned, { mode: 0o600 });
}
const local = new URL(".env.local", root);
let content = await read(local);
const defaults = (await read(new URL(".env.example", root))).split(/\r?\n/);
for (const line of defaults) {
  const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (!match) continue;
  const [, name, fallback] = match;
  const existing = new RegExp("^\\s*" + name + "\\s*=(.*)$", "m");
  const value = existing.exec(content)?.[1].trim();
  if (value && value !== '""' && value !== "''") continue;
  const replacement = name === "AI_ACCESS_CODE" ? randomBytes(18).toString("base64url")
    : name === "AI_SESSION_SECRET" ? randomBytes(48).toString("base64url") : fallback;
  if (existing.test(content)) content = content.replace(existing, name + "=" + replacement);
  else content += "\n" + name + "=" + replacement;
}
await writeFile(local, content.trim() + "\n", { mode: 0o600 });
console.log("Preparado " + fileURLToPath(local) + ". No se mostraron secretos.");
console.log("Completá GROQ_API_KEY. Para publicar, configurá Redis y el origen HTTPS. Reiniciá el servidor.");
