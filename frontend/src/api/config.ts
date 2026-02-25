import { apiGet, apiPost } from "./client";
import { configPathsSchema } from "./schemas";
import type { ConfigPaths } from "./types";

export async function fetchConfigPaths(): Promise<ConfigPaths> {
  return apiGet("/config/paths", configPathsSchema);
}

export async function updateConfigPaths(
  paths: Partial<{ download_base: string; library_path: string }>,
): Promise<ConfigPaths> {
  return apiPost("/config/paths", paths, configPathsSchema);
}
