import { openDB, type IDBPDatabase } from "idb";
import type { LibraryTrack, LibraryScanState } from "./library-types";

const DB_NAME = "deezer-downloader-library";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getLibraryDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("tracks")) {
          const store = db.createObjectStore("tracks", { keyPath: "path" });
          store.createIndex("by-artist", "artist");
          store.createIndex("by-album", "album");
          store.createIndex("by-title", "title");
        }
        if (!db.objectStoreNames.contains("scanState")) {
          db.createObjectStore("scanState", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("handles")) {
          db.createObjectStore("handles", { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

// ---- Tracks ----

export async function getAllTracks(): Promise<LibraryTrack[]> {
  const db = await getLibraryDB();
  return db.getAll("tracks");
}

export async function getTrackCount(): Promise<number> {
  const db = await getLibraryDB();
  return db.count("tracks");
}

export async function putTracks(tracks: LibraryTrack[]): Promise<void> {
  const db = await getLibraryDB();
  const tx = db.transaction("tracks", "readwrite");
  for (const track of tracks) {
    tx.store.put(track);
  }
  await tx.done;
}

export async function removeTracks(paths: string[]): Promise<void> {
  const db = await getLibraryDB();
  const tx = db.transaction("tracks", "readwrite");
  for (const path of paths) {
    tx.store.delete(path);
  }
  await tx.done;
}

export async function clearTracks(): Promise<void> {
  const db = await getLibraryDB();
  await db.clear("tracks");
}

export async function getExistingIndex(): Promise<Map<string, number>> {
  const db = await getLibraryDB();
  const tracks = await db.getAll("tracks");
  const map = new Map<string, number>();
  for (const t of tracks) {
    map.set(t.path, t.lastModified);
  }
  return map;
}

// ---- Scan State ----

export async function getScanState(): Promise<LibraryScanState | undefined> {
  const db = await getLibraryDB();
  return db.get("scanState", "state");
}

export async function putScanState(state: LibraryScanState): Promise<void> {
  const db = await getLibraryDB();
  await db.put("scanState", state);
}

// ---- Directory Handle Persistence ----

export async function saveDirectoryHandle(
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  const db = await getLibraryDB();
  await db.put("handles", { id: "libraryDir", handle });
}

export async function getDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await getLibraryDB();
  const record = await db.get("handles", "libraryDir");
  return record?.handle ?? null;
}

export async function clearDirectoryHandle(): Promise<void> {
  const db = await getLibraryDB();
  await db.delete("handles", "libraryDir");
}
