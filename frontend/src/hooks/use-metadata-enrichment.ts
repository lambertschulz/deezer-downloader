import { useCallback, useRef } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { enrichmentProgressAtom, libraryTracksAtom } from "@/atoms/app";
import { putTracks, getDirectoryHandle } from "@/lib/library-db";
import { searchRecording, lookupGenreByArtist } from "@/lib/musicbrainz";
import { detectBpm } from "@/lib/bpm-detector";
import { writeTagsToFile, canWriteTags, type TagUpdates } from "@/lib/tag-writer";
import type { EnrichmentOptions, EnrichmentProgress, LibraryTrack } from "@/lib/library-types";

/** Number of concurrent BPM detections (OfflineAudioContext instances). */
const BPM_CONCURRENCY = 4;

/**
 * Resolve a FileSystemFileHandle for a track by walking the directory tree.
 */
async function resolveFileHandle(
  dirHandle: FileSystemDirectoryHandle,
  relativePath: string,
): Promise<FileSystemFileHandle | null> {
  const parts = relativePath.split("/");
  let current: FileSystemDirectoryHandle = dirHandle;

  for (let i = 0; i < parts.length - 1; i++) {
    try {
      current = await current.getDirectoryHandle(parts[i]);
    } catch {
      return null;
    }
  }

  try {
    return await current.getFileHandle(parts[parts.length - 1]);
  } catch {
    return null;
  }
}

/**
 * Ensure the stored directory handle has permission for this session.
 * Returns the handle with permission granted, or null.
 */
async function ensureDirectoryAccess(): Promise<FileSystemDirectoryHandle | null> {
  const handle = await getDirectoryHandle();
  if (!handle) return null;

  try {
    // Try readwrite first (needed for tag writing)
    const perm = await handle.queryPermission({ mode: "readwrite" });
    if (perm === "granted") return handle;

    const requested = await handle.requestPermission({ mode: "readwrite" });
    if (requested === "granted") return handle;

    // Fall back to read-only (enough for BPM analysis)
    const readPerm = await handle.queryPermission({ mode: "read" });
    if (readPerm === "granted") return handle;

    const readRequested = await handle.requestPermission({ mode: "read" });
    if (readRequested === "granted") return handle;
  } catch {
    // Permission API not available or denied
  }

  return null;
}

