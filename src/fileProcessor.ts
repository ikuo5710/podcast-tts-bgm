import { GraphAI, GraphData } from 'graphai';
import { ttsAgent, mixBgmAgent } from './agents';
import { mapAgent as mapAgentInfo } from '@graphai/vanilla/lib/graph_agents';
import * as fs from 'fs/promises';
import * as path from 'path';

// GraphAIの並列実行数を設定。APIのレートリミットやマシンスペックに応じて調整します。
const CONCURRENCY = 10;

/**
 * 指定されたディレクトリ内の全テキストファイルを対象に、
 * TTSとBGM合成を並列実行するGraphAIの処理を組み立てて実行する
 * 
 * @param inputDir テキストファイルが格納されているディレクトリ
 * @param bgmFilePath BGMファイルのパス
 * @param outputDir 生成された音声ファイルの保存先ディレクトリ
 */
export async function processFiles(inputDir: string, bgmFilePath: string | undefined, outputDir: string) {
  // 1. 入力ディレクトリから.txtファイルの一覧を取得
  const allFiles = await fs.readdir(inputDir);
  const textFiles = allFiles
    .filter(file => file.toLowerCase().endsWith('.txt'))
    .map(file => path.join(inputDir, file));

  if (textFiles.length === 0) {
    console.log('No text files found in the input directory.');
    return;
  }

  console.log(`Found ${textFiles.length} text files to process.`);

  // 2. GraphAIのグラフを定義
  const graphData: GraphData = {
    version: 0.5,
    concurrency: CONCURRENCY,
    nodes: {
      // 全テキストファイルのパスを初期値として設定
      textFiles: {
        value: textFiles,
      },
      // mapAgentを使って、各ファイルに対してTTSとBGM合成を並列実行
      processedPodcasts: {
        agent: 'mapAgent',
        inputs: {
          // textFilesノードの各要素をループ
          rows: ':textFiles',
        },
        // mapAgent内で実行されるサブグラフ
        graph: {
          nodes: {
            // TTSエージェントを実行
            tts: {
              agent: 'ttsAgent',
              inputs: {
                textFilePath: ':row', // mapAgentから渡されるファイルパス
                outputDir: outputDir,
              },
            },
            // BGMミックスエージェントを実行
            mixBgm: {
              agent: 'mixBgmAgent',
              inputs: {
                speechFilePath: ':tts', // ttsノードの実行結果（音声ファイルパス）
                bgmFilePath: bgmFilePath,
                outputDir: outputDir,
              },
            },
          },
        },
      },
    },
  };

  // 3. GraphAIを実行
  const graph = new GraphAI(graphData, { mapAgent: mapAgentInfo, ttsAgent, mixBgmAgent });

  console.log('\nStarting podcast generation...');
  const results = await graph.run();
  console.log('\n--- All files processed! ---');
  const generatedFiles = results.processedPodcasts as string[];
  if (generatedFiles && Array.isArray(generatedFiles)) {
    console.log('Generated files:');
    generatedFiles.forEach(file => console.log(`- ${file}`));
  }
}
