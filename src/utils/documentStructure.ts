import { z } from 'zod';

export const DocumentElementSchema = z.object({
  type: z.enum(['heading', 'paragraph', 'list', 'table', 'image', 'code', 'formula', 'quote']),
  level: z.number().optional(),
  content: z.string(),
  position: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }).optional(),
  confidence: z.number().min(0).max(1),
  attributes: z.record(z.any()).optional(),
});

export const LayoutInfoSchema = z.object({
  columns: z.number().min(1),
  orientation: z.enum(['portrait', 'landscape']),
  textDensity: z.number(),
  hasImages: z.boolean(),
  hasTables: z.boolean(),
  margins: z.object({
    top: z.number(),
    right: z.number(),
    bottom: z.number(),
    left: z.number(),
  }).optional(),
});

export const ProcessingMetadataSchema = z.object({
  processingMethod: z.enum(['docling', 'text-only']),
  llmModel: z.string().optional(),
  tokensUsed: z.number().optional(),
  processingTime: z.number(),
  confidence: z.number().min(0).max(1),
  complexityScore: z.number().min(0).max(1).optional(),
});

export const PageStructureSchema = z.object({
  pageNumber: z.number(),
  elements: z.array(DocumentElementSchema),
  layout: LayoutInfoSchema,
  metadata: ProcessingMetadataSchema,
  rawText: z.string(),
  markdown: z.string(),
});

export const DocumentStructureSchema = z.object({
  metadata: z.object({
    title: z.string().optional(),
    author: z.string().optional(),
    pages: z.number(),
    processingDate: z.string(),
    totalWords: z.number(),
    totalCharacters: z.number(),
    averageConfidence: z.number().min(0).max(1),
    processingMethod: z.enum(['docling', 'text-only']),
  }),
  pages: z.array(PageStructureSchema),
  combined: z.object({
    markdown: z.string(),
    plainText: z.string(),
    wordCount: z.number(),
    characterCount: z.number(),
  }),
});

export type DocumentElement = z.infer<typeof DocumentElementSchema>;
export type LayoutInfo = z.infer<typeof LayoutInfoSchema>;
export type ProcessingMetadata = z.infer<typeof ProcessingMetadataSchema>;
export type PageStructure = z.infer<typeof PageStructureSchema>;
export type DocumentStructure = z.infer<typeof DocumentStructureSchema>;

