import type { z } from "zod";
import type {
  searchTypeSchema,
  searchResultSchema,
  paginatedSearchResponseSchema,
  taskStateSchema,
  queueTaskSchema,
  checkDownloadedResponseSchema,
} from "./schemas";

export type SearchType = z.infer<typeof searchTypeSchema>;
export type SearchResult = z.infer<typeof searchResultSchema>;
export type PaginatedSearchResponse = z.infer<
  typeof paginatedSearchResponseSchema
>;
export type TaskState = z.infer<typeof taskStateSchema>;
export type QueueTask = z.infer<typeof queueTaskSchema>;
export type CheckDownloadedResponse = z.infer<
  typeof checkDownloadedResponseSchema
>;

export interface DownloadRequest {
  type: "track" | "album";
  music_id: number;
  add_to_playlist: boolean;
  create_zip: boolean;
  artist: string;
  title: string;
}

export interface DeezerPlaylistRequest {
  playlist_url: string;
  add_to_playlist: boolean;
  create_zip: boolean;
}

export interface DeezerFavoritesRequest {
  user_id: string;
  add_to_playlist: boolean;
  create_zip: boolean;
}

export interface CheckDownloadedItem {
  type: "track" | "album";
  id: string;
  artist: string;
  title: string;
}

export type DownloadStatus =
  | "idle"
  | "queued"
  | "downloading"
  | "done"
  | "failed";
