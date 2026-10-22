import { expect, test } from "vitest";
import { readConfig, createSession, readSession, checkAccessCode, checkOrigin } from "./access";

const env = { NODE_ENV: "development", GEMINI_API_KEY: "server-test-secret", AI_ACCESS_CODE: "invite-code-123456",
  AI_SESSION_SECRET: "s".repeat(48), AI_ALLOWED_ORIGINS: "http://localhost:3000" };
test("configuration is closed when credentials or production shared limits are missing", () => {
  expect(readConfig({}).ready).toBe(false);
  expect(readConfig(env).ready).toBe(true);
  expect(readConfig({ ...env, NODE_ENV: "production" }).ready).toBe(false);
  expect(readConfig({ ...env, AI_DAILY_REQUEST_LIMIT: "0" }).ready).toBe(false);
  expect(readConfig({ ...env, AI_ALLOWED_ORIGINS: "ftp://localhost" }).ready).toBe(false);
});
test("only the exact access code is accepted", () => {
  const config = readConfig(env);
  expect(checkAccessCode("invite-code-123456", config)).toBe(true);
  expect(checkAccessCode("wrong", config)).toBe(false);
});
test("sessions reject tampering, expiry and a different signing secret", () => {
  const config = readConfig(env), session = createSession(config, 1000);
  expect(readSession(`eze_ai_session=${session.token}`, config, 1001)?.id).toBe(session.id);
  expect(readSession(`eze_ai_session=${session.token}x`, config, 1001)).toBeNull();
  expect(readSession(`eze_ai_session=${session.token}`, config, 1000 + 8 * 3600000)).toBeNull();
  expect(readSession(`eze_ai_session=${session.token}`, readConfig({ ...env, AI_SESSION_SECRET: "t".repeat(48) }), 1001)).toBeNull();
});
test("mutations require the configured browser origin", () => {
  const config = readConfig(env);
  expect(() => checkOrigin(new Request("http://localhost:3000/api/ai/test", { headers: { origin: "https://other.example" } }), config)).toThrow();
  expect(() => checkOrigin(new Request("http://localhost:3000/api/ai/test"), config)).toThrow();
  expect(() => checkOrigin(new Request("http://localhost:3000/api/ai/test", { headers: { origin: "http://localhost:3000" } }), config)).not.toThrow();
});
