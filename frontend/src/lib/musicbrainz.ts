/** MusicBrainz API client for metadata enrichment (genre, release date). */

const API_BASE = "https://musicbrainz.org/ws/2";

/** Enforces MusicBrainz rate limit: max 1 request per second. */
let lastRequestTime = 0;

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < 1100) {
    await new Promise((r) => setTimeout(r, 1100 - elapsed));
  }
  lastRequestTime = Date.now();
  return fetch(url, {
    headers: { Accept: "application/json" },
  });
}

export interface MusicBrainzResult {
  genre: string | null;
  year: number | null;
}

/**
 * Search MusicBrainz for a recording by artist + title.
 * Returns the best-matching genre tag and first release year.
 */
export async function searchRecording(
  artist: string,
  title: string,
): Promise<MusicBrainzResult> {
  // Skip unknown/placeholder artists
  const trimmedArtist = artist.replace(/[()[\]]/g, "").trim();
  const trimmedTitle = title.replace(/[()[\]]/g, "").trim();

  if (
    !trimmedArtist ||
    !trimmedTitle ||
    trimmedArtist.toLowerCase() === "unknown artist"
  ) {
    return { genre: null, year: null };
  }

  // Quote multi-word terms for Lucene query syntax
  const quotedArtist = encodeURIComponent(`"${trimmedArtist}"`);
  const quotedTitle = encodeURIComponent(`"${trimmedTitle}"`);

  const url = `${API_BASE}/recording?query=artist:${quotedArtist}+AND+recording:${quotedTitle}&fmt=json&limit=3`;

  try {
    const res = await rateLimitedFetch(url);
    if (!res.ok) return { genre: null, year: null };

    const data = await res.json();
    const recordings = data.recordings as MBRecording[] | undefined;
    if (!recordings || recordings.length === 0) {
      return { genre: null, year: null };
    }

    // Pick the best match (highest score)
    const best = recordings[0];

    // ---- Extract genre ----
    let genre: string | null = null;

    // 1) Try recording-level tags
    if (best.tags && best.tags.length > 0) {
      genre = pickBestGenreTag(best.tags);
    }

    // 2) Fallback: try release-group-level tags
    if (!genre && best.releases) {
      for (const release of best.releases) {
        const rgTags = release["release-group"]?.tags;
        if (rgTags && rgTags.length > 0) {
          genre = pickBestGenreTag(rgTags);
          if (genre) break;
        }
      }
    }

    // ---- Extract year ----
    let year: number | null = null;
    const releaseDate =
      best["first-release-date"] ?? best.releases?.[0]?.date ?? null;
    if (releaseDate) {
      const parsed = parseInt(releaseDate.slice(0, 4), 10);
      if (!isNaN(parsed) && parsed > 1900 && parsed < 2100) {
        year = parsed;
      }
    }

    return { genre, year };
  } catch {
    return { genre: null, year: null };
  }
}

/**
 * If no results found via search, try a direct lookup by recording + artist.
 * Uses the browse API to get release-group tags.
 */
export async function lookupGenreByArtist(
  artist: string,
): Promise<string | null> {
  const trimmed = artist.replace(/[()[\]]/g, "").trim();
  if (!trimmed || trimmed.toLowerCase() === "unknown artist") return null;

  const quoted = encodeURIComponent(`"${trimmed}"`);
  const url = `${API_BASE}/artist?query=artist:${quoted}&fmt=json&limit=1`;

  try {
    const res = await rateLimitedFetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    const artists = data.artists as MBArtist[] | undefined;
    if (!artists || artists.length === 0) return null;

    const best = artists[0];
    if (best.tags && best.tags.length > 0) {
      return pickBestGenreTag(best.tags);
    }
    return null;
  } catch {
    return null;
  }
}

// ---- Helpers ----

function pickBestGenreTag(
  tags: { name: string; count?: number }[],
): string | null {
  // Filter out non-genre tags (very short or very generic)
  const genreTags = tags.filter(
    (t) => t.name.length >= 3 && !NON_GENRE_TAGS.has(t.name.toLowerCase()),
  );
  if (genreTags.length === 0) return null;

  const sorted = [...genreTags].sort(
    (a, b) => (b.count ?? 0) - (a.count ?? 0),
  );
  return capitalize(sorted[0].name);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Common MusicBrainz tags that aren't genres
const NON_GENRE_TAGS = new Set([
  "seen live",
  "favorite",
  "favourites",
  "love",
  "awesome",
  "cool",
  "classic",
  "featured",
  "remix",
  "single",
  "album",
  "compilation",
  "live",
]);

// ---- MusicBrainz response types (partial) ----

interface MBRecording {
  id: string;
  title: string;
  score?: number;
  "first-release-date"?: string;
  tags?: { name: string; count?: number }[];
  releases?: {
    id: string;
    title: string;
    date?: string;
    "release-group"?: {
      "primary-type"?: string;
      tags?: { name: string; count?: number }[];
    };
  }[];
}

interface MBArtist {
  id: string;
  name: string;
  tags?: { name: string; count?: number }[];
}
