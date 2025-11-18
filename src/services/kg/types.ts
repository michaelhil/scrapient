export interface KGEntity {
  id: string;
  label: string;
  type: 'person' | 'organization' | 'location' | 'concept' | 'event' | 'other';
  properties: Record<string, any>;
  description?: string;
  importance: number; // 0.0 - 1.0
}

export interface KGRelationship {
  id: string;
  source: string; // entity id
  target: string; // entity id
  type: string;
  properties: Record<string, any>;
  weight: number; // 0.0 - 1.0
  description?: string;
}

export interface KGRawData {
  entities: KGEntity[];
  relationships: KGRelationship[];
  summary?: string;
  themes?: string[];
}

export interface KnowledgeGraph {
  id: string;
  title: string;
  sourceDocumentIds: string[];
  generatedAt: Date;
  updatedAt: Date;

  // Stage 1: Raw KG data from LLM
  rawData?: KGRawData;
  mermaidCode?: string;

  // Stage 2: Neo4j ready data
  cypherCode?: string;
  neo4jStatus: 'pending' | 'saving' | 'saved' | 'error';
  neo4jError?: string;

  // Generation metadata
  metadata: {
    userPrompt: string;
    model: string;
    processingTime: number;
    stage: 'generating' | 'preview' | 'cypher' | 'complete' | 'error';
    error?: string;
  };
}

export interface KGGenerationRequest {
  documentIds: string[];
  userPrompt: string;
  title?: string;
}

export interface KGGenerationResponse {
  success: boolean;
  kgId?: string;
  stage: 'raw' | 'cypher' | 'saved';
  data?: KGRawData;
  mermaidCode?: string;
  cypherCode?: string;
  error?: string;
  metadata?: {
    processingTime: number;
    tokensUsed: number;
    model: string;
  };
}

export interface MermaidConfig {
  theme: 'default' | 'dark' | 'forest' | 'neutral';
  maxNodes: number;
  maxEdges: number;
}

export interface CypherGenerationRequest {
  kgId: string;
  rawData: KGRawData;
}