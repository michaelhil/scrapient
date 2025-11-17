import { getLlama, Llama, LlamaModel, LlamaContext, LlamaChatSession } from 'node-llama-cpp';
import type { LLMBackend, LLMConfig, CompletionOptions } from '../types';

export class LlamaCppBackend implements LLMBackend {
  readonly name = 'llama-cpp';

  private llama?: Llama;
  private model?: LlamaModel;
  private context?: LlamaContext;
  private session?: LlamaChatSession;
  private config?: LLMConfig;

  async initialize(config: LLMConfig): Promise<void> {
    try {
      this.config = config;

      // Initialize llama.cpp
      this.llama = await getLlama();

      // Load the model
      console.log(`Loading model from: ${config.modelPath}`);
      this.model = await this.llama.loadModel({
        modelPath: config.modelPath,
        gpuLayers: this.determineGpuLayers(config.gpu),
      });

      // Create context
      this.context = await this.model.createContext({
        contextSize: config.contextSize ?? 4096,
        threads: config.threads,
      });

      // Create chat session
      const contextSequence = this.context.getSequence();
      this.session = new LlamaChatSession({
        contextSequence,
        systemPrompt: 'You are a document analysis expert. Your job is to carefully read and analyze documents, then provide specific, relevant analysis based on the user\'s instructions. Always focus on the actual content of the document provided and give concrete, detailed responses about that specific document. Never provide generic instructions or documentation about analysis tools.'
      });

      console.log('LlamaCpp backend initialized successfully');
    } catch (error) {
      console.error('Failed to initialize LlamaCpp backend:', error);
      throw new Error(`LlamaCpp initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async complete(prompt: string, options: CompletionOptions = {}): Promise<string> {
    if (!this.session) {
      throw new Error('LlamaCpp backend not initialized');
    }

    try {
      const response = await this.session.prompt(prompt, {
        maxTokens: options.maxTokens ?? this.config?.maxTokens ?? 2048,
        temperature: options.temperature ?? this.config?.temperature ?? 0.7,
        topP: options.topP ?? 0.95,
        topK: options.topK ?? 40,
        repeatPenalty: options.repeatPenalty ?? 1.1,
        stopOnAbortSignal: true,
      });

      return response;
    } catch (error) {
      console.error('LlamaCpp completion error:', error);
      throw new Error(`Completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async embed(text: string): Promise<number[]> {
    if (!this.model) {
      throw new Error('LlamaCpp backend not initialized');
    }

    try {
      const embedding = await this.model.createEmbedding(text);
      return Array.from(embedding);
    } catch (error) {
      console.error('LlamaCpp embedding error:', error);
      throw new Error(`Embedding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  isAvailable(): boolean {
    return !!(this.llama && this.model && this.context && this.session);
  }

  async dispose(): Promise<void> {
    try {
      if (this.session) {
        this.session.dispose();
        this.session = undefined;
      }

      if (this.context) {
        this.context.dispose();
        this.context = undefined;
      }

      if (this.model) {
        this.model.dispose();
        this.model = undefined;
      }

      if (this.llama) {
        this.llama.dispose();
        this.llama = undefined;
      }

      console.log('LlamaCpp backend disposed');
    } catch (error) {
      console.error('Error disposing LlamaCpp backend:', error);
    }
  }

  private determineGpuLayers(gpuConfig?: boolean | 'auto'): number {
    if (gpuConfig === false) return 0;
    if (gpuConfig === true) return 32; // Use reasonable default
    if (gpuConfig === 'auto') {
      // Auto-detect: let llama.cpp determine optimal GPU layers
      // This will be handled by the library itself
      return -1; // -1 typically means "use all available GPU layers"
    }
    return 0; // Default to CPU
  }

  // Utility method to get model info
  getModelInfo(): { name: string; path: string; contextSize: number } | null {
    if (!this.config || !this.context) return null;

    return {
      name: this.config.modelPath.split('/').pop() || 'unknown',
      path: this.config.modelPath,
      contextSize: this.config.contextSize ?? 4096,
    };
  }
}