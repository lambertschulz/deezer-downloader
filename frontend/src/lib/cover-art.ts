/**
 * Cover art extraction from audio files via music-metadata.
 * Extracts embedded album art and returns it as a Blob.
 */

import { parseBlob } from "music-metadata";
import { resolveFileHandle } from "./file-access";

/**
 * Extract cover art from an audio file.
 * Returns the first embedded picture as a Blob, or null if none found.
 */
export async function extractCoverFromFile(
  dirHandle: FileSystemDirectoryHandle,
  trackPath: string,
): Promise<Blob | null> {
  try {
    const fileHandle = await resolveFileHandle(dirHandle, trackPath);
    if (!fileHandle) return null;

    const file = await fileHandle.getFile();
    const metadata = await parseBlob(file);
    const pictures = metadata.common.picture;

    if (!pictures || pictures.length === 0) return null;

    const pic = pictures[0];
    return new Blob([pic.data], { type: pic.format });
  } catch {
    return null;
  }
}
