/**
 * BPM detection using the web-audio-beat-detector library.
 *
 * - Single segment analysis at ~30% into the track (skips intro)
 * - normalizeBpm() corrects octave errors (2x/0.5x) into [70, 170] range
 */

import { analyze } from "web-audio-beat-detector";

/** Perceptual BPM range — most music is perceived in this window. */
const MIN_BPM = 70;
const MAX_BPM = 170;

/** Widen the detector's search range so we get raw results to normalize ourselves. */
const TEMPO_SETTINGS = { minTempo: 40, maxTempo: 220 };

/**
 * Normalize a BPM value into the perceptual range by halving/doubling.
 * Corrects octave errors where the detector returns 2x or 0.5x the actual tempo.
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

    // For tracks > 30s: analyze a single 15s segment at ~30% (skip intro)
    if (duration > 30) {
      const offset = duration * 0.3;
      if (offset + 15 <= duration) {
        try {
          const tempo = await analyze(audioBuffer, offset, 15, TEMPO_SETTINGS);
          return normalizeBpm(tempo);
        } catch {
          // segment failed, fall through to full-buffer
        }
      }
    }

    // Short tracks or segment fallback: analyze the whole buffer
    const tempo = await analyze(audioBuffer, TEMPO_SETTINGS);
    return normalizeBpm(tempo);
  } catch {
    return null;
  }
}
