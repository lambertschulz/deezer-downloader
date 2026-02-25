import { apiGet } from "./client";
import { queueResponseSchema } from "./schemas";
import type { QueueTask } from "./types";

export async function fetchQueue(): Promise<QueueTask[]> {
  return apiGet("/queue", queueResponseSchema);
}
