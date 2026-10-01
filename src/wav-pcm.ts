export interface PcmAudio {
  pcm: Buffer;
  channels: number;
  sampleRate: number;
  bitDepth: number;
}

/**
 * RIFF/WAV から PCM 本体とフォーマットを取り出す。
 * Gemini 3.x の WAV は data チャンクの後ろに C2PA チャンクが付くため、
 * ヘッダ長を決め打ちせずチャンクを順に辿る。
 */
export function parseWav(buffer: Buffer): PcmAudio {
  if (buffer.toString('latin1', 0, 4) !== 'RIFF' || buffer.toString('latin1', 8, 12) !== 'WAVE') {
    throw new Error('Not a RIFF/WAVE buffer');
  }
  let format: Omit<PcmAudio, 'pcm'> | undefined;
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('latin1', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ') {
      const audioFormat = buffer.readUInt16LE(body);
      if (audioFormat !== 1) throw new Error(`Unsupported WAV format: ${audioFormat}`);
      format = {
        channels: buffer.readUInt16LE(body + 2),
        sampleRate: buffer.readUInt32LE(body + 4),
        bitDepth: buffer.readUInt16LE(body + 14),
      };
    } else if (id === 'data') {
      if (!format) throw new Error('WAV data chunk appears before fmt chunk');
      return { ...format, pcm: buffer.subarray(body, Math.min(body + size, buffer.length)) };
    }
    offset = body + size + (size & 1);
  }
  throw new Error('WAV data chunk not found');
}

/** 同じフォーマットの PCM を、間に無音を挟んで連結する */
export function concatPcm(parts: PcmAudio[], gapSeconds: number): PcmAudio {
  if (parts.length === 0) throw new Error('No audio to concatenate');
  const [{ channels, sampleRate, bitDepth }] = parts;
  for (const part of parts) {
    if (part.channels !== channels || part.sampleRate !== sampleRate || part.bitDepth !== bitDepth) {
      throw new Error('Cannot concatenate PCM with different formats');
    }
  }
  const frameBytes = channels * (bitDepth / 8);
  const gap = Buffer.alloc(Math.round(gapSeconds * sampleRate) * frameBytes);
  const buffers = parts.flatMap((part, i) => (i === 0 ? [part.pcm] : [gap, part.pcm]));
  return { channels, sampleRate, bitDepth, pcm: Buffer.concat(buffers) };
}
