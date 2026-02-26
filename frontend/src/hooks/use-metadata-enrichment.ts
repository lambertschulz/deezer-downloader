import { useCallback, useRef } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { enrichmentProgressAtom, libraryTracksAtom } from "@/atoms/app";
import { putTracks } from "@/lib/library-db";
import { searchRecording, lookupGenreByArtist } from "@/lib/musicbrainz";
import { writeTagsToFile, canWriteTags, type TagUpdates } from "@/lib/tag-writer";
import { resolveFileHandle, ensureDirectoryAccess } from "@/lib/file-access";
import type { EnrichmentOptions, EnrichmentProgress, LibraryTrack } from "@/lib/library-types";

export function useMetadataEnrichment() {
  const [progress, setProgress] = useAtom(enrichmentProgressAtom);
  const tracks = useAtomValue(libraryTracksAtom);
  const setTracks = useSetAtom(libraryTracksAtom);
  const abortRef = useRef(false);

  const enrichMetadata = useCallback(
    async (options: EnrichmentOptions) => {
      abortRef.current = false;
      const toEnrich = tracks.filter((t) => {
        if (options.genre && !t.genre) return true;
        if (options.year && (t.year === null || t.year === undefined)) return true;
        return false;
      });

      if (toEnrich.length === 0) {
        setProgress({
          status: "complete",
          processed: 0,
          total: 0,
          currentTrack: "",
          updated: 0,
          skipped: 0,
          failed: 0,
          message: "No tracks need metadata enrichment",
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

      // Directory access needed only for writing tags to files
      let dirHandle: FileSystemDirectoryHandle | null = null;
      if (options.writeToFiles) {
        dirHandle = await ensureDirectoryAccess();
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
      }

      let updated = 0;
      let skipped = 0;
      let failed = 0;
      const updatedTracks: LibraryTrack[] = [];

      // Cache: artist → genre (avoid duplicate MusicBrainz lookups)
      const artistGenreCache = new Map<string, string | null>();

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

          if (!anyUpdate) {
            skipped++;
            continue;
          }

          const updatedTrack: LibraryTrack = {
            ...track,
            ...updates,
            enrichedAt: Date.now(),
          };

          // Write tags to file
          if (options.writeToFiles && dirHandle && canWriteTags(track.format)) {
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

          // Save to IndexedDB
          await putTracks([updatedTrack]);
          updatedTracks.push(updatedTrack);
          updated++;
        } catch {
          failed++;
        }
      }

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
          skipped,
          failed,
          message: `Done: ${updated} updated, ${skipped} skipped, ${failed} failed`,
        });
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

  const missingStats = {
    missingGenre: tracks.filter((t) => !t.genre).length,
    missingYear: tracks.filter((t) => t.year === null || t.year === undefined).length,
  };

  return {
    progress,
    missingStats,
    enrichMetadata,
    abort,
    resetProgress,
  };
}
