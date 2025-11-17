#!/usr/bin/env bun
/**
 * Model downloader script for Scrapient LLM integration
 * Downloads recommended models for document analysis
 */

import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import path from 'path';

interface ModelInfo {
  name: string;
  url: string;
  size: string;
  description: string;
  recommended: boolean;
}

const MODELS: ModelInfo[] = [
  {
    name: 'llama-3.1-8b-instruct.gguf',
    url: 'https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf',
    size: '4.9GB',
    description: 'Llama 3.1 8B Instruct - Great for document analysis and structured output',
    recommended: true
  },
  {
    name: 'qwen2.5-7b-instruct.gguf',
    url: 'https://huggingface.co/bartowski/Qwen2.5-7B-Instruct-GGUF/resolve/main/Qwen2.5-7B-Instruct-Q4_K_M.gguf',
    size: '4.4GB',
    description: 'Qwen2.5 7B Instruct - Excellent for entity extraction and JSON output',
    recommended: true
  },
  {
    name: 'mistral-7b-instruct.gguf',
    url: 'https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF/resolve/main/mistral-7b-instruct-v0.2.Q4_K_M.gguf',
    size: '4.1GB',
    description: 'Mistral 7B Instruct - Fast inference for interactive queries',
    recommended: false
  }
];

async function downloadModel(model: ModelInfo): Promise<void> {
  const modelsDir = path.join(process.cwd(), 'models');
  const modelPath = path.join(modelsDir, model.name);

  // Create models directory if it doesn't exist
  if (!existsSync(modelsDir)) {
    await mkdir(modelsDir, { recursive: true });
    console.log(`Created models directory: ${modelsDir}`);
  }

  // Check if model already exists
  if (existsSync(modelPath)) {
    console.log(`✅ Model already exists: ${model.name}`);
    return;
  }

  console.log(`📥 Downloading ${model.name} (${model.size})...`);
  console.log(`📝 ${model.description}`);
  console.log(`🔗 URL: ${model.url}`);

  try {
    const response = await fetch(model.url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const totalSize = parseInt(response.headers.get('content-length') || '0');
    const file = Bun.file(modelPath);
    const writer = file.writer();

    let downloadedSize = 0;
    const reader = response.body?.getReader();

    if (!reader) {
      throw new Error('Failed to get response reader');
    }

    console.log(`📊 Progress: 0% (0/${Math.round(totalSize / 1024 / 1024)}MB)`);

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      writer.write(value);
      downloadedSize += value.length;

      const progress = totalSize > 0 ? (downloadedSize / totalSize * 100).toFixed(1) : '0';
      const downloadedMB = Math.round(downloadedSize / 1024 / 1024);
      const totalMB = Math.round(totalSize / 1024 / 1024);

      process.stdout.write(`\r📊 Progress: ${progress}% (${downloadedMB}/${totalMB}MB)`);
    }

    await writer.end();
    console.log(`\n✅ Successfully downloaded: ${model.name}`);

  } catch (error) {
    console.error(`\n❌ Failed to download ${model.name}:`, error);
    throw error;
  }
}

async function listModels(): Promise<void> {
  console.log('\n🤖 Available Models:\n');

  MODELS.forEach((model, index) => {
    const status = model.recommended ? '⭐ RECOMMENDED' : '📦 AVAILABLE';
    console.log(`${index + 1}. ${model.name}`);
    console.log(`   ${status} | Size: ${model.size}`);
    console.log(`   ${model.description}\n`);
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('🕷️ Scrapient Model Downloader\n');
    await listModels();
    console.log('Usage:');
    console.log('  bun scripts/download-model.ts <model-number>  # Download specific model');
    console.log('  bun scripts/download-model.ts recommended     # Download recommended models');
    console.log('  bun scripts/download-model.ts all            # Download all models');
    return;
  }

  const command = args[0];

  try {
    if (command === 'recommended') {
      console.log('📥 Downloading recommended models...\n');
      const recommendedModels = MODELS.filter(m => m.recommended);

      for (const model of recommendedModels) {
        await downloadModel(model);
        console.log('');
      }

      console.log('🎉 All recommended models downloaded!');

    } else if (command === 'all') {
      console.log('📥 Downloading all models...\n');

      for (const model of MODELS) {
        await downloadModel(model);
        console.log('');
      }

      console.log('🎉 All models downloaded!');

    } else {
      const modelIndex = parseInt(command) - 1;

      if (modelIndex >= 0 && modelIndex < MODELS.length) {
        const model = MODELS[modelIndex];
        console.log(`📥 Downloading ${model.name}...\n`);
        await downloadModel(model);
        console.log('\n🎉 Model downloaded successfully!');
      } else {
        console.error('❌ Invalid model number. Use "bun scripts/download-model.ts" to see available models.');
        process.exit(1);
      }
    }

    console.log('\n💡 Usage:');
    console.log('  Set LLM_MODEL_PATH environment variable or place model in ./models/');
    console.log('  Example: export LLM_MODEL_PATH="./models/llama-3.1-8b-instruct.gguf"');

  } catch (error) {
    console.error('❌ Download failed:', error);
    process.exit(1);
  }
}

if (import.meta.main) {
  await main();
}