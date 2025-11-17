# LLM Integration Setup Guide

## Overview

Scrapient now includes local LLM integration using llama.cpp for advanced document analysis, entity extraction, knowledge graph generation, and interactive querying.

## Quick Start

### 1. Download a Model

```bash
# Show available models
bun scripts/download-model.ts

# Download recommended model (Llama 3.1 8B, ~4.9GB)
bun scripts/download-model.ts 1

# Or download both recommended models
bun scripts/download-model.ts recommended
```

### 2. Set Environment Variable (Optional)

```bash
# Use specific model path
export LLM_MODEL_PATH="./models/llama-3.1-8b-instruct.gguf"

# Or let system auto-detect models in ./models/ directory
```

### 3. Start Server

```bash
bun run dev
```

The LLM service will initialize automatically when the server starts.

### 4. Test Integration

```bash
# Test LLM functionality
bun scripts/test-llm.ts

# Check LLM service status
curl http://localhost:3000/api/llm/status
```

## API Endpoints

### Document Analysis
```bash
POST /api/llm/analyze
{
  "content": "Your document content here",
  "type": "markdown|json|text",
  "task": {
    "type": "summarize|extract_entities|analyze_sentiment|generate_keywords|extract_relationships",
    "instructions": "Optional specific instructions"
  }
}
```

### Multi-Document Processing
```bash
POST /api/llm/process
{
  "documentIds": ["doc1", "doc2"],
  "task": {
    "type": "merge|compare|extract_common_themes|generate_knowledge_graph"
  }
}
```

### Interactive Querying
```bash
POST /api/llm/query
{
  "query": "What are the main themes in these documents?",
  "documentIds": ["doc1", "doc2"]  # Optional
}
```

### Knowledge Graph Generation
```bash
POST /api/llm/knowledge-graph
{
  "documentIds": ["doc1", "doc2"]
}
```

### Service Status
```bash
GET /api/llm/status
```

## Recommended Models

### Llama 3.1 8B Instruct (4.9GB) - **Primary Recommendation**
- **Best for**: General document analysis, summarization, Q&A
- **Performance**: Excellent balance of speed and quality
- **Memory**: ~8GB RAM required

### Qwen 2.5 7B Instruct (4.4GB) - **Entity Extraction**
- **Best for**: Entity extraction, structured output, JSON generation
- **Performance**: Superior for structured data tasks
- **Memory**: ~7GB RAM required

### Mistral 7B Instruct (4.1GB) - **Fast Inference**
- **Best for**: Interactive queries, real-time analysis
- **Performance**: Fastest response times
- **Memory**: ~6GB RAM required

## System Requirements

### Minimum Requirements
- **RAM**: 8GB (for 7B models)
- **Storage**: 5GB+ for models
- **CPU**: Modern multi-core processor

### Recommended Requirements
- **RAM**: 16GB+ (for better performance)
- **GPU**: Apple Metal (M1/M2) or CUDA GPU
- **Storage**: 10GB+ (for multiple models)

## Configuration

### Model Selection
Models are automatically detected in this order:
1. `LLM_MODEL_PATH` environment variable
2. `./models/llama-3.1-8b-instruct.gguf`
3. First available model in `./models/` directory

### Performance Tuning
```typescript
// In src/api/llm.ts, modify initialization:
await llmService.initialize({
  modelPath,
  contextSize: 4096,    // Increase for longer documents
  temperature: 0.7,     // Lower for more focused output
  maxTokens: 2048,      // Increase for longer responses
  gpu: 'auto'           // 'auto', true, false
});
```

## Troubleshooting

### "Model not found" Error
```bash
# Check models directory
ls -la models/

# Re-download model
bun scripts/download-model.ts 1
```

### Out of Memory Errors
```bash
# Use smaller context size
export LLM_CONTEXT_SIZE=2048

# Try CPU-only mode
export LLM_GPU=false
```

### Slow Performance
- Close other memory-intensive applications
- Use GPU acceleration if available
- Consider using smaller models for development

### Download Failures
- Check internet connection
- Verify available disk space
- Try downloading individual models instead of batch

## Integration Examples

### Analyze Document from Storage
```typescript
const response = await fetch('/api/llm/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    documentId: 'your-document-id',
    task: { type: 'summarize' }
  })
});
```

### Extract Entities from Text
```typescript
const response = await fetch('/api/llm/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    content: 'Your text content here',
    type: 'text',
    task: {
      type: 'extract_entities',
      instructions: 'Focus on people, organizations, and locations'
    }
  })
});
```

### Query Multiple Documents
```typescript
const response = await fetch('/api/llm/query', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'What are the common themes across these documents?',
    documentIds: ['doc1', 'doc2', 'doc3']
  })
});
```

## Performance Benchmarks

| Model | RAM Usage | Avg Response Time | Best For |
|-------|-----------|------------------|----------|
| Llama 3.1 8B | ~8GB | 2-5 seconds | General analysis |
| Qwen 2.5 7B | ~7GB | 1-3 seconds | Entity extraction |
| Mistral 7B | ~6GB | 1-2 seconds | Interactive queries |

*Benchmarks on Apple M2 Pro with 16GB RAM*

## Next Steps

1. **Download a model**: `bun scripts/download-model.ts 1`
2. **Test integration**: `bun scripts/test-llm.ts`
3. **Integrate with dashboard**: Add LLM analysis buttons to document viewer
4. **Optimize for your use case**: Experiment with different models and prompts

For advanced configuration and custom model integration, see the [Architecture Documentation](./LLM_INTEGRATION_ANALYSIS.md).