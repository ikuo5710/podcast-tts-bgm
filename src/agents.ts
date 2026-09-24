import { AgentFunctionInfo } from 'graphai';
import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs/promises';
import * as path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import wav from 'wav';

// Setup ffmpeg
ffmpeg.setFfmpegPath(ffmpegPath as string);
ffmpeg.setFfprobePath(ffprobeStatic.path);

// Setup Google GenAI
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error('GEMINI_API_KEY is not set in the environment variables.');
}
const genAI = new GoogleGenAI({ apiKey });
const ttsModel = process.env.TTS_MODEL || 'gemini-3.8-flash-tts';
const ttsVoice = process.env.TTS_VOICE || 'Orus';
// Gemini 3.x TTS は本文を逐語で読み上げるため、話し方の指示は speechMetadata 側に渡す
const ttsStyle = process.env.TTS_STYLE || '自然で聞きやすいポッドキャスト風の、落ち着いた話し方';

async function saveWaveFile(
  filename: string,
  pcmData: Buffer,
  channels = 1,
  rate = 24000,
  sampleWidth = 2,
) {
  return new Promise((resolve, reject) => {
    const writer = new wav.FileWriter(filename, {
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });

    writer.on('finish', resolve);
    writer.on('error', reject);

    writer.write(pcmData);
    writer.end();
  });
}

// Helper function to promisify ffprobe
const ffprobePromise = (filePath: string): Promise<ffmpeg.FfprobeData> => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return reject(err);
      resolve(data);
    });
  });
};

/**
 * Agent to convert a text file to speech using Gemini TTS.
 * It produces a temporary WAV file.
 */
export const ttsAgent: AgentFunctionInfo = {
  name: 'ttsAgent',
  agent: async ({ namedInputs }) => {
    const { textFilePath, outputDir } = namedInputs as { textFilePath: string; outputDir: string };

    console.log(`[TTS] Starting: ${path.basename(textFilePath)}`);

    const textContent = await fs.readFile(textFilePath, 'utf-8');

    const result = await genAI.models.generateContent({
      model: ttsModel,
      contents: [
        {
          parts: [
            {
              // 本文のみを渡す。指示文を混ぜると Gemini 3.x ではそのまま読み上げられる
              text: textContent,
              speechMetadata: { style: ttsStyle },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: ttsVoice },
          },
        },
      },
    });

    const inlineData = result.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!inlineData?.data) {
      throw new Error(`[TTS] Failed to get audio data for ${textFilePath}`);
    }

    const audioBuffer = Buffer.from(inlineData.data, 'base64');
    const tempWavPath = path.join(outputDir, `temp_${path.basename(textFilePath, '.txt')}.wav`);
    // Gemini 3.x は RIFF ヘッダ付きの audio/wav を返すのでそのまま書き出す。
    // 2.5 系はヘッダなしの raw PCM (audio/l16) なので WAV ヘッダを付与する。
    if (inlineData.mimeType?.startsWith('audio/wav')) {
      await fs.writeFile(tempWavPath, audioBuffer);
    } else {
      await saveWaveFile(tempWavPath, audioBuffer);
    }

    console.log(`[TTS] Completed: ${path.basename(tempWavPath)}`);
    return tempWavPath;
  },
  mock: async () => 'mock_tts_path.wav',
  inputs: {
    type: 'object',
    properties: {
      textFilePath: { type: 'string', description: 'Path to the input text file' },
      outputDir: { type: 'string', description: 'Directory to save the temporary WAV file' },
    },
  },
  output: { type: 'string', description: 'Path to the generated temporary WAV file' },
  samples: [],
  description: 'Converts a text file to speech using Gemini TTS and saves it as a temporary WAV file.',
  category: ['tts', 'google'],
  author: 'Gemini',
  repository: 'n/a',
  license: 'ISC',
};

/**
 * Agent to mix a speech file with a BGM file.
 * It uses ffmpeg with sidechain compression for professional-sounding results.
 */
