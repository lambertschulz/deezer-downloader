import { z } from "zod";

// --- Search ---

export const searchTypeSchema = z.enum([
  "track",
  "album",
  "artist",
  "album_track",
  "artist_album",
  "artist_top",
]);

export const searchResultSchema = z.object({
  id: z.string(),
  id_type: z.enum(["track", "album", "artist"]),
  title: z.string(),
  album: z.string(),
  album_id: z.union([z.string(), z.number()]),
  artist: z.string(),
  artist_id: z.number().optional(),
  img_url: z.string(),
  preview_url: z.string(),
});

export const paginatedSearchResponseSchema = z.object({
  data: z.array(searchResultSchema),
  total: z.number(),
});

// album_track returns a plain array, everything else returns { data, total }
export const searchResponseSchema = z.union([
  z.array(searchResultSchema),
  paginatedSearchResponseSchema,
]);

// --- Queue ---

export const taskStateSchema = z.enum([
  "waiting",
  "active",
  "mission accomplished",
  "failed",
]);

export const queueTaskSchema = z.object({
  id: z.number(),
  description: z.string(),
  args: z.string(),
  state: taskStateSchema,
  result: z.unknown().nullable(),
  exception: z.string().nullable(),
  progress: z.tuple([z.number(), z.number()]),
  metadata: z
    .object({
      artist: z.string().optional(),
      title: z.string().optional(),
      type: z.string().optional(),
    })
    .optional(),
});

export const queueResponseSchema = z.array(queueTaskSchema);

// --- Download ---

export const downloadResponseSchema = z.object({
  task_id: z.number(),
});

// --- Check Downloaded ---

export const checkDownloadedResponseSchema = z.record(z.string(), z.boolean());

// --- Debug ---

export const debugResponseSchema = z.object({
  debug_msg: z.string(),
});

// --- User ---

export const userProfileSchema = z.object({
  user_id: z.string(),
  name: z.string(),
  picture: z.string(),
  picture_url: z.string(),
});

export const setArlResponseSchema = z.object({
  success: z.boolean(),
  user: userProfileSchema,
});

export const userPlaylistSchema = z.object({
  id: z.string(),
  title: z.string(),
  nb_tracks: z.number(),
  picture_url: z.string(),
  link: z.string(),
  is_loved_track: z.boolean(),
});

export const userPlaylistsResponseSchema = z.array(userPlaylistSchema);

// --- Config Paths ---

export const configPathsSchema = z.object({
  download_base: z.string(),
  library_path: z.string(),
  effective_library_path: z.string(),
});

// --- Error ---

export const apiErrorSchema = z.object({
  error: z.string(),
});
