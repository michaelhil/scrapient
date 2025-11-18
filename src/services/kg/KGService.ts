import type { ScrapedDocument } from '../../storage/types';
import type { LLMService } from '../llm/LLMService';
import type {
  KGGenerationRequest,
  KGGenerationResponse,
  KGRawData,
  KnowledgeGraph,
  CypherGenerationRequest
} from './types';
import { generateMermaidCode } from './mermaid';
import { generateCypherCode } from './cypher';

interface KGServiceConfig {
  llmService: LLMService;
  progressCallback?: (progress: number, message: string) => void;
}

export interface KGServiceInterface {
  generateKG: (request: KGGenerationRequest, documents: ScrapedDocument[]) => Promise<KGGenerationResponse>;
  generateCypherFromKG: (request: CypherGenerationRequest) => Promise<{ success: boolean; cypherCode?: string; error?: string }>;
}

export const createKGService = (config: KGServiceConfig): KGServiceInterface => {
  const { llmService, progressCallback } = config;

  const generateKG = async (request: KGGenerationRequest, documents: ScrapedDocument[]): Promise<KGGenerationResponse> => {
    const startTime = Date.now();

    try {
      // Stage 1: Prepare document content
      progressCallback?.(10, 'Preparing documents...');

      const documentContent = documents.map(doc => ({
        id: doc.id,
        title: doc.title,
        content: doc.content.text,
        type: doc.contentType
      }));

      // Stage 2: Build KG generation prompt
      progressCallback?.(20, 'Building knowledge extraction prompt...');

      const prompt = buildKGGenerationPrompt(documentContent, request.userPrompt);

      // Stage 3: Generate raw KG data with LLM
      progressCallback?.(40, 'Extracting entities and relationships...');

      let llmResponse: string;
      try {
        console.log('Starting LLM generation for KG...');
        progressCallback?.(50, 'LLM processing... (this may take 30-60 seconds)');

        llmResponse = await llmService.complete(prompt, {
          maxTokens: 8192,
          temperature: 0.1
        });

        console.log('LLM generation completed successfully');
        progressCallback?.(80, 'LLM generation complete, processing results...');

        if (!llmResponse || llmResponse.trim().length === 0) {
          throw new Error('LLM returned empty response');
        }
      } catch (error) {
        console.error('LLM generation failed:', error);
        return {
          success: false,
          error: `LLM generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          stage: 'raw'
        };
      }

      // Stage 4: Parse LLM response into KG structure
      progressCallback?.(70, 'Processing knowledge graph data...');
      console.log('Starting KG response parsing...');

      const rawData = parseKGResponse(llmResponse);

      if (!rawData) {
        console.error('KG response parsing failed - no valid data returned');
        return {
          success: false,
          error: 'Failed to parse knowledge graph from LLM response',
          stage: 'raw'
        };
      }

      console.log('KG response parsing successful, entities:', rawData.entities?.length, 'relationships:', rawData.relationships?.length);

      // Stage 5: Generate Mermaid visualization
      progressCallback?.(90, 'Generating visualization...');

      const mermaidCode = generateMermaidCode(rawData);

      progressCallback?.(100, 'Knowledge graph generated successfully!');

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        stage: 'raw',
        data: rawData,
        mermaidCode,
        metadata: {
          processingTime,
          tokensUsed: estimateTokens(prompt + llmResponse),
          model: 'llama-3.1-8b'
        }
      };

    } catch (error) {
      console.error('KG generation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        stage: 'raw',
        metadata: {
          processingTime: Date.now() - startTime,
          tokensUsed: 0,
          model: 'llama-3.1-8b'
        }
      };
    }
  };

  const generateCypherFromKG = async (request: CypherGenerationRequest): Promise<{ success: boolean; cypherCode?: string; error?: string }> => {
    try {
      const cypherCode = await generateCypherCode(request.rawData, llmService);

      return {
        success: true,
        cypherCode
      };
    } catch (error) {
      console.error('Cypher generation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate Cypher code'
      };
    }
  };

  return {
    generateKG,
    generateCypherFromKG
  };
};

const buildKGGenerationPrompt = (
  documents: Array<{ id: string; title: string; content: string; type: string }>,
  userPrompt: string
): string => {
  const documentList = documents.map((doc, index) =>
    `Document ${index + 1}: "${doc.title}" (${doc.type})
---
${doc.content.slice(0, 3000)}${doc.content.length > 3000 ? '...' : ''}
---`
  ).join('\n\n');

  return `You are a knowledge graph expert. Extract entities and relationships from the provided documents to create a comprehensive knowledge graph.

User Instructions:
${userPrompt}

Documents:
${documentList}

Your task is to analyze these documents and extract:
1. **Entities**: People, organizations, locations, concepts, events, and other important items
2. **Relationships**: Connections between entities with specific relationship types
3. **Properties**: Important attributes and metadata for each entity
4. **Summary**: Brief overview of main themes and findings

Guidelines:
- Extract entities that are central to the document's meaning
- Focus on explicitly stated relationships and connections
- Use clear, descriptive relationship types (e.g., "works_for", "located_in", "causes", "leads_to")
- Provide importance scores (0.0-1.0) based on how central entities are to the content
- Include temporal information when available
- Create hierarchical structures where appropriate

**IMPORTANT**: Respond with valid JSON only. No additional text or formatting.

{
  "entities": [
    {
      "id": "unique_identifier",
      "label": "Entity Name",
      "type": "person|organization|location|concept|event|other",
      "properties": {
        "description": "Brief description of the entity",
        "aliases": ["alternative names if any"],
        "attributes": {}
      },
      "importance": 0.8
    }
  ],
  "relationships": [
    {
      "id": "rel_unique_id",
      "source": "source_entity_id",
      "target": "target_entity_id",
      "type": "relationship_type",
      "properties": {
        "description": "Description of the relationship",
        "strength": "strong|medium|weak",
        "temporal": "time information if relevant"
      },
      "weight": 0.9
    }
  ],
  "summary": "Brief summary of main themes and key findings",
  "themes": ["theme1", "theme2", "theme3"]
}`;
};

const parseKGResponse = (response: string): KGRawData | null => {
  try {
    // Find JSON in the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in KG response');
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate required fields
    if (!parsed.entities || !Array.isArray(parsed.entities)) {
      console.error('Invalid entities in KG response');
      return null;
    }

    if (!parsed.relationships || !Array.isArray(parsed.relationships)) {
      console.error('Invalid relationships in KG response');
      return null;
    }

    // Convert to our KG format
    return {
      entities: parsed.entities.map((entity: any) => ({
        id: entity.id || `entity_${Math.random().toString(36).substr(2, 9)}`,
        label: entity.label || entity.name || 'Unknown',
        type: entity.type || 'other',
        properties: entity.properties || {},
        description: entity.properties?.description || entity.description,
        importance: entity.importance || 0.5
      })),
      relationships: parsed.relationships.map((rel: any) => ({
        id: rel.id || `rel_${Math.random().toString(36).substr(2, 9)}`,
        source: rel.source,
        target: rel.target,
        type: rel.type || rel.relationship || 'related_to',
        properties: rel.properties || {},
        weight: rel.weight || 0.5,
        description: rel.properties?.description || rel.description
      })),
      summary: parsed.summary || '',
      themes: parsed.themes || []
    };

  } catch (error) {
    console.error('Failed to parse KG response:', error);
    return null;
  }
};

const estimateTokens = (text: string): number => {
  return Math.ceil(text.length / 4);
};