/**
 * Audio content hashing: decode audio to PCM, then SHA-256 hash.
 * Detects content-identical audio even in different containers/tags.
 */

/**
 * Compute an audio content hash for a file.
 *
 * 1. Decode audio to PCM using Web Audio API
 * 2. Mix to mono (if stereo)
 * 3. Take a representative segment (skip first 10%, take next 30s)
 * 4. Quantize to 16-bit integers (reduces floating-point noise)
 * 5. SHA-256 hash the samples
 */
export async function computeAudioHash(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();

  // Use OfflineAudioContext to decode (won't play audio)
  // Decode at 22050 Hz mono to normalize across sample rates
  const ctx = new OfflineAudioContext(1, 1, 22050);
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

  // Get mono channel data
  const channelData = audioBuffer.getChannelData(0);

  // Skip first 10% of audio (intros, silence) and take up to 30s
  const sampleRate = audioBuffer.sampleRate;
  const startSample = Math.floor(channelData.length * 0.1);
  const segmentSamples = Math.min(
    sampleRate * 30,
    channelData.length - startSample,
  );

  if (segmentSamples <= 0) {
    // Very short audio — hash entire buffer
    return hashSamples(channelData);
  }

  const segment = channelData.subarray(startSample, startSample + segmentSamples);
  return hashSamples(segment);
}

/**
 * Quantize Float32 samples to Int16 and compute SHA-256.
 */
async function hashSamples(samples: Float32Array): Promise<string> {
  // Quantize to 16-bit to reduce floating-point rounding differences
  const int16 = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    int16[i] = Math.round(clamped * 32767);
  }

  const hashBuffer = await crypto.subtle.digest("SHA-256", int16.buffer);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
