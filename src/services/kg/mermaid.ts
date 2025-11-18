import type { KGRawData, KGEntity, KGRelationship } from './types';

interface MermaidConfig {
  maxNodes?: number;
  maxEdges?: number;
  theme?: 'default' | 'dark' | 'forest' | 'neutral';
}

export const generateMermaidCode = (kgData: KGRawData, config: MermaidConfig = {}): string => {
  const {
    maxNodes = 50,
    maxEdges = 100,
    theme = 'default'
  } = config;

  try {
    // Limit entities by importance if we have too many
    const limitedEntities = kgData.entities
      .sort((a, b) => (b.importance || 0) - (a.importance || 0))
      .slice(0, maxNodes);

    const entityIds = new Set(limitedEntities.map(e => e.id));

    // Filter relationships to only include those between selected entities
    const limitedRelationships = kgData.relationships
      .filter(rel => entityIds.has(rel.source) && entityIds.has(rel.target))
      .sort((a, b) => (b.weight || 0) - (a.weight || 0))
      .slice(0, maxEdges);

    // Generate Mermaid flowchart
    const mermaidLines = [
      'flowchart TD'
    ];

    // Add entity definitions with styling based on type
    limitedEntities.forEach(entity => {
      const nodeId = sanitizeId(entity.id);
      const label = sanitizeLabel(entity.label);
      const style = getNodeStyle(entity);

      mermaidLines.push(`    ${nodeId}["${label}"]${style}`);
    });

    // Add relationships
    limitedRelationships.forEach(rel => {
      const sourceId = sanitizeId(rel.source);
      const targetId = sanitizeId(rel.target);
      const relType = sanitizeLabel(rel.type);

      // Use different arrow styles based on relationship strength
      const arrow = getArrowStyle(rel.weight || 0.5);

      mermaidLines.push(`    ${sourceId} ${arrow}|"${relType}"| ${targetId}`);
    });

    // Add styling classes
    mermaidLines.push('');
    mermaidLines.push('    %% Styling');
    mermaidLines.push('    classDef person fill:#e1f5fe,stroke:#01579b,stroke-width:2px');
    mermaidLines.push('    classDef organization fill:#f3e5f5,stroke:#4a148c,stroke-width:2px');
    mermaidLines.push('    classDef location fill:#e8f5e8,stroke:#1b5e20,stroke-width:2px');
    mermaidLines.push('    classDef concept fill:#fff3e0,stroke:#e65100,stroke-width:2px');
    mermaidLines.push('    classDef event fill:#fce4ec,stroke:#880e4f,stroke-width:2px');
    mermaidLines.push('    classDef other fill:#f5f5f5,stroke:#424242,stroke-width:2px');

    return mermaidLines.join('\n');

  } catch (error) {
    console.error('Error generating Mermaid code:', error);
    return generateFallbackMermaid(kgData);
  }
};

const sanitizeId = (id: string): string => {
  // Replace non-alphanumeric characters with underscores
  return id.replace(/[^a-zA-Z0-9]/g, '_');
};

const sanitizeLabel = (label: string): string => {
  // Escape quotes and limit length
  const cleaned = label.replace(/['"]/g, '').trim();
  return cleaned.length > 30 ? cleaned.substring(0, 30) + '...' : cleaned;
};

const getNodeStyle = (entity: KGEntity): string => {
  // Return class assignment based on entity type
  const className = entity.type || 'other';
  return `:::${className}`;
};

const getArrowStyle = (weight: number): string => {
  if (weight >= 0.8) {
    return '===>'; // Strong relationship
  } else if (weight >= 0.5) {
    return '-->'; // Medium relationship
  } else {
    return '-.->'; // Weak relationship
  }
};

const generateFallbackMermaid = (kgData: KGRawData): string => {
  // Simple fallback diagram when main generation fails
  const entities = kgData.entities.slice(0, 10); // Limit to 10 entities

  const lines = [
    'flowchart TD',
    '    %% Simplified Knowledge Graph',
    ''
  ];

  entities.forEach((entity, index) => {
    const id = `E${index}`;
    const label = sanitizeLabel(entity.label);
    lines.push(`    ${id}["${label}"]`);
  });

  // Add a few sample connections
  if (entities.length > 1) {
    lines.push('');
    lines.push('    E0 --> E1');
    if (entities.length > 2) {
      lines.push('    E1 --> E2');
    }
  }

  return lines.join('\n');
};

export const validateMermaidSyntax = (mermaidCode: string): { valid: boolean; error?: string } => {
  try {
    // Basic validation checks
    if (!mermaidCode.trim()) {
      return { valid: false, error: 'Empty Mermaid code' };
    }

    if (!mermaidCode.includes('flowchart')) {
      return { valid: false, error: 'Missing flowchart declaration' };
    }

    // Check for balanced brackets
    const openBrackets = (mermaidCode.match(/\[/g) || []).length;
    const closeBrackets = (mermaidCode.match(/\]/g) || []).length;

    if (openBrackets !== closeBrackets) {
      return { valid: false, error: 'Unbalanced brackets in node definitions' };
    }

    return { valid: true };

  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown validation error'
    };
  }
};