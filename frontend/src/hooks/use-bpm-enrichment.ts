import { useCallback, useRef } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { bpmProgressAtom, libraryTracksAtom } from "@/atoms/app";
import { putTracks } from "@/lib/library-db";
import { detectBpm } from "@/lib/bpm-detector";
import { writeTagsToFile, canWriteTags } from "@/lib/tag-writer";
import { resolveFileHandle, ensureDirectoryAccess } from "@/lib/file-access";
import type { EnrichmentProgress, LibraryTrack } from "@/lib/library-types";

/** Number of concurrent BPM detections. Each creates ~2 OfflineAudioContexts. */
const BPM_CONCURRENCY = 6;

export function useBpmEnrichment() {
  const [progress, setProgress] = useAtom(bpmProgressAtom);
  const tracks = useAtomValue(libraryTracksAtom);
  const setTracks = useSetAtom(libraryTracksAtom);
  const abortRef = useRef(false);

  const enrichBpm = useCallback(
    async (writeToFiles: boolean) => {
      abortRef.current = false;
      const toEnrich = tracks.filter(
        (t) => t.bpm === null || t.bpm === undefined,
      );

      if (toEnrich.length === 0) {
        setProgress({
          status: "complete",
          processed: 0,
          total: 0,
          currentTrack: "",
          updated: 0,
          skipped: 0,
          failed: 0,
          message: "All tracks already have BPM",
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

      // Always need directory access (to read audio files for analysis)
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

      let processed = 0;
      let updated = 0;
      let failed = 0;
      const updatedTracks: LibraryTrack[] = [];

      // Concurrency limiter
      let activeCount = 0;
      const waiters: (() => void)[] = [];

      async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
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

      const promises: Promise<void>[] = [];

      for (const track of toEnrich) {
        promises.push(
          withSlot(async () => {
            if (abortRef.current) return;

            try {
              const fileHandle = await resolveFileHandle(
                dirHandle,
                track.path,
              );
              if (!fileHandle) {
                failed++;
                return;
              }

              const file = await fileHandle.getFile();
              const bpm = await detectBpm(file);

              if (bpm === null) {
                failed++;
                return;
              }

              // Write BPM tag to file
              if (writeToFiles && canWriteTags(track.format)) {
                const written = await writeTagsToFile(fileHandle, track.format, {
                  bpm,
                });
                if (!written)
                  console.warn(`BPM tag write failed: ${track.path}`);
              }

              // Persist to IndexedDB
              const updatedTrack: LibraryTrack = {
                ...track,
                bpm,
                enrichedAt: Date.now(),
              };
              await putTracks([updatedTrack]);
              updatedTracks.push(updatedTrack);
              updated++;
            } catch {
              failed++;
            } finally {
              processed++;
              setProgress((prev) => ({
                ...prev,
                processed,
                updated,
                failed,
                currentTrack: `${track.artist} - ${track.title}`,
              }));
            }
          }),
        );
      }

      await Promise.allSettled(promises);

      // Update atom state
      if (updatedTracks.length > 0) {
        setTracks((prev) => {
          const map = new Map(prev.map((t) => [t.path, t]));
          for (const t of updatedTracks) {
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
          skipped: 0,
          failed,
          message: `Done: ${updated} updated, ${failed} failed`,
        });
      } else {
        setProgress((prev) => ({
          ...prev,
          status: "cancelled",
          message: `Cancelled. ${updated} BPMs saved before cancellation.`,
        }));
      }
    },
    [tracks, setProgress, setTracks],
  );

  const abort = useCallback(() => {
    abortRef.current = true;
    setProgress((prev) =>
      prev.status === "running"
        ? { ...prev, status: "cancelling", message: "Cancelling..." }
        : prev,
    );
  }, [setProgress]);

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

  const missingBpm = tracks.filter(
    (t) => t.bpm === null || t.bpm === undefined,
  ).length;

  return {
    progress,
    missingBpm,
    enrichBpm,
    abort,
    resetProgress,
  };
}