export function useMetadataEnrichment() {
  const [progress, setProgress] = useAtom(enrichmentProgressAtom);
  const tracks = useAtomValue(libraryTracksAtom);
  const setTracks = useSetAtom(libraryTracksAtom);
  const abortRef = useRef(false);

  const getTracksToEnrich = useCallback(
    (options: EnrichmentOptions) => {
      return tracks.filter((t) => {
        if (options.genre && !t.genre) return true;
        if (options.bpm && (t.bpm === null || t.bpm === undefined)) return true;
        if (options.year && (t.year === null || t.year === undefined)) return true;
        return false;
      });
    },
    [tracks],
  );

  const enrichTracks = useCallback(
    async (options: EnrichmentOptions) => {
      abortRef.current = false;
      const toEnrich = getTracksToEnrich(options);

      if (toEnrich.length === 0) {
        setProgress({
          status: "complete",
          processed: 0,
          total: 0,
          currentTrack: "",
          updated: 0,
          skipped: 0,
          failed: 0,
          message: "No tracks need enrichment",
        });
        return;
      }

      const initial: EnrichmentProgress = {
        status: "running",
        processed: 0,
        total: toEnrich.length,
        currentTrack: "",
        updated: 0,
        skipped: 0,
        failed: 0,
      };
      setProgress(initial);

      // Always request directory access — needed for BPM analysis and tag writing
      const dirHandle = await ensureDirectoryAccess();
      if (!dirHandle) {
        setProgress({
          status: "error",
          processed: 0,
          total: toEnrich.length,
          currentTrack: "",
          updated: 0,
          skipped: 0,
          failed: 0,
          message: "No directory access. Please grant folder permission first.",
        });
        return;
      }

      let updated = 0;
      let skipped = 0;
      let failed = 0;
      const updatedTracks: LibraryTrack[] = [];

      // Cache: artist → genre (avoid duplicate MusicBrainz lookups for same artist)
      const artistGenreCache = new Map<string, string | null>();

      // ---- Pre-start BPM detections in a concurrent pool ----
      // BPM detection (OfflineAudioContext) is CPU-bound and independent per track,
      // so we kick off all needed detections upfront with a concurrency limit.
      // Each detection immediately writes BPM to file + DB when done, so results
      // are persisted even if the user cancels the enrichment mid-way.
      const bpmPromises = new Map<string, Promise<number | null>>();
      const bpmWrittenTracks: LibraryTrack[] = [];

      if (options.bpm) {
        let activeCount = 0;
        const waiters: (() => void)[] = [];

        async function withBpmSlot<T>(fn: () => Promise<T>): Promise<T> {
          if (activeCount >= BPM_CONCURRENCY) {
            await new Promise<void>((resolve) => waiters.push(resolve));
          }
          activeCount++;
          try {
            return await fn();
          } finally {
            activeCount--;
            if (waiters.length > 0) waiters.shift()!();
          }
        }

        for (const track of toEnrich) {
          if (track.bpm !== null && track.bpm !== undefined) continue;
          bpmPromises.set(
            track.path,
            withBpmSlot(async () => {
              if (abortRef.current) return null;
              try {
                const fileHandle = await resolveFileHandle(dirHandle, track.path);
                if (!fileHandle) return null;
                const file = await fileHandle.getFile();
                const bpm = await detectBpm(file);
                if (bpm === null) return null;

                // Immediately persist BPM to file
                if (options.writeToFiles && canWriteTags(track.format) && fileHandle) {
                  const written = await writeTagsToFile(fileHandle, track.format, { bpm });
                  if (!written) console.warn(`BPM tag write failed: ${track.path}`);
                }

                // Immediately persist BPM to IndexedDB
                const bpmTrack: LibraryTrack = { ...track, bpm, enrichedAt: Date.now() };
                await putTracks([bpmTrack]);
                bpmWrittenTracks.push(bpmTrack);

                return bpm;
              } catch {
                return null;
              }
            }),
          );
        }
      }

      // ---- Main loop: MB lookups (sequential) + await pre-started BPM results ----
      for (let i = 0; i < toEnrich.length; i++) {
        if (abortRef.current) {
          setProgress((prev) => ({
            ...prev,
            status: "cancelled",
            message: `Cancelled after ${i} of ${toEnrich.length} tracks`,
          }));
          break;
        }

        const track = toEnrich[i];
        setProgress((prev) => ({
          ...prev,
          processed: i,
          currentTrack: `${track.artist} - ${track.title}`,
          updated,
          skipped,
          failed,
        }));

        try {
          const updates: Partial<LibraryTrack> = {};
          const tagUpdates: TagUpdates = {};
          let anyUpdate = false;

          // ---- MusicBrainz lookup for genre and year (sequential, rate-limited) ----
          const needsGenre = options.genre && !track.genre;
          const needsYear = options.year && (track.year === null || track.year === undefined);

          if (needsGenre || needsYear) {
            const mb = await searchRecording(track.artist, track.title);

            if (needsGenre && mb.genre) {
              updates.genre = mb.genre;
              tagUpdates.genre = mb.genre;
              anyUpdate = true;
            }
            if (needsYear && mb.year) {
              updates.year = mb.year;
              tagUpdates.year = mb.year;
              anyUpdate = true;
            }

            // Fallback: if no genre from recording, try artist-level tags
            if (needsGenre && !updates.genre) {
              let artistGenre = artistGenreCache.get(track.artist);
              if (artistGenre === undefined) {
                artistGenre = await lookupGenreByArtist(track.artist);
                artistGenreCache.set(track.artist, artistGenre);
              }
              if (artistGenre) {
                updates.genre = artistGenre;
                tagUpdates.genre = artistGenre;
                anyUpdate = true;
              }
            }
          }

          // ---- BPM: await pre-started detection result ----
          // BPM was already written to file/DB by the pool, but we still need the
          // value to include it in the combined tag write (genre+year+bpm together)
          // and in the full DB record with all fields.
          const bpmPromise = bpmPromises.get(track.path);
          if (bpmPromise) {
            const bpm = await bpmPromise;
            if (bpm !== null) {
              updates.bpm = bpm;
              tagUpdates.bpm = bpm;
              anyUpdate = true;
            }
          }

          if (!anyUpdate) {
            skipped++;
            continue;
          }

          // Update the track object
          const updatedTrack: LibraryTrack = {
            ...track,
            ...updates,
            enrichedAt: Date.now(),
          };

          // Write genre/year tags to file (BPM was already written by pool,
          // but including it here is harmless — same value gets overwritten)
          if (options.writeToFiles && canWriteTags(track.format)) {
            const fileHandle = await resolveFileHandle(dirHandle, track.path);
            if (fileHandle) {
              const written = await writeTagsToFile(fileHandle, track.format, tagUpdates);
              if (!written) {
                console.warn(`Tag write failed for: ${track.path}`);
              }
            } else {
              console.warn(`Could not resolve file handle for: ${track.path}`);
            }
          }

          // Save full record (genre+year+bpm) to IndexedDB
          await putTracks([updatedTrack]);
          updatedTracks.push(updatedTrack);
          updated++;
        } catch {
          failed++;
        }
      }

      // Wait for any still-running BPM detections to finish
      // (at most BPM_CONCURRENCY are active, queued ones early-return on abort)
      await Promise.allSettled(bpmPromises.values());

      // Merge atom state: main loop results (full records) take precedence
      // over BPM-only records from the pool
      const allUpdated = new Map<string, LibraryTrack>();
      for (const t of bpmWrittenTracks) {
        allUpdated.set(t.path, t);
      }
      for (const t of updatedTracks) {
        allUpdated.set(t.path, t); // overwrites BPM-only with full record
      }

      if (allUpdated.size > 0) {
        setTracks((prev) => {
          const map = new Map(prev.map((t) => [t.path, t]));
          for (const [, t] of allUpdated) {
            map.set(t.path, t);
          }
          return Array.from(map.values());
        });
      }

      if (!abortRef.current) {
        setProgress({
          status: "complete",
          processed: toEnrich.length,
          total: toEnrich.length,
          currentTrack: "",
          updated,
          skipped,
          failed,
          message: `Done: ${updated} updated, ${skipped} skipped, ${failed} failed`,
        });
      }
    },
    [getTracksToEnrich, setProgress, setTracks],
  );

  const abort = useCallback(() => {
    abortRef.current = true;
  }, []);

  const resetProgress = useCallback(() => {
    setProgress({
      status: "idle",
      processed: 0,
      total: 0,
      currentTrack: "",
      updated: 0,
      skipped: 0,
      failed: 0,
    });
  }, [setProgress]);

  // Compute missing metadata stats
  const missingStats = {
    missingGenre: tracks.filter((t) => !t.genre).length,
    missingBpm: tracks.filter((t) => t.bpm === null || t.bpm === undefined).length,
    missingYear: tracks.filter((t) => t.year === null || t.year === undefined).length,
  };

  return {
    progress,
    missingStats,
    enrichTracks,
    abort,
    resetProgress,
  };
}
