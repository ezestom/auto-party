import "server-only";
import { AIError } from "../../ai/contract";

export interface Bucket { key: string; limit: number; ttl: number }
export interface Quota { consume(buckets: Bucket[]): Promise<{ allowed: boolean; retryAfter: number }> }
export class MemoryQuota implements Quota {
  private counts = new Map<string, { count: number; until: number }>();
  constructor(private now = Date.now) {}
  async consume(buckets: Bucket[]) {
    const now = this.now();
    for (const [key, entry] of this.counts) if (entry.until <= now) this.counts.delete(key);
    for (const bucket of buckets) {
      const entry = this.counts.get(bucket.key);
      if (entry && entry.count >= bucket.limit) return { allowed: false, retryAfter: Math.max(1, Math.ceil((entry.until - now) / 1000)) };
    }
    if (this.counts.size > 4096) throw new AIError("LIMITS_UNAVAILABLE", 503);
    for (const bucket of buckets) {
      const entry = this.counts.get(bucket.key) || { count: 0, until: now + bucket.ttl * 1000 };
      this.counts.set(bucket.key, { ...entry, count: entry.count + 1 });
    }
    return { allowed: true, retryAfter: 0 };
  }
}

const quotaScript = `
for i,key in ipairs(KEYS) do
  local count = tonumber(redis.call('GET',key) or '0')
  if count >= tonumber(ARGV[(i-1)*2+1]) then
    return {0,math.max(1,redis.call('TTL',key))}
  end
end
for i,key in ipairs(KEYS) do
  local count = redis.call('INCR',key)
  if count == 1 then redis.call('EXPIRE',key,ARGV[(i-1)*2+2]) end
end
return {1,0}`;

export class RedisQuota implements Quota {
  constructor(private url: string, private token: string, private fetcher: typeof fetch = fetch) {}
  async consume(buckets: Bucket[]) {
    try {
      const response = await this.fetcher(this.url, { method: "POST", redirect: "error", cache: "no-store",
        headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(4000),
        body: JSON.stringify(["EVAL", quotaScript, buckets.length, ...buckets.map(bucket => bucket.key), ...buckets.flatMap(bucket => [bucket.limit, bucket.ttl])]) });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.result) || data.result.length !== 2 || ![0, 1].includes(data.result[0]) || !Number.isFinite(data.result[1]) || data.result[1] < 0) throw new Error("Invalid quota response");
      return { allowed: data.result[0] === 1, retryAfter: Math.max(0, Math.ceil(data.result[1])) };
    } catch { throw new AIError("LIMITS_UNAVAILABLE", 503); }
  }
}