export const mixBgmAgent: AgentFunctionInfo = {
  name: 'mixBgmAgent',
  agent: async ({ namedInputs }) => {
    const { speechFilePath, bgmFilePath, outputDir } = namedInputs as { speechFilePath: string; bgmFilePath: string; outputDir: string };

    if (!speechFilePath) {
      console.warn('[BGM] Skipping mix for empty speech file input.');
      return null;
    }

    const speechFileName = path.basename(speechFilePath).replace('temp_', '').replace('.wav', '');
    const finalOutputName = `${speechFileName}.mp3`;
    const finalOutputPath = path.join(outputDir, finalOutputName);

    console.log(`[BGM] Starting mix for: ${finalOutputName}`);

    // If no BGM is provided, just convert to MP3 and return.
    if (!bgmFilePath) {
      return new Promise<string>((resolve, reject) => {
        ffmpeg(speechFilePath)
          .audioCodec('libmp3lame')
          .audioBitrate('192k')
          .on('error', (err) => reject(new Error(`[BGM] Error converting to MP3: ${err.message}`)))
          .on('end', () => {
            console.log(`[BGM] Converted to MP3 (no BGM): ${finalOutputName}`);
            fs.unlink(speechFilePath); // Clean up temp wav file
            resolve(finalOutputPath);
          })
          .save(finalOutputPath);
      });
    }

    // With BGM, perform the mix with sidechain compression.
    const speechMetadata = await ffprobePromise(speechFilePath);
    const speechDuration = speechMetadata.format.duration;
    if (speechDuration === undefined) {
      throw new Error('[BGM] Could not get speech duration.');
    }

    // スピーチ音声終了後3秒（BGMフェードアウト用）
    const totalDuration = speechDuration + 3.0;

    return new Promise<string>((resolve, reject) => {
      // 重要: -stream_loop -1 は BGM 入力だけに適用
      const command = ffmpeg()
        .input(speechFilePath)                 // [0]
        .input(bgmFilePath)                    // [1]
        .inputOptions(['-stream_loop', '-1']); // 直前の input(bgm) にだけ適用（fluent-ffmpegではこの位置でOK）

      const filter = [
        // Voice: 正規化→分岐（mix用/サイドチェイン用）→ mix用だけTSを0始まりに
        '[0:a]loudnorm=I=-16:TP=-1.5:LRA=11,asplit=2[voice_mix_raw][voice_key_raw]',
        '[voice_mix_raw]asetpts=PTS-STARTPTS[voice_mix]',
        // サイドチェイン用: totalDurationまで無音パディング（voice_keyが先に終わるとsidechaincompressも止まるため）
        `[voice_key_raw]asetpts=PTS-STARTPTS,apad=whole_dur=${totalDuration.toFixed(3)}[voice_key]`,

        // BGM: INフェード→TSを0始まり→サイドチェイン圧縮
        '[1:a]volume=0.18,afade=t=in:st=0:d=2,asetpts=PTS-STARTPTS[bgm0]',
        '[bgm0][voice_key]sidechaincompress=threshold=0.08:ratio=8:attack=5:release=250:makeup=1[ducked_sc]',

        // ▼順序を入れ替え：まず「ボイス＋3秒」で切る → TSを0始まり → 末尾3秒でフェードアウト
        `[ducked_sc]atrim=start=0:end=${(totalDuration).toFixed(3)},asetpts=PTS-STARTPTS[ducked_cut]`,
        `[ducked_cut]afade=t=out:st=${(totalDuration - 3).toFixed(3)}:d=3[ducked]`,

        // Mix（最長に合わせてBGMテールを残す）
        `[voice_mix][ducked]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0[out]`,
      ].join(';');

      command
        .complexFilter(filter, 'out')
        .audioFrequency(48000)
        .audioCodec('libmp3lame')
        .audioBitrate('192k')
        .on('error', (err) => reject(new Error(`[BGM] Error mixing audio: ${err.message}`)))
        .on('end', () => {
          console.log(`[BGM] Mix completed: ${finalOutputName}`);
          fs.unlink(speechFilePath);
          resolve(finalOutputPath);
        })
        .save(finalOutputPath);
    });
  },
  mock: async () => 'mock_mixed_path.mp3',
  inputs: {
    type: 'object',
    properties: {
      speechFilePath: { type: 'string', description: 'Path to the temporary speech WAV file' },
      bgmFilePath: { type: 'string', description: 'Path to the BGM file' },
      outputDir: { type: 'string', description: 'Directory to save the final MP3 file' },
    },
  },
  output: { type: 'string', description: 'Path to the final mixed MP3 file' },
  samples: [],
  description: 'Mixes a speech WAV file with a BGM file into a final MP3 file.',
  category: ['audio', 'ffmpeg'],
  author: 'Gemini',
  repository: 'n/a',
  license: 'ISC',
};

