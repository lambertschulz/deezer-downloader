import { apiPost } from "./client";
import { searchResponseSchema } from "./schemas";
import type { SearchType, SearchResult, PaginatedSearchResponse } from "./types";

export async function searchDeezer(
  type: SearchType,
  query: string,
  index = 0,
): Promise<SearchResult[] | PaginatedSearchResponse> {
  return apiPost("/search", { type, query, index }, searchResponseSchema);
}

/** Normalize any search response to { data, total } */
export function normalizeSearchResponse(
  response: SearchResult[] | PaginatedSearchResponse,
): PaginatedSearchResponse {
  if (Array.isArray(response)) {
    return { data: response, total: response.length };
  }
  return response;
}
