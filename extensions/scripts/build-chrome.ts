#!/usr/bin/env bun

import { mkdir, readdir, copyFile } from 'node:fs/promises';
import { join } from 'node:path';

const buildChrome = async (): Promise<void> => {
  const sharedDir = 'extensions/shared';
  const chromeDir = 'extensions/chrome';
  const buildDir = join(chromeDir, 'build');

  try {
    await mkdir(buildDir, { recursive: true });

    console.log('📦 Building Chrome extension...');

    const transpileFile = async (inputPath: string, outputPath: string): Promise<void> => {
      const result = await Bun.build({
        entrypoints: [inputPath],
        target: 'browser',
        format: 'iife',
        minify: false
      });

      if (!result.success) {
        throw new Error(`Build failed for ${inputPath}: ${result.logs.join(', ')}`);
      }

      const output = await result.outputs[0].text();
      await Bun.write(outputPath, output);
    };

    await transpileFile(join(sharedDir, 'content.ts'), join(buildDir, 'content.js'));
    await transpileFile(join(sharedDir, 'popup.ts'), join(buildDir, 'popup.js'));

    const backgroundScript = `
// Chrome extension background script
console.log('Scrapient background script loaded');

chrome.runtime.onInstalled.addListener(() => {
  console.log('Scrapient extension installed');
});
    `.trim();

    await Bun.write(join(buildDir, 'background.js'), backgroundScript);

    await copyFile(join(chromeDir, 'manifest.json'), join(buildDir, 'manifest.json'));
    await copyFile(join(chromeDir, 'popup.html'), join(buildDir, 'popup.html'));

    console.log('✅ Chrome extension built successfully');
    console.log(`📁 Extension files ready in: ${buildDir}`);

  } catch (error) {
    console.error('❌ Chrome build failed:', error);
    process.exit(1);
  }
};

if (import.meta.main) {
  await buildChrome();
}