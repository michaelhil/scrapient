#!/usr/bin/env bun

import { LLMService } from '../src/services/llm/LLMService';

interface PerformanceMetrics {
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalTimeMs: number;
  tokensPerSecond: number;
  promptText: string;
  response: string;
}

const measureLLMPerformance = async (): Promise<PerformanceMetrics> => {
  console.log('🔧 Initializing LLM Service for performance testing...');

  const llmService = new LLMService();
  await llmService.initialize();

  const promptText = `Explain the concept of artificial intelligence and machine learning in detail.
Cover the following topics:
1. Definition and history of AI
2. Different types of machine learning (supervised, unsupervised, reinforcement)
3. Key algorithms and their applications
4. Current limitations and future prospects
5. Ethical considerations

Provide a comprehensive explanation with examples and real-world applications.`;

  console.log('📝 Starting LLM generation...');
  console.log(`📏 Prompt length: ${promptText.length} characters`);

  const startTime = Date.now();

  const response = await llmService.complete(promptText, {
    maxTokens: 1000,
    temperature: 0.7,
    topP: 0.9
  });

  const endTime = Date.now();
  const totalTimeMs = endTime - startTime;

  // Estimate token counts (rough approximation: ~4 characters per token for English)
  const promptTokens = Math.ceil(promptText.length / 4);
  const completionTokens = Math.ceil(response.length / 4);
  const totalTokens = promptTokens + completionTokens;
  const tokensPerSecond = (completionTokens / totalTimeMs) * 1000;

  return {
    totalTokens,
    promptTokens,
    completionTokens,
    totalTimeMs,
    tokensPerSecond,
    promptText,
    response
  };
};

const main = async (): Promise<void> => {
  try {
    console.log('🚀 Starting Llama 3.1 8B Performance Test\n');

    const metrics = await measureLLMPerformance();

    console.log('\n📊 PERFORMANCE RESULTS:');
    console.log('================================');
    console.log(`🎯 Model: Llama 3.1 8B Instruct (GGUF)`);
    console.log(`📁 Model Size: 4.9GB`);
    console.log(`⏱️  Total Generation Time: ${metrics.totalTimeMs.toLocaleString()}ms (${(metrics.totalTimeMs / 1000).toFixed(2)}s)`);
    console.log(`🔤 Prompt Tokens: ${metrics.promptTokens.toLocaleString()}`);
    console.log(`✨ Completion Tokens: ${metrics.completionTokens.toLocaleString()}`);
    console.log(`📈 Total Tokens: ${metrics.totalTokens.toLocaleString()}`);
    console.log(`🚄 Generation Speed: ${metrics.tokensPerSecond.toFixed(2)} tokens/second`);
    console.log(`📝 Response Length: ${metrics.response.length.toLocaleString()} characters`);
    console.log('================================\n');

    console.log('📖 GENERATED RESPONSE:');
    console.log('--------------------------------');
    console.log(metrics.response);
    console.log('--------------------------------\n');

    // Performance analysis
    const performanceClass = metrics.tokensPerSecond > 50 ? '🟢 Excellent' :
                           metrics.tokensPerSecond > 25 ? '🟡 Good' :
                           metrics.tokensPerSecond > 10 ? '🟠 Moderate' : '🔴 Slow';

    console.log('💡 PERFORMANCE ANALYSIS:');
    console.log(`Speed Rating: ${performanceClass}`);

    if (metrics.tokensPerSecond > 25) {
      console.log('✅ Suitable for real-time applications');
    } else if (metrics.tokensPerSecond > 10) {
      console.log('⚠️  Acceptable for non-real-time applications');
    } else {
      console.log('❌ Too slow for most interactive applications');
    }

    console.log(`\n🎯 For reference:`);
    console.log(`   • ChatGPT-4: ~40-60 tokens/s`);
    console.log(`   • Local models typically: 5-50 tokens/s`);
    console.log(`   • Your result: ${metrics.tokensPerSecond.toFixed(2)} tokens/s`);

  } catch (error) {
    console.error('❌ Performance test failed:', error);
    process.exit(1);
  }
};

main();