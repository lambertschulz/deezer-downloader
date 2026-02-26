/** BPM detection using the web-audio-beat-detector library. */

import { analyze } from "web-audio-beat-detector";

/**
 * Detect BPM of an audio file using Web Audio API.
 * Returns the detected BPM rounded to nearest integer, or null on failure.
 */
export async function detectBpm(file: File): Promise<number | null> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioContext = new OfflineAudioContext(1, 1, 44100);
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const tempo = await analyze(audioBuffer);
    return Math.round(tempo);
  } catch {
    return null;
  }
}
