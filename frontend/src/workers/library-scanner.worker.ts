/// <reference lib="webworker" />
import { parseBlob } from "music-metadata";
import type { ScanWorkerRequest, ScanWorkerResponse } from "@/lib/scanner-types";
import type { LibraryTrack } from "@/lib/library-types";

const SUPPORTED_EXTENSIONS = new Set([
  "mp3", "flac", "ogg", "wav", "m4a", "aac", "wma", "opus",
]);
const BATCH_SIZE = 50;
const CONCURRENCY = 4;

let aborted = false;

self.onmessage = async (event: MessageEvent<ScanWorkerRequest>) => {
  const msg = event.data;

  if (msg.type === "abort") {
    aborted = true;
    return;
  }

  if (msg.type === "start-scan") {
    aborted = false;
    const startTime = Date.now();
    const existingIndex = new Map<string, number>(msg.existingIndex);

    try {
      // Phase 1: Walk directory tree, collect all audio file entries
      const fileEntries: Array<{ handle: FileSystemFileHandle; path: string }> = [];
      await walkDirectory(msg.dirHandle, "", fileEntries);

      // Determine which files are new/modified vs unchanged
      const onDiskPaths = new Set(fileEntries.map((e) => e.path));
      const toRemove = [...existingIndex.keys()].filter((p) => !onDiskPaths.has(p));

      // Report removed files
      if (toRemove.length > 0) {
        post({ type: "removed", paths: toRemove });
      }

      // Separate files into: needs parsing vs skip
      const toParse: typeof fileEntries = [];
      let skipped = 0;

      for (const entry of fileEntries) {
        if (aborted) {
          post({ type: "error", message: "Scan aborted by user" });
          return;
        }
        const existingMod = existingIndex.get(entry.path);
        if (existingMod !== undefined) {
          // Check if file was modified — need to read file metadata
          const file = await entry.handle.getFile();
          if (file.lastModified === existingMod) {
            skipped++;
            continue;
          }
        }
        toParse.push(entry);
      }

      const total = fileEntries.length;
      let scanned = skipped;
      let indexed = 0;
      let batch: LibraryTrack[] = [];

      // Phase 2: Parse metadata with concurrent pool
      const queue = [...toParse];
      let queueIdx = 0;

      async function processNext(): Promise<void> {
        while (queueIdx < queue.length) {
          if (aborted) return;

          const idx = queueIdx++;
          const entry = queue[idx];
          scanned++;

          post({
            type: "progress",
            scanned,
            total,
            skipped,
            currentFile: entry.path,
          });

          try {
            const file = await entry.handle.getFile();
            const metadata = await parseBlob(file);
            const common = metadata.common;
            const format = metadata.format;
            const ext = entry.path.split(".").pop()?.toLowerCase() ?? "";

            const track: LibraryTrack = {
              path: entry.path,
              fileName: entry.handle.name.replace(/\.[^.]+$/, ""),
              title: common.title || entry.handle.name.replace(/\.[^.]+$/, ""),
              artist: common.artist || "Unknown Artist",
              album: common.album || "Unknown Album",
              albumArtist: common.albumartist || common.artist || "Unknown Artist",
              trackNumber: common.track?.no ?? null,
              discNumber: common.disk?.no ?? null,
              year: common.year ?? null,
              genre: common.genre?.[0] || "",
              duration: format.duration ?? null,
              fileSize: file.size,
              format: ext,
              lastModified: file.lastModified,
              indexedAt: Date.now(),
            };

            batch.push(track);
            indexed++;

            if (batch.length >= BATCH_SIZE) {
              post({ type: "batch", tracks: [...batch] });
              batch = [];
            }
          } catch {
            // Skip files that fail to parse
          }
        }
      }

      // Launch concurrent workers
      const workers = Array.from(
        { length: Math.min(CONCURRENCY, toParse.length) },
        () => processNext(),
      );
      await Promise.all(workers);

      // Send remaining batch
      if (batch.length > 0) {
        post({ type: "batch", tracks: batch });
      }

      const durationMs = Date.now() - startTime;
      post({
        type: "complete",
        totalScanned: total,
        totalIndexed: indexed,
        totalSkipped: skipped,
        totalRemoved: toRemove.length,
        durationMs,
      });
    } catch (err) {
      post({
        type: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
};

async function walkDirectory(
  dirHandle: FileSystemDirectoryHandle,
  basePath: string,
  results: Array<{ handle: FileSystemFileHandle; path: string }>,
): Promise<void> {
  for await (const entry of dirHandle.values()) {
    if (aborted) return;

    const entryPath = basePath ? `${basePath}/${entry.name}` : entry.name;

    if (entry.kind === "file") {
      const ext = entry.name.split(".").pop()?.toLowerCase() ?? "";
      if (SUPPORTED_EXTENSIONS.has(ext)) {
        results.push({
          handle: entry as FileSystemFileHandle,
          path: entryPath,
        });
      }
    } else if (entry.kind === "directory") {
      await walkDirectory(
        entry as FileSystemDirectoryHandle,
        entryPath,
        results,
      );
    }
  }
}

function post(msg: ScanWorkerResponse) {
  self.postMessage(msg);
}
