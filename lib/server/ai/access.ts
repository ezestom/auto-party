import "server-only";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { AIError } from "../../ai/contract";

export interface AIConfig {
  ready: boolean; apiKey: string; accessCode: string; sessionSecret: string; origins: string[]; model: string;
  production: boolean; redisUrl: string; redisToken: string; dailyLimit: number; hourlyLimit: number;
}
export function readConfig(env: Record<string, string | undefined> = process.env): AIConfig {
  const production = env.NODE_ENV === "production";
  const config = { ready: false, apiKey: env.GEMINI_API_KEY?.trim() || "", accessCode: env.AI_ACCESS_CODE || "",
    sessionSecret: env.AI_SESSION_SECRET || "", origins: (env.AI_ALLOWED_ORIGINS || (production ? "" : "http://localhost:3000")).split(",").map(item => item.trim()).filter(Boolean),
    model: env.GEMINI_MODEL?.trim() || "gemini-3.8-flash", production,
    redisUrl: env.UPSTASH_REDIS_REST_URL?.trim() || "", redisToken: env.UPSTASH_REDIS_REST_TOKEN?.trim() || "",
    dailyLimit: positive(env.AI_DAILY_REQUEST_LIMIT, 100, 10000), hourlyLimit: positive(env.AI_SESSION_HOURLY_LIMIT, 6, 60) };
  const originsValid = config.origins.length > 0 && config.origins.every(origin => {
    try { const url = new URL(origin); return url.origin === origin && !url.username && !url.password &&
      (url.protocol === "https:" || (!production && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))); } catch { return false; }
  });
  let redisValid = !production && !config.redisUrl && !config.redisToken;
  if (config.redisUrl && config.redisToken) {
    try { const url = new URL(config.redisUrl); redisValid = url.protocol === "https:" && url.hostname.endsWith(".upstash.io") &&
      url.pathname === "/" && !url.username && !url.password && !url.search && !url.hash; } catch { /* Invalid configuration stays closed. */ }
  }
  config.ready = !!config.apiKey && config.accessCode.length >= 12 && config.accessCode.length <= 200 && config.sessionSecret.length >= 32 &&
    /^[a-z0-9][a-z0-9.-]{1,99}$/.test(config.model) && config.dailyLimit > 0 && config.hourlyLimit > 0 && originsValid && redisValid;
  return config;
}
function positive(value: string | undefined, fallback: number, max: number) {
  if (!value) return fallback;
  const number = Number(value);
  return Number.isInteger(number) && number > 0 && number <= max ? number : 0;
}
function digest(text: string) { return createHash("sha256").update(text).digest(); }
export function checkAccessCode(value: string, config: AIConfig): boolean {
  return timingSafeEqual(digest(value), digest(config.accessCode));
}
export function createSession(config: AIConfig, now = Date.now()) {
  const id = randomUUID(), exp = now + 8 * 3600000;
  const payload = Buffer.from(JSON.stringify({ id, exp })).toString("base64url");
  const signature = createHmac("sha256", config.sessionSecret).update(payload).digest("base64url");
  return { id, token: payload + "." + signature };
}
export function readSession(cookie: string | null, config: AIConfig, now = Date.now()): { id: string; exp: number } | null {
  if (!config.ready || !cookie || cookie.length > 8192) return null;
  const token = cookie.split(";").map(item => item.trim()).find(item => item.startsWith("eze_ai_session="))?.slice(15);
  if (!token || token.length > 512) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;
  try {
    const expected = createHmac("sha256", config.sessionSecret).update(payload).digest();
    const supplied = Buffer.from(signature, "base64url");
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
    const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof value.id === "string" && /^[a-f0-9-]{36}$/.test(value.id) && Number.isFinite(value.exp) && value.exp > now && value.exp <= now + 8 * 3600000 ? value : null;
  } catch { return null; }
}
export function sessionCookie(token: string, config: AIConfig, maxAge = 8 * 3600) {
  return `eze_ai_session=${token}; Path=/api/ai; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${config.production ? "; Secure" : ""}`;
}
export function checkOrigin(request: Request, config: AIConfig) {
  if (!config.origins.includes(request.headers.get("origin") || "") || request.headers.get("sec-fetch-site") === "cross-site") throw new AIError("ORIGIN_DENIED", 403);
}
