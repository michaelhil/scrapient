#!/usr/bin/env bun

import { execSync } from 'child_process';
import { existsSync } from 'fs';

const checkDockerAvailability = (): boolean => {
  try {
    execSync('docker --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

const checkMongoConnection = async (): Promise<boolean> => {
  try {
    const response = await fetch('http://localhost:27017');
    return response.status === 200;
  } catch {
    return false;
  }
};

const buildExtension = async (): Promise<void> => {
  console.log('📦 Building Chrome extension...');
  try {
    execSync('bun extensions/scripts/build-chrome.ts', { stdio: 'inherit' });
    console.log('✅ Chrome extension built successfully');
  } catch (error) {
    console.error('❌ Extension build failed:', error);
    process.exit(1);
  }
};

const startMongoDB = (): void => {
  console.log('🐳 Starting MongoDB with Docker...');
  try {
    execSync('docker-compose up -d', { stdio: 'inherit' });
    console.log('✅ MongoDB started');
  } catch (error) {
    console.error('❌ Failed to start MongoDB:', error);
    console.log('\n📋 Manual MongoDB setup:');
    console.log('1. Install MongoDB locally or use MongoDB Atlas');
    console.log('2. Update MONGO_URI environment variable');
    console.log('3. Run: bun run dev');
    process.exit(1);
  }
};

const waitForMongo = async (): Promise<void> => {
  console.log('⏳ Waiting for MongoDB to be ready...');

  for (let i = 0; i < 30; i++) {
    const isReady = await checkMongoConnection();
    if (isReady) {
      console.log('✅ MongoDB is ready');
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('⚠️  MongoDB may not be fully ready yet, but continuing...');
};

const showExtensionInstructions = (): void => {
  console.log('\n🔧 Chrome Extension Setup:');
  console.log('1. Open Chrome and go to: chrome://extensions/');
  console.log('2. Enable "Developer mode" (toggle in top-right)');
  console.log('3. Click "Load unpacked"');
  console.log('4. Select folder: extensions/chrome/build/');
  console.log('5. Pin the extension to your toolbar');
  console.log('\n⌨️  Usage:');
  console.log('• Extension popup: Click the Scrapient icon');
  console.log('• Keyboard shortcut: Ctrl+Shift+S (Cmd+Shift+S on Mac)');
  console.log('• Dashboard: http://localhost:3001');
};

const main = async (): Promise<void> => {
  console.log('🕷️ Setting up Scrapient...\n');

  if (!checkDockerAvailability()) {
    console.log('⚠️  Docker not available. You\'ll need to set up MongoDB manually.');
  } else {
    startMongoDB();
    await waitForMongo();
  }

  await buildExtension();

  console.log('\n🚀 Setup complete!');
  showExtensionInstructions();

  console.log('\n📖 Next steps:');
  console.log('1. Load the Chrome extension (see instructions above)');
  console.log('2. Run: bun run dev');
  console.log('3. Open: http://localhost:3001');
  console.log('4. Start scraping pages with Ctrl+Shift+S!');
};

if (import.meta.main) {
  await main();
}