import { createDoclingProcessor } from '../../utils/doclingProcessor';
import { generateTitle } from '../validators/fileValidator';

export const processPDFFile = async (buffer: Buffer, filename: string) => {
  const doclingProcessor = createDoclingProcessor({
    outputFormat: 'md',
    timeout: 120000,
    tempDir: '/tmp',
  });

  const processed = await doclingProcessor.processPDFBuffer(buffer, filename.replace(/\.pdf$/i, ''));

  return {
    url: `file://${filename}`,
    domain: 'local',
    title: processed.metadata.title || filename.replace(/\.pdf$/i, ''),
    scrapedAt: new Date(),
    contentType: 'pdf' as const,
    content: {
      text: processed.content,
      markdown: processed.content,
      fileData: buffer,
      metadata: {
        processingMethod: 'docling',
        totalPages: processed.metadata.pages,
        processingTime: processed.metadata.processingTime,
        originalName: filename,
        uploadedAt: new Date().toISOString(),
        mimeType: 'application/pdf',
      },
      images: []
    }
  };
};

export const processJSONFile = async (buffer: Buffer, filename: string, mimeType?: string) => {
  const textContent = buffer.toString('utf-8');
  let parsedJson: any;

  try {
    parsedJson = JSON.parse(textContent);
  } catch (parseError) {
    throw new Error(`Invalid JSON file: ${filename}`);
  }

  return {
    url: `file://${filename}`,
    domain: 'local',
    title: generateTitle(textContent, filename),
    scrapedAt: new Date(),
    contentType: 'json' as const,
    content: {
      text: textContent,
      json: parsedJson,
      fileData: buffer,
      metadata: {
        processingMethod: 'direct',
        originalName: filename,
        uploadedAt: new Date().toISOString(),
        mimeType: mimeType || 'application/json',
        fileSize: buffer.length,
      }
    }
  };
};

export const processMarkdownFile = async (buffer: Buffer, filename: string, mimeType?: string) => {
  const textContent = buffer.toString('utf-8');

  return {
    url: `file://${filename}`,
    domain: 'local',
    title: generateTitle(textContent, filename),
    scrapedAt: new Date(),
    contentType: 'markdown' as const,
    content: {
      text: textContent,
      markdown: textContent,
      fileData: buffer,
      metadata: {
        processingMethod: 'direct',
        originalName: filename,
        uploadedAt: new Date().toISOString(),
        mimeType: mimeType || 'text/markdown',
        fileSize: buffer.length,
      }
    }
  };
};

export const processPastedJSON = async (content: string, title?: string) => {
  let parsedJson: any;
  try {
    parsedJson = JSON.parse(content);
  } catch (parseError) {
    throw new Error('Invalid JSON content');
  }

  const documentTitle = title?.trim() || generateTitle(content, 'Untitled');
  const buffer = Buffer.from(content, 'utf-8');

  return {
    url: `paste://json/${Date.now()}`,
    domain: 'local',
    title: documentTitle,
    scrapedAt: new Date(),
    contentType: 'json' as const,
    content: {
      text: content,
      json: parsedJson,
      fileData: buffer,
      metadata: {
        processingMethod: 'paste',
        uploadedAt: new Date().toISOString(),
        mimeType: 'application/json',
        fileSize: buffer.length,
      }
    }
  };
};

export const processPastedMarkdown = async (content: string, title?: string) => {
  const documentTitle = title?.trim() || generateTitle(content, 'Untitled');
  const buffer = Buffer.from(content, 'utf-8');

  return {
    url: `paste://markdown/${Date.now()}`,
    domain: 'local',
    title: documentTitle,
    scrapedAt: new Date(),
    contentType: 'markdown' as const,
    content: {
      text: content,
      markdown: content,
      fileData: buffer,
      metadata: {
        processingMethod: 'paste',
        uploadedAt: new Date().toISOString(),
        mimeType: 'text/markdown',
        fileSize: buffer.length,
      }
    }
  };
};