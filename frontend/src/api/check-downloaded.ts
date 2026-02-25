import { apiPost } from "./client";
import { checkDownloadedResponseSchema } from "./schemas";
import type { CheckDownloadedItem, CheckDownloadedResponse } from "./types";

export async function checkDownloaded(
  items: CheckDownloadedItem[],
): Promise<CheckDownloadedResponse> {
  return apiPost("/check_downloaded", items, checkDownloadedResponseSchema);
}
