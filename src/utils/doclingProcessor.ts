import { spawn } from 'child_process';
import { writeFile, unlink, readFile } from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { randomUUID } from 'crypto';

export interface DoclingConfig {
  outputFormat: 'md' | 'json' | 'text';
  timeout: number;
  tempDir: string;
}

export interface DoclingResult {
  content: string;
  metadata: {
    title?: string;
    pages: number;
    processingTime: number;
  };
  format: 'md' | 'json' | 'text';
}

export interface PDFDoclingResult {
  text: string;
  markdown: string;
  json?: any;
  metadata: {
    title?: string;
    pages: number;
    processingTime: number;
    originalName?: string;
  };
}

const DoclingConfigSchema = z.object({
  outputFormat: z.enum(['md', 'json', 'text']).default('md'),
  timeout: z.number().min(1000).max(300000).default(120000), // 2 minutes
  tempDir: z.string().default('/tmp'),
});

export type ValidatedDoclingConfig = z.infer<typeof DoclingConfigSchema>;

const getFileExtension = (format: 'md' | 'json' | 'text'): string => {
  switch (format) {
    case 'md': return 'md';
    case 'json': return 'json';
    case 'text': return 'txt';
    default: return 'md';
  }
};

export const createDoclingProcessor = (config: Partial<DoclingConfig> = {}) => {
  const validatedConfig = DoclingConfigSchema.parse(config);

  const processPDFBuffer = async (buffer: Buffer, originalName?: string): Promise<DoclingResult> => {
    const startTime = Date.now();

    // Sanitize original name to prevent path traversal
    const safeName = originalName ? sanitizeFilename(originalName) : 'document';

    // Use UUID for unique temp file names to prevent conflicts
    const tempFilePath = path.join(validatedConfig.tempDir, `docling_${randomUUID()}.pdf`);
    const tempFiles: string[] = [tempFilePath];

    try {
      // Write PDF buffer to temporary file
      await writeFile(tempFilePath, buffer);

      // Prepare docling command arguments
      const outputDir = validatedConfig.tempDir;
      const args = [
        tempFilePath,
        '--to', validatedConfig.outputFormat,
        '--output', outputDir
      ];

      // Execute docling via subprocess
      const result = await new Promise<{stdout: string, stderr: string}>((resolve, reject) => {
        const child = spawn('docling', args, {
          timeout: validatedConfig.timeout,
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        child.on('close', (code) => {
          if (code === 0) {
            resolve({ stdout, stderr });
          } else {
            reject(new Error(`Docling process exited with code ${code}. stderr: ${stderr}`));
          }
        });

        child.on('error', (error) => {
          reject(new Error(`Failed to spawn docling process: ${error.message}`));
        });

        // Handle timeout
        child.on('timeout', () => {
          reject(new Error(`Docling process timed out after ${validatedConfig.timeout}ms`));
        });
      });

      // Docling generates files with original filename + extension
      // e.g., input.pdf -> input.md, input.json, input.txt
      const originalBasename = path.basename(tempFilePath, '.pdf');
      const expectedOutputFile = path.join(outputDir, `${originalBasename}.${getFileExtension(validatedConfig.outputFormat)}`);
      tempFiles.push(expectedOutputFile);

      // Read the output file
      let content: string;
      try {
        const outputBuffer = await readFile(expectedOutputFile);
        content = outputBuffer.toString('utf-8');
      } catch (readError) {
        // Fallback to stdout if output file couldn't be read
        content = result.stdout;
      }

      const processingTime = Date.now() - startTime;

      // Extract basic metadata from content
      const metadata = extractMetadataFromContent(content, originalName);

      return {
        content,
        metadata: {
          ...metadata,
          processingTime,
        },
        format: validatedConfig.outputFormat,
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error('Docling processing error:', error);
      throw new Error(`Failed to process PDF with Docling: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      // Clean up temporary files
      try {
        for (const filePath of tempFiles) {
          await unlink(filePath);
        }
      } catch (cleanupError) {
        console.warn('Failed to clean up temporary files:', cleanupError);
      }
    }
  };

  const processPDFFromURL = async (url: string): Promise<PDFDoclingResult> => {
    try {
      // Download PDF from URL
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: HTTP ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Extract and sanitize original filename from URL
      const parsedUrl = new URL(url);
      const rawName = parsedUrl.pathname.split('/').pop()?.replace(/\.pdf$/i, '') || 'document';
      const originalName = sanitizeFilename(rawName);

      // Process with different formats
      const markdownProcessor = createDoclingProcessor({ ...validatedConfig, outputFormat: 'md' });
      const textProcessor = createDoclingProcessor({ ...validatedConfig, outputFormat: 'text' });
      const jsonProcessor = createDoclingProcessor({ ...validatedConfig, outputFormat: 'json' });

      // Process in parallel for efficiency
      const [markdownResult, textResult, jsonResult] = await Promise.allSettled([
        markdownProcessor.processPDFBuffer(buffer, originalName),
        textProcessor.processPDFBuffer(buffer, originalName),
        jsonProcessor.processPDFBuffer(buffer, originalName),
      ]);

      // Extract successful results
      const markdown = markdownResult.status === 'fulfilled' ? markdownResult.value.content : '';
      const text = textResult.status === 'fulfilled' ? textResult.value.content : '';
      let json: any = undefined;

      if (jsonResult.status === 'fulfilled') {
        try {
          json = JSON.parse(jsonResult.value.content);
        } catch (parseError) {
          console.warn('Failed to parse JSON result:', parseError);
        }
      }

      // Use metadata from the first successful result
      const metadata = markdownResult.status === 'fulfilled'
        ? markdownResult.value.metadata
        : textResult.status === 'fulfilled'
        ? textResult.value.metadata
        : { pages: 1, processingTime: 0, title: originalName };

      return {
        text,
        markdown,
        json,
        metadata: {
          ...metadata,
          originalName,
        },
      };

    } catch (error) {
      console.error('PDF URL processing error:', error);
      throw new Error(`Failed to process PDF from URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const extractMetadataFromContent = (content: string, originalName?: string): { title?: string; pages: number } => {
    let title: string | undefined = originalName;
    let pages = 1;

    // Try to extract title from markdown content
    if (content.includes('# ')) {
      const titleMatch = content.match(/^#\s+(.+)$/m);
      if (titleMatch) {
        title = titleMatch[1].trim();
      }
    }

    // Estimate page count (very rough approximation)
    const contentLength = content.length;
    if (contentLength > 0) {
      // Rough estimate: 2500 characters per page
      pages = Math.max(1, Math.ceil(contentLength / 2500));
    }

    return { title, pages };
  };

  return {
    processPDFBuffer,
    processPDFFromURL,
  };
};

// Security helper to sanitize filenames
const sanitizeFilename = (filename: string): string => {
  if (!filename || typeof filename !== 'string') {
    return 'document';
  }

  return filename
    // Remove path separators and dangerous characters
    .replace(/[\/\\:*?"<>|]/g, '_')
    // Remove null bytes
    .replace(/\0/g, '')
    // Remove leading/trailing dots and spaces
    .replace(/^[\.\s]+|[\.\s]+$/g, '')
    // Limit length
    .substring(0, 100)
    // Fallback if empty after sanitization
    || 'document';
};