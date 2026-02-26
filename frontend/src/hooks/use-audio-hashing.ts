import { useCallback, useRef } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  duplicateGroupsAtom,
  hashingProgressAtom,
  libraryTracksAtom,
} from "@/atoms/app";
import { putTracks, getDirectoryHandle } from "@/lib/library-db";
import { computeAudioHash } from "@/lib/audio-hasher";
import {
  findMetadataDuplicates,
  findAudioHashDuplicates,
} from "@/lib/duplicate-detector";
import type { LibraryTrack } from "@/lib/library-types";

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

export function useAudioHashing() {
  const [hashingProgress, setHashingProgress] = useAtom(hashingProgressAtom);
  const tracks = useAtomValue(libraryTracksAtom);
  const setTracks = useSetAtom(libraryTracksAtom);
  const setDuplicateGroups = useSetAtom(duplicateGroupsAtom);
  const abortRef = useRef(false);

  /** Compute audio hashes for all tracks that don't have one yet. */
  const computeHashes = useCallback(async () => {
    abortRef.current = false;
    const unhashed = tracks.filter((t) => !t.audioHash);

    if (unhashed.length === 0) {
      setHashingProgress({
        status: "complete",
        processed: 0,
        total: 0,
        currentTrack: "",
      });
      return;
    }

    setHashingProgress({
      status: "running",
      processed: 0,
      total: unhashed.length,
      currentTrack: "",
    });

    const dirHandle = await getDirectoryHandle();
    if (!dirHandle) {
      setHashingProgress({
        status: "error",
        processed: 0,
        total: unhashed.length,
        currentTrack: "No directory access",
      });
      return;
    }

    const updatedTracks: LibraryTrack[] = [];

    for (let i = 0; i < unhashed.length; i++) {
      if (abortRef.current) {
        setHashingProgress((prev) => ({
          ...prev,
          status: "cancelled",
        }));
        break;
      }

      const track = unhashed[i];
      setHashingProgress({
        status: "running",
        processed: i,
        total: unhashed.length,
        currentTrack: `${track.artist} - ${track.title}`,
      });

      try {
        const fileHandle = await resolveFileHandle(dirHandle, track.path);
        if (!fileHandle) continue;

        const file = await fileHandle.getFile();
        const hash = await computeAudioHash(file);

        const updated: LibraryTrack = { ...track, audioHash: hash };
        await putTracks([updated]);
        updatedTracks.push(updated);
      } catch {
        // Skip files that fail to decode
      }
    }

    // Batch update atom
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
      setHashingProgress({
        status: "complete",
        processed: unhashed.length,
        total: unhashed.length,
        currentTrack: "",
      });
    }
  }, [tracks, setHashingProgress, setTracks]);

  const abortHashing = useCallback(() => {
    abortRef.current = true;
  }, []);

  const resetHashingProgress = useCallback(() => {
    setHashingProgress({
      status: "idle",
      processed: 0,
      total: 0,
      currentTrack: "",
    });
  }, [setHashingProgress]);

  /** Find duplicates by metadata (instant, no file access needed). */
  const scanMetadataDuplicates = useCallback(() => {
    const groups = findMetadataDuplicates(tracks);
    setDuplicateGroups(groups);
    return groups;
  }, [tracks, setDuplicateGroups]);

  /** Find duplicates by audio hash (requires hashes to be computed first). */
  const scanAudioHashDuplicates = useCallback(() => {
    const groups = findAudioHashDuplicates(tracks);
    setDuplicateGroups(groups);
    return groups;
  }, [tracks, setDuplicateGroups]);

  const hashedCount = tracks.filter((t) => t.audioHash).length;

  return {
    hashingProgress,
    hashedCount,
    totalCount: tracks.length,
    computeHashes,
    abortHashing,
    resetHashingProgress,
    scanMetadataDuplicates,
    scanAudioHashDuplicates,
  };
}
