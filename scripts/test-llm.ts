#!/usr/bin/env bun
/**
 * Test script for Scrapient LLM integration
 * Tests basic functionality with downloaded models
 */

import { LLMService } from '../src/services/llm/LLMService';
import path from 'path';
import { existsSync } from 'fs';

async function testLLMIntegration(): Promise<void> {
  console.log('🧪 Testing Scrapient LLM Integration\n');

  // Find available model
  const modelsDir = path.join(process.cwd(), 'models');
  const possibleModels = [
    'llama-3.1-8b-instruct.gguf',
    'qwen2.5-7b-instruct.gguf',
    'mistral-7b-instruct.gguf'
  ];

  let modelPath: string | null = null;

  for (const model of possibleModels) {
    const fullPath = path.join(modelsDir, model);
    if (existsSync(fullPath)) {
      modelPath = fullPath;
      console.log(`✅ Found model: ${model}`);
      break;
    }
  }

  if (!modelPath) {
    console.log('❌ No models found in ./models/ directory');
    console.log('💡 Download a model first:');
    console.log('   bun scripts/download-model.ts 1');
    return;
  }

  // Initialize LLM Service
  console.log('\n🔧 Initializing LLM Service...');
  const llmService = new LLMService();

  try {
    await llmService.initialize({
      modelPath,
      contextSize: 2048,
      temperature: 0.7,
      maxTokens: 1024,
      gpu: 'auto'
    });

    console.log('✅ LLM Service initialized successfully\n');

    // Test 1: Basic completion
    console.log('📝 Test 1: Basic Document Analysis');
    const testDocument = `
# Product Analysis Report

## Executive Summary
Our new product line shows promising growth metrics. Sales increased by 24% in Q3, with customer satisfaction ratings averaging 4.2 out of 5.

## Key Findings
- Revenue: $2.4M (up from $1.9M)
- Customer acquisition cost decreased by 15%
- Market share grew to 12% in the target segment

## Recommendations
1. Expand marketing in high-performing regions
2. Invest in customer support improvements
3. Launch beta testing for next-generation features
    `;

    const analysisResult = await llmService.analyzeDocument({
      content: testDocument,
      type: 'markdown',
      task: {
        type: 'summarize',
        instructions: 'Focus on key business metrics and actionable insights'
      }
    });

    console.log('📊 Analysis Result:');
    console.log(JSON.stringify(analysisResult, null, 2));

    // Test 2: Entity extraction
    console.log('\n🏷️  Test 2: Entity Extraction');
    const entityResult = await llmService.analyzeDocument({
      content: testDocument,
      type: 'markdown',
      task: {
        type: 'extract_entities',
        instructions: 'Extract business entities, metrics, and key concepts'
      }
    });

    console.log('🏷️  Entity Result:');
    console.log(JSON.stringify(entityResult, null, 2));

    // Test 3: Query capability
    console.log('\n❓ Test 3: Document Query');
    const queryResult = await llmService.queryDocuments(
      'What was the revenue growth percentage?',
      testDocument
    );

    console.log('💬 Query Result:');
    console.log(queryResult);

    // Test 4: Knowledge graph generation
    console.log('\n🕸️  Test 4: Knowledge Graph Generation');
    const knowledgeGraph = await llmService.generateKnowledgeGraph(testDocument);

    if (knowledgeGraph) {
      console.log('📊 Knowledge Graph:');
      console.log(`Nodes: ${knowledgeGraph.metadata.totalNodes}`);
      console.log(`Edges: ${knowledgeGraph.metadata.totalEdges}`);
      console.log(JSON.stringify(knowledgeGraph, null, 2));
    } else {
      console.log('⚠️  Knowledge graph generation failed or returned empty result');
    }

    // Get service status
    console.log('\n📋 Service Status:');
    const status = await llmService.getStatus();
    console.log(JSON.stringify(status, null, 2));

    console.log('\n🎉 All tests completed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error);

    if (error instanceof Error) {
      if (error.message.includes('model')) {
        console.log('\n💡 Troubleshooting:');
        console.log('- Ensure the model file is not corrupted');
        console.log('- Try downloading the model again');
        console.log('- Check available disk space');
      } else if (error.message.includes('memory') || error.message.includes('GPU')) {
        console.log('\n💡 Troubleshooting:');
        console.log('- Reduce context size or try CPU-only mode');
        console.log('- Close other memory-intensive applications');
        console.log('- Consider using a smaller model');
      }
    }
  } finally {
    // Clean up
    console.log('\n🧹 Cleaning up...');
    await llmService.dispose();
    console.log('✅ Cleanup complete');
  }
}

async function main(): Promise<void> {
  try {
    await testLLMIntegration();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

if (import.meta.main) {
  await main();
}