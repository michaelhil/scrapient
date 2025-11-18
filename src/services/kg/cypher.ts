import type { KGRawData } from './types';
import type { LLMService } from '../llm/LLMService';

export const generateCypherCode = async (kgData: KGRawData, llmService: LLMService): Promise<string> => {
  try {
    const prompt = buildCypherGenerationPrompt(kgData);

    const response = await llmService.complete(prompt, {
      maxTokens: 4096,
      temperature: 0.1
    });

    const cypherCode = extractCypherFromResponse(response);

    if (!cypherCode) {
      throw new Error('Failed to extract valid Cypher code from LLM response');
    }

    return cypherCode;

  } catch (error) {
    console.error('Cypher generation error:', error);

    // Fallback: generate basic Cypher manually
    console.log('Falling back to manual Cypher generation');
    return generateFallbackCypher(kgData);
  }
};

const buildCypherGenerationPrompt = (kgData: KGRawData): string => {
  const entitiesJson = JSON.stringify(kgData.entities, null, 2);
  const relationshipsJson = JSON.stringify(kgData.relationships, null, 2);

  return `You are a Neo4j Cypher expert. Convert the following knowledge graph data into executable Cypher code for creating nodes and relationships in a Neo4j database.

Knowledge Graph Data:

ENTITIES:
${entitiesJson}

RELATIONSHIPS:
${relationshipsJson}

Requirements:
1. Create nodes for each entity with appropriate labels based on their type
2. Set properties for each node including label, description, importance, and any custom properties
3. Create relationships between nodes with proper relationship types and properties
4. Use MERGE statements to avoid duplicates
5. Include proper property setting with SET clauses
6. Use parameterized queries where appropriate
7. Add constraints and indexes for better performance

Output Requirements:
- Provide ONLY executable Cypher code
- No explanations or additional text
- Use proper Cypher syntax
- Include semicolons between statements
- Start with constraint creation, then nodes, then relationships

Example format:
// Create constraints
CREATE CONSTRAINT IF NOT EXISTS FOR (n:Person) REQUIRE n.id IS UNIQUE;

// Create nodes
MERGE (p:Person {id: $id})
SET p.label = $label, p.importance = $importance;

// Create relationships
MATCH (a {id: $source}), (b {id: $target})
MERGE (a)-[r:RELATIONSHIP_TYPE]->(b)
SET r.weight = $weight;

Generate the complete Cypher code for the provided knowledge graph:`;
};

const extractCypherFromResponse = (response: string): string | null => {
  try {
    // Remove markdown code blocks if present
    let cleanedResponse = response.replace(/```cypher\n?/g, '').replace(/```\n?/g, '');

    // Remove any explanatory text before the first Cypher statement
    const cypherStart = cleanedResponse.search(/(CREATE|MERGE|MATCH|WITH)/i);
    if (cypherStart !== -1) {
      cleanedResponse = cleanedResponse.substring(cypherStart);
    }

    // Basic validation - check if it contains Cypher keywords
    const hasValidCypher = /\b(CREATE|MERGE|MATCH|SET|WHERE|RETURN)\b/i.test(cleanedResponse);

    if (!hasValidCypher) {
      console.warn('Response does not contain valid Cypher keywords');
      return null;
    }

    return cleanedResponse.trim();

  } catch (error) {
    console.error('Error extracting Cypher from response:', error);
    return null;
  }
};

const generateFallbackCypher = (kgData: KGRawData): string => {
  const lines = [];

  // Add header comment
  lines.push('// Generated Cypher code for Knowledge Graph');
  lines.push('// Created by Scrapient KG Service');
  lines.push('');

  // Create constraints for entity types
  const entityTypes = [...new Set(kgData.entities.map(e => e.type))];
  lines.push('// Create constraints for entity types');
  entityTypes.forEach(type => {
    const labelName = capitalizeFirst(type);
    lines.push(`CREATE CONSTRAINT IF NOT EXISTS FOR (n:${labelName}) REQUIRE n.id IS UNIQUE;`);
  });
  lines.push('');

  // Create nodes
  lines.push('// Create entity nodes');
  kgData.entities.forEach(entity => {
    const labelName = capitalizeFirst(entity.type);
    const id = sanitizeCypherString(entity.id);
    const label = sanitizeCypherString(entity.label);
    const description = sanitizeCypherString(entity.description || '');
    const importance = entity.importance || 0.5;

    lines.push(`MERGE (n:${labelName} {id: "${id}"})`);
    lines.push(`SET n.label = "${label}",`);
    lines.push(`    n.description = "${description}",`);
    lines.push(`    n.importance = ${importance};`);
    lines.push('');
  });

  // Create relationships
  if (kgData.relationships.length > 0) {
    lines.push('// Create relationships');
    kgData.relationships.forEach(rel => {
      const sourceId = sanitizeCypherString(rel.source);
      const targetId = sanitizeCypherString(rel.target);
      const relType = sanitizeRelationshipType(rel.type);
      const weight = rel.weight || 0.5;
      const description = sanitizeCypherString(rel.description || '');

      lines.push(`MATCH (source {id: "${sourceId}"}), (target {id: "${targetId}"})`);
      lines.push(`MERGE (source)-[r:${relType}]->(target)`);
      lines.push(`SET r.weight = ${weight},`);
      lines.push(`    r.description = "${description}";`);
      lines.push('');
    });
  }

  // Add index creation
  lines.push('// Create indexes for better performance');
  entityTypes.forEach(type => {
    const labelName = capitalizeFirst(type);
    lines.push(`CREATE INDEX IF NOT EXISTS FOR (n:${labelName}) ON (n.label);`);
  });

  return lines.join('\n');
};

const capitalizeFirst = (str: string): string => {
  if (!str) return 'Entity';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

const sanitizeCypherString = (str: string): string => {
  if (!str) return '';
  // Escape quotes and remove problematic characters
  return str.replace(/["']/g, '\\"').replace(/[\r\n]/g, ' ').trim();
};

const sanitizeRelationshipType = (type: string): string => {
  if (!type) return 'RELATED_TO';
  // Convert to valid relationship type format
  return type
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
};

export const validateCypherSyntax = (cypherCode: string): { valid: boolean; error?: string } => {
  try {
    // Basic validation checks
    if (!cypherCode.trim()) {
      return { valid: false, error: 'Empty Cypher code' };
    }

    // Check for basic Cypher keywords
    const hasValidKeywords = /\b(CREATE|MERGE|MATCH|SET|WHERE|RETURN)\b/i.test(cypherCode);
    if (!hasValidKeywords) {
      return { valid: false, error: 'No valid Cypher keywords found' };
    }

    // Check for balanced parentheses
    const openParens = (cypherCode.match(/\(/g) || []).length;
    const closeParens = (cypherCode.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      return { valid: false, error: 'Unbalanced parentheses in Cypher code' };
    }

    // Check for balanced curly braces
    const openBraces = (cypherCode.match(/\{/g) || []).length;
    const closeBraces = (cypherCode.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      return { valid: false, error: 'Unbalanced braces in Cypher code' };
    }

    return { valid: true };

  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown validation error'
    };
  }
};