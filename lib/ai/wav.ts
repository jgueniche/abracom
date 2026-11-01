/**
 * Wraps raw PCM in a WAV header. Gemini-TTS on Vertex AI answers with 16-bit mono PCM at
 * 24 kHz and no container (docs, 2026-10); every browser plays the same samples as a WAV.
 */
export function pcmToWav(
  pcm: Buffer,
  sampleRate = 24000,
  channels = 1,
  bitsPerSample = 16,
): Buffer {
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/** The sample rate a `audio/L16;codec=pcm;rate=24000` MIME type names, or the default. */
export function sampleRateOf(mimeType: string | undefined, fallback = 24000): number {
  const match = /rate=(\d+)/.exec(mimeType ?? "");
  return match ? Number(match[1]) : fallback;
}
