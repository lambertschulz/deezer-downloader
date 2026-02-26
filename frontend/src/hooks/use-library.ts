import { useCallback, useEffect, useRef, useState } from "react";
import { useAtom, useSetAtom } from "jotai";
import Fuse, { type IFuseOptions } from "fuse.js";
import {
  libraryTracksAtom,
  librarySearchQueryAtom,
  librarySearchResultsAtom,
  libraryScanProgressAtom,
  libraryIsLoadedAtom,
  libraryFiltersAtom,
} from "@/atoms/app";
import {
  getAllTracks,
  putTracks,
  removeTracks,
  clearTracks,
  getExistingIndex,
  getDirectoryHandle,
  saveDirectoryHandle,
  clearDirectoryHandle,
  putScanState,
} from "@/lib/library-db";
import type { LibraryFilter, LibraryTrack } from "@/lib/library-types";
import type { ScanWorkerResponse } from "@/lib/scanner-types";

const FUSE_OPTIONS: IFuseOptions<LibraryTrack> = {
  keys: [
    { name: "title", weight: 0.4 },
    { name: "artist", weight: 0.3 },
    { name: "album", weight: 0.2 },
    { name: "albumArtist", weight: 0.1 },
  ],
  threshold: 0.4,
  includeScore: true,
  minMatchCharLength: 2,
};

function filterKey(f: LibraryFilter): string {
  switch (f.type) {
    case "album":
      return `album:${f.albumArtist}||${f.album}`;
    case "artist":
      return `artist:${f.name}`;
    case "song":
      return `song:${f.path}`;
  }
}

function applyFilters(
  tracks: LibraryTrack[],
  filters: LibraryFilter[],
): LibraryTrack[] {
  if (filters.length === 0) return tracks;
  return tracks.filter((t) =>
    filters.every((f) => {
      switch (f.type) {
        case "album":
          return t.album === f.album && t.albumArtist === f.albumArtist;
        case "artist":
          return t.artist === f.name;
        case "song":
          return t.path === f.path;
      }
    }),
  );
}