export const createDocumentStructureBuilder = () => {
  const parseMarkdownToElements = (markdown: string): DocumentElement[] => {
    const elements: DocumentElement[] = [];
    const lines = markdown.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed) continue;

      // Headings
      const headingMatch = trimmed.match(/^(#+)\s+(.+)$/);
      if (headingMatch) {
        elements.push({
          type: 'heading',
          level: headingMatch[1].length,
          content: headingMatch[2],
          confidence: 0.9,
        });
        continue;
      }

      // Lists
      if (trimmed.match(/^[-*+]\s+/) || trimmed.match(/^\d+\.\s+/)) {
        elements.push({
          type: 'list',
          content: trimmed.replace(/^[-*+]\s+|^\d+\.\s+/, ''),
          confidence: 0.8,
        });
        continue;
      }

      // Code blocks
      if (trimmed.startsWith('```')) {
        let codeContent = '';
        let j = i + 1;
        while (j < lines.length && !lines[j].trim().startsWith('```')) {
          codeContent += lines[j] + '\n';
          j++;
        }
        elements.push({
          type: 'code',
          content: codeContent.trim(),
          confidence: 0.9,
        });
        i = j; // Skip to end of code block
        continue;
      }

      // Quotes
      if (trimmed.startsWith('>')) {
        elements.push({
          type: 'quote',
          content: trimmed.substring(1).trim(),
          confidence: 0.8,
        });
        continue;
      }

      // Tables (basic detection)
      if (trimmed.includes('|') && trimmed.split('|').length >= 3) {
        elements.push({
          type: 'table',
          content: trimmed,
          confidence: 0.7,
        });
        continue;
      }

      // Formulas (basic detection)
      if (trimmed.match(/[=±∞∑∏∫∂√π]/) || trimmed.includes('\\')) {
        elements.push({
          type: 'formula',
          content: trimmed,
          confidence: 0.6,
        });
        continue;
      }

      // Default to paragraph
      if (trimmed.length > 0) {
        elements.push({
          type: 'paragraph',
          content: trimmed,
          confidence: 0.8,
        });
      }
    }

    return elements;
  };

  const analyzeLayout = (text: string, elements: DocumentElement[]): LayoutInfo => {
    const hasImages = elements.some(el => el.type === 'image');
    const hasTables = elements.some(el => el.type === 'table');

    // Simple column detection based on text patterns
    const lines = text.split('\n').filter(l => l.trim());
    let possibleColumns = 0;

    for (const line of lines) {
      const words = line.trim().split(/\s+/);
      if (words.length > 3) {
        const spacesToTextRatio = (line.length - words.join('').length) / words.join('').length;
        if (spacesToTextRatio > 2) {
          possibleColumns++;
        }
      }
    }

    const columns = possibleColumns > lines.length * 0.3 ? 2 : 1;

    // Calculate text density
    const totalChars = text.length;
    const totalLines = lines.length;
    const textDensity = totalLines > 0 ? totalChars / totalLines : 0;

    // Determine orientation based on content structure
    const headings = elements.filter(el => el.type === 'heading');
    const orientation = headings.length > 5 ? 'portrait' : 'landscape';

    return {
      columns,
      orientation,
      textDensity,
      hasImages,
      hasTables,
    };
  };

  const buildPageStructure = (
    pageNumber: number,
    rawText: string,
    markdown: string,
    processingMetadata: ProcessingMetadata
  ): PageStructure => {
    const elements = parseMarkdownToElements(markdown);
    const layout = analyzeLayout(rawText, elements);

    return {
      pageNumber,
      elements,
      layout,
      metadata: processingMetadata,
      rawText,
      markdown,
    };
  };

  const buildDocumentStructure = (
    pages: PageStructure[],
    originalMetadata?: any
  ): DocumentStructure => {
    const combinedMarkdown = pages.map(page => page.markdown).join('\n\n');
    const combinedText = pages.map(page => page.rawText).join('\n\n');

    const totalWords = combinedText.split(/\s+/).filter(w => w.length > 0).length;
    const totalCharacters = combinedText.length;

    const averageConfidence = pages.reduce((sum, page) => sum + page.metadata.confidence, 0) / pages.length;

    // Determine overall processing method
    const doclingPages = pages.filter(p => p.metadata.processingMethod === 'docling').length;
    const processingMethod = doclingPages > pages.length / 2 ? 'docling' : 'text-only';

    return {
      metadata: {
        title: originalMetadata?.title,
        author: originalMetadata?.author,
        pages: pages.length,
        processingDate: new Date().toISOString(),
        totalWords,
        totalCharacters,
        averageConfidence,
        processingMethod,
      },
      pages,
      combined: {
        markdown: combinedMarkdown,
        plainText: combinedText,
        wordCount: totalWords,
        characterCount: totalCharacters,
      },
    };
  };

  const validateDocumentStructure = (structure: any): DocumentStructure => {
    try {
      return DocumentStructureSchema.parse(structure);
    } catch (error) {
      console.error('Document structure validation failed:', error);
      throw new Error('Invalid document structure format');
    }
  };

  const exportToJSON = (structure: DocumentStructure): string => {
    return JSON.stringify(structure, null, 2);
  };

  const exportToCompactJSON = (structure: DocumentStructure): string => {
    return JSON.stringify(structure);
  };

  return {
    parseMarkdownToElements,
    analyzeLayout,
    buildPageStructure,
    buildDocumentStructure,
    validateDocumentStructure,
    exportToJSON,
    exportToCompactJSON,
  };
};