import { apiGet, apiPost } from "./client";
import {
  userProfileSchema,
  setArlResponseSchema,
  userPlaylistsResponseSchema,
} from "./schemas";
import type { UserProfile, UserPlaylist } from "./types";

export async function fetchUserProfile(): Promise<UserProfile> {
  return apiGet("/user/me", userProfileSchema);
}

export async function setArl(
  arl: string,
): Promise<{ success: boolean; user: UserProfile }> {
  return apiPost("/user/arl", { arl }, setArlResponseSchema);
}

export async function fetchUserPlaylists(): Promise<UserPlaylist[]> {
  return apiGet("/user/playlists", userPlaylistsResponseSchema);
}
