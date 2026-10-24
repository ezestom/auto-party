import { expect, test, vi } from "vitest";
import { MemoryQuota, RedisQuota } from "./limits";

test("quota is atomic across simultaneous requests and resets after expiration", async () => {
  let now = 0;
  const quota = new MemoryQuota(() => now);
  const bucket = [{ key: "global", limit: 2, ttl: 60 }];
  const result = await Promise.all(Array.from({ length: 5 }, () => quota.consume(bucket)));
  expect(result.filter(item => item.allowed)).toHaveLength(2);
  expect(result[4].retryAfter).toBe(60);
  now = 61000;
  expect((await quota.consume(bucket)).allowed).toBe(true);
});
test("a blocked session never spends the shared global quota", async () => {
  const quota = new MemoryQuota(() => 0);
  await quota.consume([{ key: "session", limit: 1, ttl: 60 }]);
  expect((await quota.consume([{ key: "global", limit: 1, ttl: 60 }, { key: "session", limit: 1, ttl: 60 }])).allowed).toBe(false);
  expect((await quota.consume([{ key: "global", limit: 1, ttl: 60 }])).allowed).toBe(true);
});
test("shared quota errors fail closed without exposing the storage token", async () => {
  const fetcher = vi.fn().mockRejectedValue(new Error("redis-secret"));
  const quota = new RedisQuota("https://test.upstash.io", "redis-secret", fetcher);
  await expect(quota.consume([{ key: "global", limit: 1, ttl: 60 }])).rejects.toThrow("Unable to verify the usage limit.");
});
