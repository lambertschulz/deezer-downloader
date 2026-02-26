/**
 * Shared file-access utilities for enrichment hooks.
 * Wraps the File System Access API for resolving file handles
 * and ensuring directory permissions.
 */

import { getDirectoryHandle } from "./library-db";

/**
 * Resolve a FileSystemFileHandle for a track by walking the directory tree.
 */
export async function resolveFileHandle(
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
 * Tries readwrite first (needed for tag writing), falls back to read-only.
 * Returns the handle with permission granted, or null.
 */
export async function ensureDirectoryAccess(): Promise<FileSystemDirectoryHandle | null> {
  const handle = await getDirectoryHandle();
  if (!handle) return null;

  try {
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
