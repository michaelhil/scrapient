import type { DocumentChunk } from '../types';

export interface DocumentProcessorConfig {
  chunkSize: number;
  chunkOverlap: number;
  preserveStructure: boolean;
}

export class DocumentProcessor {
  private config: DocumentProcessorConfig;

  constructor(config: Partial<DocumentProcessorConfig> = {}) {
    this.config = {
      chunkSize: config.chunkSize ?? 3000,
      chunkOverlap: config.chunkOverlap ?? 200,
      preserveStructure: config.preserveStructure ?? true,
    };
  }

  processMarkdown(content: string): DocumentChunk[] {
    // Split at headers for better context preservation
    const sections = this.splitAtHeaders(content);
    const chunks: DocumentChunk[] = [];

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];

      if (this.estimateTokens(section.content) <= this.config.chunkSize) {
        // Section fits in one chunk
        chunks.push({
          content: section.content,
          index: chunks.length,
          tokens: this.estimateTokens(section.content),
          metadata: {
            section: section.title,
            startLine: section.startLine,
            endLine: section.endLine,
          }
        });
      } else {
        // Section needs to be split further
        const subChunks = this.splitLargeSection(section.content, section.title);
        chunks.push(...subChunks.map((chunk, idx) => ({
          ...chunk,
          index: chunks.length + idx,
          metadata: {
            ...chunk.metadata,
            section: section.title,
          }
        })));
      }
    }

    return chunks;
  }

  processJSON(content: string): DocumentChunk[] {
    try {
      const data = JSON.parse(content);
      const flattenedData = this.flattenJSON(data);
      const naturalLanguage = this.jsonToNaturalLanguage(flattenedData);

      return this.chunkText(naturalLanguage, 'json');
    } catch (error) {
      // If JSON is invalid, treat as plain text
      return this.chunkText(content, 'json');
    }
  }

  processText(content: string): DocumentChunk[] {
    return this.chunkText(content, 'text');
  }

  private splitAtHeaders(content: string): Array<{
    title: string;
    content: string;
    startLine: number;
    endLine: number;
  }> {
    const lines = content.split('\n');
    const sections: Array<{
      title: string;
      content: string;
      startLine: number;
      endLine: number;
    }> = [];

    let currentSection = {
      title: 'Introduction',
      content: '',
      startLine: 0,
      endLine: 0,
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for markdown headers (# ## ### etc.)
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);

      if (headerMatch) {
        // Save previous section if it has content
        if (currentSection.content.trim()) {
          currentSection.endLine = i - 1;
          sections.push({ ...currentSection });
        }

        // Start new section
        currentSection = {
          title: headerMatch[2],
          content: line + '\n',
          startLine: i,
          endLine: i,
        };
      } else {
        currentSection.content += line + '\n';
      }
    }

    // Add the last section
    if (currentSection.content.trim()) {
      currentSection.endLine = lines.length - 1;
      sections.push(currentSection);
    }

    return sections;
  }

  private splitLargeSection(content: string, sectionTitle: string): DocumentChunk[] {
    const sentences = this.splitIntoSentences(content);
    const chunks: DocumentChunk[] = [];
    let currentChunk = '';
    let sentenceCount = 0;

    for (const sentence of sentences) {
      const potentialChunk = currentChunk + sentence + ' ';

      if (this.estimateTokens(potentialChunk) > this.config.chunkSize && currentChunk) {
        // Current chunk is full, save it
        chunks.push({
          content: currentChunk.trim(),
          index: 0, // Will be set by caller
          tokens: this.estimateTokens(currentChunk),
          metadata: {
            section: `${sectionTitle} (part ${chunks.length + 1})`,
          }
        });

        // Start new chunk with overlap
        currentChunk = this.createOverlap(currentChunk, sentence);
        sentenceCount = 1;
      } else {
        currentChunk = potentialChunk;
        sentenceCount++;
      }
    }

    // Add the final chunk
    if (currentChunk.trim()) {
      chunks.push({
        content: currentChunk.trim(),
        index: 0, // Will be set by caller
        tokens: this.estimateTokens(currentChunk),
        metadata: {
          section: `${sectionTitle} (part ${chunks.length + 1})`,
        }
      });
    }

    return chunks;
  }

  private chunkText(content: string, type: string): DocumentChunk[] {
    const sentences = this.splitIntoSentences(content);
    const chunks: DocumentChunk[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      const potentialChunk = currentChunk + sentence + ' ';

      if (this.estimateTokens(potentialChunk) > this.config.chunkSize && currentChunk) {
        chunks.push({
          content: currentChunk.trim(),
          index: chunks.length,
          tokens: this.estimateTokens(currentChunk),
          metadata: { section: `${type}-chunk-${chunks.length + 1}` }
        });

        currentChunk = this.createOverlap(currentChunk, sentence);
      } else {
        currentChunk = potentialChunk;
      }
    }

    if (currentChunk.trim()) {
      chunks.push({
        content: currentChunk.trim(),
        index: chunks.length,
        tokens: this.estimateTokens(currentChunk),
        metadata: { section: `${type}-chunk-${chunks.length + 1}` }
      });
    }

    return chunks;
  }

  private splitIntoSentences(text: string): string[] {
    // Simple sentence splitting - can be enhanced with more sophisticated NLP
    return text
      .split(/[.!?]+\s+/)
      .filter(sentence => sentence.trim().length > 0)
      .map(sentence => sentence.trim());
  }

  private createOverlap(currentChunk: string, newSentence: string): string {
    const sentences = this.splitIntoSentences(currentChunk);
    const overlapSentences = sentences.slice(-Math.floor(this.config.chunkOverlap / 100));
    return overlapSentences.join(' ') + ' ' + newSentence;
  }

  private flattenJSON(obj: any, prefix = ''): Record<string, any> {
    const flattened: Record<string, any> = {};

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const newKey = prefix ? `${prefix}.${key}` : key;

        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          Object.assign(flattened, this.flattenJSON(obj[key], newKey));
        } else {
          flattened[newKey] = obj[key];
        }
      }
    }

    return flattened;
  }

  private jsonToNaturalLanguage(flattenedData: Record<string, any>): string {
    const descriptions: string[] = [];

    for (const [key, value] of Object.entries(flattenedData)) {
      if (Array.isArray(value)) {
        descriptions.push(`The ${key} contains ${value.length} items: ${value.slice(0, 3).join(', ')}${value.length > 3 ? '...' : ''}.`);
      } else {
        descriptions.push(`The ${key} is set to ${JSON.stringify(value)}.`);
      }
    }

    return descriptions.join(' ');
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }
}