export function useLibrary() {
  const [tracks, setTracks] = useAtom(libraryTracksAtom);
  const [searchQuery, setSearchQuery] = useAtom(librarySearchQueryAtom);
  const setSearchResults = useSetAtom(librarySearchResultsAtom);
  const [scanProgress, setScanProgress] = useAtom(libraryScanProgressAtom);
  const [isLoaded, setIsLoaded] = useAtom(libraryIsLoadedAtom);
  const [filters, setFilters] = useAtom(libraryFiltersAtom);

  const fuseRef = useRef<Fuse<LibraryTrack> | null>(null);
  const workerRef = useRef<Worker | null>(null);

  // ---- Load tracks from IndexedDB on mount ----
  useEffect(() => {
    if (isLoaded) return;
    (async () => {
      const storedTracks = await getAllTracks();
      setTracks(storedTracks);
      fuseRef.current = new Fuse(storedTracks, FUSE_OPTIONS);
      setIsLoaded(true);
    })();
  }, [isLoaded, setTracks, setIsLoaded]);

  // ---- Rebuild Fuse index when tracks change ----
  useEffect(() => {
    if (tracks.length > 0) {
      fuseRef.current = new Fuse(tracks, FUSE_OPTIONS);
    }
  }, [tracks]);

  // ---- Search ----
  const search = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (!query.trim() || !fuseRef.current) {
        setSearchResults([]);
        return;
      }
      const results = fuseRef.current.search(query, { limit: 100 });
      setSearchResults(results.map((r) => r.item));
    },
    [setSearchQuery, setSearchResults],
  );

  // ---- Filters ----
  const toggleFilter = useCallback(
    (filter: LibraryFilter) => {
      setFilters((prev) => {
        const key = filterKey(filter);
        const exists = prev.some((f) => filterKey(f) === key);
        if (exists) return prev.filter((f) => filterKey(f) !== key);
        return [...prev, filter];
      });
    },
    [setFilters],
  );

  const removeFilter = useCallback(
    (filter: LibraryFilter) => {
      setFilters((prev) =>
        prev.filter((f) => filterKey(f) !== filterKey(filter)),
      );
    },
    [setFilters],
  );

  const clearFilters = useCallback(() => {
    setFilters([]);
  }, [setFilters]);

  // ---- File System Access API support ----
  const isSupported =
    typeof window !== "undefined" && "showDirectoryPicker" in window;

  // ---- Pick directory ----
  const pickDirectory = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;
    try {
      const handle = await window.showDirectoryPicker({ mode: "readwrite" });
      await saveDirectoryHandle(handle);
      setHasStoredHandle(true);
      return true;
    } catch {
      return false;
    }
  }, [isSupported]);

  // ---- Request permission for stored handle ----
  const requestPermission =
    useCallback(async (): Promise<FileSystemDirectoryHandle | null> => {
      const handle = await getDirectoryHandle();
      if (!handle) return null;
      const perm = await handle.queryPermission({ mode: "readwrite" });
      if (perm === "granted") return handle;
      const requested = await handle.requestPermission({ mode: "readwrite" });
      if (requested === "granted") return handle;
      return null;
    }, []);

  // ---- Start scan (internal) ----
  const startScanWithHandle = useCallback(
    async (handle: FileSystemDirectoryHandle, fullRescan: boolean) => {
      if (fullRescan) {
        await clearTracks();
        setTracks([]);
      }

      setScanProgress({
        status: "scanning",
        scanned: 0,
        total: 0,
        skipped: 0,
        currentFile: "Walking directory...",
      });

      const existingIndex = fullRescan
        ? new Map<string, number>()
        : await getExistingIndex();

      const worker = new Worker(
        new URL("../workers/library-scanner.worker.ts", import.meta.url),
        { type: "module" },
      );
      workerRef.current = worker;

      worker.onmessage = async (event: MessageEvent<ScanWorkerResponse>) => {
        const msg = event.data;

        switch (msg.type) {
          case "progress":
            setScanProgress({
              status: "scanning",
              scanned: msg.scanned,
              total: msg.total,
              skipped: msg.skipped,
              currentFile: msg.currentFile,
            });
            break;

          case "batch": {
            // Merge: preserve enrichment data from existing tracks
            let merged: LibraryTrack[] = msg.tracks;
            setTracks((prev) => {
              const map = new Map(prev.map((t) => [t.path, t]));
              merged = msg.tracks.map((scanned) => {
                const existing = map.get(scanned.path);
                if (!existing) return scanned;
                return {
                  ...scanned,
                  bpm: scanned.bpm ?? existing.bpm,
                  genre: scanned.genre || existing.genre,
                  year: scanned.year ?? existing.year,
                  audioHash: existing.audioHash,
                  enrichedAt: existing.enrichedAt,
                };
              });
              for (const t of merged) map.set(t.path, t);
              return Array.from(map.values());
            });
            await putTracks(merged);
            break;
          }

          case "removed":
            await removeTracks(msg.paths);
            setTracks((prev) => {
              const removed = new Set(msg.paths);
              return prev.filter((t) => !removed.has(t.path));
            });
            break;

          case "complete": {
            const parts: string[] = [];
            if (msg.totalIndexed > 0)
              parts.push(`${msg.totalIndexed} indexed`);
            if (msg.totalSkipped > 0)
              parts.push(`${msg.totalSkipped} unchanged`);
            if (msg.totalRemoved > 0)
              parts.push(`${msg.totalRemoved} removed`);
            const summary = parts.join(", ");
            const time = (msg.durationMs / 1000).toFixed(1);

            setScanProgress({
              status: "complete",
              scanned: msg.totalScanned,
              total: msg.totalScanned,
              skipped: msg.totalSkipped,
              currentFile: "",
              message: `${summary} in ${time}s`,
            });
            await putScanState({
              id: "state",
              scanning: false,
              lastScanAt: Date.now(),
              totalFiles: msg.totalScanned,
              totalIndexed: msg.totalIndexed,
              lastScanDuration: msg.durationMs,
            });
            worker.terminate();
            workerRef.current = null;
            break;
          }

          case "error":
            setScanProgress({
              status: "error",
              scanned: 0,
              total: 0,
              skipped: 0,
              currentFile: "",
              message: msg.message,
            });
            worker.terminate();
            workerRef.current = null;
            break;
        }
      };

      worker.postMessage({
        type: "start-scan",
        dirHandle: handle,
        existingIndex: [...existingIndex.entries()],
      });
    },
    [setTracks, setScanProgress],
  );

  // ---- Start scan (public) ----
  const startScan = useCallback(
    async (fullRescan = false) => {
      let handle = await requestPermission();
      if (!handle) {
        const picked = await pickDirectory();
        if (!picked) return;
        handle = await getDirectoryHandle();
        if (!handle) return;
      }
      return startScanWithHandle(handle, fullRescan);
    },
    [requestPermission, pickDirectory, startScanWithHandle],
  );

  // ---- Abort scan ----
  const abortScan = useCallback(() => {
    workerRef.current?.postMessage({ type: "abort" });
  }, []);

  // ---- Disconnect library ----
  const disconnect = useCallback(async () => {
    await clearDirectoryHandle();
    await clearTracks();
    setTracks([]);
    setSearchResults([]);
    setFilters([]);
    setHasStoredHandle(false);
    setScanProgress({
      status: "idle",
      scanned: 0,
      total: 0,
      skipped: 0,
      currentFile: "",
    });
  }, [setTracks, setSearchResults, setFilters, setScanProgress]);

  // ---- Stored handle state ----
  const [hasStoredHandle, setHasStoredHandle] = useState(false);
  useEffect(() => {
    getDirectoryHandle().then((h) => setHasStoredHandle(!!h));
  }, []);

  return {
    tracks,
    trackCount: tracks.length,
    isLoaded,
    isSupported,
    hasStoredHandle,
    searchQuery,
    search,
    filters,
    toggleFilter,
    removeFilter,
    clearFilters,
    applyFilters,
    scanProgress,
    startScan,
    abortScan,
    pickDirectory,
    disconnect,
  };
}
