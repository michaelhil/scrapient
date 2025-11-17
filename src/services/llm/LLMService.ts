import { LlamaCppBackend } from './backends/LlamaCppBackend';
import { DocumentProcessor } from './processors/DocumentProcessor';
import { PromptTemplates } from './utils/PromptTemplates';
import type {
  LLMConfig,
  LLMBackend,
  AnalysisRequest,
  AnalysisResponse,
  ProcessingRequest,
  KnowledgeGraph,
  DocumentChunk
} from './types';

export class LLMService {
  private backend?: LLMBackend;
  private documentProcessor: DocumentProcessor;
  private isInitialized = false;

  constructor() {
    this.documentProcessor = new DocumentProcessor({
      chunkSize: 3000,
      chunkOverlap: 200,
      preserveStructure: true
    });
  }

  async initialize(config: LLMConfig): Promise<void> {
    try {
      console.log('Initializing LLM Service...');

      // Initialize the llama.cpp backend
      this.backend = new LlamaCppBackend();
      await this.backend.initialize(config);

      this.isInitialized = true;
      console.log('LLM Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize LLM Service:', error);
      throw error;
    }
  }

  async analyzeDocument(request: AnalysisRequest): Promise<AnalysisResponse> {
    if (!this.isInitialized || !this.backend) {
      throw new Error('LLM Service not initialized');
    }

    const startTime = Date.now();

    try {
      // Process the document based on its type
      const chunks = this.processDocumentContent(request.content, request.type);

      // For now, analyze the first chunk or combine if small
      let contentToAnalyze = request.content;
      if (chunks.length > 1) {
        // If document is large, analyze the most important chunks
        const importantChunks = chunks.slice(0, 3); // Take first 3 chunks
        contentToAnalyze = importantChunks.map(chunk => chunk.content).join('\n\n');
      }

      // Build the analysis prompt
      const prompt = PromptTemplates.buildAnalysisPrompt(contentToAnalyze, request.task);

      // Get completion from LLM
      const response = await this.backend.complete(prompt, {
        maxTokens: request.options?.maxLength ?? 2048,
        temperature: 0.1, // Low temperature for consistent analysis
      });

      // Parse the response
      const result = this.parseAnalysisResponse(response, request.task.type);

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        result,
        metadata: {
          tokensUsed: this.estimateTokens(prompt + response),
          processingTime,
          model: this.getModelName(),
        }
      };

    } catch (error) {
      console.error('Document analysis error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Analysis failed',
        metadata: {
          tokensUsed: 0,
          processingTime: Date.now() - startTime,
          model: this.getModelName(),
        }
      };
    }
  }

  async processMultipleDocuments(request: ProcessingRequest): Promise<AnalysisResponse> {
    if (!this.isInitialized || !this.backend) {
      throw new Error('LLM Service not initialized');
    }

    const startTime = Date.now();

    try {
      // Build prompt for multi-document processing
      const prompt = PromptTemplates.buildMultiDocumentPrompt(request.documents, request.task.type);

      const response = await this.backend.complete(prompt, {
        maxTokens: 4096,
        temperature: 0.2,
      });

      const result = this.parseMultiDocumentResponse(response);
      const processingTime = Date.now() - startTime;

      return {
        success: true,
        result,
        metadata: {
          tokensUsed: this.estimateTokens(prompt + response),
          processingTime,
          model: this.getModelName(),
        }
      };

    } catch (error) {
      console.error('Multi-document processing error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Processing failed',
        metadata: {
          tokensUsed: 0,
          processingTime: Date.now() - startTime,
          model: this.getModelName(),
        }
      };
    }
  }

  async generateKnowledgeGraph(content: string): Promise<KnowledgeGraph | null> {
    if (!this.isInitialized || !this.backend) {
      throw new Error('LLM Service not initialized');
    }

    try {
      const prompt = PromptTemplates.buildKnowledgeGraphPrompt(content);

      const response = await this.backend.complete(prompt, {
        maxTokens: 4096,
        temperature: 0.1,
      });

      const parsed = this.parseJSONResponse(response);

      if (parsed && parsed.nodes && parsed.edges) {
        return {
          nodes: parsed.nodes,
          edges: parsed.edges,
          metadata: {
            totalNodes: parsed.nodes.length,
            totalEdges: parsed.edges.length,
            generatedAt: new Date(),
            model: this.getModelName(),
          }
        };
      }

      return null;
    } catch (error) {
      console.error('Knowledge graph generation error:', error);
      return null;
    }
  }

  async queryDocuments(query: string, context: string): Promise<string> {
    if (!this.isInitialized || !this.backend) {
      throw new Error('LLM Service not initialized');
    }

    try {
      const prompt = PromptTemplates.buildQueryPrompt(query, context);

      const response = await this.backend.complete(prompt, {
        maxTokens: 1024,
        temperature: 0.3,
      });

      return response;
    } catch (error) {
      console.error('Query processing error:', error);
      throw error;
    }
  }

  private processDocumentContent(content: string, type: string): DocumentChunk[] {
    switch (type) {
      case 'markdown':
        return this.documentProcessor.processMarkdown(content);
      case 'json':
        return this.documentProcessor.processJSON(content);
      case 'text':
      case 'document':
      default:
        return this.documentProcessor.processText(content);
    }
  }

  private parseAnalysisResponse(response: string, taskType: string): any {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Fallback: create structured response from plain text
      return this.createFallbackResponse(response, taskType);
    } catch (error) {
      console.warn('Failed to parse LLM response as JSON, using fallback');
      return this.createFallbackResponse(response, taskType);
    }
  }

  private parseMultiDocumentResponse(response: string): any {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return { analysis: response };
    } catch (error) {
      return { analysis: response };
    }
  }

  private parseJSONResponse(response: string): any {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return null;
    } catch (error) {
      console.warn('Failed to parse JSON response');
      return null;
    }
  }

  private createFallbackResponse(response: string, taskType: string): any {
    // Create a basic structured response when JSON parsing fails
    switch (taskType) {
      case 'summarize':
        return {
          summary: response,
          keyPoints: [],
          wordCount: response.split(' ').length
        };
      case 'extract_entities':
        return { entities: [] };
      case 'analyze_sentiment':
        return {
          sentiment: 0,
          label: 'neutral',
          confidence: 0.5,
          keyPhrases: []
        };
      case 'generate_keywords':
        return { keywords: [] };
      case 'extract_relationships':
        return { relationships: [] };
      default:
        return { result: response };
    }
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private getModelName(): string {
    if (this.backend && 'getModelInfo' in this.backend) {
      const info = (this.backend as any).getModelInfo();
      return info?.name || 'unknown';
    }
    return 'unknown';
  }

  async getStatus(): Promise<{
    initialized: boolean;
    backend: string | null;
    model: string | null;
    available: boolean;
  }> {
    return {
      initialized: this.isInitialized,
      backend: this.backend?.name || null,
      model: this.getModelName(),
      available: this.backend?.isAvailable() || false,
    };
  }

  async complete(prompt: string, options?: any): Promise<string> {
    if (!this.isInitialized || !this.backend) {
      throw new Error('LLM Service not initialized');
    }

    return this.backend.complete(prompt, options);
  }

  async dispose(): Promise<void> {
    if (this.backend) {
      await this.backend.dispose();
      this.backend = undefined;
    }
    this.isInitialized = false;
    console.log('LLM Service disposed');
  }
}