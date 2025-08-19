import 'dotenv/config';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { processFiles } from './fileProcessor';
import * as path from 'path';
import * as fs from 'fs';

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option('input-dir', {
      alias: 'i',
      type: 'string',
      description: 'Directory containing input .txt files',
      default: 'inputs',
    })
    .option('bgm', {
      alias: 'b',
      type: 'string',
      description: 'Path to the background music file (optional)',
    })
    .option('output-dir', {
      alias: 'o',
      type: 'string',
      description: 'Directory to save the output .mp3 files',
      default: 'outputs',
    })
    .demandOption([], 'Please provide all required arguments. Or just run without arguments to use defaults.')
    .help()
    .alias('help', 'h')
    .usage('Usage: $0 -i [input_dir] -b [bgm_path] -o [output_dir]')
    .example('$0', 'Run with default directories (inputs, outputs) and no BGM')
    .example('$0 -i ./scripts -b ./music/bgm.mp3 -o ./podcasts', 'Run with custom paths')
    .parse();

  // Resolve paths to be absolute
  const inputDir = path.resolve(argv['input-dir']);
  const outputDir = path.resolve(argv['output-dir']);
  const bgmPath = argv.bgm ? path.resolve(argv.bgm) : undefined;

  // Ensure directories exist
  if (!fs.existsSync(inputDir)) {
    console.error(`Error: Input directory not found at ${inputDir}`);
    process.exit(1);
  }
  if (bgmPath && !fs.existsSync(bgmPath)) {
    console.error(`Error: BGM file not found at ${bgmPath}`);
    process.exit(1);
  }
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('--- Podcast Generation Tool ---');
  console.log(`Input Directory: ${inputDir}`);
  console.log(`Output Directory: ${outputDir}`);
  console.log(`BGM File: ${bgmPath || 'Not specified'}`);
  console.log('-------------------------------');

  try {
    await processFiles(inputDir, bgmPath, outputDir);
  } catch (error) {
    console.error('\nAn unexpected error occurred:', error);
    process.exit(1);
  }
}

main().catch(console.error);
