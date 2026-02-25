import { apiPost } from "./client";
import { downloadResponseSchema } from "./schemas";
import type {
  DownloadRequest,
  DeezerPlaylistRequest,
  DeezerFavoritesRequest,
} from "./types";

export async function downloadTrackOrAlbum(req: DownloadRequest) {
  return apiPost("/download", req, downloadResponseSchema);
}

export async function downloadDeezerPlaylist(req: DeezerPlaylistRequest) {
  return apiPost("/playlist/deezer", req, downloadResponseSchema);
}

export async function downloadDeezerFavorites(req: DeezerFavoritesRequest) {
  return apiPost("/favorites/deezer", req, downloadResponseSchema);
}
