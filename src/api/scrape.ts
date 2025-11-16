import type { Storage } from '../storage/types';
import type { ExtractedContent } from '../../extensions/shared/types';
import { z } from 'zod';

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

  return { handleScrape };
};