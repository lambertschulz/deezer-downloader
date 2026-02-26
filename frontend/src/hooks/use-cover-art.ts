import { useEffect, useState } from "react";
import { getCover, putCover, getDirectoryHandle } from "@/lib/library-db";
import { extractCoverFromFile } from "@/lib/cover-art";

/**
 * In-memory cache: albumKey → object URL.
 * Shared across all hook instances so each cover is only loaded once.
 * Empty string "" means "confirmed no cover in file" (permanent).
 */
const urlCache = new Map<string, string>();

/** Tracks in-flight fetches to avoid duplicate concurrent extractions. */
const pending = new Map<string, Promise<string | null>>();

/** Concurrency limiter for file extractions */
const COVER_CONCURRENCY = 3;
let activeExtractions = 0;
const extractionQueue: (() => void)[] = [];

async function withExtractionSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (activeExtractions >= COVER_CONCURRENCY) {
    await new Promise<void>((resolve) => extractionQueue.push(resolve));
  }
  activeExtractions++;
  try {
    return await fn();
  } finally {
    activeExtractions--;
    if (extractionQueue.length > 0) extractionQueue.shift()!();
  }
}

/**
 * Check if we currently have read permission on the stored directory handle.
 * Does NOT request permission (no user gesture needed).
 */
async function getGrantedDirHandle(): Promise<FileSystemDirectoryHandle | null> {
  const handle = await getDirectoryHandle();
  if (!handle) return null;
  try {
    const perm = await handle.queryPermission({ mode: "read" });
    return perm === "granted" ? handle : null;
  } catch {
    return null;
  }
}

/**
 * Returns:
 * - object URL string → cover found and cached
 * - "" → confirmed no cover in file (permanent)
 * - null → couldn't check (no permission yet, transient)
 */
async function loadCover(
  albumKey: string,
  trackPath: string,
): Promise<string | null> {
  // 1. Memory cache
  const cached = urlCache.get(albumKey);
  if (cached !== undefined) return cached || null;

  // 2. IndexedDB cache
  const blob = await getCover(albumKey);
  if (blob) {
    const url = URL.createObjectURL(blob);
    urlCache.set(albumKey, url);
    return url;
  }

  // 3. Check if we have permission (query only, no prompt)
  const dirHandle = await getGrantedDirHandle();
  if (!dirHandle) {
    // No permission yet — DON'T cache, so we retry later
    return null;
  }

  // 4. Extract from file (with concurrency limit)
  const extracted = await withExtractionSlot(() =>
    extractCoverFromFile(dirHandle, trackPath),
  );

  if (!extracted) {
    // File genuinely has no cover — cache permanently
    urlCache.set(albumKey, "");
    return null;
  }

  // Cache in IDB + memory
  await putCover(albumKey, extracted);
  const url = URL.createObjectURL(extracted);
  urlCache.set(albumKey, url);
  return url;
}

/** Bump this to force all hooks to re-attempt loading. */
let cacheVersion = 0;

/**
 * Call this after directory permission is granted to trigger
 * cover loading for all visible albums.
 */
export function retryCoverLoading() {
  cacheVersion++;
  // Notify all mounted hooks
  for (const cb of listeners) cb();
}

const listeners = new Set<() => void>();

/**
 * React hook that returns an object URL for an album's cover art.
 * Lazy-loads from file on first access, caches in IndexedDB for persistence.
 */
export function useCoverArt(
  albumKey: string,
  trackPath: string | undefined,
): string | null {
  const [url, setUrl] = useState<string | null>(() => {
    const cached = urlCache.get(albumKey);
    if (cached !== undefined) return cached || null;
    return null;
  });

  // Subscribe to retry signals
  const [version, setVersion] = useState(cacheVersion);
  useEffect(() => {
    const cb = () => setVersion((v) => v + 1);
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }, []);

  useEffect(() => {
    if (!trackPath) return;

    // Already resolved in memory (and confirmed)
    const cached = urlCache.get(albumKey);
    if (cached !== undefined) {
      setUrl(cached || null);
      return;
    }

    // Deduplicate concurrent requests for the same album
    let p = pending.get(albumKey);
    if (!p) {
      p = loadCover(albumKey, trackPath);
      pending.set(albumKey, p);
    }

    let cancelled = false;
    p.then((result) => {
      if (!cancelled) setUrl(result);
    }).finally(() => {
      pending.delete(albumKey);
    });

    return () => {
      cancelled = true;
    };
  }, [albumKey, trackPath, version]);

  return url;
}
