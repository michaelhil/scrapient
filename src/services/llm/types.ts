export interface LLMConfig {
  modelPath: string;
  contextSize?: number;
  temperature?: number;
  maxTokens?: number;
  gpu?: boolean | 'auto';
  threads?: number;
}

export interface CompletionOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  repeatPenalty?: number;
  stopSequences?: string[];
}

export interface LLMBackend {
  name: string;
  initialize: (config: LLMConfig) => Promise<void>;
  complete: (prompt: string, options?: CompletionOptions) => Promise<string>;
  embed?: (text: string) => Promise<number[]>;
  isAvailable: () => boolean;
  dispose: () => Promise<void>;
}

export interface AnalysisRequest {
  content: string;
  type: 'document' | 'text' | 'markdown' | 'json';
  task: AnalysisTask;
  options?: AnalysisOptions;
}

export interface AnalysisResponse {
  success: boolean;
  result?: AnalysisResult;
  error?: string;
  metadata: {
    tokensUsed: number;
    processingTime: number;
    model: string;
  };
}

export interface AnalysisTask {
  type: 'summarize' | 'extract_entities' | 'analyze_sentiment' | 'generate_keywords' | 'extract_relationships';
  instructions?: string;
}

export interface AnalysisOptions {
  maxLength?: number;
  language?: string;
  format?: 'json' | 'markdown' | 'text';
}

export interface AnalysisResult {
  summary?: string;
  entities?: Entity[];
  sentiment?: number;
  keywords?: string[];
  relationships?: Relationship[];
  structure?: any;
}

export interface Entity {
  name: string;
  type: 'person' | 'organization' | 'location' | 'concept' | 'other';
  confidence: number;
  mentions: number;
}

export interface Relationship {
  source: string;
  target: string;
  type: string;
  confidence: number;
}

export interface DocumentChunk {
  content: string;
  index: number;
  tokens: number;
  metadata: {
    startLine?: number;
    endLine?: number;
    section?: string;
  };
}

export interface ProcessingRequest {
  documents: Array<{
    id: string;
    content: string;
    type: string;
  }>;
  task: ProcessingTask;
  options?: ProcessingOptions;
}

export interface ProcessingTask {
  type: 'merge' | 'compare' | 'extract_common_themes' | 'generate_knowledge_graph';
  instructions?: string;
}

export interface ProcessingOptions {
  outputFormat?: 'json' | 'md' | 'text';
  includeMetadata?: boolean;
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: {
    totalNodes: number;
    totalEdges: number;
    generatedAt: Date;
    model: string;
  };
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  properties: Record<string, any>;
}

export interface GraphEdge {
  source: string;
  target: string;
  relationship: string;
  weight: number;
  properties: Record<string, any>;
}