/**
 * Tag writing service for audio files.
 * - MP3/M4A/AAC: uses mp3tag.js (ID3v2 / MP4 atoms)
 * - FLAC: uses custom Vorbis Comment writer
 * - Other formats (OGG, WAV, WMA, etc.): not supported, DB only
 *
 * Uses File System Access API to write back to disk.
 */

import MP3Tag from "mp3tag.js";
import {
  updateFlacVorbisComments,
  type VorbisCommentUpdates,
} from "./flac-writer";

const WRITABLE_FORMATS = new Set(["mp3", "m4a", "aac", "flac"]);

export interface TagUpdates {
  genre?: string;
  bpm?: number;
  year?: number;
}

/**
 * Check if a file format supports tag writing.
 */
export function canWriteTags(format: string): boolean {
  return WRITABLE_FORMATS.has(format.toLowerCase());
}

/**
 * Write metadata tags to an audio file via its FileSystemFileHandle.
 * Returns false if the format is unsupported or writing failed.
 */
export async function writeTagsToFile(
  fileHandle: FileSystemFileHandle,
  format: string,
  updates: TagUpdates,
): Promise<boolean> {
  const fmt = format.toLowerCase();
  if (!canWriteTags(fmt)) return false;

  if (fmt === "flac") {
    return writeFlacTags(fileHandle, updates);
  }
  return writeMp3Tags(fileHandle, updates);
}

// ---- FLAC (Vorbis Comments) ----

async function writeFlacTags(
  fileHandle: FileSystemFileHandle,
  updates: TagUpdates,
): Promise<boolean> {
  try {
    const file = await fileHandle.getFile();
    const buffer = await file.arrayBuffer();

    const vcUpdates: VorbisCommentUpdates = {};
    if (updates.genre !== undefined) vcUpdates["GENRE"] = updates.genre;
    if (updates.bpm !== undefined) vcUpdates["BPM"] = String(updates.bpm);
    if (updates.year !== undefined) vcUpdates["DATE"] = String(updates.year);

    if (Object.keys(vcUpdates).length === 0) return false;

    const newBuffer = updateFlacVorbisComments(buffer, vcUpdates);

    const writable = await fileHandle.createWritable();
    await writable.write(newBuffer);
    await writable.close();
    return true;
  } catch (err) {
    console.warn(`Failed to write FLAC tags for ${fileHandle.name}:`, err);
    return false;
  }
}

// ---- MP3 / M4A / AAC (ID3v2 via mp3tag.js) ----

async function writeMp3Tags(
  fileHandle: FileSystemFileHandle,
  updates: TagUpdates,
): Promise<boolean> {
  const file = await fileHandle.getFile();
  const buffer = await file.arrayBuffer();

  const mp3tag = new MP3Tag(buffer, false);
  mp3tag.read();

  if (mp3tag.error !== "") {
    console.warn(`Failed to read tags for ${fileHandle.name}:`, mp3tag.error);
    return false;
  }

  let changed = false;

  if (updates.genre !== undefined) {
    mp3tag.tags.genre = updates.genre;
    if (mp3tag.tags.v2) {
      mp3tag.tags.v2.TCON = updates.genre;
    }
    changed = true;
  }

  if (updates.bpm !== undefined) {
    if (mp3tag.tags.v2) {
      mp3tag.tags.v2.TBPM = String(updates.bpm);
    }
    changed = true;
  }

  if (updates.year !== undefined) {
    mp3tag.tags.year = String(updates.year);
    if (mp3tag.tags.v2) {
      mp3tag.tags.v2.TDRC = String(updates.year);
    }
    changed = true;
  }

  if (!changed) return false;

  mp3tag.save({ strict: false });

  if (mp3tag.error !== "") {
    console.warn(`Failed to save tags for ${fileHandle.name}:`, mp3tag.error);
    return false;
  }

  const writable = await fileHandle.createWritable();
  await writable.write(mp3tag.buffer);
  await writable.close();

  return true;
}
