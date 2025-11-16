import type { Server } from 'bun';
import { createMongoStorage } from './storage/mongodb';
import { createScrapeHandlers } from './api/scrape';
import { createDocumentHandlers } from './api/documents';

export const createServer = async (): Promise<Server> => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/scrapient';

  const storage = await createMongoStorage(mongoUri);
  const scrapeHandlers = createScrapeHandlers(storage);
  const documentHandlers = createDocumentHandlers(storage);

  const router = async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    if (method === 'POST' && path === '/api/scrape') {
      return scrapeHandlers.handleScrape(req);
    }

    if (method === 'GET' && path === '/api/documents') {
      return documentHandlers.handleListDocuments(req);
    }

    if (method === 'GET' && path.startsWith('/api/documents/') && path.split('/').length === 4) {
      return documentHandlers.handleGetDocument(req);
    }

    if (method === 'DELETE' && path.startsWith('/api/documents/') && path.split('/').length === 4) {
      return documentHandlers.handleDeleteDocument(req);
    }

    if (method === 'DELETE' && path === '/api/documents') {
      return documentHandlers.handleDeleteMany(req);
    }

    if (method === 'GET' && path === '/api/health') {
      return new Response(
        JSON.stringify({ status: 'healthy' }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (method === 'GET') {
      if (path === '/' || path === '/index.html') {
        try {
          const indexFile = Bun.file('./dashboard/index.html');
          return new Response(indexFile, {
            headers: { 'Content-Type': 'text/html' }
          });
        } catch (error) {
          console.error('Error serving index.html:', error);
        }
      }

      if (path === '/app.js') {
        try {
          const result = await Bun.build({
            entrypoints: ['./dashboard/app.ts'],
            target: 'browser',
            format: 'iife',
            minify: false
          });

          if (!result.success) {
            throw new Error('Build failed');
          }

          const output = await result.outputs[0].text();
          return new Response(output, {
            headers: { 'Content-Type': 'application/javascript' }
          });
        } catch (error) {
          console.error('Error serving app.js:', error);
          return new Response(
            JSON.stringify({ error: 'Failed to build app.js' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }

      if (path === '/styles.css') {
        try {
          const cssFile = Bun.file('./dashboard/styles/main.css');
          return new Response(cssFile, {
            headers: { 'Content-Type': 'text/css' }
          });
        } catch (error) {
          console.error('Error serving styles.css:', error);
        }
      }
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const port = parseInt(process.env.PORT || '3000');

  const server = Bun.serve({
    port,
    fetch: router
  });

  console.log(`🕷️ Scrapient server running on http://localhost:${port}`);

  return server;
};

if (import.meta.main) {
  await createServer();
}