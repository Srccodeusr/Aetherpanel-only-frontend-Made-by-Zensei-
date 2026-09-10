/**
 * Ephemeral, in-memory-only secret store.
 *
 * The panel-account password we generate during provisioning is only ever
 * needed once — to hand it to the customer on their checkout loading screen.
 * It must NEVER be written to data/db.json (that file already stores plenty
 * of non-secret state, but plaintext passwords don't belong on disk).
 *
 * This is a plain process-memory Map with a TTL. It is intentionally NOT
 * persisted, NOT part of the DatabaseSchema, and is wiped on server restart.
 * If you horizontally scale this app across multiple processes/containers,
 * swap this for a short-TTL Redis key instead — the interface below is
 * small on purpose so that's a drop-in change.
 */

interface SecretEntry {
  value: string;
  expiresAt: number;
}

const store = new Map<string, SecretEntry>();
const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes

function cleanup() {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.expiresAt <= now) store.delete(key);
  }
}

setInterval(cleanup, 5 * 60 * 1000).unref?.();

export function setEphemeralSecret(key: string, value: string, ttlMs: number = DEFAULT_TTL_MS): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/** Reads the secret without deleting it (safe to call repeatedly while polling). */
export function peekEphemeralSecret(key: string): string | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

/** Reads the secret and immediately deletes it — use for true one-time reveals. */
export function consumeEphemeralSecret(key: string): string | null {
  const value = peekEphemeralSecret(key);
  if (value !== null) store.delete(key);
  return value;
}

export function clearEphemeralSecret(key: string): void {
  store.delete(key);
}
