/**
 * BPM detection using the web-audio-beat-detector library.
 *
 * Addresses the "octave error" problem (detecting 2x or 0.5x the actual tempo)
 * with two strategies:
 * 1. Multi-segment analysis — sample 3 windows from different parts of the track
 *    (skipping intro/outro), take the median for consistency.
 * 2. Perceptual normalization — halve or double the result into a reasonable
 *    range [70, 170] BPM, matching how DJ software (Traktor, rekordbox) works.
 */

import { analyze } from "web-audio-beat-detector";

/** Perceptual BPM range — most music is perceived in this window. */
const MIN_BPM = 70;
const MAX_BPM = 170;

/** Widen the detector's search range so we get raw results to normalize ourselves. */
const TEMPO_SETTINGS = { minTempo: 40, maxTempo: 220 };

/** Segment length in seconds for multi-window analysis. */
const SEGMENT_LENGTH = 15;

/**
 * Normalize a BPM value into the perceptual range by halving/doubling.
 * Corrects octave errors where the detector returns 2x or 0.5x the actual tempo.
 *
 * Examples: 260 → 130, 65 → 130, 43 → 86, 152 → 152
 */
function normalizeBpm(bpm: number): number {
  while (bpm > MAX_BPM) bpm /= 2;
  while (bpm < MIN_BPM) bpm *= 2;
  return Math.round(bpm);
}

/**
 * Detect BPM of an audio file using Web Audio API.
 * Returns the detected BPM rounded to nearest integer, or null on failure.
 */
export async function detectBpm(file: File): Promise<number | null> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioContext = new OfflineAudioContext(1, 1, 44100);
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const duration = audioBuffer.duration;

    // Short tracks (< 30s): analyze the whole buffer
    if (duration < 30) {
      const tempo = await analyze(audioBuffer, TEMPO_SETTINGS);
      return normalizeBpm(tempo);
    }

    // Longer tracks: sample multiple segments (skip intro/outro)
    const offsets = [
      duration * 0.2,
      duration * 0.4,
      duration * 0.6,
    ].filter((o) => o + SEGMENT_LENGTH <= duration);

    const tempos: number[] = [];
    for (const offset of offsets) {
      try {
        const tempo = await analyze(
          audioBuffer, offset, SEGMENT_LENGTH, TEMPO_SETTINGS,
        );
        tempos.push(tempo);
      } catch {
        // segment analysis can fail; continue with others
      }
    }

    // Fallback to full-buffer if all segments failed
    if (tempos.length === 0) {
      const tempo = await analyze(audioBuffer, TEMPO_SETTINGS);
      return normalizeBpm(tempo);
    }

    // Normalize each reading, then take the median
    const normalized = tempos.map(normalizeBpm);
    normalized.sort((a, b) => a - b);
    return normalized[Math.floor(normalized.length / 2)];
  } catch {
    return null;
  }
}
