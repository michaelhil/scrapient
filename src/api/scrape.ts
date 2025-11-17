import type { Storage } from '../storage/types';
import type { ExtractedContent } from '../../extensions/shared/types';
import { z } from 'zod';
import { createDoclingProcessor } from '../utils/doclingProcessor';

const ExtractedContentSchema = z.object({
  url: z.string().url(),
  domain: z.string(),
  title: z.string(),
  content: z.object({
    html: z.string(),
    text: z.string(),
    markdown: z.string(),
    metadata: z.record(z.any()),
    images: z.array(z.string())
  }),
  scrapedAt: z.string().or(z.date()),
  contentType: z.literal('webpage')
});

export const createScrapeHandlers = (storage: Storage) => {
  const handleScrape = async (req: Request): Promise<Response> => {
    try {
      const body = await req.json();

      const validatedContent = ExtractedContentSchema.parse(body);

      const document = {
        url: validatedContent.url,
        domain: validatedContent.domain,
        title: validatedContent.title,
        scrapedAt: new Date(validatedContent.scrapedAt),
        contentType: 'webpage' as const,
        content: {
          html: validatedContent.content.html,
          text: validatedContent.content.text,
          markdown: validatedContent.content.markdown,
          metadata: validatedContent.content.metadata,
          images: validatedContent.content.images
        }
      };

      const id = await storage.save(document);

      return new Response(
        JSON.stringify({ success: true, id }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Headers': 'Content-Type'
          }
        }
      );

    } catch (error) {
      console.error('Scrape error:', error);

      const errorMessage = error instanceof z.ZodError
        ? 'Invalid request data'
        : error instanceof Error
        ? error.message
        : 'Internal server error';

      return new Response(
        JSON.stringify({ success: false, error: errorMessage }),
        {
          status: error instanceof z.ZodError ? 400 : 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  };

  const handlePDFScrape = async (req: Request): Promise<Response> => {
    return handleDoclingPDFScrape(req);
  };

  const handleDoclingPDFScrape = async (req: Request): Promise<Response> => {
    try {
      const body = await req.json();
      const {
        url,
        output_format = 'md',
        timeout = 120000
      } = body;

      if (!url || typeof url !== 'string') {
        throw new Error('URL is required and must be a string');
      }

      if (!url.toLowerCase().endsWith('.pdf')) {
        throw new Error('URL must point to a PDF file');
      }

      // Create Docling processor with configuration
      const doclingProcessor = createDoclingProcessor({
        outputFormat: output_format,
        timeout: timeout,
        tempDir: '/tmp',
      });

      const result = await doclingProcessor.processPDFFromURL(url);
      const parsedUrl = new URL(url);

      const document = {
        url: url,
        domain: parsedUrl.hostname,
        title: result.metadata.title || parsedUrl.pathname.split('/').pop()?.replace(/\.pdf$/i, '') || 'PDF Document',
        scrapedAt: new Date(),
        contentType: 'pdf' as const,
        content: {
          text: result.text,
          markdown: result.markdown,
          ...(result.json && { structure: result.json }),
          metadata: {
            processingMethod: 'docling',
            totalPages: result.metadata.pages,
            processingTime: result.metadata.processingTime,
            originalName: result.metadata.originalName,
          },
        }
      };

      const id = await storage.save(document);

      return new Response(
        JSON.stringify({
          success: true,
          id,
          document: {
            text: result.text,
            markdown: result.markdown,
            ...(result.json && { json: result.json }),
          },
          processing: {
            method: 'docling',
            totalTime: result.metadata.processingTime,
            pagesProcessed: result.metadata.pages,
            format: output_format,
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Headers': 'Content-Type'
          }
        }
      );

    } catch (error) {
      console.error('Docling PDF scrape error:', error);

      const errorMessage = error instanceof Error ? error.message : 'Failed to process PDF with Docling';

      return new Response(
        JSON.stringify({ success: false, error: errorMessage }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  };

  return { handleScrape, handlePDFScrape, handleDoclingPDFScrape };
};