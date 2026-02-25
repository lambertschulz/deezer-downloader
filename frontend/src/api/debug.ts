import { apiGet } from "./client";
import { debugResponseSchema } from "./schemas";

export async function fetchDebugLog(): Promise<string> {
  const data = await apiGet("/debug", debugResponseSchema);
  return data.debug_msg;
}
