import "server-only";
import { AIError, parseTracks, parseBlockName } from "../../ai/contract";
import { checkAccessCode, checkOrigin, createSession, readConfig, readSession, sessionCookie } from "./access";
import { MemoryQuota, RedisQuota, type Quota } from "./limits";
import { boundedJson, errorResponse, jsonResponse } from "./http";
import { planWithGroq, testGroq } from "./provider";

const memory = new MemoryQuota();
interface Dependencies { env?: () => Record<string, string | undefined>; quota?: Quota; fetcher?: typeof fetch; now?: () => number }
export function createAIHandlers(deps: Dependencies = {}) {
  const fetcher = deps.fetcher || fetch, now = deps.now || Date.now;
  const config = () => readConfig(deps.env?.() || process.env);
  function storage(settings: ReturnType<typeof config>): Quota {
    // Even an injected memory quota cannot enable production without shared configuration.
    if (!settings.ready) throw new AIError("NOT_CONFIGURED", 503);
    return deps.quota || (settings.redisUrl ? new RedisQuota(settings.redisUrl, settings.redisToken, fetcher) : memory);
  }
  async function authorize(request: Request) {
    const settings = config();
    checkOrigin(request, settings);
    const quota = storage(settings);
    const session = readSession(request.headers.get("cookie"), settings, now());
    if (!session) throw new AIError("ACCESS_REQUIRED", 401);
    return { settings, quota, session };
  }
  async function spend(request: Request, access: Awaited<ReturnType<typeof authorize>>) {
    if (request.signal.aborted) throw new AIError("PROVIDER_TIMEOUT", 499);
    const result = await access.quota.consume([
      { key: `eze:ai:day:${Math.floor(now() / 86400000)}`, limit: access.settings.dailyLimit, ttl: 86400 },
      { key: `eze:ai:session:${access.session.id}:${Math.floor(now() / 3600000)}`, limit: access.settings.hourlyLimit, ttl: 3600 },
    ]);
    if (!result.allowed) throw new AIError("LIMIT_REACHED", 429, result.retryAfter);
  }
  function requireJson(request: Request) {
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new AIError("INVALID_REQUEST", 415);
  }
  return {
    async status(request: Request) {
      const settings = config();
      return jsonResponse({ configured: settings.ready, authorized: !!readSession(request.headers.get("cookie"), settings, now()), model: settings.ready ? settings.model : null });
    },
    async login(request: Request) {
      try {
        const settings = config(); checkOrigin(request, settings); requireJson(request);
        const quota = storage(settings);
        const result = await quota.consume([{ key: `eze:ai:login:${Math.floor(now() / 900000)}`, limit: 30, ttl: 900 }]);
        if (!result.allowed) throw new AIError("LIMIT_REACHED", 429, result.retryAfter);
        const body = await boundedJson(request, 1024) as { accessCode?: unknown };
        if (!body || typeof body.accessCode !== "string" || body.accessCode.length > 200 || !checkAccessCode(body.accessCode, settings)) throw new AIError("INVALID_ACCESS_CODE", 401);
        const session = createSession(settings, now());
        return jsonResponse({ authorized: true }, 200, { "Set-Cookie": sessionCookie(session.token, settings) });
      } catch (error) { return errorResponse(error); }
    },
    async logout(request: Request) {
      try { const settings = config(); checkOrigin(request, settings); return jsonResponse({ authorized: false }, 200, { "Set-Cookie": sessionCookie("", settings, 0) }); }
      catch (error) { return errorResponse(error); }
    },
    async plan(request: Request) {
      try {
        const access = await authorize(request); requireJson(request);
        const body = await boundedJson(request) as { tracks?: unknown; blockName?: unknown };
        const tracks = parseTracks(body?.tracks);
        const blockName = parseBlockName(body?.blockName);
        await spend(request, access);
        return jsonResponse(await planWithGroq(access.settings, tracks, request.signal, fetcher, blockName));
      } catch (error) { return errorResponse(error); }
    },
    async test(request: Request) {
      try {
        const access = await authorize(request); requireJson(request);
        await boundedJson(request, 1024);
        await spend(request, access);
        return jsonResponse(await testGroq(access.settings, request.signal, fetcher));
      } catch (error) { return errorResponse(error); }
    },
  };
}
export const aiHandlers = createAIHandlers();
