import { CACHE_TTL } from './config.js';

export function remainingCacheTime(snapshot, now = Date.now()) {
  const timestamp = Date.parse(snapshot?.fetchedAt);
  if (!Number.isFinite(timestamp) || timestamp > now) return 0;
  return Math.max(0, CACHE_TTL - (now - timestamp));
}
